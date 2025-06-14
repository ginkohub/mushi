/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { readdirSync, statSync } from 'fs';
import { Ctx } from './context.js';
import { platform } from 'os';
import { pathToFileURL } from 'url';
import { Plugin } from './plugin.js';
import { Pen } from './pen.js';
import { CONTACTS_UPDATE, CONTACTS_UPSERT, GROUP_PARTICIAPANTS_UPDATE, GROUPS_UPDATE, GROUPS_UPSERT, MESSAGES_REACTION, MESSAGES_UPSERT } from './const.js';
import { jidNormalizedUser } from 'baileys';
import { genHEX } from './tools.js';

export class Handler {
  constructor({ pluginDir, filter, prefix, pen, groupCache, contactCache, timerCache }) {
    this.pluginDir = pluginDir ?? '../plugins';
    this.filters = filter;

    /** @type {import('./client.js').Wangsaf} */
    this.client = null;

    /** @type {import('./pen.js').Pen)} */
    this.pen = pen ?? new Pen({ prefix: 'hand' });

    this.prefix = prefix ?? './';

    /** @type {Map<number, import('./plugin.js').Plugin>} */
    this.plugins = new Map();

    /** @type {Map<string, number>} */
    this.cmds = new Map();

    /** @type {Map<number, number>} */
    this.listens = new Map();

    /** @type {Map<string, import('baileys').GroupMetadata>} */
    this.groupCache = groupCache ?? new Map();

    /** @type {Map<string, import('baileys').Contact>} */
    this.contactCache = contactCache ?? new Map();

    /** @type {Map<string, number>} */
    this.timerCache = timerCache ?? new Map();

    this.loadPlugin(this.pluginDir);

  }

  /** @param {import('./plugin.js').Plugin} opts */
  async on(...opts) {
    for (const opt of opts) {
      /* Check if plugin hasn't exec */
      if (!opt.exec) continue;

      const plugin = new Plugin(opt);
      const newid = this.plugins.size;
      this.plugins.set(newid, plugin);

      /* Check if plugin has cmd, so it is a command plugin */
      if (plugin.cmd) {
        let precmds = [];
        if (Array.isArray(plugin.cmd)) {
          precmds = plugin.cmd;
        } else {
          precmds = [plugin.cmd];
        }

        let cmds = [];
        for (const precmd of precmds) {
          if (plugin.noPrefix) {
            cmds.push(precmd);
          } else {
            for (const pre of this.prefix) {
              cmds.push(`${pre}${precmd}`);
            }
          }
        }

        for (const cmd of cmds) {
          this.cmds.set(cmd.toLowerCase(), newid);
        }
      } else {
        this.listens.set(this.listens.size, newid);
      }
    }
  }

  async loadPlugin(dir) {
    let files = [];
    try {
      files = readdirSync(dir);
    } catch (e) {
      this.pen.Error(e);
    }
    for (const file of files) {
      let loc = `${dir}/${file}`.replace('//', '/');

      try {
        if (statSync(loc)?.isDirectory()) await this.loadPlugin(loc);
      } catch (e) {
        this.pen.Error(e.message);
      }
      if (loc.endsWith('.js')) {
        try {
          if (platform === 'win32') {
            loc = pathToFileURL(loc).href;
          }

          const loaded = await import(loc);
          if (loaded.default) {
            if (Array.isArray(loaded.default)) {
              this.on(...loaded.default);
            } else {
              this.on(loaded.default);
            }
          }

          this.pen.Debug(`Plugin loaded:`, loc)
        } catch (e) {
          this.pen.Error(loc, e);
        }
      }
    }
  }

  /** 
   *
   * Get command by pattern
   *
   * @param {string} p
   */
  getCMD(p) {
    if (!p) return;
    p = p.toLowerCase();
    const cid = this.cmds.get(p);
    if (!cid) return;
    return this.plugins.get(cid);
  }

  /** 
   * Check if given pattern is a command
   *
   * @param {string} p
   */
  isCMD(p) {
    p = p.toLowerCase();
    return this.cmds.has(p);
  }

  /**
   * Handle event and passed it to all plugins whether it is a command or a listener
   *
   * @param {{event: any, eventType: string, eventName: string}}
   */
  async handle({ event, eventType, eventName }) {
    try {
      const ctx = new Ctx({
        handler: this,
        eventName: eventName,
        event: event,
        eventType: eventType
      });

      this.updateData(ctx);

      for (const lsid of this.listens.values()) {
        try {
          const listen = this.plugins.get(lsid);
          if (!listen) continue;

          /* Check rules and midware before exec */
          const passed = await listen.check(ctx);
          if (!passed) {
            continue;
          }

          /* Exec */
          if (listen.exec) await listen.exec(ctx);
        } catch (e) {
          this.pen.Error(e);
        }
      }

      /* Handle commands */
      if (ctx?.pattern && ctx?.eventType !== 'append' && ctx?.type !== 'senderKeyDistributionMessage') {
        const pid = this.cmds.get(ctx.pattern.toLowerCase());
        if (!pid) return;
        const plugin = this.plugins.get(pid);
        if (plugin) {
          try {
            /* Check rules and midware before exec */
            const passed = await plugin.check(ctx);
            if (!passed) {
              return;
            }

            /* Exec */
            if (plugin.exec) await plugin.exec(ctx);
          } catch (e) {
            this.pen.Error(e);
          }
        }
      }
    } catch (e) {
      this.pen.Error(e);
    }
  }

  /**
   * Handle update data 
   *
   * @param {import('./context.js').Ctx} ctx
   */
  async updateData(ctx) {
    try {

      switch (ctx.eventName) {
        case GROUPS_UPSERT:
        case GROUP_PARTICIAPANTS_UPDATE:
        case GROUPS_UPDATE: {
          this.pen.Warn(ctx.eventName, ctx.eventName);
          await this.updateGroupMetadata(ctx.chat);
          break;
        }

        case CONTACTS_UPDATE:
        case CONTACTS_UPSERT: {
          this.updateContact(ctx.sender, {
            jid: ctx.sender,
            name: ctx.pushName,
          });
          break;
        }
        case MESSAGES_UPSERT: {
          if (ctx?.expiration) {
            this.updateTimer(ctx.chat, ctx.expiration);
          }
          break;
        }
      }
    } catch (e) {
      this.pen.Error(e);
    }
  }

  /** 
  *
  * @param {import('./client.js').Wangsaf} client 
  */
  async attach(client) {
    this.client = client;

    this.client.sock.ev.on(MESSAGES_UPSERT, (update) => {
      for (const event of update.messages) {
        this.handle({ eventName: MESSAGES_UPSERT, event: event, eventType: update.type });
      }
    });

    this.client.sock.ev.on(MESSAGES_REACTION, (update) => {
      for (const event of update) {
        this.handle({ eventName: MESSAGES_REACTION, event: event, eventType: update.type });
      }
    });

    this.client.sock.ev.on(GROUPS_UPSERT, (update) => {
      for (const event of update) {
        this.handle({ eventName: GROUPS_UPSERT, event: event, eventType: update.type });
      }
    });

    this.client.sock.ev.on(GROUPS_UPDATE, (update) => {
      for (const event of update) {
        this.handle({ eventName: GROUPS_UPDATE, event: event, eventType: update.type });
      }
    });

    this.client.sock.ev.on(GROUP_PARTICIAPANTS_UPDATE, (event) => {
      this.handle({ eventName: GROUP_PARTICIAPANTS_UPDATE, event: event, eventType: event.type });
    });


    this.client.sock.ev.on(CONTACTS_UPDATE, (update) => {
      for (const event of update) {
        this.handle({ eventName: CONTACTS_UPDATE, event: event, eventType: update.type });
      }
    });

    this.client.sock.ev.on(CONTACTS_UPSERT, (update) => {
      for (const event of update) {
        this.handle({ eventName: CONTACTS_UPSERT, event: event, eventType: update.type });
      }
    });
  }

  async updateGroupMetadata(jid) {
    try {
      const data = await this.client.sock.groupMetadata(jid);
      if (data) this.groupCache.set(jid, data);
    } catch (e) {
      this.pen.Error(e);
    }
  }

  getGroupMetadata(jid) {
    const data = this.groupCache.get(jid);
    if (!data) this.updateGroupMetadata(jid).catch((e) => this.pen.Error(e));
    return data;
  }

  updateContact(jid, data) {
    try {
      if (data) this.contactCache.set(jid, data);
    } catch (e) {
      this.pen.Error(e);
    }
  }

  getContact(jid) {
    return this.contactCache.get(jid);
  }

  updateTimer(jid, ephemeral) {
    if (ephemeral) {
      const data = this.timerCache.get(jid);
      if (data !== ephemeral) {
        this.timerCache.set(jid, ephemeral);
      }
    }
  }

  getTimer(jid) {
    return this.timerCache.get(jid);
  }

  getName(jid) {
    jid = jidNormalizedUser(jid);
    if (!jid || jid === '') return null;

    if (jid.endsWith('@g.us')) {
      let data = this.getGroupMetadata(jid);
      return data?.subject;
    } else if (jid.endsWith('@s.whatsapp.net')) {
      const data = this.getContact(jid);
      if (data) {
        return data.name;
      }
    } else if (jid.endsWith('@newsletter')) {

    } else if (jid.endsWith('@lid')) {

    }

    return null;
  }

  /** 
  * Send message to given jid
  *
  * @param {string} jid
  * @param {import('baileys').AnyMessageContent} content
  * @param {import('baileys').MessageGenerationOptions} options
  */
  async sendMessage(jid, content, options) {
    if (!content) throw new Error('content not provided');
    if (!options) options = {};

    if (!options.messageId) options.messageId = genHEX(32);

    const ephemeral = this.getTimer(jid);
    if (ephemeral && ephemeral > 0) {
      options.ephemeralExpiration = ephemeral;
    }

    try {
      return await this.client.sock.sendMessage(jid, content, options);
    } catch (e) {
      this.pen.Error(e);
    }
  }

  /**
   * Relay message to given jid
   *
   * @param {string} jid
   * @param {import('baileys').proto.IMessage} content
   * @param {import('baileys').MessageGenerationOptions} options
   */
  async relayMessage(jid, content, options) {
    if (!content) throw new Error('content not provided');
    if (!options) options = {};

    if (!options.messageId) options.messageId = genHEX(32);

    const ephemeral = this.getTimer(jid);
    if (ephemeral && ephemeral > 0) {
      for (let key in content) {
        if (!content[key]) continue;

        if (!content[key]?.contextInfo) {
          content[key].contextInfo = { expiration: ephemeral };
        } else {
          content[key].contextInfo.expiration = ephemeral;
        }
      }
    }

    try {
      return await this.client.sock.relayMessage(jid, content, options);
    } catch (e) {
      pen.Error(e);
    }
  }

}
