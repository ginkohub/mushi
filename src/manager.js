/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import path from 'path';
import pen, { Pen } from './pen.js';
import * as chokidar from 'chokidar';
import { hashCRC32 } from './tools.js';
import { Plugin } from './plugin.js';
import { pathToFileURL } from 'url';
import { readdirSync, statSync } from 'fs';
import { platform } from 'process';

/** @typedef {function(number, string, PluginManager): Promise<void>} doneCallback */
/** @typedef {function(import('./plugin.js').Plugin, PluginManager): boolean} pluginFilter */
/** @typedef {function(string, PluginManager): Promise<void>} updateCallback */

/** 
 * @typedef {Object} PluginResultItem
 * @property {string} pluginKey
 * @property {string} pluginPath
 * @property {string} [prefix]
 * @property {() => import('./plugin.js').Plugin} getPlugin
 */

/**
 * @typedef {Object} PluginResult
 * @property {number} updatedAt
 * @property {{string: PluginResultItem}} listener
 * @property {{string: PluginResultItem}} command
 */

/**
 * @typedef {Object} ManageOptions
 * @property {string} pluginDir - The path to the plugin directory.
 * @property {import('./pen.js').Pen} pen - Pen logging interface.
 * @property {doneCallback[]} doneScanCallbacks - Callbacks to call when the scan is done.
 */

export class PluginManager {

  /** @type {import('./pen.js').Pen} */
  #pen

  /** @type {import('chokidar').FSWatcher} */
  #watcher

  /**
   * @param {ManageOptions} opts
   */
  constructor(opts) {

    /** @type {number} */
    this.updatedAt = Date.now();

    /** @type {string} */
    this.pluginDir = opts.pluginDir ?? path.join(import.meta.dirname, '../plugins');

    /** @type {import('./pen.js').Pen} */
    this.#pen = opts.pen ?? new Pen({ prefix: 'PM' });

    /** @type{Map<string, {string: Record<string, import('./plugin.js').Plugin}>>} */
    this.plugins = new Map();

    /** @type {Map<string, updateCallback>} */
    this.updateCallbacks = new Map();

    /* Watch changes in pluginDir */
    /** @type {import('chokidar').FSWatcher} */
    this.#watcher = chokidar.watch(this.pluginDir, {
      ignoreInitial: true,
      usePolling: false,
      interval: 1000,
    })
      .on('change', (filePath) => {
        this.#pen.Debug(`Plugin changed:`, filePath);
        this.loadFile(filePath, true);
      })
      .on('add', (filePath) => {
        this.#pen.Debug(`Add :`, filePath);
        this.loadFile(filePath, true);
      })
      .on('unlink', (filePath) => {
        this.#pen.Debug(`Remove :`, filePath);
        this.remove(filePath, true);
      });

    if (!opts?.doneScanCallbacks) opts.doneScanCallbacks = [];
    this.scanPlugin(this.pluginDir, 0, ...opts?.doneScanCallbacks);
  }

  /** @returns {import('./pen.js').Pen} */
  pen() { return this.#pen; }

  /** @returns {import('chokidar').FSWatcher} */
  watcher() { return this.#watcher; }

  /**
   * Plugin scanner for given directory
   * @param {string} dir
   * @param {number} level 
   * @param {Function[]} doneCallbacks
   */
  async scanPlugin(dir, level, ...doneCallbacks) {
    if (!level) level = 0;
    let files = [];

    try {
      files = readdirSync(dir);
      for (const file of files) {
        let filePath = `${dir}/${file}`.replace('//', '/');

        try {
          if (statSync(filePath)?.isDirectory()) await this.scanPlugin(filePath, level + 1, ...doneCallbacks);
        } catch (e) {
          this.#pen.Error('scan-plugin-stat', e.message);
        }

        await this.loadFile(filePath);
      }
    } catch (e) {
      this.#pen.Error('scan-plugin', e);
    } finally {
      for (const doneCallback of doneCallbacks) {
        await doneCallback(level, dir, this);
      }
    }
  }

  async remove(filePath) {
    this.plugins.delete(filePath);
  }

  /**
   * @param {string} path
   * @param {import('./plugin.js').Plugin[]} plugins
   */
  async add(filePath, ...plugins) {
    const hashPath = hashCRC32(filePath);
    try {
      if (this.plugins.has(filePath)) this.plugins.delete(filePath);
      this.plugins.set(filePath, {});
      for (let [id, plugin] of plugins?.entries()) {
        const key = `${hashPath}-${id}`;
        plugin.location = filePath;
        this.plugins.get(filePath)[key] = new Plugin(plugin);
      }
      this.updateAt = Date.now();
    } catch (e) {
      this.#pen.Error('add-plugin', filePath, '\n', e);
    }
  }

  /**
   * Load plugin file from given filePath
   * @param {string} filePath
   * @param {boolean} isUpdate
   */
  async loadFile(filePath, isUpdate) {
    if (filePath.endsWith('.js')) {
      try {
        const filename = filePath.split('/').pop();
        const loggedName = filePath?.split('/')?.slice(-2)?.join('/');
        if (
          filename.startsWith('_') ||
          filename.startsWith('.') ||
          filename.endsWith('.test.js')
        ) {
          this.#pen.Debug('Skip:', loggedName);
          return;
        }

        if (platform === 'win32') {
          filePath = pathToFileURL(filePath).href;
        }

        const loaded = await import(`${filePath}?t=${Date.now()}`);
        let def = 0;

        if (loaded.default) {
          if (Array.isArray(loaded.default)) {
            this.add(filePath, ...loaded.default);
            def = loaded.default.length;
          } else {
            this.add(filePath, loaded.default);
            def = 1;
          }
        }

        if (def > 0) {
          this.updatedAt = Date.now();

          const msgs = ['Loaded', `${def} default`, loggedName];
          this.#pen.Debug(...msgs);

          if (isUpdate) {
            for (const [key, updateCallback] of this.updateCallbacks) {
              this.#pen.Debug(`Update callback for ${key}`);
              try {
                updateCallback(filePath, this);
              } catch (e) {
                this.#pen.Error('update-callback', key, '\n', e);
              }
            }
          }
        }
      } catch (e) {
        this.#pen.Error('load-file', filePath, '\n', e);
      }
    }
  }

  /**
   * Get plugin by filePath and pluginKey
   * @param {string} filePath
   * @param {string} pluginKey
   * @returns {import('./plugin.js').Plugin}
   */
  getPlugin(filePath, pluginKey) {
    return this.plugins?.get(filePath)?.[pluginKey];
  }

  /**
   * Generate plugins for given prefix and filter
   * @param {string[]} prefix
   * @param {pluginFilter} filter
   * @param {{unique: string, callback: updateCallback}} updateCallback
   * @returns {PluginResult}
   */
  genPlugins(prefix, filter, updateCallback) {

    if (!prefix || !Array.isArray(prefix)) prefix = [];

    /** @type {PluginResult} */
    const plugins = {
      updatedAt: this.updatedAt,
      listener: {},
      command: {}
    }

    for (const [filePath, pluginMap] of this.plugins.entries()) {
      for (const [key, plugin] of Object.entries(pluginMap)) {
        if (filter && !filter(plugin, this)) continue;
        if (!plugin?.cmd) {
          plugins.listener[key] = {
            pluginKey: key,
            pluginPath: filePath,
            getPlugin: () => this.getPlugin(filePath, key)
          };
        } else {
          const cmds = [];
          if (Array.isArray(plugin?.cmd)) {
            cmds.push(...plugin.cmd);
          } else if (typeof plugin?.cmd === 'string') {
            cmds.push(plugin.cmd);
          }

          for (const cmd of cmds) {
            if (prefix?.length > 0) {
              prefix.map((p) => {
                const preCmd = p + cmd;
                plugins.command[preCmd] = {
                  prefix: p,
                  pluginKey: key,
                  pluginPath: filePath,
                  getPlugin: () => this.getPlugin(filePath, key)
                };
              });
            } else {
              plugins.command[cmd] = {
                pluginKey: key,
                pluginPath: filePath,
                getPlugin: () => this.getPlugin(filePath, key)
              }
            }
          }
        }
      }
    }

    if (updateCallback) this.updateCallbacks.set(updateCallback.unique, updateCallback.callback);
    return plugins;
  }

}
