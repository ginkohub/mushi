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

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { logger } from "./logger.js";
import { Client } from "./client.js";
import { Handler } from "./handler.js";
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

    this.log = logger.child("manager");

    /** @type {Map<string, import('./client.js').Client>} */
    this.bots = new Map();

    /** @type {string} */
    this.baseDir = opts?.baseDir || path.resolve(process.cwd(), "data");

    /** @type {string} */
    this.pluginDir = opts?.pluginDir || path.resolve(process.cwd(), "plugins");

    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
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
        this.log.info(`Received ${signal}. Stopping all bot instances...`);
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
      this.log.warn(
        `Bot instance ${config.name} already exists. Skipping initialization.`,
      );
      return this.bots.get(config.name);
    }

    config.handler = new Handler({
      registry: this.registry,
      prefixes: config.prefixes,
      plugins: config.plugins || [],
    });

    config.botDir = config.botDir || path.join(this.baseDir, config.name);
    const bot = new Client(config);

    this.bots.set(config.name, bot);
    return bot;
  }

  /**
   * Load and connect all instances found in baseDir
   */
  async loadAll() {
    if (!existsSync(this.baseDir)) return;
    const folders = readdirSync(this.baseDir);
    for (const id of folders) {
      const configFile = path.join(this.baseDir, id, "config.json");
      if (existsSync(configFile)) {
        try {
          const config = JSON.parse(readFileSync(configFile, "utf8"));
          this.addBot(config);
        } catch (e) {
          this.log.error(`Failed to load config for instance ${id}:`, e);
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
      this.log.info(`Connecting bot: ${id}`);
      try {
        await bot.connect();
        // Delay 2s between connections to prevent resource spikes
        await delay(2000);
      } catch (e) {
        this.log.error(`Failed to connect bot ${id}:`, e);
      }
    }
  }

  /**
   * Stop all bot instances
   * @returns {Promise<void>}
   */
  async stopAll() {
    this.log.info("Stopping all bot instances...");
    const promises = [];
    for (const id of this.bots.keys()) {
      promises.push(this.disconnectBot(id));
    }
    await Promise.all(promises);
  }

  /**
   * Disconnect a specific bot
   * @param {string} id
   * @returns {Promise<void>}
   */
  async disconnectBot(id) {
    const bot = this.getBot(id);
    if (bot?.sock) {
      bot.sock.end();
      this.bots.delete(id);
      this.log.info(`Bot ${id} disconnected and removed.`);
    }
  }
}
