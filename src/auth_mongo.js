/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { BufferJSON, initAuthCreds, WAProto } from "baileys";
import { MongoClient } from "mongodb";
import pen from "./pen.js";

/**
 * Use MongoDB to store authentication state
 * @param {string} url - MongoDB connection string
 * @param {string} dbName - Database name
 * @returns {Promise<{ state: import('baileys').AuthenticationState, saveCreds: () => Promise<void> }>}
 */
export async function useMongoDB(url) {
  const client = new MongoClient(url);
  let collection;

  try {
    await client.connect();
    const db = client.db();
    collection = db.collection("baileys_auth_store");
    pen.Debug("Connected to MongoDB for authentication");
  } catch (error) {
    pen.Error("Failed to connect to MongoDB:", error);
    throw error;
  }

  const writeData = async (key, data) => {
    const value = JSON.stringify(data, BufferJSON.replacer);
    await collection.updateOne(
      { _id: key },
      { $set: { value } },
      { upsert: true },
    );
  };

  const readData = async (key) => {
    const result = await collection.findOne({ _id: key });
    return result ? JSON.parse(result.value, BufferJSON.reviver) : null;
  };

  const removeData = async (key) => {
    await collection.deleteOne({ _id: key });
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
    clearState: async () => {
      await collection.deleteMany({});
    },
  };
}
