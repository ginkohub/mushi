/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { fromMe, midwareOr } from '../../src/midware.js';
import { formatElapse } from '../../src/tools.js';
import { fromOwner } from '../settings.js';

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
  tags: ['menu'],
  desc: 'Show the menu of commands',

  midware: midwareOr(
    fromMe, fromOwner
  ),

  exec: async (c) => {

    const prefix = c.pattern[0];
    const texts = [];
    const withDesc = c.argv?.desc || c.argv?.d;

    if (c.args?.length > 0 && !withDesc) {
      /** @type {Map<string, import('../../src/plugin.js').Plugin>} */
      const plugins = new Map();
      const userKeys = c.args?.toLowerCase().split(' ');

      if (userKeys) {

        c.handler()?.command?.forEach((p, k) => {
          if (!p?.cmd) return;

          if (Array.isArray(p?.cmd)) {
            p.cmd.forEach((x) => {
              if (userKeys.includes(x.toLowerCase())) plugins.set(k, p);
            });
          } else if (typeof p.cmd === 'string') {
            if (userKeys.includes(p?.cmd?.toLowerCase())) plugins.set(k, p);
          }
        });
      } else {
        texts.push('No command found :', c.args);
      }


      for (const [k, p] of plugins?.entries()) {
        texts.push(
          `Detail of \`${k}\``,
          `- Cmds : ${Array.isArray(p.cmd) ? p.cmd?.map((c) => `\`${prefix + c}\``).join(', ') : `\`${prefix + p.cmd}\``}`,
          `- NoPrefix : ${p.noPrefix ? '✅' : '❌'}`,
          `- Hidden : ${p.hidden ? '✅' : '❌'}`,
          `- Timeout : ${p.timeout ? p.timeout : '∞'}`,
          `- Disabled : ${p.disabled ? '✅' : '❌'}`,
          `- Cat  : ${p.cat}`,
          `- Desc : ${p.desc}`,
          `- Path : ${p.location}`, ''
        )
      }
    } else {
      texts.push('*# Available menu*');

      const since = new Date() - c.handler()?.client?.dateCreated;
      texts.push('',
        `*Uptime:* ${formatElapse(since, ' ')}`,
        '*Prefix :* ' + c.handler()?.prefix?.map((p) => `\`${p}\``).join(', '),
      );

      const categories = new Map();
      let cmdCount = 0;
      for (const key of Object.keys(c.handler()?.command)) {
        const dataCMD = c.handler()?.getCMD(key);
        const p = dataCMD.getPlugin();
        if (!p || p?.hidden) continue;
        if (!categories.has(p.cat)) categories.set(p.cat, new Map());

        const cat = categories.get(p.cat);
        if (cat.has(dataCMD?.pluginKey)) continue;

        const patt = Array.isArray(p.cmd) ? p.cmd[0] : p.cmd;

        cat.set(dataCMD?.pluginKey, {
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
            if (withDesc) texts.push(`    _${patt.plugin.desc?.trim()}_`);
          }
        }
      }
      texts.push('', `${cmdCount} cmd, ${c.handler()?.listens?.size} listener & ${disabledCount} disabled`);
    }

    if (texts.length > 1) {
      await c.reply({
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
      }, { quoted: c.event });
    }
  }
};

