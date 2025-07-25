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
  desc: 'Execute git fetch and pull command shell command, also removing git lock files before execution.',

  midware: midwareAnd(
    eventNameIs(MESSAGES_UPSERT),
    midwareOr(fromMe, fromOwner),
  ),

  exec: async (c) => {
    /* waiting */
    await c.react('⌛');
    const src = 'git fetch ; git pull';
    try {
      let isLocked = false;
      let force = c.argv?.f || c.argv?.force || false;

      /* Remove lock files */
      const branch = execSync('git rev-parse --abbrev-ref HEAD')?.toString().trim();
      const lockFiles = [
        '.git/index.lock',
        '.git/HEAD.lock',
        `.git/refs/heads/${branch}.lock`
      ];
      for (const lf of lockFiles) {
        if (existsSync(lf)) {
          isLocked = isLocked || true;
          unlinkSync(lf);
        }
      }

      if (isLocked || force) {
        await c.react('🔒');

        /* Stash local changes */
        execSync('git stash');
      }

      /* Execute shell command */
      let stdout = execSync(src);
      stdout = stdout?.toString();

      if (isLocked || force) {
        /* Apply stashed changes */
        execSync('git stash pop');
      }

      if (stdout && stdout?.length > 0) {
        return await c.reply({ text: `${stdout.toString()}`.trim() }, { quoted: c.event });
      }
    } catch (e) {
      await c.react('❌');
      await c.reply({ text: `${e}` }, { quoted: c.event });
    } finally {
      await c.react('');
    }
  }
};

