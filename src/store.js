/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import pen from './pen.js';
import fs from 'node:fs';
import { isBun, watchDir } from './tools.js';

/**
 * Store data in JSON file
 */
export class StoreJson {
  /**
   * @param {{saveName?: string, autoSave?: boolean, autoLoad?: boolean, expiration?: number}} opts
   */
  constructor({ saveName, autoSave, autoLoad, expiration }) {
    if (!saveName) throw Error('saveName required');

    /** @type {Record<string, any>} */
    this.data = {};

    this.autoSave = autoSave ?? false;
    this.saveName = saveName;
    this.expiration = expiration ?? 0;
    this.saveState = true;
    this.saveTimeout = null;
    this.autoLoad = autoLoad ?? false;

    this.load();
    this.watch();
  }

  /**
   * Watch for autoloader
   */
  async watch() {
    if (!this.watcher && this.autoLoad) {
      try {
        this.watcher = watchDir(this.saveName, {
          onChange: (loc) => {
            if (!this.saveState) {
              pen.Debug('Reload', loc)
              this.load();
            } else {
              this.saveState = false;
            }
          }
        });
      } catch { }
    }
  }

  /**
   * Load data from local storage
   * @param {string} [saveName]
   */
  async load(saveName) {
    /* Read json data local storage */
    try {
      this.data = JSON.parse(fs.readFileSync(saveName ?? this.saveName, 'utf8'));
    } catch (e) {
      pen.Error(e.message);
      this.data = {};
    }
  }

  save() {
    try {
      const tempPath = this.saveName + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.saveName);
      this.saveState = true;
    } catch (e) {
      pen.Error('Failed saving data', e);
    }
  }

  saveCheck() {
    if (this.autoSave) {
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => {
        this.save();
        this.saveTimeout = null;
      }, 2000);
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
}

/**
 * Create SQLite connection
 * @param {string} saveName
 * @returns {Promise<*>}
 */
export async function createSQLite(saveName) {
  if (isBun) {
    /* @ts-ignore */
    const { Database } = await import('bun:sqlite');
    return new Database(saveName);
  } else {
    const { DatabaseSync } = await import('node:sqlite');
    return new DatabaseSync(saveName);
  }
}

/** @type {Record<string, any>} List of SQLite connections */
export const connectionList = {};

/**
 * Store data in SQLite database
 */
export class StoreSQLite {
  /**
   * @param {{saveName: string, autoSave: boolean, expiration: number, tableName: string}} opts
   */
  constructor({ saveName, autoSave, expiration, tableName }) {
    if (!saveName) throw Error('saveName required');

    this.autoSave = autoSave ?? false;
    this.saveName = saveName;
    this.expiration = expiration ?? 0;
    this.tableName = tableName ?? 'data';
    this.ready = this._init();
  }

  async waitReady() {
    return this.ready;
  }

  async _init() {
    if (!connectionList[this.saveName]) connectionList[this.saveName] = await createSQLite(this.saveName);

    this.db = connectionList[this.saveName];
    this.db.exec('PRAGMA journal_mode=WAL');
    this.db.exec('PRAGMA foreign_keys=ON');
    this.load();
  }

  /**
   * @param {string} sql
   * @param  {...any} params
   */
  run_(sql, ...params) { return this.db.prepare(sql).run(...params); }

  /**
   * @param {string} sql
   * @param  {...any} params
   */
  get_(sql, ...params) { return this.db.prepare(sql).get(...params); }

  /**
   * @param {string} sql
   * @param  {...any} params
   */
  all_(sql, ...params) { return this.db.prepare(sql).all(...params); }

  async load() {
    return this.run_(`CREATE TABLE IF NOT EXISTS ${this.tableName} (key TEXT PRIMARY KEY, value BLOB)`);
  }

  save() { }

  /**
   * Set data
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    if (!key) return;

    return this.run_(`INSERT OR REPLACE INTO ${this.tableName} (key, value) VALUES (?,?)`, key, JSON.stringify(value));
  }

  /**
   * Get data
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    if (!key) return;
    const row = this.get_(`SELECT value FROM ${this.tableName} WHERE key = ?`, key);
    if (!row) return;

    return JSON.parse(row.value);
  }

  /**
   * Delete data
   * @param {string} key
   */
  delete(key) {
    if (!key) return;
    return this.run_(`DELETE FROM ${this.tableName} WHERE key = ?`, key);
  }

  /**
  * Clear data
  */
  clear() {
    return this.run_(`DELETE FROM data`);
  }

  /**
   * Get all keys
   * @returns {IterableIterator<string>}
   */
  keys() {
    return this.all_(`SELECT key FROM data`).map(row => row.key);
  }

  /**
   * Check if key exists
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    if (!key || typeof key !== 'string') return false;
    return this.get_(`SELECT 1 FROM ${this.tableName} WHERE key = ?`, key) !== undefined;
  }

  /**
   * Create new StoreSQLite instance with different table name
   * @param {string} tableName
   * @returns {StoreSQLite}
   */
  use(tableName) {
    return new StoreSQLite({ saveName: this.saveName, autoSave: this.autoSave, expiration: this.expiration, tableName: tableName });
  }
}
