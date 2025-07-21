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
import { eventNameIs, fromMe, midwareAnd } from '../../src/midware.js';
import pen from '../../src/pen.js';

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ['timer'],
  timeout: 15,
  cat: 'system',
  tags: ['system'],
  desc: 'Set the chat ephemeral',

  midware: midwareAnd(
    eventNameIs(MESSAGES_UPSERT), fromMe,
  ),

  exec: async (c) => {
    const latest = c.handler()?.getTimer(c.chat);
    const text = `Setting timer for ${c.chat} from ${latest} to ${c.expiration}`;
    pen.Debug(text);
    c.handler()?.updateTimer(c.chat, c.expiration);
    c.reply({ text: text });
  }
};

