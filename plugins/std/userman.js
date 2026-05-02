/**
 * Copyright (C) 2025-2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { MESSAGES_UPSERT } from '../../src/const.js';
import { Role } from '../../src/roles.js';

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    cmd: ['role'],
    timeout: 15,
    cat: 'user',
    tags: ['user', 'role'],
    desc: 'Get user info',
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      await c.reply({ text: JSON.stringify(c.user(), null, 2) }, { quoted: c.event });
    }
  },
  {
    cmd: ['role+'],
    timeout: 15,
    cat: 'user',
    tags: ['user', 'role'],
    desc: 'Add role to quoted or mentioned user',
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const jids = c.parseJIDs();
      if (jids.length === 0) return await c.reply({ text: 'No user specified. Tag or quote someone.' });

      for (let i = 0; i < jids.length; i++) {
        if (jids[i].includes('@lid')) jids[i] = await c.LIDToPN(jids[i]);
      }

      const role = c.argv?.r ?? c.argv?.role;
      if (!role) return await c.reply({ text: 'Please specify a role using -r or --role' });

      if (!Object.values(Role).includes(role)) {
        return await c.reply({ text: `Invalid role. Available roles: ${Object.values(Role).join(', ')}` });
      }

      for (const jid of jids) {
        const user = c.handler().userManager.getUser(jid);
        if (!user.roles.includes(role)) {
          user.roles.push(role);
          c.handler().userManager.updateUser(jid, { roles: user.roles });
        }
      }

      await c.reply({ text: `Added role *${role}* to ${jids.length} user(s).` });
    }
  },
  {
    cmd: ['role-'],
    timeout: 15,
    cat: 'user',
    tags: ['user', 'role'],
    desc: 'Remove role from quoted or mentioned user',
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const jids = c.parseJIDs();
      if (jids.length === 0) return await c.reply({ text: 'No user specified. Tag or quote someone.' });

      for (let i = 0; i < jids.length; i++) {
        if (jids[i].includes('@lid')) jids[i] = await c.LIDToPN(jids[i]);
      }

      const role = c.argv?.r ?? c.argv?.role;
      if (!role) return await c.reply({ text: 'Please specify a role using -r or --role' });

      for (const jid of jids) {
        const user = c.handler().userManager.getUser(jid);
        if (user.roles.includes(role)) {
          user.roles = user.roles.filter(r => r !== role);
          if (user.roles.length === 0) user.roles.push(Role.GUEST);
          c.handler().userManager.updateUser(jid, { roles: user.roles });
        }
      }

      await c.reply({ text: `Removed role *${role}* from ${jids.length} user(s).` });
    }
  },
];

