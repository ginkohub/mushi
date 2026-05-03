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
    admin_only: "This command is for group admins or bot admins only.",
    bot_admin: "I need to be an admin to perform this action.",
    no_user: "Please tag, quote, or provide the number of the user.",
    success: "Success {action} {count} user(s).",
    failed: "Failed to {action} users.",
    group_only: "This command can only be used in groups.",
    link: "*Group Link:* https://chat.whatsapp.com/{val}",
  },
  id: {
    admin_only: "Perintah ini hanya untuk admin grup atau admin bot.",
    bot_admin: "Saya harus menjadi admin untuk melakukan tindakan ini.",
    no_user: "Silakan tag, quote, atau masukkan nomor user.",
    success: "Berhasil {action} {count} user.",
    failed: "Gagal untuk {action} user.",
    group_only: "Perintah ini hanya bisa digunakan di dalam grup.",
    link: "*Link Grup:* https://chat.whatsapp.com/{val}",
  },
});

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    cmd: ["kick", "k"],
    cat: "admin",
    tags: ["admin", "group"],
    desc: "Kick members from group.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!c.isGroup) return await c.reply({ text: t("group_only", {}, c) });
      if (
        !c.isAdmin &&
        !c.handler().userManager.rolesEnough(c.senderJid, [Role.ADMIN])
      )
        return await c.reply({ text: t("admin_only", {}, c) });
      if (!c.isBotAdmin) return await c.reply({ text: t("bot_admin", {}, c) });

      const jids = c.parseJIDs();
      if (jids.length === 0)
        return await c.reply({ text: t("no_user", {}, c) });

      const res = await c.groupParticipantsUpdate(c.chat, jids, "remove");
      if (res) {
        await c.reply({
          text: t("success", { action: "kick", count: jids.length }, c),
        });
      } else {
        await c.reply({ text: t("failed", { action: "kick" }, c) });
      }
    },
  },
  {
    cmd: ["add", "a"],
    cat: "admin",
    tags: ["admin", "group"],
    desc: "Add members to group.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!c.isGroup) return await c.reply({ text: t("group_only", {}, c) });
      if (
        !c.isAdmin &&
        !c.handler().userManager.rolesEnough(c.senderJid, [Role.ADMIN])
      )
        return await c.reply({ text: t("admin_only", {}, c) });
      if (!c.isBotAdmin) return await c.reply({ text: t("bot_admin", {}, c) });

      const jids = c.parseJIDs();
      if (jids.length === 0)
        return await c.reply({ text: t("no_user", {}, c) });

      const res = await c.groupParticipantsUpdate(c.chat, jids, "add");
      if (res) {
        await c.reply({
          text: t("success", { action: "add", count: jids.length }, c),
        });
      } else {
        await c.reply({ text: t("failed", { action: "add" }, c) });
      }
    },
  },
  {
    cmd: ["promote"],
    cat: "admin",
    tags: ["admin", "group"],
    desc: "Promote members to admin.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!c.isGroup) return await c.reply({ text: t("group_only", {}, c) });
      if (
        !c.isAdmin &&
        !c.handler().userManager.rolesEnough(c.senderJid, [Role.ADMIN])
      )
        return await c.reply({ text: t("admin_only", {}, c) });
      if (!c.isBotAdmin) return await c.reply({ text: t("bot_admin", {}, c) });

      const jids = c.parseJIDs();
      if (jids.length === 0)
        return await c.reply({ text: t("no_user", {}, c) });

      const res = await c.groupParticipantsUpdate(c.chat, jids, "promote");
      if (res) {
        await c.reply({
          text: t("success", { action: "promote", count: jids.length }, c),
        });
      } else {
        await c.reply({ text: t("failed", { action: "promote" }, c) });
      }
    },
  },
  {
    cmd: ["demote"],
    cat: "admin",
    tags: ["admin", "group"],
    desc: "Demote members from admin.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!c.isGroup) return await c.reply({ text: t("group_only", {}, c) });
      if (
        !c.isAdmin &&
        !c.handler().userManager.rolesEnough(c.senderJid, [Role.ADMIN])
      )
        return await c.reply({ text: t("admin_only", {}, c) });
      if (!c.isBotAdmin) return await c.reply({ text: t("bot_admin", {}, c) });

      const jids = c.parseJIDs();
      if (jids.length === 0)
        return await c.reply({ text: t("no_user", {}, c) });

      const res = await c.groupParticipantsUpdate(c.chat, jids, "demote");
      if (res) {
        await c.reply({
          text: t("success", { action: "demote", count: jids.length }, c),
        });
      } else {
        await c.reply({ text: t("failed", { action: "demote" }, c) });
      }
    },
  },
  {
    cmd: ["linkgc", "link"],
    cat: "admin",
    tags: ["admin", "group"],
    desc: "Get group invite link.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!c.isGroup) return await c.reply({ text: t("group_only", {}, c) });
      if (
        !c.isAdmin &&
        !c.handler().userManager.rolesEnough(c.senderJid, [Role.ADMIN])
      )
        return await c.reply({ text: t("admin_only", {}, c) });
      if (!c.isBotAdmin) return await c.reply({ text: t("bot_admin", {}, c) });

      const code = await c.groupInviteCode(c.chat);
      if (code) {
        await c.reply({ text: t("link", { val: code }, c) });
      }
    },
  },
  {
    cmd: ["hidetag", "ht"],
    cat: "admin",
    tags: ["admin", "group"],
    desc: "Tag all members without showing the tag list.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!c.isGroup) return await c.reply({ text: t("group_only", {}, c) });
      if (
        !c.isAdmin &&
        !c.handler().userManager.rolesEnough(c.senderJid, [Role.ADMIN])
      )
        return await c.reply({ text: t("admin_only", {}, c) });

      const metadata = await c.handler().getGroupMetadata(c.chat);
      const jids = metadata.participants.map((p) => p.id);
      const text = c.args || "Hello everyone!";

      await c.sendMessage(c.chat, { text, mentions: jids });
    },
  },
];
