/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { readFileSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import logger from "./logger.js";
import { isBun, isDeno, watchDir } from "./tools.js";

/**
 * @typedef {Object} Store
 * @property {string} saveName
 * @property {string} [tableName]
 * @property {boolean} autoSave
 * @property {boolean} autoLoad
 * @property {number} expiration
 * @property {function():Promise<void>} load
 * @property {function():Promise<void>} save
 * @property {function():void} saveCheck
 * @property {function():Promise<void>} close
 * @property {function(key:string, value:any):void} set
 * @property {function(key:string):any} get
 * @property {function(key:string):void} delete
 * @property {function():void} clear
 * @property {function():IterableIterator<string>} keys
 * @property {function(key:string):boolean} has
 * @property {function():Promise<void>} [flush]
 * @property {Promise<void>} waitReady
 * @property {function():void} watch
 * @property {function(tableName:string):StoreSQLite} [use]
 */

/**
 * @typedef {Object} StoreOpts
 * @property {string} saveName
 * @property {string} [tableName]
 * @property {boolean} autoSave
 * @property {boolean} autoLoad
 * @property {number} expiration
 */

/** @type {Set<StoreJson>} */
const activeStore = new Set();

export async function cleanUp() {
  logger.debug("Cleaning up active store store");
  for (const store of Array.from(activeStore)) {
    if (store.saveTimeout) {
      await store.flush();
    }
    await store.close();
    activeStore.delete(store);
  }
}

const signalHandler = async () => {
  await cleanUp();
  process.exit(0);
};
/* Registering clean up for exist */
process.on("SIGINT", signalHandler);
process.on("SIGTERM", signalHandler);
process.on("beforeExit", async () => {
  await cleanUp();
});

/**
 * Sanitize table name
 * @param {string} name - table name
 * @returns {string} - sanitized table name
 */
export function sanitizeTableName(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * @class StoreJson
 * @description Store data in JSON file
 */
export class StoreJson {
  /**
   * @param {StoreOpts} opts
   */
  constructor(opts) {
    if (!opts?.saveName) throw Error("saveName required");

    this.autoSave = opts?.autoSave ?? false;
    this.saveName = opts?.saveName;
    this.expiration = opts?.expiration ?? 0;
    this.autoLoad = opts?.autoLoad ?? false;

    this.saveTimeout = null;
    this._lastSave = 0;
    this._saving = false;
    this.watcher = null;

    /** @type {Record<string, any>} */
    this.data = this._initialLoad();

    if (this.autoLoad) this.watch();
    activeStore.add(this);
  }

  _initialLoad() {
    try {
      const content = readFileSync(this.saveName, "utf8");
      return JSON.parse(content);
    } catch (e) {
      if (e.code !== "ENOENT") logger.error("Failed initial loading data", e);
      return {};
    }
  }

  /**
   * Watch for autoloader
   */
  async watch() {
    if (!this.watcher && this.autoLoad) {
      try {
        this.watcher = await watchDir(this.saveName, {
          onChange: async (loc) => {
            if (Date.now() - this._lastSave < 2000 || this._saving) return;

            logger.debug("Reloading store due to external change:", loc);
            await this.load();
          },
        });
      } catch (e) {
        logger.error("Failed to start watcher", e);
      }
    }
  }

  /**
   * Load data from local storage
   * @param {string} [saveName]
   */
  async load(saveName) {
    try {
      const targetName = saveName ?? this.saveName;
      const content = await readFile(targetName, "utf-8");
      const newData = JSON.parse(content);

      this.data = newData;
    } catch (e) {
      if (e.code !== "ENOENT") logger.error("Failed loading data", e);
    }
  }

  async save() {
    if (this._saving) return;
    this._saving = true;
    try {
      const tempPath = `${this.saveName}.tmp`;
      const content = JSON.stringify(this.data, null, 2);
      await writeFile(tempPath, content, "utf8");
      await rename(tempPath, this.saveName);
      this._lastSave = Date.now();
    } catch (e) {
      logger.error("Failed saving data", e);
    } finally {
      this._saving = false;
    }
  }

  saveCheck() {
    if (this.autoSave) {
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(async () => {
        await this.save();
        this.saveTimeout = null;
      }, 1000);
    }
  }

  async close() {
    if (this.watcher) {
      try {
        const instance = await this.watcher;
        if (instance && typeof instance.close === "function") {
          if (!isDeno) await instance.close();
        }
      } catch (e) {
        logger.error("Failed to close", e);
      }
    }
  }

  /**
   * Set data
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    if (!key) return;

    this.data[key] = value;
    this.saveCheck();
  }

  /**
   * Get data
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    return this.data[key];
  }

  /**
   * Delete data
   * @param {string} key
   */
  delete(key) {
    delete this.data[key];
    this.saveCheck();
  }

  /**
   * Clear all data
   */
  clear() {
    this.data = {};
    this.saveCheck();
  }

  /**
   * Get all keys
   * @returns {IterableIterator<string>}
   */
  keys() {
    return Object.keys(this.data);
  }

  /**
   * Check if key exists
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return key in this.data;
  }

  async flush() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.save();
  }
}

/**
 * Create SQLite connection
 * @param {string} saveName
 * @returns {Promise<import("bun:sqlite").Database | import("node:sqlite").DatabaseSync>}
 */
export async function createSQLite(saveName) {
  if (isBun) {
    const { Database } = await import("bun:sqlite");
    return new Database(saveName);
  } else {
    const { DatabaseSync } = await import("node:sqlite");
    return new DatabaseSync(saveName);
  }
}

/** @type {Record<string, Promise<any>>} */
const connectionList = {};

/**
 * Get or create a shared SQLite connection for a given saveName.
 * Guarantees only one connection is created per saveName.
 * @param {string} saveName
 * @returns {Promise<any>}
 */
function getConnection(saveName) {
  if (!connectionList[saveName]) {
    connectionList[saveName] = createSQLite(saveName);
  }
  return connectionList[saveName];
}

/**
 * @class StoreSQLite
 * @description Store data in SQLite database
 */
export class StoreSQLite {
  /**
   * @param {StoreOpts} opts
   */
  constructor(opts) {
    if (!opts?.saveName) throw new Error("saveName required");
    this.saveName = opts.saveName;
    this.autoSave = opts.autoSave ?? false;
    this.tableName = opts.tableName
      ? sanitizeTableName(opts.tableName)
      : "data";
    /** @type {any} */
    this.db = null;
    this.ready = this._init();
  }

  /** @returns {Promise<void>} */
  waitReady() {
    return this.ready;
  }

  async _init() {
    this.db = await getConnection(this.saveName);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec("PRAGMA foreign_keys=ON");
    await this._load();
  }

  /** @param {string} sql @param {...any} params */
  _run(sql, ...params) {
    return this.db.prepare(sql).run(...params);
  }

  /** @param {string} sql @param {...any} params */
  _get(sql, ...params) {
    return this.db.prepare(sql).get(...params);
  }

  /** @param {string} sql @param {...any} params */
  _all(sql, ...params) {
    return this.db.prepare(sql).all(...params);
  }

  async _load() {
    this._run(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        key   TEXT PRIMARY KEY,
        value BLOB NOT NULL
      )
    `);
  }

  /** No-op — SQLite writes are synchronous. Kept for interface compatibility. */
  save() {}

  /**
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    if (!key) return;
    this._run(
      `INSERT OR REPLACE INTO ${this.tableName} (key, value) VALUES (?, ?)`,
      key,
      JSON.stringify(value),
    );
  }

  /**
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    if (!key) return undefined;
    const row = this._get(
      `SELECT value FROM ${this.tableName} WHERE key = ?`,
      key,
    );
    if (!row) return undefined;
    return JSON.parse(row.value);
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    if (!key || typeof key !== "string") return false;
    return (
      this._get(`SELECT 1 FROM ${this.tableName} WHERE key = ?`, key) !==
      undefined
    );
  }

  /**
   * @param {string} key
   */
  delete(key) {
    if (!key) return;
    this._run(`DELETE FROM ${this.tableName} WHERE key = ?`, key);
  }

  clear() {
    this._run(`DELETE FROM ${this.tableName}`);
  }

  /**
   * @returns {string[]}
   */
  keys() {
    return this._all(`SELECT key FROM ${this.tableName}`).map((row) => row.key);
  }

  /**
   * Return a new StoreSQLite scoped to a different table,
   * reusing the already-open connection once it's ready.
   * Safe to call before `await waitReady()`.
   * @param {string} tableName
   * @returns {StoreSQLite}
   */
  use(tableName) {
    const child = Object.create(StoreSQLite.prototype);
    child.saveName = this.saveName;
    child.autoSave = this.autoSave;
    child.tableName = sanitizeTableName(tableName);
    child.db = null;
    child.ready = this.ready.then(() => {
      child.db = this.db;
      return child._load();
    });
    return child;
  }

  /**
   * Create a StoreSQLite instance with an existing connection, skipping _init().
   * @param {any} db
   * @param {StoreOpts} opts
   * @returns {StoreSQLite}
   */
  static _fromConnection(db, opts) {
    const instance = Object.create(StoreSQLite.prototype);
    instance.saveName = opts.saveName;
    instance.autoSave = opts.autoSave ?? false;
    instance.tableName = opts.tableName ?? "data";
    instance.db = db;
    instance.ready = instance._load();
    return instance;
  }
}
