/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path, { resolve } from 'node:path';
import { promisify } from 'node:util';
import { MESSAGES_UPSERT } from '../../src/const.js';
import pen from '../../src/pen.js';
import { storeMsg } from '../settings.js';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { google } from 'googleapis';
import { Role } from '../../src/roles.js';

const execFileAsync = promisify(execFile);
const ytdlps = [
  resolve('./node_modules/.bin/yt-dlp'),
  resolve('~/bin/yt-dlp'),
  resolve('bin/yt-dlp')
];

const youtube = google.youtube('v3');

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ['play'],
  cat: 'downloader',
  tags: ['youtube', 'downloader', 'mp3', 'yt-dlp'],
  desc: 'Search for a video on YouTube using yt-dlp, and download the audio.',
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],

  exec: async (c) => {
    await c.react('🔍');
    const query = c.argv?._?.join(' ');
    if (!query) {
      return c.react('❓');
    }

    /** @type {string} - os temp dir */
    const tempDir = os.tmpdir();
    let audioFilePath = '';

    try {
      /** Search the video */
      const apiKey = process.env.GOOGLE_API_KEY ?? process.env.YOUTUBE_API_KEY ?? process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return c.react('🔑');
      }

      const searchRes = await youtube.search.list({
        auth: apiKey,
        part: 'snippet',
        q: query,
        maxResults: 1,
        type: 'video',
      });

      if (!searchRes?.data?.items?.length === 0) return await c.react('❓');
      const videoYT = searchRes?.data?.items[0];

      /* Check on database */
      /** @type {import('baileys').proto.IWebMessageInfo }*/
      let msg = storeMsg.get(videoYT?.id?.videoId);
      if (msg && !c.argv.force) {
        try {
          const ephemeral = c.handler().getTimer(c.chat);
          msg.message.audioMessage.contextInfo.expiration = ephemeral;
        } catch (e) {
          pen.Error('set-expiration', e);
        }
        return c.replyRelay(msg.message);
      } else {

        /** Check the binary */
        let ytdlpBin = 'yt-dlp';
        for (const yp of ytdlps) {
          if (existsSync(yp)) {
            ytdlpBin = yp;
            break;
          }
        }

        pen.Debug(`Using yt-dlp binary: ${ytdlpBin}`)

        try {
          await execFileAsync(ytdlpBin, ['--version']);
        } catch (e) {
          pen.Error('yt-dlp is not installed or not in PATH.', e);
          return c.reply('`yt-dlp` is not installed. Please install it to use this command.');
        }

        const { stdout: searchStdout } = await execFileAsync(ytdlpBin, ['--dump-json', 'https://www.youtube.com/watch?v=' + videoYT?.id?.videoId]);

        if (!searchStdout) {
          return await c.react('❓');
        }

        const video = JSON.parse(searchStdout);

        /** @type {import('baileys').proto.IWebMessageInfo} */
        let msg = storeMsg.get(video.id);
        if (msg && !c.argv.force) {
          return c.replyRelay(msg.message);
        }

        const videoUrl = video.webpage_url;
        const thumbUrl = video.thumbnail;

        const outputTemplate = path.join(tempDir, `${video.id}.%(ext)s`);

        await execFileAsync(ytdlpBin, [
          '-f', 'bestaudio[ext=m4a]/bestaudio',
          '-o', outputTemplate,
          video.id
        ]);

        const files = await fs.readdir(tempDir);
        const downloadedFile = files.find(f => f.startsWith(video.id));
        if (!downloadedFile) {
          pen.Error('Downloaded file not found for video ID:', video.id);
          return c.react('🔥');
        }
        audioFilePath = path.join(tempDir, downloadedFile);
        const fileExtension = path.extname(downloadedFile).slice(1);

        const audioBuffer = await fs.readFile(audioFilePath);

        let mimetype = 'audio/mp4'; /* default for m4a */
        if (fileExtension === 'mp3') mimetype = 'audio/mpeg';
        else if (fileExtension === 'ogg') mimetype = 'audio/ogg';
        else if (fileExtension === 'webm') mimetype = 'audio/webm';

        const caption = `*${video.title}*\n\n` +
          `*Author:* ${video.uploader}\n` +
          `*Duration:* ${video.duration_string}\n` +
          `*Views:* ${video.view_count?.toLocaleString('en-US') ?? 'N/A'}\n\n` +
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
            }
          }
        });
        if (resp) storeMsg.set(video.id, resp);
      }
    } catch (e) {
      pen.Error(e);
      await c.react('❌');
    } finally {
      if (audioFilePath) {
        try {
          await fs.unlink(audioFilePath);
        } catch (unlinkErr) {
          pen.Error('Failed to delete temp audio file:', unlinkErr);
        }
      }
      await c.react('');
    }
  }
};
