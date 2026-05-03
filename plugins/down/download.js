/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { instagramGetUrl } from "instagram-url-direct";
import rahad from "rahad-all-downloader-v2";

const { alldl } = rahad;

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
 * Formats a video caption with metadata in a professional layout.
 * @param {any} video
 * @param {import('../../src/context.js').Ctx} c
 * @param {string} platform
 * @returns {string}
 */
function formatCaption(video, c, platform) {
  const parts = [
    `*${video.title?.trim() || "Media Content"}*`,
    "━━━━━━━━━━━━━━━━━━",
    `*${t("platform", {}, c)}:* ${platform}`,
    `*${t("author", {}, c)}:* ${video.uploader || video.author || t("unknown", {}, c)}`,
  ];

  if (video.duration_string || video.duration) {
    parts.push(
      `*${t("duration", {}, c)}:* ${video.duration_string || video.duration}`,
    );
  }

  if (video.view_count || video.views) {
    const views = video.view_count || video.views;
    parts.push(
      `*${t("views", {}, c)}:* ${views.toLocaleString(c.user()?.lang || "en-US")}`,
    );
  }

  return parts.join("\n");
}

/**
 * Downloads media from Instagram using instagram-url-direct
 * @param {string} link
 * @returns {Promise<any[]>}
 */
async function getInstagramMedia(link) {
  try {
    const data = await instagramGetUrl(link);
    if (data?.url_list && Array.isArray(data.url_list)) {
      return data.url_list.map((url) => ({
        url: url,
        title: "Instagram Post",
        type: url.includes(".mp4") ? "video" : "image",
        ext: url.includes(".mp4") ? "mp4" : "jpg",
        uploader: "Instagram User",
      }));
    }
    return [];
  } catch (e) {
    pen.Error("Instagram DL error:", e.message);
    return [];
  }
}

/**
 * Downloads media from various platforms using rahad-all-downloader-v2
 * @param {string} link
 * @returns {Promise<any[]>}
 */
async function getGenericMedia(link) {
  try {
    const data = await alldl(link);
    if (!data?.data) return [];

    const result = data.data;
    const entries = [];

    const video = result.video || result.videoUrl;
    if (video) {
      entries.push({
        url: video,
        title: result.title || "Social Media Video",
        type: "video",
        ext: "mp4",
        uploader: result.author || "User",
      });
    }

    if (result.photo && Array.isArray(result.photo)) {
      result.photo.forEach((p, i) => {
        entries.push({
          url: p,
          title: `${result.title || "Social Media Photo"} (${i + 1})`,
          type: "image",
          ext: "jpg",
          uploader: result.author || "User",
        });
      });
    }

    if (entries.length === 0 && result.low) {
      entries.push({
        url: result.high || result.low,
        title: result.title || "Media Content",
        type: "video",
        ext: "mp4",
        uploader: result.author || "User",
      });
    }

    return entries;
  } catch (e) {
    pen.Error("Generic DL error:", e.message);
    return [];
  }
}

const REGEX_LINKS =
  /https?:\/\/(www\.)?(instagram\.com|tiktok\.com|vt\.tiktok\.com|youtube\.com|youtu\.be|threads\.net|facebook\.com|fb\.watch)\/[^\s]+/g;

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ["down", "dl"],
  cat: "downloader",
  desc: "Multi-platform downloader (IG, TikTok, FB, YT, Threads).",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],

  exec: async (c) => {
    let links = [];
    if (c.isCMD) {
      links = c.argv?._?.filter((arg) => /^https?:\/\//.test(arg)) || [];
    } else {
      const text = c.text || "";
      links = text.match(REGEX_LINKS) || [];
    }

    if (!links || links.length === 0) {
      if (c.isCMD) return c.react("❓");
      return;
    }

    for (const link of links) {
      try {
        const isInstagram = link.includes("instagram.com");
        const platform = isInstagram
          ? "Instagram"
          : link.includes("tiktok.com")
            ? "TikTok"
            : link.includes("youtube.com") || link.includes("youtu.be")
              ? "YouTube"
              : link.includes("threads.net")
                ? "Threads"
                : link.includes("facebook.com") || link.includes("fb.watch")
                  ? "Facebook"
                  : "Web";

        let entries = [];

        if (isInstagram) {
          entries = await getInstagramMedia(link);
        }

        if (entries.length === 0) {
          entries = await getGenericMedia(link);
        }

        if (entries.length === 0) {
          if (c.isCMD) {
            await c.react("⚠️");
            c.reply({ text: t("not_retrieved", { val: link }, c) });
          }
          continue;
        }

        await c.react("⌛");

        for (const entry of entries) {
          const id = entry.id || entry.url;
          const cached = storeMsg.get(id);
          if (cached && !c.argv?.force) {
            await c.replyRelay(cached.message);
            continue;
          }

          let buffer;
          try {
            const res = await fetch(entry.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            buffer = Buffer.from(await res.arrayBuffer());
          } catch (err) {
            pen.Error(`Fetch failed for ${entry.url}:`, err.message);
            continue;
          }

          if (!buffer || buffer.length === 0) {
            pen.Error(`Download failed for: ${entry.title || id}`);
            if (c.isCMD)
              c.reply({
                text: t("failed", { val: entry.title || "Media" }, c),
              });
            continue;
          }

          const type =
            entry.type || (entry.url.includes(".mp4") ? "video" : "image");
          const content = {};

          if (type === "image") {
            content.image = buffer;
          } else if (type === "audio") {
            content.audio = buffer;
            content.mimetype = "audio/mp4";
          } else {
            content.video = buffer;
            content.mimetype = "video/mp4";
          }

          content.caption = formatCaption(entry, c, platform);
          const resp = await c.reply(content, { quoted: c.event });

          if (resp && id) storeMsg.set(id, resp);
        }
        await c.react("✅");
      } catch (err) {
        pen.Error(`Downloader error [${link}]:`, err.message);
        await c.react("❌");
        if (c.isCMD) c.reply({ text: t("failed", { val: link }, c) });
      }
    }
  },
};
