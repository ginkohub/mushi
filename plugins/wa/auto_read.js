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
import { delay, randomNumber } from '../../src/tools.js';
import { settings } from '../settings.js';
import pen from '../../src/pen.js';

const skipTypes = [
  'senderKeyDistributionMessage',
]

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    desc: 'Auto read message',
    timeout: 15,

    midware: midwareAnd(
      eventNameIs(MESSAGES_UPSERT),
      (c) => ({ success: !c.isStatus && !c.fromMe && !skipTypes.includes(c.type) && settings.get('auto_read_' + c.me) }),

    ),

    /** @param {import('../../src/context.js').Ctx} c */
    exec: async (c) => {
      await delay(randomNumber(1000, 2000));
      c.sock().readMessages([
        {
          id: c.id,
          fromMe: c.fromMe,
          participant: c.sender,
          remoteJid: c.chat,
        }
      ])
    }
  },
  {
    cmd: ['aread', 'aread+', 'aread-'],
    cat: 'whatsapp',
    desc: 'Auto read message',
    timeout: 15,

    midware: midwareAnd(
      eventNameIs(MESSAGES_UPSERT),
      fromMe,
    ),

    /** @param {import('../../src/context.js').Ctx} c */
    exec: async (c) => {
      const key = `auto_read_${c.me}`;
      let pattern = c.pattern;
      if (c.pattern.endsWith('+')) {
        settings.set(key, true)
        pattern = c.pattern.slice(0, -1);
        pen.Warn(`Activating auto read for ${c.me}`);
      } else if (c.pattern.endsWith('-')) {
        settings.set(key, false)
        pattern = c.pattern.slice(0, -1);
        pen.Warn(`Deactivating auto read for ${c.me}`);
      }
      const set = settings.get(key);
      let text = '';
      if (set) {
        text = `Auto read status : *${set}*`;
      } else {
        text = `Auto read is not yet set.`;
      }
      c.reply({ text: text + `\n\nNB :\n  *${pattern}-* _to deactivating_\n  *${pattern}+* _to activating_` }, { qouted: c.message })
    }
  }
]
