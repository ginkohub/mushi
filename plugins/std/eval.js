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
import { fromOwner } from '../settings.js';

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ['>'],
  timeout: 15,
  cat: 'system',
  tags: ['system'],
  desc: 'Evaluate JavaScript code',

  midware: midwareAnd(
    eventNameIs(MESSAGES_UPSERT),
    midwareOr(fromMe, fromOwner),
  ),

  exec: async (c) => {
    const src = c.args?.trim();
    if (!src) {
      return await c.react('⁉️');
    }

    try {
      let res = await eval(`(async () => { ${src} })()`);
      if (!res) {
        return await c.react('❔');
      }

      if (typeof res === 'object' && !(
        res instanceof Buffer

      )) res = JSON.stringify(res, null, 2);

      await c.reply({ text: `${res}` }, { quoted: c.event });
    } catch (e) {
      await c.react('‼️');
      await c.reply({ text: `${e}` }, { quoted: c.event });
    }
  }
};

