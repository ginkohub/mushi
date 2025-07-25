/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { MESSAGES_UPSERT } from '../../src/const.js';
import { eventNameIs, fromMe, midwareAnd, midwareOr } from '../../src/midware.js';
import { formatElapse } from '../../src/tools.js';
import { fromOwner } from '../settings.js';

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ['ping', 'p'],
  timeout: 120,
  cat: 'system',
  tags: ['system'],
  desc: 'Ping the bot and get the response time.',

  midware: midwareAnd(
    eventNameIs(MESSAGES_UPSERT),
    midwareOr(
      fromMe,
      fromOwner,
    )
  ),

  exec: async (c) => {
    const current = Date.now();
    let latency = current - c.timestamp;

    let text = `*⏱️ Late:* ${formatElapse(latency)}`;

    const beforeSend = Date.now();
    const resp = await c.reply({ text }, { quoted: c.event });
    const afterSend = Date.now();

    latency = afterSend - beforeSend;
    text += `\n*⏱️ Resp:* ${formatElapse(latency)}`;
    return await c.reply({
      text: text,
      edit: resp.key
    })
  }
};

