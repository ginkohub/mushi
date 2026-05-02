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
      const jids = c.parseJIDs();
      const targets = jids.length > 0 ? jids : [c.senderJid];

      let texts = ['*📃 User Information*', ''];
      for (const jid of targets) {
        const user = c.handler().userManager.getUser(jid);
        if (!user) continue;

        const roles = user.roles.join(', ');
        const added = new Date(user.addedAt).toLocaleString();

        texts.push(`*Name*: ${user.name || c.getName(jid) || 'N/A'}`);
        texts.push(`*JID*: ${jid}`);
        texts.push(`${user.lid ? `*LID*: ${user.lid}\n` : ''}*Roles*: ${roles}`);
        texts.push(`*Level*: ${user.level}`);
        texts.push(`*XP*: ${user.xp}`);
        texts.push(`*Status*: ${user.banned ? `Banned (at ${new Date(user.bannedAt).toLocaleString()})` : 'Active'}`);
        texts.push(`*Added*: ${added}`, '', '');
      }

      await c.reply({ text: texts.join('\n').trim() }, { quoted: c.event });
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

