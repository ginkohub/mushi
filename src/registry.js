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
 * @typedef {Object} PluginItem
 * @property {string} location
 * @property {string} id
 * @property {import('./plugin.js').Plugin}
 */

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

    this.pen = new Pen({ prefix: "registry" });

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
      const watcherIntance = await this.watcher;
      if (watcherIntance) {
        if (typeof watcherIntance.close === "function") {
          await watcherIntance.close();
          this.emit("watch", "closed");
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
    this.emit("ready");
  }

  /**
   * Add plugins to registry
   * @param {...PluginItem} items
   */
  add(...items) {
    for (const item of items) {
      if (!item.name) {
        this.pen.Warn(`Skipped! missing plugin name ${item.location}`);
        continue;
      }
      if (this.plugins.has(item.name)) {
        this.pen.Warn(`Duplicate name ${item.name}`);
      }
      this.plugins.set(item.name, item);
      this.emit("plugin-add", item.name, item.location);
    }
  }

  /**
   * Load plugin file
   * @param {string} loc
   */
  async loadFile(loc) {
    loc = path.resolve(loc);

    if (!loc.endsWith(".js")) return;

    try {
      const filename = loc.split("/").pop();

      if (
        filename &&
        (filename.startsWith("_") ||
          filename.startsWith(".") ||
          filename.endsWith(".test.js"))
      ) {
        return;
      }

      const originalLoc = loc;
      if (platform() === "win32") {
        loc = pathToFileURL(loc).href;
      }

      const imported = await import(`${loc}?t=${Date.now()}`);
      if (!imported) return;

      this.removeByLocation(originalLoc);

      /** @type {Array<{location: string, names: Array<string>}>} */
      const items = [];

      if (imported.default) {
        if (Array.isArray(imported.default)) {
          const names = [];
          for (const plugin of imported.default) {
            if (plugin.name && typeof plugin.exec === "function") {
              /** @type {PluginItem} */
              const item = {
                location: loc,
                name: plugin.name,
                plugin: new Plugin(plugin),
              };

              this.add(item);
              names.push(item.name);
            }
          }
          items.push({ names, location: loc });
        } else {
          if (typeof imported.default.exec === "function") {
            /** @type {PluginItem} */
            const item = {
              location: loc,
              name: imported.default.name,
              plugin: new Plugin(imported.default),
            };

            this.add(item);
            items.push({ names: [item.name], location: loc });
          }
        }
      }

      /* Notify for loaded */
      this.emit("load-file", ...items);
    } catch (e) {
      this.pen.Error("registry-load", loc, e);
    }
  }

  /**
   * Remove by location
   * @param {string} loc
   */
  removeByLocation(loc) {
    for (const [name, item] of this.plugins.entries()) {
      if (item.location === loc) {
        this.remove(name);
      }
    }
  }

  /**
   * Remove plugin from registry
   * @param {string} name
   */
  remove(name) {
    if (this.plugins.has(name)) {
      this.plugins.delete(name);

      /* Notify for remove */
      this.emit("remove", name);
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
