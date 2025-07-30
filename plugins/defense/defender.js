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

const KEY_DEFENSE_ALLOW_STATUS = 'defense_allow_status';

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
      const tail = pattern.slice(-1);
      switch (tail) {
        case '+': {
          settings.set(key, true)
          pattern = c.pattern.slice(0, -1);
          pen.Warn(`Activating defense for ${c.me}`);
          break;
        }

        case '-': {
          settings.set(key, false)
          pattern = c.pattern.slice(0, -1);
          pen.Warn(`Deactivating defense for ${c.me}`);
          break;
        }
      }
      const set = settings.get(key);

      const texts = [
        `🛡️ *Defense status* : *${(set === true) ? 'Active ✅' : 'Inactive ⚠️'}*`,
        '', '', 'NB :',
        `  *${pattern}-* _to deactivating_`,
        `  *${pattern}+* _to activating_`
      ];

      c.reply(
        { text: texts.join('\n') },
        { quoted: c.event },
      )
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
      if (!newAllowed || !Array.isArray(newAllowed)) newAllowed = [];
      newAllowed = newAllowed.filter((v, i, a) => a.indexOf(v) === i);

      let setAllows = settings.get(KEY_DEFENSE_ALLOW_STATUS);
      if (!setAllows || !Array.isArray(setAllows)) setAllows = [];

      const tail = c.pattern.slice(-1);
      let pattern = ['-', '+'].includes(tail) ? c.pattern.slice(0, -1) : c.pattern;
      let status = '';

      const texts = [];

      switch (tail) {
        case '+': {
          setAllows.push(...newAllowed.filter((v) => !setAllows?.includes(v) && !allowed?.includes(v)));
          status = 'add';
          break;
        }

        case '-': {
          setAllows = setAllows.filter((v) => !newAllowed.includes(v));
          status = 'remove';
          break;
        }
      }

      if (status?.length > 0) {
        settings.set(KEY_DEFENSE_ALLOW_STATUS, setAllows);
        texts.push(`Success ${status} ${status === 'add' ? 'to' : 'from'} setting`, '');
      }

      texts.push(
        `*# Skip from setting* :`,
        ...setAllows?.map((v) => `- \`${v}\``)
      );

      texts.push(
        '', `*# Default skip types* :`,
        ...allowed?.map((v) => `- \`${v}\``)
      );


      texts.push(
        '', 'NB :',
        `  *${pattern}-* _to remove_`,
        `  *${pattern}+* _to add_`, '',
        'Example :', '',
        `  *${pattern}+ audioMessage imageMessage*`);
      c.reply({ text: texts.join('\n')?.trim() }, { quoted: c.event })
    }
  }
];

