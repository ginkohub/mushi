/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  getFile,
  getFlag,
  MESSAGES_UPSERT,
  Role,
  translate,
  translateText,
} from "#mushi";

const t = translate({
  en: {
    help_title: "✨ *RUMI QUOTES*",
    help_usage:
      "Use `.rumi` for a random quote. Use `--tr [lang]` to translate.",
    help_update: "⚙️ *Admin:* `.rumi.update` to sync/download quotes.",
    no_data: "❌ Quotes data not found! Use `{prefix}rumi.update` to download.",
    error: "❌ Failed to get quote.",
    sync_success: "✅ *Sync Success!*",
    sync_stats: "Successfully loaded {count} quotes.",
    sync_failed: "❌ *Sync Failed:* {error}",
  },
  id: {
    help_title: "✨ *KATA BIJAK RUMI*",
    help_usage:
      "Gunakan `.rumi` untuk kutipan acak. Gunakan `--tr [bahasa]` untuk terjemahan.",
    help_update: "⚙️ *Admin:* `.rumi.update` untuk sinkronisasi kutipan.",
    no_data:
      "❌ Data kutipan tidak ditemukan! Gunakan `{prefix}rumi.update` untuk mengunduh.",
    error: "❌ Gagal memuat kutipan.",
    sync_success: "✅ *Sinkronisasi Berhasil!*",
    sync_stats: "Berhasil memuat {count} kutipan.",
    sync_failed: "❌ *Sinkronisasi Gagal:* {error}",
  },
});

const JSON_URL = "https://ginkohub.github.io/data/quotes.json";
let quotes = [];

function loadQuotes() {
  try {
    const path = getFile("quotes.json");
    if (existsSync(path)) {
      quotes = JSON.parse(readFileSync(path, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load quotes.json:", e);
  }
}

async function ensureQuotes() {
  if (quotes.length > 0) return;
  try {
    const response = await fetch(JSON_URL);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        quotes = data;
        const path = getFile("quotes.json");
        writeFileSync(path, JSON.stringify(data, null, 2));
      }
    }
  } catch (e) {
    console.error("Failed to fetch quotes.json:", e);
  }
}

loadQuotes();

export default [
  {
    name: "faith-rumi",
    cmd: ["rumi", "rumi?"],
    includes: ["faith-rumi-updater"],
    cat: "faith",
    tags: ["info", "quotes"],
    desc: "Get random quotes of Jalaluddin Rumi translated to Indonesian",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (c.cmd.endsWith("?")) {
        const helpText = [
          t("help_title", {}, c),
          "",
          t("help_usage", {}, c),
          t("help_update", {}, c),
        ];
        return await c.reply(
          { text: helpText.join("\n") },
          { quoted: c.event },
        );
      }

      await ensureQuotes();

      if (quotes.length === 0) {
        return await c.reply(
          { text: t("no_data", { prefix: c.prefix }, c) },
          { quoted: c.event },
        );
      }

      try {
        const q = quotes[Math.floor(Math.random() * quotes.length)];
        const originalText = [`"${q.text}"`, `— _*${q.author}*_`].join("\n");

        const resp = await c.reply({ text: originalText }, { quoted: c.event });

        const args = c.args?.split(/\s+/) || [];
        const trIndex = args.findIndex((a) => a === "-t" || a === "--tr");

        if (trIndex !== -1) {
          try {
            const quotedJid =
              c.participant || (c.quotedMessage ? c.chat : null);
            const quotedUser = quotedJid ? c.client().getUser(quotedJid) : null;

            let targetLang = args[trIndex + 1];
            if (!targetLang || targetLang.startsWith("-")) {
              targetLang =
                quotedUser?.lang ||
                c.user?.lang ||
                c.chatData?.lang ||
                c.client()?.settings.get("lang") ||
                "id";
            }

            let translated = "";
            try {
              translated = await translateText(q.text, targetLang, "auto");
            } catch (_) {
              if (targetLang !== "id") {
                targetLang = "id";
                translated = await translateText(q.text, targetLang, "auto");
              }
            }

            if (
              translated &&
              translated.toLowerCase().trim() !== q.text.toLowerCase().trim()
            ) {
              const flag = getFlag(targetLang);
              const label = `${flag} :`;
              const formatted = [
                originalText,
                "",
                label,
                `"${translated}"`,
              ].join("\n");

              await c.reply({ text: formatted, edit: resp.key });
            }
          } catch (_) {}
        }
      } catch (e) {
        c.log().error(`rumi-error: ${e.stack || e}`);
        await c.reply({ text: t("error", {}, c) }, { quoted: c.event });
      }
    },
  },
  {
    name: "faith-rumi-updater",
    cmd: ["rumi.update"],
    cat: "faith",
    tags: ["info", "admin"],
    desc: "Sync quotes for Jalaluddin Rumi",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],
    exec: async (c) => {
      await c.react("⌛");
      try {
        const response = await fetch(JSON_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid data format: Expected an array");
        }

        const path = getFile("quotes.json");
        writeFileSync(path, JSON.stringify(data, null, 2));
        quotes = data;

        const stats = `${t("sync_success", {}, c)}\n\n${t("sync_stats", { count: data.length }, c)}`;

        await c.reply({ text: stats }, { quoted: c.event });
        await c.react("✅");
      } catch (e) {
        c.log().error(`rumi-sync-error: ${e.stack || e}`);
        await c.reply(
          { text: t("sync_failed", { error: e.message }, c) },
          { quoted: c.event },
        );
        await c.react("❌");
      }
    },
  },
];
