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
import pen from '../../src/pen.js';
import { execSync } from 'child_process';
import { fromOwner } from '../settings.js';

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ['$'],
  timeout: 15,
  cat: 'system',
  tags: ['system'],
  desc: 'Execute command shell command',

  midware: midwareAnd(
    eventNameIs(MESSAGES_UPSERT),
    midwareOr(fromMe, fromOwner),
  ),

  exec: async (c) => {
    pen.Warn(c.pattern, 'args :', c.args);
    const src = c.args?.trim();
    if (!src) return await c.react('❌');

    try {
      /* Execute shell command */
      const stdout = execSync(src);
      if (stdout && stdout?.length > 0) {
        return await c.reply({ text: `${stdout.toString()}`.trim() }, { quoted: c.event });
      }
    } catch (e) {
      await c.react('❌');
      await c.reply({ text: `${e}` }, { quoted: c.event });
    }
  }
};

