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
import { getLang, setLang, translate } from "../settings.js";

const t = translate({
  en: {
    usage: "Usage: {cmd} [lang]\nAvailable: en, id",
    success: "Language set to: *{lang}*",
    invalid: "Invalid language. Available: en, id",
    current: "Current language: *{lang}*",
  },
  id: {
    usage: "Penggunaan: {cmd} [bahasa]\nTersedia: en, id",
    success: "Bahasa diatur ke: *{lang}*",
    invalid: "Bahasa tidak valid. Tersedia: en, id",
    current: "Bahasa saat ini: *{lang}*",
  },
});

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ["lang", "set.lang"],

  cat: "system",
  tags: ["system"],
  desc: "Set the bot language.",
  events: [MESSAGES_UPSERT],
  roles: [Role.ADMIN],

  exec: async (c) => {
    const lang = c.args?.trim()?.toLowerCase();
    const available = ["en", "id"];
    const current = getLang();

    if (!lang || !available.includes(lang)) {
      const text = !lang
        ? `${t("current", { lang: current })}\n\n${t("usage", { cmd: c.pattern })}`
        : t("invalid");

      return await c.reply(
        { text },
        { quoted: c.event },
      );
    }

    setLang(lang);

    const successText = t("success", { lang });

    await c.reply(
      { text: successText },
      { quoted: c.event },
    );
  },
};
