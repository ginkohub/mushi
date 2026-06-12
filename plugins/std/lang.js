/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { MESSAGES_UPSERT, Role, translate } from "#mushi";

const t = translate({
  en: {
    usage: "Usage: {cmd} [lang]\nExample: {cmd} id",
    success: "System language set to: *{lang}*",
    current: "Current system language: *{lang}*",
    reset_success: "System language preference cleared (default: *id*).",
  },
  id: {
    usage: "Penggunaan: {cmd} [bahasa]\nContoh: {cmd} id",
    success: "Bahasa sistem diatur ke: *{lang}*",
    current: "Bahasa sistem saat ini: *{lang}*",
    reset_success: "Preferensi bahasa sistem telah dihapus (bawaan: *id*).",
  },
});

export default [
  {
    name: "std-lang",
    cmd: ["lang", "set.lang", "lang?", "set.lang?"],
    includes: [],
    cat: "system",
    tags: ["system", "lang"],
    desc: "Set the global bot language.",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const lang = c.args?.trim()?.toLowerCase();
      const current = c.client()?.settings.get("lang") || "id";

      if (lang === "reset" || lang === "delete" || lang === "clear") {
        c.client()?.settings.delete("lang");
        return await c.reply(
          { text: t("reset_success", {}, c) },
          { quoted: c.event },
        );
      }

      if (!lang) {
        const text = `${t("current", { lang: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`;
        return await c.reply({ text }, { quoted: c.event });
      }

      c.client()?.settings.set("lang", lang);
      await c.reply({ text: t("success", { lang }, c) }, { quoted: c.event });
    },
  },
];
