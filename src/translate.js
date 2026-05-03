/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { getLang } from "./settings.js";

/**
 * Basic translation function using Google Translate single endpoint
 * @param {string} text
 * @param {string} to
 * @param {string} from
 * @returns {Promise<string>}
 */
export async function translateText(text, to = "en", from = "auto") {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetch(url);

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const data = await response.json();

  // The translation is in the first element of the first array
  return data[0].map((s) => s[0]).join("");
}

/**
 * Higher-order function to handle i18n translations with hierarchy:
 * User Preference > Chat Preference > Global Bot Setting > Fallback (English)
 *
 * @param {Record<string, Record<string, string>>} sets
 * @param {string} altLang
 * @returns {(key: string, replaces?: Record<string, string>, ctx?: import('./context.js').Ctx | string) => string}
 */
export function translate(sets, altLang = "en") {
  return (key, replaces = {}, ctx) => {
    let lang = getLang();

    if (typeof ctx === "string") {
      lang = ctx;
    } else if (ctx && typeof ctx === "object") {
      // Check User pref, then Chat pref, then Global
      lang = ctx.user()?.lang || ctx.chatData()?.lang || getLang();
    }

    let text = sets[lang]?.[key] || sets[altLang]?.[key] || key;

    for (const [k, v] of Object.entries(replaces)) {
      text = text.replace(new RegExp(`{${k}}`, "g"), v);
    }

    return text;
  };
}
