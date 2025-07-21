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
import { execSync } from 'child_process';
import { fromOwner } from '../settings.js';
import { existsSync, unlinkSync } from 'fs';

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ['update'],
  timeout: 15,
  cat: 'system',
  tags: ['system'],
  desc: 'Execute git fetch and pull command shell command',

  midware: midwareAnd(
    eventNameIs(MESSAGES_UPSERT),
    midwareOr(fromMe, fromOwner),
  ),

  exec: async (c) => {
    /* waiting */
    await c.react('⌛');
    const src = 'git fetch ; git pull ';
    try {
      if (c.argv?.l || c.argv?.lock) {
        await c.react('🔒');
        const lockFiles = ['.git/HEAD.lock', '.git/refs/heads/main.lock'];
        for (const lf of lockFiles) {
          /* Remove lock files */
          if (existsSync(lf)) unlinkSync(lf);
        }
      }

      /* Execute shell command */
      let stdout = execSync(src);
      stdout = stdout?.toString();

      if (stdout && stdout?.length > 0) {
        c.reply({ text: `${stdout.toString()}`.trim() });
      }
    } catch (e) {
      c.react('❌')
      c.reply({ text: `${e}` });
    } finally {
      c.react('', c.key);
    }
  }
};

