/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Ctx } from './context.js';
import { Pen } from './pen.js';
import { Events } from './const.js';
import { jidNormalizedUser } from 'baileys';
import { delay, genHEX } from './tools.js';
import { Reason } from './reason.js';
import { StoreSQLite } from './store.js';
import { getFile } from './data.js';

/**
 * @typedef {Object} HandlerOptions
 * @property {import('./manager.js').PluginManager} pluginManager
 * @property {import('./manager.js').pluginFilter} filter
 * @property {string[]} prefix
 * @property {import('./pen.js').Pen} pen
 * @property {Map<string, import('baileys').GroupMetadata>} groupCache
 * @property {Map<string, import('baileys').Contact>} contactCache
 * @property {Map<string, number>} timerCache
 */
/**
 * Handler class for handling plugins
 */
export class Handler {
  /** @type {import('./pen.js').Pen} */
  #pen

  /** @returns {import('./pen.js').Pen} */
  get pen() { return this.#pen; }
  /**
   * @param {HandlerOptions} 
   */
  constructor({ pluginManager, filter, prefix, pen, groupCache, contactCache, timerCache }) {

    /** @type {string} */
    this.unique = genHEX(16);

    /** @type {number} */
    this.updatedAt = Date.now();

    /** @type {import('./manager.js').PluginManager} */
    this.pluginManager = pluginManager;

    /** @type {import('./manager.js').pluginFilter} */
    this.filter = filter;

    /** @type {import('./client.js').Wangsaf} */
    this.client = null;

    /** @type {import('./pen.js').Pen)} */
    this.#pen = pen ?? new Pen({ prefix: 'hand' });

    /** @type {string[]} */
    this.prefix = prefix ?? ['.', '/'];

    const store = new StoreSQLite({ saveName: getFile('cache.db') });

    /** @type {Map<string, import('baileys').GroupMetadata>} */
    this.groupCache = groupCache ?? store.use('group_cache');

    /** @type {Map<string, import('baileys').Contact>} */
    this.contactCache = contactCache ?? store.use('contact_cache');

    /** @type {Map<string, number>} */
    this.timerCache = timerCache ?? store.use('timer_cache');

    /** @type {Array} */
    this.watchID = [];

    /** @type {Array} */
    this.blockList = [];

    /** @type {Object} */
    this.taskList = {};

    /** @type {{string:import('./manager.js').PluginResultItem}} */
    this.command = {};

    /** @type {{string:import('./manager.js').PluginResultItem}} */
    this.listener = {};

  }

  /**
   * Set client for handler
   */
  generatePlugin() {
    try {
      this.#pen.Debug('Generating plugins', `${this.updatedAt} to ${this.pluginManager?.updatedAt}`);


      /** @type {import('./manager.js').PluginResult} */
      const pr = this.pluginManager?.genPlugins(this.prefix, this.filter, {
        unique: this.unique,
        callback: async (filePath, theManager) => {
          try {
            if (this.updatedAt !== theManager.updatedAt) this.generatePlugin();
          } catch (e) {
            this.#pen.Error('generate-plugin-callback', e);
          }
        }
      });

      this.updatedAt = pr.updatedAt;
      this.command = pr.command;
      this.listener = pr.listener;

    } catch (e) {
      this.#pen.Error('generate-plugin', e);
    }
  }

  /**
   * @param {string} id 
   * @param {() => Promise<any>} fn
   * @returns {Promise<any>}
   */
  async runTask(id, fn) {
    if (this.taskList[id]) {
      this.#pen.Debug(`Task ${id} is already running`);
      return this.taskList[id];
    }

    this.#pen.Debug(`Task ${id} started`);
    const task = (async () => {
      try {
        return await fn();
      } catch (e) {
        this.#pen.Error('run-task', `Task ${id} failed`, e);
      } finally {
        delete this.taskList[id];
      }
    })();

    this.taskList[id] = task;
    return task;
  }

  /**
   * Check whether given jid is blocked or not
   * @param {string} jid
   * @returns {boolean}
   */
  isBlocked(jid) {
    return this.blockList.includes(jidNormalizedUser(jid));
  }

  /**
 * Block / unblock given jid
 * @param {string} jid
 * @returns {Promise<boolean | undefined>}
 */
  async updateBlock(jid, action) {
    try {
      await this.client?.sock?.updateBlockStatus(jid, action);
      switch (action) {
        case 'block': {
          this.blockList.push(jidNormalizedUser(jid));
          break;
        }
        case 'unblock': {
          this.blockList = this.blockList.filter(x => x !== jidNormalizedUser(jid));
          break;
        }
      }
      return true
    } catch (e) {
      this.#pen.Error('update-block', e);
    }
  }

  /**
   * Set prefix for command plugins
   * @param {string[]} prefix
   */
  setPrefix(prefix) {
    if (!Array.isArray(prefix) || prefix?.length === 0) {
      return this.#pen.Warn('Prefix must be an array larger than 0');
    }
    this.prefix = prefix;
    this.generatePlugin();
  }

  /** 
   * Get command by pattern
   * @param {string} p
   * @returns {import('./manager.js').PluginResultItem | undefined}
   */
  getCMD(p) {
    return this.command?.[p];
  }

  /** 
   * Check if given pattern is a command
   * @param {string} p
   * @returns {boolean}
   */
  isCMD(p) {
    if (!p) return false;
    return this.command?.[p.toLowerCase()];
  }

  /**
   * Check if given context id is already exist in watchID
   * @param {import('./context.js').Ctx} ctx
   * @returns {boolean|undefined}
   */
  idExist(ctx) {
    if (this.watchID.includes(ctx?.id)) {
      return true;
    } else {
      if (this.watchID.length >= 100) this.watchID.shift();
      this.watchID.push(ctx.id);
      return false;
    }
  }

  /**
   * Check if given context is safe to execute
   * @param {import('./context.js').Ctx} ctx
   * @returns {boolean|undefined}
   */
  isSafe(ctx) {
    const isAppend = ctx?.eventType === 'append';
    const isPrekey = ctx?.type === 'senderKeyDistributionMessage';
    const isUndefined = ctx?.type === 'undefined' || typeof ctx?.type === 'undefined';
    const idExist = isPrekey || isUndefined ? false : this.idExist(ctx);

    return !(isAppend || isPrekey || isUndefined || idExist);
  }

  /**
   * Handle event and passed it to all plugins whether it is a command or a listener
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

      await this.updateData(ctx);

      for (const key of Object.keys(this.listener)) {
        /** @type {import('./plugin.js').Plugin} */
        const listen = this.listener[key].getPlugin();
        try {
          if (!listen) continue;

          ctx.plugin = () => listen;

          /* Check rules and midware before exec */
          const reason = await listen.check(ctx);
          if (!reason?.success) {
            if (listen?.final) await listen.final(ctx, reason);
            continue;
          }

          /* Exec */
          if (listen.exec) await listen.exec(ctx);
        } catch (e) {
          this.#pen.Error('handle-listen', e);
          if (listen?.final) await listen.final(ctx, new Reason({
            success: false,
            code: 'handle-listen-error',
            author: import.meta.url,
            message: e.message,
          }));
        } finally {
          ctx.plugin = null;
        }
      }

      /* Handle commands */
      if (ctx?.pattern && this.isSafe(ctx)) {
        const data = this.getCMD(ctx.pattern.toLowerCase());
        if (!data) return;

        /** @type {import('./plugin.js').Plugin} */
        const plugin = data.getPlugin();
        try {
          ctx.plugin = () => plugin;
          ctx.prefix = data.prefix;
          ctx.cmd = data.cmd

          /* Check rules and midware before exec */
          const reason = await plugin?.check(ctx);
          if (!reason?.success) {
            if (plugin?.final) await plugin.final(ctx, reason);
            return;
          }

          /* Exec */
          if (plugin?.exec) await plugin?.exec(ctx);
        } catch (e) {
          this.#pen.Error('handle-command', e);
          if (plugin?.final) await plugin?.final(ctx, new Reason({
            success: false,
            code: 'handle-command-error',
            author: import.meta.url,
            message: e.message,
          }));
        } finally {
          ctx.plugin = null;
        }
      }
    } catch (e) {
      this.#pen.Error('handle', e);
    }
  }

  /**
   * Handle update data 
   * @param {import('./context.js').Ctx} ctx
   */
  async updateData(ctx) {
    try {
      if (this.updatedAt !== this.pluginManager?.updatedAt) this.generatePlugin();

      switch (ctx.eventName) {
        case Events.GROUPS_UPSERT:
        case Events.GROUP_PARTICIPANTS_UPDATE:
        case Events.GROUPS_UPDATE: {
          await this.updateGroupMetadata(ctx.chat, ctx);
          break;
        }

        case Events.CONTACTS_UPDATE:
        case Events.CONTACTS_UPSERT: {
          this.updateContact(ctx.sender, {
            jid: ctx.sender,
            name: ctx.pushName,
          });
          break;
        }

        case Events.MESSAGES_UPSERT: {
          if (ctx?.fromMe && ctx?.eventType !== 'append' && ctx?.type !== 'senderKeyDistributionMessage') {
            this.updateTimer(ctx.chat, ctx.expiration, ctx.eventName);
          }
          break;
        }

        case Events.BLOCKLIST_SET:
        case Events.BLOCKLIST_UPDATE: {
          /** @type {{blocklist: string[], type: 'add' | 'remove'}} */
          const ev = ctx.event;
          switch (ev?.type) {
            case 'add': {
              this.blockList.push(...ev?.blocklist);
              break;
            }
            case 'remove': {
              this.blockList = this.blockList.filter((jid) => !ev?.blocklist?.includes(jid));
              break;
            }
            default: {
              if (ctx.eventName === Events.BLOCKLIST_SET) this.blockList = ev.blocklist;
            }
          }

          this.blockList = [...new Set(this.blockList)];
          break;
        }

        case Events.CONNECTION_UPDATE: {
          if (ctx?.event?.isOnline) {
            this.generatePlugin();
            await delay(3000);
            try {
              this.runTask('update-data-fetch-blocklist', async () => {
                this.blockList = await this.client?.sock.fetchBlocklist();
              })
            } catch (e) {
              this.#pen.Error('update-data-fetch-blocklist', e);
            }
          }
          break;
        }
      }
    } catch (e) {
      this.#pen.Error('update-data', e);
    }
  }

  /** 
  * Attach client to handler & start listening for events
  * @param {import('./client.js').Wangsaf} client 
  */
  async attach(client) {
    this.#pen.Debug('Attaching client');

    this.client = client;

    this.client.sock.ev.process(events => {
      for (const eventName of Object.keys(events)) {
        const update = events[eventName];
        switch (eventName) {
          case Events.MESSAGES_UPSERT: {
            for (const event of update?.messages) {
              this.handle({ eventName: eventName, event: event, eventType: update.type });
            }
            break;
          }

          case Events.CALL:
          case Events.MESSAGES_REACTION:
          case Events.MESSAGES_UPDATE:
          case Events.CONTACTS_UPDATE:
          case Events.CONTACTS_UPSERT:
          case Events.GROUPS_UPSERT:
          case Events.GROUPS_UPDATE: {
            for (const event of update) {
              this.handle({ eventName: eventName, event: event, eventType: update.type });
            }
            break;
          }

          case Events.GROUP_PARTICIPANTS_UPDATE:
          case Events.PRESENCE_UPDATE: {
            this.handle({ eventName: eventName, event: update, eventType: update.type });
            break;
          }

          default: {
            if (Array.isArray(update)) {
              for (const event of update) {
                this.handle({ eventName: eventName, event: event, eventType: update.type });
              }
            } else {
              this.handle({ eventName: eventName, event: update, eventType: update.type });
            }
          }
        }
      }
    });
  }

  /**
   * Update group metadata by given jid
   * @param {string} jid
   * @param {import('./context.js').Ctx} ctx
   * @returns {Promise<import('baileys').GroupMetadata>}
   */
  async updateGroupMetadata(jid, ctx) {
    try {
      this.#pen.Debug('Updating group metadata', jid, ctx ? `via ${ctx.eventName} with action : ${ctx.action}` : '');
      let data = this.groupCache.get(jid);
      let updated = false;

      if (data) {

        switch (ctx?.eventName) {
          case Events.GROUP_PARTICIPANTS_UPDATE: {
            switch (ctx?.action) {
              case 'add': {
                for (const add of ctx.mentionedJid) {
                  const part = { id: add, admin: null };
                  data.participants.push(part);
                  updated = true && !add.endsWith('@lid');
                }
                break;
              }
              case 'remove': {
                for (const rm of ctx.mentionedJid) {
                  const i = data.participants?.findIndex((part) =>
                    part.id === rm || part.lid === rm || part.jid === rm
                  );
                  if (i !== -1) {
                    data.participants.splice(i, 1);
                    updated = true;
                  }
                }
                break;
              }
              case 'promote': {
                data?.participants?.forEach((part) => {
                  if (ctx.mentionedJid?.includes(part.id) || ctx.mentionedJid?.includes(part.lid)) {
                    part.admin = 'admin';
                    updated = true;
                  }
                });
                break;
              }
              case 'demote': {
                data?.participants?.forEach((part) => {
                  if (ctx.mentionedJid?.includes(part.id) || ctx.mentionedJid?.includes(part.lid)) {
                    part.admin = null;
                    updated = true;
                  }
                });
                break;
              }
              case 'modify': {
                break;
              }
              default: { }
            }
            break;
          }
          case Events.GROUPS_UPDATE: {
            const skip = ['author', 'id'];
            for (const key in ctx?.event) {
              if (skip.includes(key)) continue;
              data[key] = ctx.event[key];
              updated = true;
            }
            break;
          }
        }
      }

      if (!updated) {
        data = await this.client.sock.groupMetadata(jid);
      }

      if (data) {
        data.size = data.participants.length;
        this.groupCache.set(jid, data);
        this.updateTimer(data.id, data.ephemeralDuration, ctx?.eventName);
        return data;
      }

    } catch (e) {
      this.#pen.Error('update-group-metadata', e);
    }
  }

  /**
   * Get group metadata by given jid
   * @param {string} jid
   * @returns {import('baileys').GroupMetadata|undefined}
   */
  getGroupMetadata(jid) {
    const data = this.groupCache.get(jid);
    if (!data) this.runTask('get-group-metadata_' + jid, async () => {
      this.updateGroupMetadata(jid)
        .catch((e) => this.#pen.Error('get-group-metadata', e));
    });
    return data;
  }

  /**
   * Update contact by given jid & data
   * @param {string} jid
   * @param {import('baileys').Contact} data
   */
  updateContact(jid, data) {
    try {
      if (data) this.contactCache.set(jid, data);
    } catch (e) {
      this.#pen.Error('update-contact', e);
    }
  }

  /**
   * Get contact by given jid
   * @param {string} jid
   * @returns {import('baileys').Contact|undefined}
   */
  getContact(jid) {
    return this.contactCache.get(jid);
  }

  /**
   * Update timer by given jid & ephemeral
   * @param {string} jid
   * @param {number} ephemeral
   * @param {string} via
   */
  updateTimer(jid, ephemeral, via) {
    this.#pen.Debug('Updating ephemeral for', jid, 'to', ephemeral, via ? `via ${via}` : '');
    if (jid) {
      const data = this.timerCache.get(jid);
      if (data !== ephemeral) {
        if (!ephemeral) {
          this.timerCache.delete(jid)
        } else {
          this.timerCache.set(jid, ephemeral);
        }
      }
    }
  }

  /**
   * Get timer by given jid
   * @param {string} jid
   * @returns {number|undefined}
   */
  getTimer(jid) {
    return this.timerCache.get(jid);
  }

  /**
   * Get name by given jid
   * @param {string} jid
   * @returns {string|undefined}
   */
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
  * @param {string} jid
  * @param {import('baileys').AnyMessageContent} content
  * @param {import('baileys').MessageGenerationOptions} options
  * @returns {Promise<import('baileys').proto.IWebMessageInfo>}
  */
  async sendMessage(jid, content, options) {
    try {
      if (!content) throw new Error('content not provided');
      if (!options) options = {};

      if (!options.messageId) options.messageId = genHEX(32);

      const ephemeral = this.getTimer(jid);
      if (ephemeral && ephemeral > 0) {
        options.ephemeralExpiration = ephemeral;
      }

      return await this.client.sock.sendMessage(jid, content, options);
    } catch (e) {
      this.#pen.Error('send-message', e);
    }
  }

  /**
   * Relay message to given jid
   * @param {string} jid
   * @param {import('baileys').proto.IMessage} content
   * @param {import('baileys').MessageRelayOptions} options
   * @returns {Promise<string>}
   */
  async relayMessage(jid, content, options) {
    try {
      if (!content) throw new Error('content not provided');
      if (!options) options = {};

      if (!options.messageId) options.messageId = genHEX(32);

      const ephemeral = this.getTimer(jid);
      if (ephemeral && ephemeral > 0) {
        for (let key in content) {
          if (!content[key]) continue;
          if (typeof content[key] === 'object') {
            if (!content[key]?.contextInfo) {
              content[key].contextInfo = { expiration: ephemeral };
            } else {
              content[key].contextInfo.expiration = ephemeral;
            }
          }
        }
        if (content?.conversation && ephemeral > 0) {
          content = {
            extendedTextMessage: {
              text: content.conversation,
              contextInfo: { expiration: ephemeral }
            }
          }
        }
      }
      return await this.client.sock.relayMessage(jid, content, options);
    } catch (e) {
      this.#pen.Error('relay-message', e);
    }
  }

}
