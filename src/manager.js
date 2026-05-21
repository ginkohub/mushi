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
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Client } from "./client.js";
import { Handler } from "./handler.js";
import { logger } from "./logger.js";
import { PluginRegistry, RegistryEvents } from "./registry.js";
import { getRoleLevelBadge, rolesToLevel } from "./roles.js";
import { StoreSQLite } from "./store.js";
import { delay } from "./tools.js";

/**
 * @typedef {Object} BotManagerOpts
 * @property {string} baseDir
 * @property {string} pluginDir
 * @property {Record<string, any>} [registryListeners]
 * @property {import('./store.js').Store} [store]
 * @property {import('./api.js').ApiServerOpts} [apiServer]
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

    /** @type {import("./store.js").Store} */
    this.store =
      opts?.store ||
      new StoreSQLite({
        saveName: path.join(this.baseDir, "manager.db"),
        tableName: "bots",
      });

    this.ready = this._init();

    /** @type {PluginRegistry} */
    this.registry = new PluginRegistry(this.pluginDir);

    if (opts?.registryListeners) {
      for (const [key, fn] of Object.entries(opts.registryListeners)) {
        this.registry.on(key, fn);
      }
    }

    /* Register signal handlers */
    ["SIGTERM", "SIGINT"].forEach((signal) => {
      process.once(signal, async () => {
        this.log.info(`Received ${signal}. Stopping all bot instances...`);
        await this.stopAll();
      });
    });
  }

  async _init() {
    await this.store.waitReady();
    this.log.info("Manager store ready.");

    /** Load all bot configs into memory without connecting */
    const keys = this.store.keys();
    for (const id of keys) {
      try {
        const config = this.store.get(id);
        if (config && !this.bots.has(id)) {
          this.addBot(config);
        }
      } catch (e) {
        this.log.error(`Failed to load config for instance ${id} from DB:`, e);
      }
    }
    this.log.info(`Loaded ${this.bots.size} bot(s) from registry.`);
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

    /** Save config to SQLite */
    const savedConfig = { ...config };
    delete savedConfig.handler;
    delete savedConfig.logger;
    if (savedConfig.socketConfig) {
      delete savedConfig.socketConfig.logger;
    }

    /** We use a promise here to not block the sync addBot but still ensure it saves */
    this.store
      .waitReady()
      .then(() => {
        this.store.set(config.name, savedConfig);
        this.log.info(`Config saved to database for bot: ${config.name}`);
      })
      .catch((e) => {
        this.log.error(
          `Failed to save config to database for bot: ${config.name}`,
          e,
        );
      });

    return bot;
  }

  /**
   * Load and connect all instances from database
   */
  async loadAll() {
    await this.store.waitReady();
    const keys = this.store.keys();
    for (const id of keys) {
      try {
        const config = this.store.get(id);
        if (config && !this.bots.has(id)) {
          this.addBot(config);
        }
      } catch (e) {
        this.log.error(`Failed to load config for instance ${id} from DB:`, e);
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
        /** Delay 2s between connections to prevent resource spikes */
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
    if (bot) {
      await bot.disconnect();
      bot.removeAllListeners();
      this.bots.delete(id);
      this.log.info(`Bot ${id} disconnected and removed.`);
    }
  }

  /**
   * Remove a bot completely from memory and database
   * @param {string} id
   */
  async removeBot(id) {
    await this.disconnectBot(id);
    this.store.delete(id);
    this.log.info(`Bot ${id} removed from database.`);
  }

  /**
   * Create and optionally start an API server bound to this manager
   * @param {import('./api.js').ApiServerOpts} [opts]
   * @returns {Promise<import('./api.js').ApiServer>}
   */
  async createApiServer(opts = {}) {
    if (this.apiServer) return this.apiServer;

    const { ApiServer } = await import("./api.js");
    this.apiServer = new ApiServer({
      ...opts,
      manager: this,
      logger: this.log,
    });
    return this.apiServer;
  }
}

/**
 * @param {Record<string, any>} items
 * @returns {string[]|undefined}
 */
function parseItems(items) {
  if (!items) {
    return;
  }

  const parsedItems = [];
  for (const [key, val] of Object.entries(items)) {
    const roles = rolesToLevel(val.roles) || [];
    const rolesMax = roles.length > 0 ? Math.max(...roles) : 0;
    parsedItems.push(`${key}:${getRoleLevelBadge(rolesMax)}`);
  }
  return parsedItems;
}

const baseDir = path.resolve(process.cwd(), "data");
const pluginDir = path.resolve(process.cwd(), "plugins");

export const manager = new BotManager({
  baseDir,
  pluginDir,
  registryListeners: {
    [RegistryEvents.PLUGIN_LOAD]: async (item) => {
      const filename = path.basename(item.location);
      logger.info(
        `Load: ${filename} ${item?.estimate || 0}ms${parseItems(item?.items)?.map((i) => `\n  - ${i}`)}`,
      );
    },
  },
});
