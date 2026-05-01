/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { WAProto, initAuthCreds, BufferJSON } from 'baileys';
import { createSQLite } from './store.js';

/**
 *
 * @param {string} dbPath
 * @returns {Promise<{state: import('baileys').AuthenticationState, saveCreds: () => Promise<void> }>}
 */
export async function useSQLite(dbPath) {
  const db = await createSQLite(dbPath);

  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");

  /** @type {(query: string, ...params: any[]) => any} */
  const run = (query, ...params) => db.prepare(query).run(...params);
  /** @type {(query: string, ...params: any[]) => any} */
  const get = (query, ...params) => db.prepare(query).get(...params);

  /**
   * Sanitize table name
   * @param {string} name - table name
   * @returns {string} - sanitized table name
   */
  const sanitizeTableName = (name) => { return name.replace(/[^a-zA-Z0-9_]/g, "_") };

  /**
   * Create table if not exists
   *
   * @param {string} collection - collection name
   */
  const ensureTable = (collection) => {
    const tableName = sanitizeTableName(collection);
    run(`CREATE TABLE IF NOT EXISTS ${tableName} (
     key TEXT PRIMARY KEY,
     data TEXT )`);
  }

  /**
   * @param {any} data - data to be saved
   * @param {string} col - collection name
   * @param {string} key - key to identify the data
   */
  const writeData = (data, col, key) => {
    const tableName = sanitizeTableName(col)
    ensureTable(col);
    const value = JSON.stringify(data, BufferJSON.replacer);
    run(`INSERT OR REPLACE INTO ${tableName} (key, data) VALUES (?, ?)`, key, value);
  }

  /**
   * @param {string} col - collection name
   * @param {string} key - key to identify the data
   * @returns {any} - data
   */
  const readData = (col, key) => {
    const tableName = sanitizeTableName(col);
    ensureTable(col);
    const result = get(`SELECT data FROM ${tableName} WHERE key = ?`, key);
    return result ? JSON.parse(result.data, BufferJSON.reviver) : null;
  }

  /**
   * Remove data from table
   *
   * @param {string} col - collection name
   * @param {string} key - key to identify the data
   */
  const removeData = (col, key) => {
    const tableName = sanitizeTableName(col);
    ensureTable(col);
    run(`DELETE FROM ${tableName} WHERE key = ?`, key);
  }

  /** @type {import('baileys').AuthenticationCreds} */
  const creds = (readData("credentials", "creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        /* @ts-ignore */
        get: async (type, ids) => {
          const data = {}
          await Promise.all(
            ids.map(async (id) => {
              let value = readData(type, id)
              if (type === "app-state-sync-key" && value) {
                value = WAProto.Message.AppStateSyncKeyData.fromObject(value)
              }
              /* @ts-ignore */
              data[id] = value
            }),
          )
          return data
        },
        set: async (data) => {
          const tasks = []
          for (const category in data) {
            /* @ts-ignore */
            for (const id in data[category]) {
              /* @ts-ignore */
              const value = data[category][id]
              tasks.push(value ? writeData(value, category, id) : removeData(category, id))
            }
          }
          await Promise.all(tasks)
        },
      },
    },
    saveCreds: async () => {
      writeData(creds, "credentials", "creds")
    },
  }
}
