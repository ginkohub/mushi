/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { getFile } from "../src/data.js";
import { StoreJson, StoreSQLite } from "../src/store.js";

export const storeMsg = new StoreSQLite({
  saveName: getFile("store_message.db"),
});

export const settings = new StoreJson({
  saveName: getFile("settings.json"),
  autoSave: true,
  autoLoad: true,
});

/** @returns {string} */
export function getLang() {
  return settings.get("lang") || "en";
}

/** @param {string} */
export function setLang(lang) {
  return settings.set("lang", lang);
}

/**
 * @param {Record<string, string>} sets
 * @param {string} altLang
 * @returns {(key: string, replaces?: Record<string, string>) => string}
 */
export function translate(sets, altLang = "en") {
  return (key, replaces = {}) => {
    const lang = getLang();
    let text = sets[lang]?.[key] || sets[altLang]?.[key] || key;
    for (const [k, v] of Object.entries(replaces)) {
      text = text.replace(`{${k}}`, v);
    }
    return text;
  };
}

/** @returns {string[]} */
export function getPrefixes() {
  return settings.get("prefixes") || [];
}

/** @param {string[]} prefixes */
export function setPrefixes(prefixes) {
  return settings.set("prefixes", prefixes);
}
