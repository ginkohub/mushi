/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { MESSAGES_UPSERT } from "../../src/const.js";
import { Role } from "../../src/roles.js";
import { translate } from "../settings.js";

const t = translate({
  en: {
    usage: "Usage: {cmd} [lang] [text]\nExample: {cmd} id hello\nOr reply to a message with {cmd} [lang]\nType *{cmd}?* to see available languages.",
    failed: "Translation failed. Please try again later.",
    no_text: "No text provided for translation.",
    available: "*🌐 Available Languages:*",
  },
  id: {
    usage: "Penggunaan: {cmd} [bahasa] [teks]\nContoh: {cmd} en halo\nAtau balas pesan dengan {cmd} [bahasa]\nKetik *{cmd}?* untuk melihat daftar bahasa.",
    failed: "Terjemahan gagal. Silakan coba lagi nanti.",
    no_text: "Tidak ada teks yang diberikan untuk diterjemahkan.",
    available: "*🌐 Bahasa yang Tersedia:*",
  },
});

const languages = {
  af: "Afrikaans", sq: "Albanian", am: "Amharic", ar: "Arabic", hy: "Armenian", az: "Azerbaijani",
  eu: "Basque", be: "Belarusian", bn: "Bengali", bs: "Bosnian", bg: "Bulgarian", ca: "Catalan",
  ceb: "Cebuano", ny: "Chichewa", "zh-cn": "Chinese (Simplified)", "zh-tw": "Chinese (Traditional)",
  co: "Corsican", hr: "Croatian", cs: "Czech", da: "Danish", nl: "Dutch", en: "English",
  eo: "Esperanto", et: "Estonian", tl: "Filipino", fi: "Finnish", fr: "French", fy: "Frisian",
  gl: "Galician", ka: "Georgian", de: "German", el: "Greek", gu: "Gujarati", ht: "Haitian Creole",
  ha: "Hausa", haw: "Hawaiian", iw: "Hebrew", hi: "Hindi", hmn: "Hmong", hu: "Hungarian",
  is: "Icelandic", ig: "Igbo", id: "Indonesian", ga: "Irish", it: "Italian", ja: "Japanese",
  jw: "Javanese", kn: "Kannada", kk: "Kazakh", km: "Khmer", ko: "Korean", ku: "Kurdish (Kurmanji)",
  ky: "Kyrgyz", lo: "Lao", la: "Latin", lv: "Latvian", lt: "Lithuanian", lb: "Luxembourgish",
  mk: "Macedonian", mg: "Malagasy", ms: "Malay", ml: "Malayalam", mt: "Maltese", mi: "Maori",
  mr: "Marathi", mn: "Mongolian", my: "Myanmar (Burmese)", ne: "Nepali", no: "Norwegian",
  ps: "Pashto", fa: "Persian", pl: "Polish", pt: "Portuguese", pa: "Punjabi", ro: "Romanian",
  ru: "Russian", sm: "Samoan", gd: "Scots Gaelic", sr: "Serbian", st: "Sesotho", sn: "Shona",
  sd: "Sindhi", si: "Sinhala", sk: "Slovak", sl: "Slovenian", so: "Somali", es: "Spanish",
  su: "Sundanese", sw: "Swahili", sv: "Swedish", tg: "Tajik", ta: "Tamil", te: "Telugu",
  th: "Thai", tr: "Turkish", uk: "Ukrainian", ur: "Urdu", uz: "Uzbek", vi: "Vietnamese",
  cy: "Welsh", xh: "Xhosa", yi: "Yiddish", yo: "Yoruba", zu: "Zulu"
};

/**
 * Basic translation function using Google Translate single endpoint
 * @param {string} text 
 * @param {string} to 
 * @param {string} from 
 * @returns {Promise<string>}
 */
async function translateText(text, to = "en", from = "auto") {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetch(url);

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const data = await response.json();
  
  // The translation is in the first element of the first array
  return data[0].map((s) => s[0]).join("");
}

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ["tr", "tr?", "translate"],
  cat: "tool",
  tags: ["tool", "translate"],
  desc: "Translate text using Google Translate.",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],

  exec: async (c) => {
    if (c.pattern.endsWith("?")) {
      const list = Object.entries(languages)
        .map(([code, name]) => `- *${code}*: ${name}`)
        .join("\n");
      return await c.reply({ text: `${t("available")}\n\n${list}` });
    }

    let to = "id";
    let text = "";

    const args = c.args?.split(" ");
    if (args && args.length > 0) {
      const maybeLang = args[0].toLowerCase();
      if (maybeLang.length <= 5 && languages[maybeLang]) {
        to = maybeLang;
        text = args.slice(1).join(" ");
      } else {
        text = args.join(" ");
      }
    }

    if (!text && c.quotedMessage) {
      text = c.quotedText;
    }

    if (!text) {
      return await c.reply({ text: t("usage", { cmd: c.prefix + "tr" }) });
    }

    try {
      c.react("⌛");
      const result = await translateText(text, to);
      await c.reply({ text: result }, { quoted: c.event });
      c.react("✅");
    } catch (e) {
      console.error("Translation error:", e);
      await c.reply({ text: t("failed") });
      c.react("❌");
    }
  },
};
