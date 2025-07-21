/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { google } from 'googleapis';
import axios from 'axios';
import { MESSAGES_UPSERT } from '../../src/const.js';
import { eventNameIs, fromMe, midwareAnd, midwareOr } from '../../src/midware.js';
import pen from '../../src/pen.js';
import { fromOwner, storeMsg } from '../settings.js';

const youtube = google.youtube('v3');

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ['play'],
  cat: 'downloader',
  tags: ['youtube', 'downloader', 'mp3'],
  desc: 'Search for a video on YouTube, download the audio.',
  midware: midwareAnd(
    eventNameIs(MESSAGES_UPSERT),
    midwareOr(fromOwner, fromMe),
  ),

  exec: async (c) => {
    await c.react('🔍');
    const query = c.argv?._?.join(' ');
    if (!query) {
      return c.react('❓');
    }

    const apiKey = process.env.GOOGLE_API_KEY ?? process.env.YOUTUBE_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return c.react('🔑');
    }

    try {
      const searchRes = await youtube.search.list({
        auth: apiKey,
        part: 'snippet',
        q: query,
        maxResults: 1,
        type: 'video',
      });

      if (!searchRes.data.items || searchRes.data.items.length === 0) {
        return await c.react('❓');
      }

      const video = searchRes.data.items[0];

      /** @type {import('baileys').proto.IWebMessageInfo} */
      let msg = storeMsg.get(video.id.videoId);
      if (msg && !c.argv.force) {
        c.replyRelay(msg.message);
      } else {

        const videoUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
        let thumbUrl = video.snippet.thumbnails.medium.url;

        const downloaderApiUrl = `https://fastrestapis.fasturl.cloud/downup/ytmp3?url=${encodeURIComponent(videoUrl)}&quality=128kbps&server=auto`;
        const downloadRes = await axios.get(downloaderApiUrl);

        if (downloadRes.data.status !== 200) {
          return c.react('🔥');
        }

        const result = downloadRes.data.result;
        const audioUrl = result.media;
        const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });

        const mimetype = audioResponse.headers['content-type'];
        if (!audioResponse || !mimetype?.startsWith('audio/')) return c.react('⁉️');

        const fileExtension = mimetype.split('/')[1] || 'mp3';

        thumbUrl = thumbUrl ?? result.metadata.thumbnail;

        let thumbnailBuffer = null;
        if (thumbUrl) {
          try {
            const thumbRes = await axios.get(thumbUrl, { responseType: 'arraybuffer' });
            thumbnailBuffer = Buffer.from(thumbRes.data);
          } catch (thumbErr) {
            pen.Error('Failed to download thumbnail:', thumbErr);
          }
        }

        const caption = `*${result.title}*\n\n` +
          `*Author:* ${result.author.name}\n` +
          `*Duration:* ${result.metadata.duration}\n` +
          `*Views:* ${result.metadata.views}\n\n` +
          `_${result.description}_`;

        const resp = await c.reply({
          audio: Buffer.from(audioResponse.data),
          mimetype: mimetype,
          fileName: `${result.title}.${fileExtension}`,
          caption: caption,
          contextInfo: {
            externalAdReply: {
              title: result.title,
              body: result.author.name,
              thumbnail: thumbnailBuffer,
              mediaType: 1,
              mediaUrl: videoUrl,
              sourceUrl: videoUrl,
            }
          }
        });
        if (resp) storeMsg.set(video.id.videoId, resp);
      }
    } catch (e) {
      pen.Error(e);
      c.react('❌');
    } finally {
      c.react('');
    }
  }
};
