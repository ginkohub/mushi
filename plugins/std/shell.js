/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { MESSAGES_UPSERT } from '../../src/const.js';
import { execSync } from 'node:child_process';
import { Role } from '../../src/roles.js';

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ['!'],
  timeout: 15,
  cat: 'system',
  tags: ['system'],
  desc: 'Execute command shell command.',
  events: [MESSAGES_UPSERT],
  roles: [Role.SUPERADMIN],

  exec: async (c) => {
    await c.react('⌛');
    if (!c.args || c.args?.length === 0) return;

    try {
      let stdout = execSync(c.args);
      stdout = stdout?.toString();

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

