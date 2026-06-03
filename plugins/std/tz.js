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
import { translate } from "../../src/translate.js";

const t = translate({
  en: {
    usage: "Usage: {cmd} [timezone]\nExample: {cmd} Asia/Jakarta",
    success: "System timezone set to: *{tz}*",
    current: "Current system timezone: *{tz}*",
    reset_success: "System timezone preference cleared (default: *UTC*).",
    invalid:
      "❌ Invalid timezone! Example: `Asia/Jakarta`, `Europe/London`, `UTC`.",
  },
  id: {
    usage: "Penggunaan: {cmd} [timezone]\nContoh: {cmd} Asia/Jakarta",
    success: "Timezone sistem diatur ke: *{tz}*",
    current: "Timezone sistem saat ini: *{tz}*",
    reset_success: "Preferensi timezone sistem telah dihapus (bawaan: *UTC*).",
    invalid:
      "❌ Timezone tidak valid! Contoh: `Asia/Jakarta`, `Europe/London`, `UTC`.",
  },
});

function isValidTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export default [
  {
    name: "std-tz",
    cmd: ["tz", "set.tz", "tz?", "set.tz?"],
    includes: [],
    cat: "system",
    tags: ["system", "tz"],
    desc: "Set the global bot timezone.",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const tz = c.args?.trim();
      const current = c.client()?.settings.get("tz") || "UTC";

      if (tz === "reset" || tz === "delete" || tz === "clear") {
        c.client()?.settings.delete("tz");
        return await c.reply({ text: t("reset_success", {}, c) });
      }

      if (!tz) {
        const text = `${t("current", { tz: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`;
        return await c.reply({ text });
      }

      if (!isValidTimezone(tz)) {
        return await c.reply({ text: t("invalid", {}, c) });
      }

      c.client()?.settings.set("tz", tz);
      await c.reply({ text: t("success", { tz }, c) });
    },
  },
];
