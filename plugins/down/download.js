/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import browser from "../../src/browser.js";
import { MESSAGES_UPSERT } from "../../src/const.js";
import pen from "../../src/pen.js";
import { Role } from "../../src/roles.js";
import { storeMsg } from "../../src/settings.js";
import { translate } from "../../src/translate.js";

const t = translate({
  en: {
    downloading: "Processing your request...",
    failed: "❌ *Failed to download:* {val}",
    not_retrieved: "⚠️ *Content unavailable:* {val}",
    author: "👤 Author",
    duration: "🕒 Duration",
    views: "👁️ Views",
    platform: "🌐 Platform",
    unknown: "Unknown",
    na: "N/A",
  },
  id: {
    downloading: "Sedang memproses permintaan Anda...",
    failed: "❌ *Gagal mengunduh:* {val}",
    not_retrieved: "⚠️ *Konten tidak tersedia:* {val}",
    author: "👤 Penulis",
    duration: "🕒 Durasi",
    views: "👁️ Dilihat",
    platform: "🌐 Platform",
    unknown: "Tidak diketahui",
    na: "N/A",
  },
});

/**
 * Formats a video caption with metadata.
 * @param {any} result
 * @param {import('../../src/context.js').Ctx} c
 * @returns {string}
 */
function formatCaption(result, c) {
  const parts = [`*${t("platform", {}, c)}:* ${result.platform || "Web"}`];

  const author = result.metadata?.author;
  if (author) {
    parts.push(`*${t("author", {}, c)}:* ${author}`);
  }

  const duration = result.media?.duration;
  if (duration) {
    parts.push(`*${t("duration", {}, c)}:* ${duration}`);
  }

  const title = result.title?.trim() || "Media Content";
  if (title) {
    parts.push(`*${title}*`);
  }

  const description = result.metadata?.description?.trim();
  if (description && description !== title) {
    parts.push("", description);
  }

  return parts.join("\n");
}

const REGEX_LINKS =
  /https?:\/\/(www\.)?(instagram\.com|tiktok\.com|vt\.tiktok\.com|youtube\.com|youtu\.be|threads\.net|facebook\.com|fb\.watch|pin\.it|pinterest\.com|capcut\.com|likee\.video|l\.likee)\/[^\s]+/g;

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ["down", "dl"],
  cat: "downloader",
  desc: "Multi-platform downloader (IG, TikTok, FB, YT, Threads, Pinterest, CapCut, Likee).",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],

  exec: async (c) => {
    const quotedText = c.quotedText || "";
    let links = c.argv?._?.filter((arg) => /^https?:\/\//.test(arg)) || [];

    if (links.length === 0) {
      links = quotedText.match(REGEX_LINKS) || [];
    }

    if (!links || links.length === 0) {
      return c.react("❓");
    }

    for (const link of links) {
      try {
        await c.react("⌛");

        const result = await browser.download(link);

        if (!result?.media?.urls?.length) {
          await c.react("⚠️");
          c.reply({ text: t("not_retrieved", { val: link }, c) });
          continue;
        }

        for (const url of result.media.urls) {
          const id = url;
          const cached = storeMsg.get(id);
          if (cached && !c.argv?.force) {
            await c.replyRelay(cached.message);
            continue;
          }

          /** @type {import('baileys').AnyMessageContent} */
          const content = {};
          content.caption = formatCaption(result, c);
          if (result.media.type === "video") {
            content.video = { url };
          } else if (result.media.type === "image") {
            content.image = { url };
          }

          const resp = await c.reply(content, { quoted: c.event });

          if (resp && id) storeMsg.set(id, resp);
        }
        await c.react("✅");
      } catch (err) {
        pen.Error(`Downloader error [${link}]:`, err.message);
        await c.react("❌");
        c.reply({ text: t("failed", { val: link }, c) });
      }
    }
  },
};
