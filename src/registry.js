/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { EventEmitter } from "node:events";
import { readdirSync, statSync } from "node:fs";
import { platform } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Pen } from "./pen.js";
import { Plugin } from "./plugin.js";
import { watchDir } from "./tools.js";

/**
 * Clean name
 * @param {string} name
 * @returns {string}
 */
export function cleanName(name) {
  return name.trim().toLowerCase();
}

/**
 * @typedef {Object} PluginItem
 * @property {string} name
 * @property {string} location
 * @property {number} estimate
 * @property {import('./plugin.js').Plugin}
 */

/**
 * @enum {string}
 * @readonly
 */
export const RegistryEvents = Object.freeze({
  PLUGIN_LOAD: "plugin:load",
  PLUGIN_ADD: "plugin:add",
  PLUGIN_ERROR: "plugin:error",
  PLUGIN_REMOVE: "plugin:remove",

  WATCH_START: "watch:start",
  WATCH_CLOSE: "watch:close",
  WATCH_STOP: "watch:stop",
  WATCH_ERROR: "watch:error",

  READY: "ready",

  SCAN_START: "scan:start",
  SCAN_END: "scan:end",
});

/**
 * @class PluginRegistry
 * @description Manages the scanning, loading, and watching of plugin files.
 */
export class PluginRegistry extends EventEmitter {
  /**
   * @param {string} pluginDir
   */
  constructor(pluginDir) {
    super();

    /** @type {string} */
    this.pluginDir = pluginDir || path.resolve(process.cwd(), "plugins");

    /** @type {Map<string, PluginItem>} */
    this.plugins = new Map();

    this.isReady = false;

    this.pen = new Pen({ prefix: "reg" });

    this.scan(this.pluginDir);

    this.watcher = watchDir(this.pluginDir, {
      onChange: async (loc) => {
        this.pen.Debug(`Plugin changed:`, loc);
        await this.loadFile(loc);
      },
      onAdd: async (loc) => {
        this.pen.Debug(`Plugin added:`, loc);
        await this.loadFile(loc);
      },
      onRemove: async (loc) => {
        this.pen.Debug(`Plugin removed:`, loc);
        this.removeByLocation(loc);
      },
    });
  }

  /** TODO:: Able to stop watcher */
  /**
   * Stop watching directory for changes
   * @return {Promise<void>}
   */
  async stopWatch() {
    try {
      const watcherInstance = await this.watcher;
      if (watcherInstance) {
        if (typeof watcherInstance.close === "function") {
          await watcherInstance.close();
          this.emit(RegistryEvents.WATCH_CLOSE);
        }
        this.watcher = null;
      }
    } catch (e) {
      this.pen.Error("registry-stop-watch", e);
    }
  }

  /**
   * Scan directory for plugins
   * @param {string} dir
   */
  async scan(dir) {
    this.emit(RegistryEvents.SCAN_START, dir);
    const walk = async (currentDir) => {
      let files = [];
      try {
        files = readdirSync(currentDir);
      } catch (e) {
        this.pen.Error("registry-walk", e);
        return;
      }

      for (const file of files) {
        const loc = path.join(currentDir, file);

        try {
          if (statSync(loc)?.isDirectory() && !file?.startsWith(".")) {
            await walk(loc);
          } else {
            if (loc.endsWith(".js")) await this.loadFile(loc);
          }
        } catch (e) {
          this.pen.Error("registry-walk-stat", e.message);
        }
      }
    };

    await walk(dir);
    this.isReady = true;

    this.emit(RegistryEvents.SCAN_END, dir);
    this.emit(RegistryEvents.READY);
  }

  /**
   * Add plugins to registry
   * @param {PluginItem} item
   */
  add(item) {
    if (!item.name) {
      this.pen.Warn(`Skipped! missing plugin name ${item.location}`);
      return;
    } else {
      if (this.plugins.has(item.name)) {
        this.pen.Warn(`Duplicate name ${item.name}`);
      }
      this.plugins.set(item.name, item);
      this.emit(RegistryEvents.PLUGIN_ADD, {
        name: item.name,
        location: item.location,
      });
    }
  }

  /**
   * Load plugin file
   * @param {string} location
   */
  async loadFile(location) {
    location = path.resolve(location);

    if (!location.endsWith(".js")) return;

    try {
      const filename = location.split("/").pop();

      if (
        filename &&
        (filename.startsWith("_") ||
          filename.startsWith(".") ||
          filename.endsWith(".test.js"))
      ) {
        return;
      }

      const original = location;
      if (platform() === "win32") {
        location = pathToFileURL(location).href;
      }

      const start = Date.now();
      const imported = await import(`${location}?t=${Date.now()}`);
      const estimate = Date.now() - start;

      if (!imported) return;

      this.removeByLocation(original);

      /** @type {Record<string, any>} */
      const items = {};

      if (imported.default) {
        if (Array.isArray(imported.default)) {
          for (const plugin of imported.default) {
            if (plugin.name && typeof plugin.exec === "function") {
              /** @type {PluginItem} */
              const item = {
                name: plugin.name,
                location,
                estimate,
                plugin: new Plugin(plugin),
              };

              this.add(item);
              items[item.name] = {
                cmd: plugin.cmd,
                roles: plugin.roles,
              };
            }
          }
        } else {
          if (typeof imported.default.exec === "function") {
            /** @type {PluginItem} */
            const item = {
              estimate,
              location,
              name: imported.default.name,
              plugin: new Plugin(imported.default),
            };

            this.add(item);
            items[item.name] = {
              cmd: imported.default.cmd,
              roles: imported.default.roles,
            };
          }
        }
      }

      this.emit(RegistryEvents.PLUGIN_LOAD, { location, estimate, items });
    } catch (e) {
      this.pen.Error("registry-load", location, e);
      this.emit(RegistryEvents.PLUGIN_ERROR, { location, error: e });
    }
  }

  /**
   * Remove by location
   * @param {string} location
   */
  removeByLocation(location) {
    const toRemove = [];
    for (const [name, item] of this.plugins.entries()) {
      if (item.location === location) {
        toRemove.push(name);
      }
    }
    for (const name of toRemove) {
      this.remove(name);
    }
  }

  /**
   * Remove plugin from registry
   * @param {string} name
   */
  remove(name) {
    if (this.plugins.has(name)) {
      this.plugins.delete(name);

      this.emit(RegistryEvents.PLUGIN_REMOVE, name);
    }
  }

  /**
   * Get plugin by name
   * @param {string} name
   * @returns {PluginItem|undefined}
   */
  getPlugin(name) {
    return this.plugins.get(name);
  }
}
