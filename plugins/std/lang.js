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
import { getLang, setLang } from "../../src/settings.js";
import { translate } from "../../src/translate.js";

const t = translate({
  en: {
    admin_only: "This command is for group admins or bot admins only.",
    usage: "Usage: {cmd} [lang]\nAvailable: en, id",
    success: "System language set to: *{lang}*",
    chat_success: "Chat language set to: *{lang}*",
    user_success: "Your personal language set to: *{lang}*",
    invalid: "Invalid language. Available: en, id",
    current: "Current system language: *{lang}*",
    current_chat: "Current chat language: *{lang}*",
    current_user: "Your personal language: *{lang}*",
  },
  id: {
    admin_only: "Perintah ini hanya untuk admin grup atau admin bot.",
    usage: "Penggunaan: {cmd} [bahasa]\nTersedia: en, id",
    success: "Bahasa sistem diatur ke: *{lang}*",
    chat_success: "Bahasa chat diatur ke: *{lang}*",
    user_success: "Bahasa kamu telah diatur ke: *{lang}*",
    invalid: "Bahasa tidak valid. Tersedia: en, id",
    current: "Bahasa sistem saat ini: *{lang}*",
    current_chat: "Bahasa chat saat ini: *{lang}*",
    current_user: "Bahasa kamu saat ini: *{lang}*",
  },
});

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    cmd: ["lang", "set.lang", "lang?", "set.lang?"],
    cat: "system",
    tags: ["system", "lang"],
    desc: "Set the global bot language.",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const lang = c.args?.trim()?.toLowerCase();
      const available = ["en", "id"];
      const current = getLang();

      if (!lang || !available.includes(lang)) {
        const text = !lang
          ? `${t("current", { lang: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`
          : t("invalid", {}, c);

        return await c.reply({ text }, { quoted: c.event });
      }

      setLang(lang);
      await c.reply({ text: t("success", { lang }, c) }, { quoted: c.event });
    },
  },
  {
    cmd: ["lang.chat", "chatlang", "lang.chat?", "chatlang?"],
    cat: "system",
    tags: ["admin", "chat", "lang"],
    desc: "Set the default language for this chat.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      const isQuestion = c.cmd.endsWith("?");
      const lang = c.args?.trim()?.toLowerCase();
      const available = ["en", "id"];
      const current = c.chatData()?.lang || getLang();

      if (isQuestion || !lang) {
        return await c.reply({
          text: `${t("current_chat", { lang: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`,
        });
      }

      if (
        !c.isAdmin &&
        !c.handler().userManager.rolesEnough(c.senderJid, [Role.ADMIN])
      )
        return await c.reply({ text: t("admin_only", {}, c) });

      if (!available.includes(lang)) {
        return await c.reply({
          text: t("invalid", {}, c),
        });
      }

      c.handler().chatManager.updateChat(c.chat, { lang });
      await c.reply({ text: t("chat_success", { lang }, c) });
    },
  },
  {
    cmd: ["lang.user", "mylang", "lang.user?", "mylang?"],
    cat: "user",
    tags: ["user", "lang"],
    desc: "Set your personal language preference.",
    events: [MESSAGES_UPSERT],
    roles: [Role.GUEST],
    exec: async (c) => {
      const isQuestion = c.cmd.endsWith("?");
      const lang = c.args?.trim()?.toLowerCase();
      const available = ["en", "id"];
      const current = c.user()?.lang || getLang();

      if (isQuestion || !lang) {
        return await c.reply({
          text: `${t("current_user", { lang: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`,
        });
      }

      if (!available.includes(lang)) {
        return await c.reply({
          text: t("invalid", {}, c),
        });
      }

      c.handler().userManager.updateUser(c.senderJid, { lang });
      await c.reply({ text: t("user_success", { lang }, c) });
    },
  },
];
