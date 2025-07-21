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
import { delay, randomNumber } from '../../src/tools.js';
import { fromOwner, settings } from '../settings.js';
import pen from '../../src/pen.js';

const skipTypes = [
  'senderKeyDistributionMessage',
];

const AUTO_READ_KEY = 'auto_read';

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    desc: 'Auto read message',
    timeout: 15,

    midware: midwareAnd(
      eventNameIs(MESSAGES_UPSERT),
      (c) => ({ success: !c.isStatus && !c.fromMe && !skipTypes.includes(c.type) && settings.get(AUTO_READ_KEY) }),
    ),

    exec: async (c) => {
      await delay(randomNumber(1000, 2000));
      await c.sock().readMessages([c.key]);
    }
  },

  {
    cmd: ['aread', 'aread+', 'aread-'],
    cat: 'whatsapp',
    desc: 'Auto read message',
    timeout: 15,

    midware: midwareAnd(
      eventNameIs(MESSAGES_UPSERT),
      midwareOr(fromMe, fromOwner),
    ),

    exec: async (c) => {
      let pattern = c.pattern;
      const tail = c.pattern.slice(-1);
      switch (tail) {
        case '+': {
          settings.set(AUTO_READ_KEY, true);
          pattern = c.pattern.slice(0, -1);
          pen.Warn(`Activating auto read for ${c.me}`);
          break;
        }

        case '-': {
          settings.set(AUTO_READ_KEY, false);
          pattern = c.pattern.slice(0, -1);
          pen.Warn(`Deactivating auto read for ${c.me}`);
          break;
        }
      }

      let set = settings.get(AUTO_READ_KEY);
      if (!set) set = false;
      let texts = [];
      texts.push(`📵 *Auto read status* : *${set}*`);

      texts.push(
        '', 'NB :',
        `  *${pattern}-* _to deactivating_`,
        `  *${pattern}+* _to activating_`
      );
      await c.reply({ text: texts.join('\n') }, { quoted: c.event });
    }
  }
];
