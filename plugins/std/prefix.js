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
import pen from "../../src/pen.js";
import { Role } from "../../src/roles.js";
import { getPrefixes, setPrefixes } from "../../src/settings.js";
import { translate } from "../../src/translate.js";

const t = translate({
  en: {
    added: "List prefix that has *added* :",
    removed: "List prefix that has *removed* :",
    current: "Currrent list prefix registered :",
    nb: "NB :",
    remove_hint: "{pattern}- _to remove_",
    add_hint: "{pattern}+ _to add_",
    split_hint: "_Split multiple prefix with space_",
    example_hint: "_example :_",
  },
  id: {
    added: "Daftar awalan yang telah *ditambahkan* :",
    removed: "Daftar awalan yang telah *dihapus* :",
    current: "Daftar awalan yang terdaftar saat ini :",
    nb: "Catatan :",
    remove_hint: "{pattern}- _untuk menghapus_",
    add_hint: "{pattern}+ _untuk menambah_",
    split_hint: "_Pisahkan beberapa awalan dengan spasi_",
    example_hint: "_contoh :_",
  },
});

/** @type {import('../../src/plugin.js').Plugin} */
export default [
  {
    cmd: ["prefix", "prefix+", "prefix-", "pre", "pre+", "pre-"],
    timeout: 15,
    cat: "system",
    tags: ["system"],
    desc: "Set / remove the prefix (split with space).",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      let newPrefix = c.args?.trim()?.split(" ");
      if (!newPrefix) newPrefix = [];
      newPrefix = newPrefix.filter((v, i, a) => a.indexOf(v) === i && v);

      let allow = getPrefixes();
      if (!allow) allow = [];

      let pattern = c.pattern;
      let status = "";
      if (c.pattern.endsWith("+")) {
        pattern = c.pattern.slice(0, -1);
        allow.push(...newPrefix.filter((v) => !allow.includes(v)));
        status = "added";
      } else if (c.pattern.endsWith("-")) {
        pattern = c.pattern.slice(0, -1);
        allow = allow.filter((v) => !newPrefix.includes(v));
        status = "removed";
      }

      if (status.length > 0) {
        setPrefixes(allow);
        c.handler().setPrefix(allow);
      }

      let text = "";
      if (status.length > 0 && newPrefix?.length > 0) {
        text = `${t(status, {}, c)}\n${newPrefix.map((v) => `${v}`).join(", ")}`;
      } else {
        text = `${t("current", {}, c)}\n${allow.map((v) => `\`${v}\``).join(", ")}`;
      }

      if (text.length === 0) return await c.react("🤔");
      c.reply(
        {
          text:
            text +
            `\n\n${t("nb", {}, c)}\n  *${t("remove_hint", { pattern }, c)}*\n  *${t("add_hint", { pattern }, c)}*` +
            `\n\n${t("split_hint", {}, c)}` +
            `\n\n${t("example_hint", {}, c)}\n\`${pattern}+ ' " ! \\ /\``,
        },
        { quoted: c.event },
      );
    },
  },
];

/** @param {import('../../src/handler.js').Handler} hand */
export const pre = (hand) => {
  const prefixes = getPrefixes();
  if (prefixes?.length > 0) {
    pen.Debug("Setting prefix to", prefixes, "from", hand.prefix);
    hand?.setPrefix(prefixes);
  }
};
