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
import { Languages, translate, translateText } from "../../src/translate.js";

const t = translate({
  en: {
    usage:
      "Usage: {cmd} [lang] [text]\nExample: {cmd} id hello\nOr reply to a message with {cmd} [lang]\nType *{cmd}?* to see available languages.",
    failed: "Translation failed. Please try again later.",
    no_text: "No text provided for translation.",
    available: "*🌐 Available Languages:*",
  },
  id: {
    usage:
      "Penggunaan: {cmd} [bahasa] [teks]\nContoh: {cmd} en halo\nAtau balas pesan dengan {cmd} [bahasa]\nKetik *{cmd}?* untuk melihat daftar bahasa.",
    failed: "Terjemahan gagal. Silakan coba lagi nanti.",
    no_text: "Tidak ada teks yang diberikan untuk diterjemahkan.",
    available: "*🌐 Bahasa yang Tersedia:*",
  },
});

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
      const list = Object.entries(Languages)
        .map(([code, name]) => `- *${code}*: ${name}`)
        .join("\n");
      return await c.reply({ text: `${t("available", {}, c)}\n\n${list}` });
    }

    let to = "id";
    let text = "";

    const args = c.args?.split(" ");
    if (args && args.length > 0) {
      const maybeLang = args[0].toLowerCase();
      if (maybeLang.length <= 5 && Languages[maybeLang]) {
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
      return await c.reply({ text: t("usage", { cmd: `${c.prefix}tr` }, c) });
    }

    try {
      c.react("⌛");
      const result = await translateText(text, to);
      await c.reply({ text: result }, { quoted: c.event });
      c.react("✅");
    } catch (e) {
      console.error("Translation error:", e);
      await c.reply({ text: t("failed", {}, c) });
      c.react("❌");
    }
  },
};
