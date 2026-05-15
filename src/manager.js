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
import pen from "./pen.js";
import { PluginRegistry } from "./registry.js";
import { delay } from "./tools.js";

/**
 * @class BotManager
 * @description class for handling multiple WhatsApp bot instances
 */
export class BotManager extends EventEmitter {
  constructor(baseDir = "data", pluginDir = "plugins") {
    super();

    /** @type {Map<string, import('./client.js').Client>} */
    this.bots = new Map();

    /** @type {string} */
    this.baseDir = baseDir || process.cwd();

    /** @type {string} */
    this.pluginDir =
      pluginDir || path.resolve(path.resolve(process.cwd(), "plugins"));

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    /** @type {PluginRegistry} */
    this.registry = new PluginRegistry(this.pluginDir);

    /* Register signal handlers */
    ["SIGTERM", "SIGINT"].forEach((signal) => {
      process.on(signal, async () => {
        pen.Info(`Received ${signal}. Stopping all bot instances...`);
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
      pen.Warn(
        `Bot instance ${config.name} already exists. Skipping initialization.`,
      );
      return this.bots.get(config.name);
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
          pen.Error(`Failed to load config for instance ${id}:`, e);
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
      pen.Info(`Connecting bot: ${id}`);
      try {
        await bot.connect();
        // Delay 2s between connections to prevent resource spikes
        await delay(2000);
      } catch (e) {
        pen.Error(`Failed to connect bot ${id}:`, e);
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
      pen.Info(`Bot ${id} disconnected and removed.`);
    }
  }
}
