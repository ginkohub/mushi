/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

/**
 * List of supported languages by Google Translate API
 * @readonly
 * @enum {string}
 */
export const Languages = Object.freeze({
  af: "Afrikaans",
  sq: "Albanian",
  am: "Amharic",
  ar: "Arabic",
  hy: "Armenian",
  az: "Azerbaijani",
  eu: "Basque",
  be: "Belarusian",
  bn: "Bengali",
  bs: "Bosnian",
  bg: "Bulgarian",
  ca: "Catalan",
  ceb: "Cebuano",
  ny: "Chichewa",
  "zh-cn": "Chinese (Simplified)",
  "zh-tw": "Chinese (Traditional)",
  co: "Corsican",
  hr: "Croatian",
  cs: "Czech",
  da: "Danish",
  nl: "Dutch",
  en: "English",
  eo: "Esperanto",
  et: "Estonian",
  tl: "Filipino",
  fi: "Finnish",
  fr: "French",
  fy: "Frisian",
  gl: "Galician",
  ka: "Georgian",
  de: "German",
  el: "Greek",
  gu: "Gujarati",
  ht: "Haitian Creole",
  ha: "Hausa",
  haw: "Hawaiian",
  iw: "Hebrew",
  hi: "Hindi",
  hmn: "Hmong",
  hu: "Hungarian",
  is: "Icelandic",
  ig: "Igbo",
  id: "Indonesian",
  ga: "Irish",
  it: "Italian",
  ja: "Japanese",
  jw: "Javanese",
  kn: "Kannada",
  kk: "Kazakh",
  km: "Khmer",
  ko: "Korean",
  ku: "Kurdish (Kurmanji)",
  ky: "Kyrgyz",
  lo: "Lao",
  la: "Latin",
  lv: "Latvian",
  lt: "Lithuanian",
  lb: "Luxembourgish",
  mk: "Macedonian",
  mg: "Malagasy",
  ms: "Malay",
  ml: "Malayalam",
  mt: "Maltese",
  mi: "Maori",
  mr: "Marathi",
  mn: "Mongolian",
  my: "Myanmar (Burmese)",
  ne: "Nepali",
  no: "Norwegian",
  ps: "Pashto",
  fa: "Persian",
  pl: "Polish",
  pt: "Portuguese",
  pa: "Punjabi",
  ro: "Romanian",
  ru: "Russian",
  sm: "Samoan",
  gd: "Scots Gaelic",
  sr: "Serbian",
  st: "Sesotho",
  sn: "Shona",
  sd: "Sindhi",
  si: "Sinhala",
  sk: "Slovak",
  sl: "Slovenian",
  so: "Somali",
  es: "Spanish",
  su: "Sundanese",
  sw: "Swahili",
  sv: "Swedish",
  tg: "Tajik",
  ta: "Tamil",
  te: "Telugu",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  ur: "Urdu",
  uz: "Uzbek",
  vi: "Vietnamese",
  cy: "Welsh",
  xh: "Xhosa",
  yi: "Yiddish",
  yo: "Yoruba",
  zu: "Zulu",
});

/**
 * Map of language codes to their representative flag emojis
 * @readonly
 * @enum {string}
 */
export const LanguageFlags = Object.freeze({
  af: "🇿🇦",
  sq: "🇦🇱",
  am: "🇪🇹",
  ar: "🇸🇦",
  hy: "🇦🇲",
  az: "🇦🇿",
  eu: "🇪🇸",
  be: "🇧🇾",
  bn: "🇧🇩",
  bs: "🇧🇦",
  bg: "🇧🇬",
  ca: "🇪🇸",
  ceb: "🇵🇭",
  ny: "🇲🇼",
  "zh-cn": "🇨🇳",
  "zh-tw": "🇹🇼",
  co: "🇫🇷",
  hr: "🇭🇷",
  cs: "🇨🇿",
  da: "🇩🇰",
  nl: "🇳🇱",
  en: "🇬🇧",
  et: "🇪🇪",
  tl: "🇵🇭",
  fi: "🇫🇮",
  fr: "🇫🇷",
  fy: "🇳🇱",
  gl: "🇪🇸",
  ka: "🇬🇪",
  de: "🇩🇪",
  el: "🇬🇷",
  gu: "🇮🇳",
  ht: "🇭🇹",
  ha: "🇳🇬",
  haw: "🇺🇸",
  iw: "🇮🇱",
  hi: "🇮🇳",
  hu: "🇭🇺",
  is: "🇮🇸",
  ig: "🇳🇬",
  id: "🇮🇩",
  ga: "🇮🇪",
  it: "🇮🇹",
  ja: "🇯🇵",
  jw: "🇮🇩",
  kn: "🇮🇳",
  kk: "🇰🇿",
  km: "🇰🇭",
  ko: "🇰🇷",
  ky: "🇰🇬",
  lo: "🇱🇦",
  la: "🇻🇦",
  lv: "🇱🇻",
  lt: "🇱🇹",
  lb: "🇱🇺",
  mk: "🇲🇰",
  mg: "🇲🇬",
  ms: "🇲🇾",
  ml: "🇮🇳",
  mt: "🇲🇹",
  mi: "🇳🇿",
  mr: "🇮🇳",
  mn: "🇲🇳",
  my: "🇲🇲",
  ne: "🇳🇵",
  no: "🇳🇴",
  ps: "🇦🇫",
  fa: "🇮🇷",
  pl: "🇵🇱",
  pt: "🇵🇹",
  pa: "🇮🇳",
  ro: "🇷🇴",
  ru: "🇷🇺",
  sm: "🇼🇸",
  gd: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  sr: "🇷🇸",
  st: "🇿🇦",
  sn: "🇿🇼",
  sd: "🇵🇰",
  si: "🇱🇰",
  sk: "🇸🇰",
  sl: "🇸🇮",
  so: "🇸🇴",
  es: "🇪🇸",
  su: "🇮🇩",
  sw: "🇰🇪",
  sv: "🇸🇪",
  tg: "🇹🇯",
  ta: "🇮🇳",
  te: "🇮🇳",
  th: "🇹🇭",
  tr: "🇹🇷",
  uk: "🇺🇦",
  ur: "🇵🇰",
  uz: "🇺🇿",
  vi: "🇻🇳",
  cy: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  xh: "🇿🇦",
  yi: "🇮🇱",
  yo: "🇳🇬",
  zu: "🇿🇦",
});

/**
 * Get flag emoji for a language code
 * @param {string} lang
 * @returns {string}
 */
export function getFlag(lang) {
  return LanguageFlags[lang] || "🌐";
}

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
    let lang = "en";

    if (typeof ctx === "string") {
      lang = ctx;
    } else if (ctx && typeof ctx === "object") {
      // Check User pref, then Chat pref, then Global
      lang = ctx.user?.lang || ctx.chatData?.lang || "en";
    }

    let text = sets[lang]?.[key] || sets[altLang]?.[key] || key;

    for (const [k, v] of Object.entries(replaces)) {
      text = text.replace(new RegExp(`{${k}}`, "g"), v);
    }

    return text;
  };
}
