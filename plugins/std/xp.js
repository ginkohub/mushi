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
    xp_title: "🌟 *User XP*",
    xp_user: "User: @{user}",
    xp_amount: "XP: *{xp}*",
    xp_level: "Level: *{level}*",
    lb_title: "🏆 *XP Leaderboard*",
    lb_empty: "No one has XP yet!",
    lb_format: "{rank}. *{name}* - {xp} XP{tail}",
  },
  id: {
    xp_title: "🌟 *XP Pengguna*",
    xp_user: "Pengguna: @{user}",
    xp_amount: "XP: *{xp}*",
    xp_level: "Level: *{level}*",
    lb_title: "🏆 *Papan Peringkat XP*",
    lb_empty: "Belum ada yang punya XP!",
    lb_format: "{rank}. *{name}* - {xp} XP{tail}",
  },
});

/** @type {import('#mushi').Plugin[]} */
export default [
  {
    name: "std-xp",
    cmd: ["xp"],
    cat: "utility",
    desc: "Check your or someone else's XP.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      const targetJid = c.parseJIDs(0, 1)[0] || c.sender;
      const user = c.client().getUser(targetJid);
      const mention = `@${targetJid.split("@")[0]}`;

      const text = [
        t("xp_title", {}, c),
        "",
        t("xp_user", { user: mention }, c),
        t("xp_amount", { xp: user.xp }, c),
        t("xp_level", { level: user.level }, c),
      ].join("\n");

      await c.reply({ text, mentions: [targetJid] }, { quoted: c.event });
    },
  },
  {
    name: "std-lb",
    cmd: ["lb", "leaderboard"],
    cat: "utility",
    desc: "Show the top 10 users with the most XP.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      const userManager = c.client().userManager;
      const keys = Array.from(userManager.storage.keys());
      const users = keys
        .map((key) => {
          const u = userManager.getUser(key);
          return {
            jid: key,
            name: u.name || c.getName(key) || key.split("@")[0],
            xp: u.xp || 0,
          };
        })
        .filter((u) => u.xp > 0)
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 10);

      if (users.length === 0) {
        return await c.reply({ text: t("lb_empty", {}, c) });
      }

      const list = users
        .map((u, i) =>
          t(
            "lb_format",
            { rank: i + 1, name: u.name, xp: u.xp, tail: i === 0 ? " 👑" : "" },
            c,
          ),
        )
        .join("\n");

      const text = `${t("lb_title", {}, c)}\n\n${list}`;
      await c.reply({ text });
    },
  },
];
