/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import Database from 'better-sqlite3';
import pen from "./pen.js";
import fs from 'fs';
import chokidar from 'chokidar';
import { shouldUsePolling } from './tools.js';

/**
 * Store ${this.tableName} in JSON file
 */
export class StoreJson {
  /**
   * @param {{saveName: string, autoSave: boolean, autoLoad: boolean, expiration: number}}
   * @returns {StoreSQLite}
   */
  constructor({ saveName, autoSave, autoLoad, expiration }) {
    if (!saveName) throw Error('saveName required');

    this.data = {};

    this.autoSave = autoSave ?? false;
    this.saveName = saveName;
    this.expiration = expiration ?? 0;
    this.saveState = true;

    /* Watch changes on disk */
    if (autoLoad) {
      this.watcher = chokidar.watch(this.saveName, {
        ignoreInitial: true,
        usePolling: shouldUsePolling(),
        interval: 1000,
      }).on('change', (loc) => {
        if (!this.saveState) {
          pen.Debug('Reload', loc)
          this.load();
        } else {
          this.saveState = false;
        }
      });
    }

    this.load();
  }

  async load(saveName) {
    /* Read json ${this.tableName} from local storage */
    try {
      this.data = JSON.parse(fs.readFileSync(saveName ?? this.saveName, 'utf8'));
    } catch (e) {
      pen.Error(e.message);
      this.data = {};
    }
  }

  save() {
    try {
      fs.writeFileSync(this.saveName, JSON.stringify(this.data, null, 2), 'utf8');
      this.saveState = true;
    } catch (e) {
      pen.Error(e);
    }
  }

  saveCheck() {
    if (this.autoSave) {
      this.save();
    }
  }

  set(key, value) {
    if (!key) return;

    this.data[key] = value;
    this.saveCheck();
  }

  get(key) {
    return this.data[key];
  }

  delete(key) {
    delete this.data[key];
    this.saveCheck();
  }

  clear() {
    this.data = {};
    this.saveCheck();
  }

  keys() {
    return this.data.keys();
  }

  has(key) {
    return key in this.data;
  }
}

/** @type {object} List of SQLite connections */
export const connectionList = {};

/**
 * Store data in SQLite database
 */
export class StoreSQLite {
  /**
   * @param {{saveName: string, autoSave: boolean, expiration: number, tableName: string}}
   * @returns {StoreSQLite}
   */
  constructor({ saveName, autoSave, expiration, tableName }) {
    if (!saveName) throw Error('saveName required');

    if (!connectionList[saveName]) connectionList[saveName] = new Database(saveName);

    this.db = () => connectionList[saveName];
    this.db().pragma('journal_mode=WAL');
    this.db().pragma('foreign_keys=ON');

    this.autoSave = autoSave ?? false;
    this.saveName = saveName;
    this.expiration = expiration ?? 0;
    this.tableName = tableName ?? 'data';

    this.load();
  }

  run_(sql, ...params) {
    return this.db().prepare(sql).run(...params);
  }

  get_(sql, ...params) {
    return this.db().prepare(sql).get(...params);
  }

  async load() {
    return this.run_(`CREATE TABLE IF NOT EXISTS ${this.tableName} (key TEXT PRIMARY KEY, value BLOB)`);
  }

  save() { }

  set(key, value) {
    if (!key) return;

    return this.run_(`INSERT OR REPLACE INTO ${this.tableName} (key, value) VALUES (?,?)`, key, JSON.stringify(value));
  }

  get(key) {
    if (!key) return;
    const row = this.get_(`SELECT value FROM ${this.tableName} WHERE key = ?`, key);
    if (!row) return;

    return JSON.parse(row.value);
  }

  delete(key) {
    if (!key) return;
    return this.run_(`DELETE FROM ${this.tableName} WHERE key = ?`, key);
  }

  clear() {
    return this.run_(`DELETE FROM data`);
  }

  keys() {
    return this.get_(`SELECT key FROM data`).map(row => row.key);
  }

  has(key) {
    return this.get_(`SELECT 1 FROM ${this.tableName} WHERE key = ?`, key) !== undefined;
  }

  use(tableName) {
    return new StoreSQLite({ saveName: this.saveName, autoSave: this.autoSave, expiration: this.expiration, tableName: tableName });
  }
}
