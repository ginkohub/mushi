/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Events } from '../../src/const.js';
import { eventNameIs, fromMe, midwareAnd, midwareOr } from '../../src/midware.js';
import pen from '../../src/pen.js';
import { fromOwner, settings } from '../settings.js';
import { allowed } from './detector.js';

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    cmd: ['smp'],
    cat: 'defense',
    desc: 'Create and send sample message as json.',
    timeout: 15,
    midware: midwareAnd(
      eventNameIs(Events.MESSAGES_UPSERT),
      midwareOr(fromMe),
    ),

    exec: async (c) => {
      c.reply({
        document: Buffer.from(JSON.stringify(c)),
        fileName: `${c.chat}_${c.sender}_${c.timestamp}.json`,
        mimetype: 'application/json',
      });
    }
  },

  {
    cmd: ['defense', 'defense+', 'defense-'],
    cat: 'defense',
    desc: 'Manage defense status',
    timeout: 15,

    midware: midwareAnd(
      eventNameIs(Events.MESSAGES_UPSERT),
      midwareOr(fromMe, fromOwner),
    ),

    exec: async (c) => {
      const key = `defense`;
      let pattern = c.pattern;
      if (c.pattern.endsWith('+')) {
        settings.set(key, true)
        pattern = c.pattern.slice(0, -1);
        pen.Warn(`Activating defense for ${c.me}`);
      } else if (c.pattern.endsWith('-')) {
        settings.set(key, false)
        pattern = c.pattern.slice(0, -1);
        pen.Warn(`Deactivating defense for ${c.me}`);
      }
      const set = settings.get(key);

      const text = `Defense status : *${(set === true) ? 'Active' : 'Inactive'}*`;

      c.reply({ text: text + `\n\nNB :\n  *${pattern}-* _to deactivating_\n  *${pattern}+* _to activating_` }, { qouted: c.message })
    }
  },

  {
    cmd: ['skip', 'skip+', 'skip-'],
    cat: 'defense',
    desc: 'Manage skip message type on status.',
    timeout: 15,

    midware: midwareAnd(
      eventNameIs(Events.MESSAGES_UPSERT),
      midwareOr(fromMe, fromOwner),
    ),

    exec: async (c) => {
      let newAllowed = c.argv?._;
      if (!newAllowed) newAllowed = [];
      newAllowed = newAllowed.filter((v, i, a) => a.indexOf(v) === i);

      const key = `defense_allow_status`;
      let allow = settings.get(key);
      if (!allow) allow = [];

      let pattern = c.pattern;
      let status = '';
      if (c.pattern.endsWith('+')) {
        pattern = c.pattern.slice(0, -1);
        allow.push(...newAllowed.filter((v) => !allow.includes(v)));
        status = 'added';
      } else if (c.pattern.endsWith('-')) {
        pattern = c.pattern.slice(0, -1);
        allow = allow.filter((v) => !newAllowed.includes(v))
        status = 'removed';
      }

      if (status.length > 0) settings.set(key, allow);

      let text = '';
      if (status.length > 0 && newAllowed?.length > 0) {
        text = `List type that has *${status}* :\n` +
          newAllowed.map((v) => `  - *${v}*`).join('\n') +
          `\n\nDefault :\n` + allowed.map((v) => `  - \`${v}\``).join('\n');
      } else {
        text = `Currrent list type registered :\n` +
          allow.map((v) => `  - \`${v}\``).join('\n') +
          `\n\nDefault :\n` + allowed.map((v) => `  - \`${v}\``).join('\n');
      }
      if (text.length === 0) return await c.react('🤔');
      c.reply({
        text: text +
          `\n\nNB :\n  *${pattern}-* _to remove_\n  *${pattern}+* _to add_` +
          `\n\n_Split multiple type with space_` +
          `\n\n_example :_\n\`${pattern}+ audioMessage imageMessage\``,
      }, { quoted: c.event })
    }
  }
];

