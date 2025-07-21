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
import { fromOwner, settings } from '../settings.js';

/** @type {import('../../src/plugin.js').Plugin} */
export default [
  {
    cmd: ['prefix', 'prefix+', 'prefix-', 'pre', 'pre+', 'pre-'],
    timeout: 15,
    cat: 'system',
    tags: ['system'],
    desc: 'Set / remove the prefix (split with space).',

    midware: midwareAnd(
      eventNameIs(MESSAGES_UPSERT),
      midwareOr(fromMe, fromOwner)
    ),

    exec: async (c) => {
      let newPrefix = c.args?.trim()?.split(' ');
      if (!newPrefix) newPrefix = [];
      newPrefix = newPrefix.filter((v, i, a) => (a.indexOf(v) === i && v));

      const key = `prefix`;
      let allow = settings.get(key);
      if (!allow) allow = [];

      let pattern = c.pattern;
      let status = '';
      if (c.pattern.endsWith('+')) {
        pattern = c.pattern.slice(0, -1);
        allow.push(...newPrefix.filter((v) => !allow.includes(v)));
        status = 'added';
      } else if (c.pattern.endsWith('-')) {
        pattern = c.pattern.slice(0, -1);
        allow = allow.filter((v) => !newPrefix.includes(v))
        status = 'removed';
      }

      if (status.length > 0) {
        settings.set(key, allow);
        c.handler().setPrefix(allow);
      }

      let text = '';
      if (status.length > 0 && newPrefix?.length > 0) {
        text = `List prefix that has *${status}* :\n` +
          newPrefix.map((v) => `${v}`).join(', ');
      } else {
        text = `Currrent list prefix registered :\n` +
          allow.map((v) => `\`${v}\``).join(', ');
      }

      if (text.length === 0) return await c.react('🤔');
      c.reply({
        text: text +
          `\n\nNB :\n  *${pattern}-* _to remove_\n  *${pattern}+* _to add_` +
          `\n\n_Split multiple prefix with space_` +
          `\n\n_example :_\n\`${pattern}+ ' " ! \\ /\``,
      }, { quoted: c.event })
    }
  }
];


/** @param {import('../../src/handler.js').Handler} hand */
export const pre = (hand) => {
  const prefix = settings.get('prefix');
  if (prefix) {
    pen.Debug('Setting prefix to', prefix, 'from', hand.prefix);
    hand?.setPrefix(prefix);
  }
};

