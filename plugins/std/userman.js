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
import { translate } from "../settings.js";

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
    no_role: "Please specify a role using -r or --role",
    invalid_role: "Invalid role. Available roles: {val}",
    added_role: "Added role *{role}* to {count} user(s).",
    removed_role: "Removed role *{role}* from {count} user(s).",
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
    no_role: "Silakan tentukan peran menggunakan -r atau --role",
    invalid_role: "Peran tidak valid. Peran tersedia: {val}",
    added_role: "Menambahkan peran *{role}* ke {count} user.",
    removed_role: "Menghapus peran *{role}* dari {count} user.",
  },
});

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    cmd: ["user"],

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

      const texts = [t("header"), ""];
      for (const jid of targets) {
        const name = c.getName(jid);
        const updateData = { name, jid };

        const lid = await c.PNToLID(jid).catch(() => null);
        if (lid) {
          updateData.lid = lid;
          const lidName = c.getName(lid);
          if (lidName) updateData.name = lidName;
        }

        const user = c.handler().userManager.updateUser(jid, updateData);
        if (!user) continue;

        const roles = user.roles
          .map((r) => `${getRoleBadge(r)} ${r}`)
          .join(", ");
        const added = new Date(user.addedAt).toLocaleString();

        texts.push(
          `*${t("name")}*: ${user.name || "N/A"}`,
          `*${t("jid")}*: ${jid}`,
        );
        if (user.lid) texts.push(`*${t("lid")}*: ${user.lid}`);
        texts.push(
          `*${t("roles")}*: ${roles}`,
          `*${t("level")}*: ${user.level}`,
          `*${t("xp")}*: ${user.xp}`,
          `*${t("status")}*: ${user.banned ? t("banned", { val: new Date(user.bannedAt).toLocaleString() }) : t("active")}`,
          `*${t("added")}*: ${added}`,
        );

        if (user.stats && Object.keys(user.stats).length > 0) {
          texts.push(`\n*📊 ${t("stats")}*`);
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
          text: t("no_user"),
        });

      for (let i = 0; i < jids.length; i++) {
        if (jids[i].includes("@lid")) jids[i] = await c.LIDToPN(jids[i]);
      }

      const role = c.argv?.r ?? c.argv?.role;
      if (!role)
        return await c.reply({
          text: t("no_role"),
        });

      if (!Object.values(Role).includes(role)) {
        return await c.reply({
          text: t("invalid_role", { val: Object.values(Role).join(", ") }),
        });
      }

      for (const jid of jids) {
        const user = c.handler().userManager.getUser(jid);
        if (!user.roles.includes(role)) {
          user.roles.push(role);
          c.handler().userManager.updateUser(jid, { roles: user.roles });
        }
      }

      await c.reply({
        text: t("added_role", { role, count: jids.length }),
      });
    },
  },
  {
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
          text: t("no_user"),
        });

      for (let i = 0; i < jids.length; i++) {
        if (jids[i].includes("@lid")) jids[i] = await c.LIDToPN(jids[i]);
      }

      const role = c.argv?.r ?? c.argv?.role;
      if (!role)
        return await c.reply({
          text: t("no_role"),
        });

      for (const jid of jids) {
        const user = c.handler().userManager.getUser(jid);
        if (user.roles.includes(role)) {
          user.roles = user.roles.filter((r) => r !== role);
          if (user.roles.length === 0) user.roles.push(Role.GUEST);
          c.handler().userManager.updateUser(jid, { roles: user.roles });
        }
      }

      await c.reply({
        text: t("removed_role", { role, count: jids.length }),
      });
    },
  },
];
