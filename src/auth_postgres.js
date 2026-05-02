/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import pg from "pg";

const { Pool } = pg;

import { BufferJSON, initAuthCreds, WAProto } from "baileys";
import pen from "./pen.js";

const TABLE_NAME = "baileys_auth_store";

/**
 * Use PostgreSQL to store authentication state
 * @param {string} connectionString - PostgreSQL connection string
 * @returns {Promise<{ state: import('baileys').AuthenticationState, saveCreds: () => Promise<void> }>}
 */
export async function usePostgres(connectionString) {
  const pool = new Pool({ connectionString });

  const ensureTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  };

  try {
    await ensureTable();
    pen.Debug("Connected to PostgreSQL for authentication");
  } catch (error) {
    pen.Error("Failed to connect to PostgreSQL or create table:", error);
    throw error;
  }

  const writeData = async (key, data) => {
    const value = JSON.stringify(data, BufferJSON.replacer);
    await pool.query(
      `INSERT INTO ${TABLE_NAME} (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2;`,
      [key, value],
    );
  };

  const readData = async (key) => {
    const result = await pool.query(
      `SELECT value FROM ${TABLE_NAME} WHERE key = $1;`,
      [key],
    );
    if (result.rows.length === 0) {
      return null;
    }
    return JSON.parse(result.rows[0].value, BufferJSON.reviver);
  };

  const removeData = async (key) => {
    await pool.query(`DELETE FROM ${TABLE_NAME} WHERE key = $1;`, [key]);
  };

  const creds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = WAProto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }),
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(key, value) : removeData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData("creds", creds);
    },
  };
}
