/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { getFile } from "./data.js";
import { StoreJson, StoreSQLite } from "./store.js";

/**
 * Message store for caching or other purposes
 */
export const storeMsg = new StoreSQLite({
  saveName: getFile("cache_message.db"),
});

/**
 * Global bot settings
 */
export const settings = new StoreJson({
  saveName: getFile("settings.json"),
  autoSave: true,
  autoLoad: true,
});

/**
 * Get global bot language
 * @returns {string}
 */
export function getLang() {
  return settings.get("lang") || "en";
}

/**
 * Set global bot language
 * @param {string} lang
 */
export function setLang(lang) {
  return settings.set("lang", lang);
}

/**
 * Get bot command prefixes
 * @returns {string[]}
 */
export function getPrefixes() {
  return settings.get("prefixes") || [];
}

/**
 * Set bot command prefixes
 * @param {string[]} prefixes
 */
export function setPrefixes(prefixes) {
  return settings.set("prefixes", prefixes);
}
