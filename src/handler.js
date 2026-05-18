/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Pen } from "./pen.js";
import { RegistryEvents } from "./registry.js";

/**
 * @typedef {Object} HandlerOpts
 * @property {string[]} [plugins]
 * @property {string[]} prefixs
 * @property {import('./registry.js').PluginRegistry} registry
 */

/**
 * @typedef {Object} Command
 * @property {string} name
 * @property {prefix} prefix
 */

export class Handler {
  /**
   * @param {HandlerOpts} opts
   */
  constructor(opts) {
    /** @type {string[]} */
    this.prefixs = opts?.prefixs?.length > 0 ? opts.prefixs : [".", "/"];

    /** @type {import('./registry.js').PluginRegistry} */
    this.registry = opts.registry;
    if (this.registry.isReady) {
      this.generate();
    } else {
      this.registry.once(RegistryEvents.READY, () => this.generate());
    }

    /** @type {string[]} */
    this.plugins = opts.plugins;

    /** @type {Set<string>} */
    this.plugin_listeners = new Set();

    /** @type {Map<string, Command>} */
    this.plugin_commands = new Map();

    /** @type {boolean} */
    this.isReady = false;

    this.pen = new Pen({ prefix: "hand" });
  }

  /**
   * Get command by pattern
   * @param {string} pattern
   * @returns {{id: string, prefix?: string, cmd: string, plugin:import('./plugin.js').Plugin}|undefined}
   */
  getCMD(pattern) {
    pattern = pattern.trim().toLowerCase();
    if (!pattern) return;
    const data = this.plugin_commands.get(pattern);
    if (!data) return;
    const item = this.registry.getPlugin(data.name);
    if (!item) return;
    return {
      prefix: data.prefix,
      cmd: data.cmd,
      plugin: item.plugin,
    };
  }

  /**
   * Check if given pattern is a command
   * @param {string} p
   * @returns {boolean}
   */
  isCMD(p) {
    if (!p) return false;
    return this.plugin_commands.has(p.toLowerCase());
  }

  /**
   * Generate command and listener for a plugin
   * @param {string} name
   * @param {string|string[]} cmd
   * @param {boolean} noPrefix
   */
  generateCMD(name, cmd, noPrefix) {
    const cmds = Array.isArray(cmd) ? cmd : [cmd];
    for (const cmd of cmds) {
      if (noPrefix) {
        this.plugin_commands.set(cmd.toLowerCase(), {
          name: name,
          prefix: "",
        });
      } else {
        for (const prefix of this.prefixs) {
          this.plugin_commands.set(prefix + cmd.toLowerCase(), {
            name,
            prefix,
          });
        }
      }
    }
  }

  /**
   * Generate command and listener
   */
  generate() {
    this.isReady = false;

    this.plugin_listeners.clear();
    this.plugin_commands.clear();

    const names =
      this.plugins?.length > 0 ? this.plugins : this.registry.plugins.keys();
    const includeNames = [];

    for (const pluginName of names) {
      /** @type {import('./registry.js').PluginItem} */
      const item = this.registry.getPlugin(pluginName);
      if (!item) {
        this.pen.Warn(`Plugin ${pluginName} not found`);
        this.pen.Warn(this.registry.plugins.keys());
        continue;
      }
      if (item.plugin.cmd) {
        this.generateCMD(pluginName, item.plugin.cmd, item.plugin.noPrefix);
      } else {
        this.plugin_listeners.add(pluginName);
      }
      includeNames.push(pluginName);
    }

    this.isReady = true;
    this.pen.Info(
      `${this.plugin_listeners.size} listeners ${this.plugin_commands.size} commands`,
    );
    this.pen.Info(includeNames.join(", "));
  }

  /**
   * @param {import('./context.js').Ctx} c
   */
  async handle(c) {
    try {
      const allTasks = Array.from(this.plugin_listeners.values()).map(
        async (id) => {
          /** @type {import('./registry.js').PluginItem} */
          const item = this.registry.getPlugin(id);
          if (!item) return;
          try {
            const clone = c.clone();

            /** @type {import('./reason.js').Reason} */
            const checked = await item.plugin.check(clone);
            if (!checked?.success) {
              if (item.plugin.onFailed)
                await item.plugin.onFailed(clone, checked);
              return;
            }

            await item.plugin.exec(clone);
          } catch (e) {
            this.pen.Error("handler-handle-listen", e);
            if (item.plugin.onError) await item.plugin.onError(clone, e);
          }
        },
      );

      if (c.pattern?.length > 0) {
        const pattern = c.pattern.toLowerCase();
        const cmd = this.plugin_commands.get(pattern);
        if (cmd) {
          /** @type {import('./registry.js').PluginItem} */
          const item = this.registry.getPlugin(cmd.name);
          if (item) {
            const clone = c.clone();
            allTasks.push(
              (async () => {
                try {
                  /** @type {import('./reason.js').Reason} */
                  const checked = await item.plugin.check(clone);
                  if (!checked?.success) {
                    if (item.plugin.onFailed)
                      await item.plugin.onFailed(clone, checked);
                  } else {
                    await item.plugin.exec(clone);
                  }
                } catch (e) {
                  this.pen.Error("handler-handle-command", e);
                  if (item.plugin.onError) await item.plugin.onError(clone, e);
                }
              })(),
            );
          }
        }
      }

      await Promise.allSettled(allTasks);
    } catch (e) {
      this.pen.Error("handler-handle", e);
    }
  }
}
