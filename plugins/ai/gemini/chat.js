/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { MESSAGES_UPSERT } from '../../../src/const.js';
import pen from '../../../src/pen.js';
import { StoreJson } from '../../../src/store.js';
import { getFile } from '../../../src/data.js';
import { extractTextContext } from '../../../src/context.js';
import { formatMD } from '../../../src/tools.js';
import { Role } from '../../../src/roles.js';

/** @type {import('./gemini.js').Gemini} */
const gemini = await import(`./gemini.js?t=${new Date()}`).then(m => m.gemini);

const chatWatch = new StoreJson({
  autoSave: true,
  saveName: getFile('gemini_id.json')
});

const contentSupport = [
  'audioMessage',
  'imageMessage',
  'videoMessage',
  'documentMessage',
  'stickerMessage',
  'documentWithCaptionMessage',
];

/**
 * @param {import('../../../src/context.js').Ctx} c
 */
async function processChat(c) {
  let query = c.isCMD ? c.args : c.text;
  if (c.quotedText && c.quotedText?.length > 0 && !chatWatch.has(c.stanzaId)) {
    query = query?.trim();
    if (query?.length > 0) {
      query = `${query} ${c.quotedText}`;
    } else {
      query = c.quotedText;
    }
  }

  /** @type {import('@google/genai').PartListUnion} */
  const parts = [];

  query = query.trim();

  if (query || query.length > 0) parts.push({ text: query });

  const msgs = [c.message, c.quotedMessage];
  for (let m of msgs) {
    const ext = extractTextContext(m);

    if (!m || !ext) continue;
    if (!contentSupport.includes(ext.type)) continue;

    let mtype = 'unknown';
    let content = null;

    switch (ext.type) {
      case 'audioMessage': {
        mtype = 'audio';
        content = m.audioMessage;
        break;
      }
      case 'imageMessage': {
        mtype = 'image';
        content = m.imageMessage;
        break;
      }
      case 'videoMessage': {
        mtype = 'video';
        content = m.videoMessage;
        break;
      }
      case 'documentWithCaptionMessage': {
        m = m.documentWithCaptionMessage.message;
      }
      case 'documentMessage': {
        mtype = 'document';
        content = m.documentMessage;
        break;
      }
      case 'stickerMessage': {
        mtype = 'sticker';
        content = m.stickerMessage;
        break;
      }
    }

    let mimetype = content?.mimetype || 'unknown';
    if (mimetype?.startsWith('application/') && !mimetype?.endsWith('pdf')) mimetype = 'text/plain';

    const buff = await c.downloadIt({ message: m }, 'buffer', {});
    if (!buff) continue;

    parts.push({
      inlineData: {
        data: Buffer.from(buff).toString('base64'),
        mimeType: mimetype
      }
    });
  }

  if (parts.length > 0) {
    try {
      /* pen.Debug(`Parts ${parts.length}, Query : ${query?.length}`); */

      const resp = await gemini.chat(c.chat, { message: parts });
      const respText = formatMD(resp?.text?.trim());

      if (!respText || respText?.length === 0) return;
      const sent = await c.reply({ text: `${respText}` }, { quoted: c.event });
      if (sent) {
        chatWatch.set(sent.key?.id, `${c.sender}_${c.chat}_${c.timestamp}`);
      }
    } catch (e) {
      pen.Error(e);
    }
  }
}

/** @type {import('../../../src/plugin.js').Plugin[]} */
export default [
  {
    cmd: ['gm', 'gemini'],
    timeout: 15,
    desc: 'Gemini chat plugin',
    cat: 'ai',
    events: [MESSAGES_UPSERT],
    roles: [Role.PREMIUM],
    exec: processChat
  },
  {
    timeout: 15,
    desc: 'Gemini chat listener',
    events: [MESSAGES_UPSERT],
    roles: [Role.PREMIUM],
    midware: (c) => ({ success: chatWatch.has(c.stanzaId) }),
    exec: processChat
  },
  {
    cmd: ['gm.models'],
    timeout: 15,
    desc: 'List available models',
    cat: 'ai',
    roles: [Role.PREMIUM],
    exec: async (c) => {
      const texts = ['*# List available models*', ''];

      for (let [key,] of gemini.listModels.entries()) {
        texts.push(`- ${key}`);
      }

      await c.reply({ text: texts.join('\n') }, { quoted: c.event });
    }
  },
  {
    cmd: ['gm.set'],
    timeout: 15,
    desc: 'Set model name',
    cat: 'ai',
    roles: [Role.PREMIUM],
    exec: async (c) => {
      const modelName = c.args?.trim();
      if (modelName && modelName.length > 0) gemini.setModelName(modelName)
    }
  }
];

