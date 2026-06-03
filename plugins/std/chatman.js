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
    cmd_on: "Commands are enabled in this chat ✅",
    cmd_off: "Commands are disabled in this chat ❌",
    cmd_status: "Command status: *{val}*",
    enabled: "enabled",
    disabled: "disabled",
    welcome_on: "Welcome message enabled in this chat ✅",
    welcome_off: "Welcome message disabled in this chat ❌",
    welcome_status: "Welcome message status: *{val}*",
    current_chat: "Current chat {key}: *{val}*",
    chat_success: "Chat {key} set to: *{val}*",
    chat_reset: "Chat {key} preference cleared.",
    invalid_tz:
      "❌ Invalid timezone! Example: `Asia/Jakarta`, `Europe/London`, `UTC`.",
  },
  id: {
    usage: "Penggunaan: {cmd} [nilai]",
    cmd_on: "Perintah telah diaktifkan di chat ini ✅",
    cmd_off: "Perintah telah dinonaktifkan di chat ini ❌",
    cmd_status: "Status perintah: *{val}*",
    enabled: "aktif",
    disabled: "nonaktif",
    welcome_on: "Pesan selamat datang diaktifkan di chat ini ✅",
    welcome_off: "Pesan selamat datang dinonaktifkan di chat ini ❌",
    welcome_status: "Status pesan selamat datang: *{val}*",
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
    cmd: ["cmd"],
    cat: "system",
    tags: ["admin", "chat"],
    desc: "Show command execution status in this chat.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      const val = c.chatData?.allowCommand
        ? t("enabled", {}, c)
        : t("disabled", {}, c);
      await c.reply({ text: t("cmd_status", { val }, c) });
    },
  },
  {
    name: "std-chatman-cmd-on",
    cmd: ["cmd+"],
    cat: "system",
    tags: ["admin", "chat"],
    desc: "Enable command execution in this chat.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      if (!isAdminOrAbove(c)) return;
      c.client().chatManager.updateChat(c.chat, { allowCommand: true });
      await c.reply({ text: t("cmd_on", {}, c) });
    },
  },
  {
    name: "std-chatman-cmd-off",
    cmd: ["cmd-"],
    cat: "system",
    tags: ["admin", "chat"],
    desc: "Disable command execution in this chat.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      if (!isAdminOrAbove(c)) return;
      c.client().chatManager.updateChat(c.chat, { allowCommand: false });
      await c.reply({ text: t("cmd_off", {}, c) });
    },
  },
  {
    name: "std-chatman-welcome",
    cmd: ["welcome"],
    cat: "system",
    tags: ["admin", "chat"],
    desc: "Show welcome message status in this chat.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      const val = c.chatData?.welcome
        ? t("enabled", {}, c)
        : t("disabled", {}, c);
      await c.reply({ text: t("welcome_status", { val }, c) });
    },
  },
  {
    name: "std-chatman-welcome-on",
    cmd: ["welcome+"],
    cat: "system",
    tags: ["admin", "chat"],
    desc: "Enable welcome message in this chat.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      if (!isAdminOrAbove(c)) return;
      c.client().chatManager.updateChat(c.chat, { welcome: true });
      await c.reply({ text: t("welcome_on", {}, c) });
    },
  },
  {
    name: "std-chatman-welcome-off",
    cmd: ["welcome-"],
    cat: "system",
    tags: ["admin", "chat"],
    desc: "Disable welcome message in this chat.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      if (!isAdminOrAbove(c)) return;
      c.client().chatManager.updateChat(c.chat, { welcome: false });
      await c.reply({ text: t("welcome_off", {}, c) });
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
      const current =
        c.chatData?.tz || c.client()?.settings.get("tz") || "UTC";

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
