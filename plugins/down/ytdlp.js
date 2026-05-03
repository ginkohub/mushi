/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import YtDlpWrap from "yt-dlp-wrap";
import { MESSAGES_UPSERT } from "../../src/const.js";
import pen from "../../src/pen.js";
import { Role } from "../../src/roles.js";
import { storeMsg } from "../../src/settings.js";

const BIN_DIR = resolve("./bin");
const YTDLP_PATHS = [
  join(BIN_DIR, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"),
  resolve("./node_modules/.bin/yt-dlp"),
  resolve("~/bin/yt-dlp"),
  resolve("bin/yt-dlp"),
];

/** @type {Promise<YtDlpWrap> | null} */
let ytDlpPromise = null;

/**
 * Resolves the yt-dlp binary path or downloads it if missing.
 * @returns {Promise<string>}
 */
async function resolveBinary() {
  for (const path of YTDLP_PATHS) {
    if (existsSync(path)) return path;
  }

  try {
    if (!existsSync(BIN_DIR)) mkdirSync(BIN_DIR, { recursive: true });
    pen.Info("yt-dlp binary not found. Downloading to ./bin...");
    return await YtDlpWrap.downloadBinary(BIN_DIR);
  } catch (e) {
    pen.Error(
      "Failed to download yt-dlp binary, falling back to system PATH:",
      e,
    );
    return "yt-dlp";
  }
}

/**
 * Returns a singleton instance of YtDlpWrap.
 * @returns {Promise<YtDlpWrap>}
 */
async function getYT() {
  if (!ytDlpPromise) {
    ytDlpPromise = resolveBinary().then((bin) => new YtDlpWrap(bin));
  }
  return ytDlpPromise;
}

// Pre-initialize to speed up first use
getYT().catch((e) => pen.Error("yt-dlp pre-initialization failed:", e));

/**
 * Formats a video caption with metadata.
 * @param {any} video
 * @returns {string}
 */
function formatCaption(video) {
  const parts = [
    `*${video.title}*`,
    "",
    `*Author:* ${video.uploader || "Unknown"}`,
    `*Duration:* ${video.duration_string || "N/A"}`,
    `*Views:* ${video.view_count?.toLocaleString("en-US") ?? "N/A"}`,
  ];
  return parts.join("\n");
}

/**
 * Downloads a video from a link and returns the buffer.
 * @param {YtDlpWrap} ytDlp
 * @param {string} link
 * @returns {Promise<Buffer>}
 */
async function downloadVideo(ytDlp, link) {
  return await ytDlp.getBuffer(link, ["-f", "best[ext=mp4]/best"]);
}

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ["ytdlp"],
  cat: "downloader",
  tags: ["youtube", "downloader", "video", "yt-dlp"],
  desc: "Download videos from supported sites using direct links.",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],

  exec: async (c) => {
    const links = c.argv?._?.filter((arg) => /^https?:\/\//.test(arg)) || [];
    if (links.length === 0) return c.react("❓");

    try {
      c.react("⌛");

      const ytDlp = await getYT();

      for (const link of links) {
        try {
          const video = await ytDlp.getVideoInfo(link);
          if (!video?.id) {
            pen.Warn(`Could not retrieve info for: ${link}`);
            continue;
          }

          const cached = storeMsg.get(video.id);
          if (cached && !c.argv.force) {
            await c.replyRelay(cached.message);
            continue;
          }

          const buffer = await downloadVideo(ytDlp, link);
          if (!buffer || buffer.length === 0) {
            pen.Error(`Download failed for: ${video.title}`);
            continue;
          }

          const resp = await c.reply(
            {
              video: buffer,
              mimetype: "video/mp4",
              fileName: `${video.title}.mp4`,
              caption: formatCaption(video),
            },
            { quoted: c.event },
          );

          if (resp) storeMsg.set(video.id, resp);
        } catch (err) {
          pen.Error(`Error processing link [${link}]:`, err.message);
        }
      }
    } catch (e) {
      pen.Error("Fatal ytdlp error:", e);
      c.react("❌");
    }
  },
};
