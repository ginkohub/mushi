/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Role } from "../../src/roles.js";
import { formatElapse } from "../../src/tools.js";
import { translate } from "../settings.js";

const t = translate({
  en: {
    no_cmd: "No command found :",
    detail: "Detail of",
    cmds: "Cmds",
    no_prefix: "NoPrefix",
    hidden: "Hidden",
    timeout: "Timeout",
    disabled: "Disabled",
    cat: "Cat",
    desc: "Desc",
    path: "Path",
    available: "*# Available menu*",
    uptime: "*Uptime:*",
    prefix: "*Prefix :*",
    footer: "{cmd} cmd, {listener} listener & {disabled} disabled",
    ad_title: "Mushi Bot",
    ad_body: "Simple a multi porpuses whatsapp bot.",
  },
  id: {
    no_cmd: "Perintah tidak ditemukan :",
    detail: "Detail dari",
    cmds: "Perintah",
    no_prefix: "Tanpa Awalan",
    hidden: "Tersembunyi",
    timeout: "Waktu Habis",
    disabled: "Dinonaktifkan",
    cat: "Kategori",
    desc: "Deskripsi",
    path: "Lokasi",
    available: "*# Menu yang tersedia*",
    uptime: "*Waktu Aktif:*",
    prefix: "*Awalan :*",
    footer: "{cmd} perintah, {listener} pendengar & {disabled} dinonaktifkan",
    ad_title: "Mushi Bot",
    ad_body: "Bot whatsapp sederhana dengan banyak fungsi.",
  },
});

const emoMap = {
  info: "ℹ️",
  fun: "🎉",
  admin: "🔧",
  util: "🔧",
  system: "⚙️",
  dev: "⚠️",
  defense: "🛡️",
  net: "🌐",
  ai: "❇️",
  whatsapp: "💬",
};

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: "menu",
  
  cat: "info",
  desc: "Show the menu of commands",
  roles: [Role.GUEST],
  exec: async (c) => {
    const prefix = c.pattern[0];
    const texts = [];
    const withDesc = c.argv?.desc || c.argv?.d;

    if (c.args?.length > 0 && !withDesc) {
      /** @type {Map<string, import('../../src/plugin.js').Plugin>} */
      const plugins = new Map();
      const userKeys = c.args?.toLowerCase().split(" ");

      if (userKeys) {
        c.handler()?.plugins?.forEach((p, k) => {
          if (!p?.cmd) return;

          if (Array.isArray(p?.cmd)) {
            p.cmd.forEach((x) => {
              if (userKeys.includes(x.toLowerCase())) plugins.set(k, p);
            });
          } else if (typeof p.cmd === "string") {
            if (userKeys.includes(p?.cmd?.toLowerCase())) plugins.set(k, p);
          }
        });
      } else {
        texts.push(t("no_cmd"), c.args);
      }

      for (const [k, p] of plugins?.entries() ?? []) {
        texts.push(
          `${t("detail")} \`${k}\``,
          `- ${t("cmds")} : ${Array.isArray(p.cmd) ? p.cmd?.map((c) => `\`${prefix + c}\``).join(", ") : `\`${prefix + p.cmd}\``}`,
          `- ${t("no_prefix")} : ${p.noPrefix ? "✅" : "❌"}`,
          `- ${t("hidden")} : ${p.hidden ? "✅" : "❌"}`,
          `- ${t("timeout")} : ${p.timeout ? p.timeout : "∞"}`,
          `- ${t("disabled")} : ${p.disabled ? "✅" : "❌"}`,
          `- ${t("cat")}  : ${p.cat}`,
          `- ${t("desc")} : ${p.desc}`,
          `- ${t("path")} : ${p.location}`,
          "",
        );
      }
    } else {
      texts.push(t("available"));

      const since = Date.now() - c.handler()?.client?.dateCreated;
      texts.push(
        "",
        `${t("uptime")} ${formatElapse(since, " ")}`,
        `${t("prefix")} ` +
        c.handler()
          ?.prefix?.map((p) => `\`${p}\``)
          .join(", "),
      );

      const categories = new Map();
      let cmdCount = 0;
      for (const dataCMD of c.handler()?.cmds?.values() ?? []) {
        const p = c.handler()?.plugins?.get(dataCMD?.id);
        if (!p || p?.hidden) continue;
        if (!categories.has(p.cat)) categories.set(p.cat, new Map());

        const cat = categories.get(p.cat);
        if (cat.has(dataCMD?.id)) continue;

        const patt = Array.isArray(p.cmd) ? p.cmd[0] : p.cmd;

        cat.set(dataCMD?.id, {
          pre: `${p.noPrefix ? patt : prefix + patt}`,
          plugin: p,
        });
        cmdCount++;
      }

      const lascat = "";
      let disabledCount = 0;
      const cats = Array.from(categories.keys()).sort();
      for (const catname of cats) {
        const cat = categories.get(catname);
        if (catname !== lascat)
          texts.push(
            "",
            `*${emoMap[catname] ? emoMap[catname] : "🧩"} ${catname.toUpperCase()}*`,
          );
        if (cat.size > 0) {
          for (const [, patt] of cat.entries()) {
            if (patt.plugin.disabled) disabledCount++;
            texts.push(`  \`${patt.pre}\` ${patt.plugin.disabled ? "❗" : ""}`);
            if (withDesc) texts.push(`    _${patt.plugin.desc?.trim()}_`);
          }
        }
      }
      texts.push(
        "",
        t("footer", {
          cmd: cmdCount,
          listener: c.handler()?.listens?.size,
          disabled: disabledCount,
        }),
      );
    }

    if (texts.length > 1) {
      await c.reply(
        {
          text: texts.join("\n"),
          contextInfo: {
            externalAdReply: {
              title: t("ad_title"),
              body: t("ad_body"),
              renderLargerThumbnail: true,
              mediaType: 1,
              thumbnailUrl:
                "https://opengraph.githubassets.com/new/ginkohub/mushi",
              sourceUrl: "https://github.com/ginkohub/mushi",
              mediaUrl: "https://github.com/ginkohub/mushi",
            },
          },
        },
        { quoted: c.event },
      );
    }
  },
};
