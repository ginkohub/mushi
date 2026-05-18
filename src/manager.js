/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import EventEmitter from "node:events";
import fs from "node:fs";
import path from "node:path";
import { Client } from "./client.js";
import { Handler } from "./handler.js";
import { Pen } from "./pen.js";
import { PluginRegistry } from "./registry.js";
import { delay } from "./tools.js";

/**
 * @typedef {Object} BotManagerOpts
 * @property {string} baseDir
 * @property {string} pluginDir
 * @property {Record<string, any>} [registryListeners]
 */

/**
 * @class BotManager
 * @description class for handling multiple WhatsApp bot instances
 */
export class BotManager extends EventEmitter {
  /** @param {BotManagerOpts} opts */
  constructor(opts) {
    super();

    this.pen = new Pen({ prefix: "mgr", format: "" });

    /** @type {Map<string, import('./client.js').Client>} */
    this.bots = new Map();

    /** @type {string} */
    this.baseDir = opts?.baseDir || path.resolve(process.cwd(), "data");

    /** @type {string} */
    this.pluginDir = opts?.pluginDir || path.resolve(process.cwd(), "plugins");

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    /** @type {PluginRegistry} */
    this.registry = new PluginRegistry(this.pluginDir);

    if (opts?.registryListeners) {
      for (const [key, fn] of Object.entries(opts.registryListeners)) {
        this.registry.on(key, fn);
      }
    }

    /* Register signal handlers */
    ["SIGTERM", "SIGINT"].forEach((signal) => {
      process.on(signal, async () => {
        this.pen.Info(`Received ${signal}. Stopping all bot instances...`);
        await this.stopAll();
      });
    });
  }

  /**
   * Get a bot instance by ID
   * @param {string} name
   * @returns {import('./client.js').Client|undefined}
   */
  getBot(name) {
    return this.bots.get(name);
  }

  /**
   * Add and initialize a new bot instance from config
   * @param {import('./client.js').ClientOpts} config
   * @returns {import('./client.js').Client|undefined}
   */
  addBot(config) {
    if (this.bots.has(config.name)) {
      this.pen.Warn(
        `Bot instance ${config.name} already exists. Skipping initialization.`,
      );
      return this.bots.get(config.name);
    }

    config.handler = new Handler({
      registry: this.registry,
      prefixs: config.prefixs || [".", "/"],
      plugins: config.plugins || [],
    });

    if (this.registry.isReady) {
      config.handler.generate();
    } else {
      this.registry.once("ready", () => {
        config.handler.generate();
      });
    }

    config.botDir = config.botDir || path.join(this.baseDir, config.name);
    const bot = new Client(config);

    this.bots.set(config.name, bot);
    return bot;
  }

  /**
   * Load and connect all instances found in baseDir
   */
  async loadAll() {
    if (!fs.existsSync(this.baseDir)) return;
    const folders = fs.readdirSync(this.baseDir);
    for (const id of folders) {
      const configFile = path.join(this.baseDir, id, "config.json");
      if (fs.existsSync(configFile)) {
        try {
          const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
          this.addBot(config);
        } catch (e) {
          this.pen.Error(`Failed to load config for instance ${id}:`, e);
        }
      }
    }
    return this.connectAll();
  }

  /**
   * Connect all bot instances
   * @returns {Promise<void>}
   */
  async connectAll() {
    for (const [id, bot] of this.bots) {
      this.pen.Info(`Connecting bot: ${id}`);
      try {
        await bot.connect();
        // Delay 2s between connections to prevent resource spikes
        await delay(2000);
      } catch (e) {
        this.pen.Error(`Failed to connect bot ${id}:`, e);
      }
    }
  }

  /**
   * Stop all bot instances
   */
  async stopAll() {
    pen.Info("Stopping all bot instances...");
    const promises = [];
    for (const id of this.bots.keys()) {
      promises.push(this.disconnectBot(id));
    }
    await Promise.all(promises);
  }

  /**
   * Disconnect a specific bot
   * @param {string} id
   */
  async disconnectBot(id) {
    const bot = this.getBot(id);
    if (bot?.sock) {
      bot.sock.end();
      this.bots.delete(id);
      this.pen.Info(`Bot ${id} disconnected and removed.`);
    }
  }
}
