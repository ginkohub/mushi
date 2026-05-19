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

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  name: "down-play",
  cmd: ["play"],
  cat: "downloader",
  tags: ["youtube", "downloader", "mp3", "yt-dlp"],
  desc: "Search for a video on YouTube using yt-dlp, and download the audio.",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],

  exec: async (c) => {
    await c.react("🔍");
    const query = c.argv?._?.join(" ");
    if (!query) {
      return c.react("❓");
    }

    try {
      const ytDlp = await getYT();

      /** Search the video */
      const video = await ytDlp.getVideoInfo(`ytsearch1:${query}`);

      if (!video?.id) {
        return await c.react("❓");
      }

      /* Check on database */
      /** @type {import('baileys').proto.IWebMessageInfo }*/
      const msg = c.client()?.store.get(video.id);
      if (msg && !c.argv.force) {
        try {
          const ephemeral = c.handler().getTimer(c.chat);
          msg.message.audioMessage.contextInfo.expiration = ephemeral;
        } catch (e) {
          pen.Error("set-expiration", e);
        }
        return c.replyRelay(msg.message);
      } else {
        const videoUrl = video.webpage_url;
        const thumbUrl = video.thumbnail;

        const audioBuffer = await ytDlp.getBuffer(video.id, [
          "-f",
          "bestaudio",
          "-x",
          "--audio-format",
          "mp3",
        ]);

        if (!audioBuffer || audioBuffer.length === 0) {
          pen.Error("Downloaded buffer is empty for video ID:", video.id);
          return c.react("🔥");
        }

        const fileExtension = "mp3";
        const mimetype = "audio/mpeg";

        const caption =
          `*${video.title}*\n\n` +
          `*Author:* ${video.uploader}\n` +
          `*Duration:* ${video.duration_string}\n` +
          `*Views:* ${video.view_count?.toLocaleString("en-US") ?? "N/A"}\n\n` +
          `_${video.description}_`;

        const resp = await c.reply({
          audio: audioBuffer,
          mimetype: mimetype,
          fileName: `${video.title}.${fileExtension}`,
          caption: caption,
          contextInfo: {
            externalAdReply: {
              title: video.title,
              body: video.uploader,
              mediaType: 1,
              mediaUrl: videoUrl,
              sourceUrl: videoUrl,
              thumbnailUrl: thumbUrl,
            },
          },
        });
        if (resp) c.client()?.store.set(video.id, resp);
      }
    } catch (e) {
      pen.Error(e);
      await c.react("❌");
    } finally {
      await c.react("");
    }
  },
};
