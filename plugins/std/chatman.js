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
    usage: "Usage: {cmd} [value]",
    active: "ON ✅",
    inactive: "OFF ❌",
    cmd_status: "Command status: *{val}*",
    welcome_status: "Welcome message status: *{val}*",
    nb: "NB :",
    deactivating: "  *{pattern}-* _to disable_",
    activating: "  *{pattern}+* _to enable_",
    current_chat: "Current chat {key}: *{val}*",
    chat_success: "Chat {key} set to: *{val}*",
    chat_reset: "Chat {key} preference cleared.",
    invalid_tz:
      "❌ Invalid timezone! Example: `Asia/Jakarta`, `Europe/London`, `UTC`.",
  },
  id: {
    usage: "Penggunaan: {cmd} [nilai]",
    active: "NYALA ✅",
    inactive: "MATI ❌",
    cmd_status: "Status perintah: *{val}*",
    welcome_status: "Status pesan selamat datang: *{val}*",
    nb: "Catatan :",
    deactivating: "  *{pattern}-* _untuk menonaktifkan_",
    activating: "  *{pattern}+* _untuk mengaktifkan_",
    current_chat: "{key} chat saat ini: *{val}*",
    chat_success: "{key} chat diatur ke: *{val}*",
    chat_reset: "Preferensi {key} chat telah dihapus.",
    invalid_tz:
      "❌ Timezone tidak valid! Contoh: `Asia/Jakarta`, `Europe/London`, `UTC`.",
  },
});

const isAdminOrAbove = (c) =>
  c.isAdmin || c.client().userManager.rolesEnough(c.senderJid, [Role.ADMIN]);

function isValidTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    name: "std-chatman-cmd",
    cmd: ["chat.cmd", "chat.cmd+", "chat.cmd-"],
    cat: "system",
    tags: ["admin", "chat"],
    desc: "Manage command execution status in this chat.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      let pattern = c.pattern;
      const tail = pattern.slice(-1);

      switch (tail) {
        case "+": {
          if (!isAdminOrAbove(c)) return;
          c.client().chatManager.updateChat(c.chat, { allowCommand: true });
          pattern = pattern.slice(0, -1);
          break;
        }
        case "-": {
          if (!isAdminOrAbove(c)) return;
          c.client().chatManager.updateChat(c.chat, { allowCommand: false });
          pattern = pattern.slice(0, -1);
          break;
        }
      }

      const isActive = c.chatData?.allowCommand === true;
      const texts = [
        t("cmd_status", { val: isActive ? t("active") : t("inactive") }),
        "",
        "",
        t("nb"),
        t("deactivating", { pattern }),
        t("activating", { pattern }),
      ];
      await c.reply({ text: texts.join("\n") }, { quoted: c.event });
    },
  },
  {
    name: "std-chatman-welcome",
    cmd: ["chat.welcome", "chat.welcome+", "chat.welcome-"],
    cat: "system",
    tags: ["admin", "chat"],
    desc: "Manage welcome message status in this chat.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      let pattern = c.pattern;
      const tail = pattern.slice(-1);

      switch (tail) {
        case "+": {
          if (!isAdminOrAbove(c)) return;
          c.client().chatManager.updateChat(c.chat, { welcome: true });
          pattern = pattern.slice(0, -1);
          break;
        }
        case "-": {
          if (!isAdminOrAbove(c)) return;
          c.client().chatManager.updateChat(c.chat, { welcome: false });
          pattern = pattern.slice(0, -1);
          break;
        }
      }

      const isActive = c.chatData?.welcome === true;
      const texts = [
        t("welcome_status", { val: isActive ? t("active") : t("inactive") }),
        "",
        "",
        t("nb"),
        t("deactivating", { pattern }),
        t("activating", { pattern }),
      ];
      await c.reply({ text: texts.join("\n") }, { quoted: c.event });
    },
  },
  {
    name: "std-chatman-lang",
    cmd: ["chat.lang", "chat.lang?"],
    cat: "system",
    tags: ["admin", "chat", "lang"],
    desc: "Set the default language for this chat.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      const isQuestion = c.cmd.endsWith("?");
      const lang = c.args?.trim()?.toLowerCase();
      const current =
        c.chatData?.lang || c.client()?.settings.get("lang") || "id";

      if (isQuestion || !lang) {
        return await c.reply({
          text: `${t("current_chat", { key: "lang", val: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`,
        });
      }

      if (!isAdminOrAbove(c)) return;

      if (lang === "reset" || lang === "delete" || lang === "clear") {
        c.client().chatManager.updateChat(c.chat, { lang: null });
        return await c.reply({ text: t("chat_reset", { key: "lang" }, c) });
      }

      c.client().chatManager.updateChat(c.chat, { lang });
      await c.reply({ text: t("chat_success", { key: "lang", val: lang }, c) });
    },
  },
  {
    name: "std-chatman-tz",
    cmd: ["chat.tz", "chat.tz?"],
    cat: "system",
    tags: ["admin", "chat", "tz"],
    desc: "Set the default timezone for this chat.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      const isQuestion = c.cmd.endsWith("?");
      const tz = c.args?.trim();
      const current = c.chatData?.tz || c.client()?.settings.get("tz") || "UTC";

      if (isQuestion || !tz) {
        return await c.reply({
          text: `${t("current_chat", { key: "tz", val: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`,
        });
      }

      if (!isAdminOrAbove(c)) return;

      if (tz === "reset" || tz === "delete" || tz === "clear") {
        c.client().chatManager.updateChat(c.chat, { tz: null });
        return await c.reply({ text: t("chat_reset", { key: "tz" }, c) });
      }

      if (!isValidTimezone(tz)) {
        return await c.reply({ text: t("invalid_tz", {}, c) });
      }

      c.client().chatManager.updateChat(c.chat, { tz });
      await c.reply({ text: t("chat_success", { key: "tz", val: tz }, c) });
    },
  },
];
