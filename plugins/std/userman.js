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
import { getRoleBadge, Role } from "../../src/roles.js";
import { translate } from "../../src/translate.js";

const t = translate({
  en: {
    header: "*📃 User Information*",
    name: "Name",
    jid: "JID",
    lid: "LID",
    roles: "Roles",
    level: "Level",
    xp: "XP",
    status: "Status",
    banned: "Banned (at {val})",
    active: "Active",
    added: "Added",
    stats: "Statistics",
    no_user: "No user specified. Tag or quote someone.",
    no_role: "Please specify a role (e.g. .role+ admin @user)",
    invalid_role: "Invalid role. Available roles: {val}",
    added_role: "Added role *{role}* to {count} user(s).",
    removed_role: "Removed role *{role}* from {count} user(s).",
    set_role: "Set role to *{role}* for {count} user(s).",
    usage: "Usage: {cmd} [value]",
    current_user: "Your personal {key}: *{val}*",
    user_success: "Your personal {key} set to: *{val}*",
    user_reset: "Your personal {key} preference cleared.",
    deleted_user: "Deleted data for {count} user(s).",
    invalid_tz:
      "❌ Invalid timezone! Example: `Asia/Jakarta`, `Europe/London`, `UTC`.",
  },
  id: {
    header: "*📃 Informasi User*",
    name: "Nama",
    jid: "JID",
    lid: "LID",
    roles: "Peran",
    level: "Level",
    xp: "XP",
    status: "Status",
    banned: "Diblokir (pada {val})",
    active: "Aktif",
    added: "Ditambahkan",
    stats: "Statistik",
    no_user: "Tidak ada user yang ditentukan. Tag atau quote seseorang.",
    no_role: "Silakan tentukan peran (misal: .role+ admin @user)",
    invalid_role: "Peran tidak valid. Peran tersedia: {val}",
    added_role: "Menambahkan peran *{role}* ke {count} user.",
    removed_role: "Menghapus peran *{role}* dari {count} user.",
    set_role: "Mengatur peran menjadi *{role}* untuk {count} user.",
    usage: "Penggunaan: {cmd} [nilai]",
    current_user: "{key} personal kamu: *{val}*",
    user_success: "{key} personal kamu diatur ke: *{val}*",
    user_reset: "Preferensi {key} personal kamu telah dihapus.",
    deleted_user: "Menghapus data untuk {count} user.",
    invalid_tz:
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

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    name: "std-userman-user",
    cmd: ["user"],
    includes: [
      "std-userman-role-add",
      "std-userman-role-remove",
      "std-userman-role-set",
      "std-userman-del",
    ],
    cat: "user",
    tags: ["user", "role"],
    desc: "Get user info and sync with current data",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      const jids = c.parseJIDs();
      const targets = jids.length > 0 ? jids : [c.senderJid];
      for (let i = 0; i < targets.length; i++) {
        if (targets[i].includes("@lid"))
          targets[i] = await c.LIDToPN(targets[i]);
      }

      const texts = [t("header", {}, c), ""];
      for (const jid of targets) {
        let name = c.getName(jid);
        if (jid === c.senderJid && c.pushName) {
          name = c.pushName;
        }
        const updateData = { name, jid };

        const lid = await c.PNToLID(jid).catch(() => null);
        if (lid) {
          updateData.lid = lid;
          let lidName = c.getName(lid);
          if (jid === c.senderJid && c.pushName) {
            lidName = c.pushName;
          }
          if (lidName) updateData.name = lidName;
        }

        const user = c.client().userManager.updateUser(jid, updateData);
        if (!user) continue;

        const roles = user.roles
          .map((r) => `${getRoleBadge(r)} ${r}`)
          .join(", ");
        const added = new Date(user.addedAt).toLocaleString();

        texts.push(
          `*${t("name", {}, c)}*: ${user.name || "N/A"}`,
          `*${t("jid", {}, c)}*: ${jid}`,
        );
        if (user.lid) texts.push(`*${t("lid", {}, c)}*: ${user.lid}`);
        texts.push(
          `*${t("roles", {}, c)}*: ${roles}`,
          `*${t("level", {}, c)}*: ${user.level}`,
          `*${t("xp", {}, c)}*: ${user.xp}`,
          `*${t("status", {}, c)}*: ${user.banned ? t("banned", { val: new Date(user.bannedAt).toLocaleString() }, c) : t("active", {}, c)}`,
          `*${t("added", {}, c)}*: ${added}`,
        );

        if (user.stats && Object.keys(user.stats).length > 0) {
          texts.push(`\n*📊 ${t("stats", {}, c)}*`);
          for (const [type, count] of Object.entries(user.stats)) {
            texts.push(`- ${type.replaceAll("Message", "")}: ${count}`);
          }
        }

        texts.push("");
      }

      await c.reply({ text: texts.join("\n").trim() }, { quoted: c.event });
    },
  },
  {
    name: "std-userman-del",
    cmd: ["user.del", "user.delete"],
    cat: "user",
    tags: ["admin", "user"],
    desc: "Delete user data",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const jids = c.parseJIDs();
      if (jids.length === 0)
        return await c.reply({
          text: t("no_user", {}, c),
        });

      for (let i = 0; i < jids.length; i++) {
        if (jids[i].includes("@lid")) jids[i] = await c.LIDToPN(jids[i]);
      }

      for (const jid of jids) {
        c.client().userManager.deleteUser(jid);
      }

      await c.reply({
        text: t("deleted_user", { count: jids.length }, c),
      });
    },
  },
  {
    name: "std-userman-role-add",
    cmd: ["role+"],
    cat: "user",
    tags: ["user", "role"],
    desc: "Add role to quoted or mentioned user",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const jids = c.parseJIDs();
      if (jids.length === 0)
        return await c.reply({
          text: t("no_user", {}, c),
        });

      for (let i = 0; i < jids.length; i++) {
        if (jids[i].includes("@lid")) jids[i] = await c.LIDToPN(jids[i]);
      }

      let role = c.argv?.r ?? c.argv?.role;
      if (role) {
        role = role.toLowerCase().trim();
      } else if (c.argv?._) {
        role = c.argv._.find((arg) =>
          Object.values(Role).includes(arg?.toLowerCase()?.trim()),
        )
          ?.toLowerCase()
          ?.trim();
      }

      if (!role)
        return await c.reply({
          text: t("no_role", {}, c),
        });

      if (!Object.values(Role).includes(role)) {
        return await c.reply({
          text: t("invalid_role", { val: Object.values(Role).join(", ") }, c),
        });
      }

      for (const jid of jids) {
        const user = c.client().userManager.getUser(jid);
        user.addRole(role);
        c.client().userManager.updateUser(jid, user);
      }

      await c.reply({
        text: t("added_role", { role, count: jids.length }, c),
      });
    },
  },
  {
    name: "std-userman-role-remove",
    cmd: ["role-"],
    cat: "user",
    tags: ["user", "role"],
    desc: "Remove role from quoted or mentioned user",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const jids = c.parseJIDs();
      if (jids.length === 0)
        return await c.reply({
          text: t("no_user", {}, c),
        });

      for (let i = 0; i < jids.length; i++) {
        if (jids[i].includes("@lid")) jids[i] = await c.LIDToPN(jids[i]);
      }

      let role = c.argv?.r ?? c.argv?.role;
      if (role) {
        role = role.toLowerCase().trim();
      } else if (c.argv?._) {
        role = c.argv._.find((arg) =>
          Object.values(Role).includes(arg?.toLowerCase()?.trim()),
        )
          ?.toLowerCase()
          ?.trim();
      }

      if (!role)
        return await c.reply({
          text: t("no_role", {}, c),
        });

      for (const jid of jids) {
        const user = c.client().userManager.getUser(jid);
        user.removeRole(role);
        c.client().userManager.updateUser(jid, user);
      }

      await c.reply({
        text: t("removed_role", { role, count: jids.length }, c),
      });
    },
  },
  {
    name: "std-userman-role-remove",
    cmd: ["role-"],
    cat: "user",
    tags: ["user", "role"],
    desc: "Remove role from quoted or mentioned user",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const jids = c.parseJIDs();
      if (jids.length === 0)
        return await c.reply({
          text: t("no_user", {}, c),
        });

      for (let i = 0; i < jids.length; i++) {
        if (jids[i].includes("@lid")) jids[i] = await c.LIDToPN(jids[i]);
      }

      let role = c.argv?.r ?? c.argv?.role;
      if (role) {
        role = role.toLowerCase().trim();
      } else if (c.argv?._) {
        role = c.argv._.find((arg) =>
          Object.values(Role).includes(arg?.toLowerCase()?.trim()),
        )
          ?.toLowerCase()
          ?.trim();
      }

      if (!role)
        return await c.reply({
          text: t("no_role", {}, c),
        });

      for (const jid of jids) {
        const user = c.client().userManager.getUser(jid);
        user.removeRole(role);
        c.client().userManager.updateUser(jid, user);
      }

      await c.reply({
        text: t("removed_role", { role, count: jids.length }, c),
      });
    },
  },
  {
    name: "std-userman-role-set",
    cmd: ["role="],
    cat: "user",
    tags: ["user", "role"],
    desc: "Set role (replace old roles) for quoted or mentioned user",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const jids = c.parseJIDs();
      if (jids.length === 0)
        return await c.reply({
          text: t("no_user", {}, c),
        });

      for (let i = 0; i < jids.length; i++) {
        if (jids[i].includes("@lid")) jids[i] = await c.LIDToPN(jids[i]);
      }

      let role = c.argv?.r ?? c.argv?.role;
      if (role) {
        role = role.toLowerCase().trim();
      } else if (c.argv?._) {
        role = c.argv._.find((arg) =>
          Object.values(Role).includes(arg?.toLowerCase()?.trim()),
        )
          ?.toLowerCase()
          ?.trim();
      }

      if (!role)
        return await c.reply({
          text: t("no_role", {}, c),
        });

      if (!Object.values(Role).includes(role)) {
        return await c.reply({
          text: t("invalid_role", { val: Object.values(Role).join(", ") }, c),
        });
      }

      for (const jid of jids) {
        c.client().userManager.updateUser(jid, { roles: [role] });
      }

      await c.reply({
        text: t("set_role", { role, count: jids.length }, c),
      });
    },
  },
  {
    name: "std-userman-lang",
    cmd: ["user.lang", "user.lang?"],
    cat: "user",
    tags: ["user", "lang"],
    desc: "Set your personal language preference.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      const isQuestion = c.cmd.endsWith("?");
      const lang = c.args?.trim()?.toLowerCase();
      const current = c.user?.lang || c.client()?.settings.get("lang") || "id";

      if (isQuestion || !lang) {
        return await c.reply({
          text: `${t("current_user", { key: "lang", val: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`,
        });
      }

      if (lang === "reset" || lang === "delete" || lang === "clear") {
        c.client().userManager.updateUser(c.senderJid, { lang: null });
        return await c.reply({ text: t("user_reset", { key: "lang" }, c) });
      }

      c.client().userManager.updateUser(c.senderJid, { lang });
      await c.reply({ text: t("user_success", { key: "lang", val: lang }, c) });
    },
  },
  {
    name: "std-userman-tz",
    cmd: ["user.tz", "user.tz?"],
    cat: "user",
    tags: ["user", "tz"],
    desc: "Set your personal timezone preference.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      const isQuestion = c.cmd.endsWith("?");
      const tz = c.args?.trim();
      const current = c.user?.tz || c.client()?.settings.get("tz") || "UTC";

      if (isQuestion || !tz) {
        return await c.reply({
          text: `${t("current_user", { key: "tz", val: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`,
        });
      }

      if (tz === "reset" || tz === "delete" || tz === "clear") {
        c.client().userManager.updateUser(c.senderJid, { tz: null });
        return await c.reply({ text: t("user_reset", { key: "tz" }, c) });
      }

      if (!isValidTimezone(tz)) {
        return await c.reply({ text: t("invalid_tz", {}, c) });
      }

      c.client().userManager.updateUser(c.senderJid, { tz });
      await c.reply({ text: t("user_success", { key: "tz", val: tz }, c) });
    },
  },
];
