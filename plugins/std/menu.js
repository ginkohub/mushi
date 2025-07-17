/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { fromMe, midwareAnd } from '../../src/midware.js';
import { formatElapse } from '../../src/tools.js';

const emoMap = {
  'info': 'ℹ️',
  'fun': '🎉',
  'admin': '🔧',
  'util': '🔧',
  'system': '⚙️',
  'dev': '⚠️',
  'defense': '🛡️',
  'net': '🌐',
  'ai': '❇️',
  'whatsapp': '💬',
};

/** @type {import('../../src/plugin.js').Plugin} */
export default {

  cmd: 'menu',
  timeout: 15,
  cat: 'info',
  desc: 'Show the menu of commands',

  midware: midwareAnd(
    fromMe
  ),

  /** @param {import('../../src/context.js').Ctx} c */
  exec: async (c) => {

    const texts = ['*# Available menu*'];

    const since = new Date() - c.handler()?.client?.dateCreated;
    texts.push('',
      `*Uptime:* ${formatElapse(since, ' ')}`,
      '*Prefix :* ' + c.handler()?.prefix?.split('')?.map((p) => `\`${p}\``).join(', '),
    );

    const prefix = c.pattern[0];
    const categories = new Map();
    let cmdCount = 0;
    for (const cid of c.handler()?.cmds?.values()) {
      const p = c.handler()?.plugins?.get(cid);
      if (!p || p?.hidden) continue;
      if (!categories.has(p.cat)) categories.set(p.cat, new Map());

      const cat = categories.get(p.cat);
      if (cat.has(cid)) continue;

      const patt = Array.isArray(p.cmd) ? p.cmd[0] : p.cmd;

      cat.set(cid, {
        pre: `${p.noPrefix ? patt : prefix + patt}`,
        plugin: p
      });
      cmdCount++;
    }

    let lascat = '';
    let disabledCount = 0;
    const cats = Array.from(categories.keys()).sort()
    for (const catname of cats) {
      const cat = categories.get(catname);
      if (catname !== lascat) texts.push('', `*${emoMap[catname] ? emoMap[catname] : '🧩'} ${catname.toUpperCase()}*`);
      if (cat.size > 0) {
        for (const [_, patt] of cat.entries()) {
          if (patt.plugin.disabled) disabledCount++;
          texts.push(`  \`${patt.pre}\` ${patt.plugin.disabled ? '❗' : ''}`);
          if (c.argv?.desc) texts.push(`    > _${patt.plugin.desc?.trim()}_`);
        }
      }
    }

    texts.push('', `${cmdCount} cmd, ${c.handler()?.listens?.size} listener & ${disabledCount} disabled`);
    if (texts.length > 1) {
      c.reply({
        text: texts.join('\n'),
        contextInfo: {
          externalAdReply: {
            title: 'Mushi Bot',
            body: 'Simple a multi porpuses whatsapp bot.',
            renderLargerThumbnail: true,
            mediaType: 1,
            thumbnailUrl: 'https://opengraph.githubassets.com/new/ginkohub/mushi',
            sourceUrl: 'https://github.com/ginkohub/mushi',
            mediaUrl: 'https://github.com/ginkohub/mushi'
          }
        }
      }, {});
    }
  }
};

