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
import { Events } from './const.js';
import { jidNormalizedUser } from 'baileys';
import { delay, genHEX, hashCRC32, shouldUsePolling } from './tools.js';
import * as chokidar from 'chokidar';
import { Reason } from './reason.js';

/**
 * @typedef {Object} HandlerOptions
 * @property {string} pluginDir
 * @property {Function} filter
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
  /**
   * @param {HandlerOptions} 
   */
  constructor({ pluginDir, filter, prefix, pen, groupCache, contactCache, timerCache }) {
    this.pluginDir = pluginDir ?? '../plugins';

    /** @type {Function} */
    this.filter = filter;

    /** @type {import('./client.js').Wangsaf} */
    this.client = null;

    /** @type {import('./pen.js').Pen)} */
    this.pen = pen ?? new Pen({ prefix: 'hand' });

    /** @type {string[]} */
    this.prefix = prefix ?? ['.', '/'];

    /** @type {Map<number, import('./plugin.js').Plugin>} */
    this.plugins = new Map();

    /** @type {Map<string, {id: number, prefix: string, cmd: string}>} */
    this.cmds = new Map();

    /** @type {Map<number, number>} */
    this.listens = new Map();

    /** @type {Map<string, import('baileys').GroupMetadata>} */
    this.groupCache = groupCache ?? new Map();

    /** @type {Map<string, import('baileys').Contact>} */
    this.contactCache = contactCache ?? new Map();

    /** @type {Map<string, number>} */
    this.timerCache = timerCache ?? new Map();

    /** @type {Array} */
    this.watchID = [];

    /** @type {Array} */
    this.blockList = [];

    /** @type {Object} */
    this.taskList = {}

    /* Scan plugins on start */
    this.scanPlugin(this.pluginDir);

    /* Watch changes in pluginDir */
    this.watcher = chokidar.watch(this.pluginDir, {
      ignoreInitial: true,
      usePolling: shouldUsePolling(),
      interval: 1000,
    })
      .on('change', (loc) => {
        this.pen.Debug(`Plugin changed:`, loc);
        this.loadFile(loc);
      })
      .on('add', (loc) => {
        this.pen.Debug(`Plugin added:`, loc);
        this.loadFile(loc);
      })
      .on('unlink', (loc) => {
        this.pen.Debug(`Plugin removed:`, loc);
        const hash = hashCRC32(loc);
        this.removeOn(hash);
      });
  }

  /**
   * @param {string} id 
   * @param {() => Promise<any>} fn
   * @returns {Promise<any>}
   */
  async runTask(id, fn) {
    if (this.taskList[id]) {
      this.pen.Debug(`Task ${id} is already running`);
      return this.taskList[id];
    }

    this.pen.Debug(`Task ${id} started`);
    const task = (async () => {
      try {
        return await fn();
      } catch (e) {
        this.pen.Error('run-task', `Task ${id} failed`, e);
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
      this.pen.Error('update-block', e);
    }
  }

  /**
   * Set prefix for command plugins
   * @param {string[]} prefix
   */
  setPrefix(prefix) {
    if (!Array.isArray(prefix) || prefix?.length === 0) {
      return this.pen.Warn('Prefix must be an array larger than 0');
    }
    this.prefix = prefix;
    this.cmds.clear()
    for (const [id, plugin] of this.plugins) {
      if (!plugin.cmd) continue;
      this.genCMD(id, plugin);
    }
  }

  /**
   * Generate & registering command for given plugin
   * @param {string} id
   * @param {import('./plugin.js').Plugin} plugin
   */
  genCMD(id, plugin) {
    if (plugin?.cmd) {
      /** @type {string[]} */
      let precmds = [];
      if (Array.isArray(plugin.cmd)) {
        precmds = plugin.cmd;
      } else if (typeof plugin.cmd === 'string') {
        precmds = [plugin.cmd];
      }

      for (const precmd of precmds) {
        if (!precmd) continue;
        if (plugin.noPrefix) {
          this.cmds?.set(precmd.toLowerCase(), {
            id: id,
            cmd: precmd.toLowerCase(),
          });
        } else {
          if (this.prefix) {
            for (const pre of this.prefix) {
              this.cmds?.set(`${pre}${precmd.toLowerCase()}`, {
                id: id,
                prefix: pre,
                cmd: precmd.toLowerCase(),
              });
            }
          } else {
            this.cmds?.set(precmd.toLowerCase(), {
              id: id,
              cmd: precmd.toLowerCase(),
            });
          }
        }
      }
    }
  }

  /**
   * Add plugin to handler
   * @param {string} location
   * @param {import('./plugin.js').Plugin} opts 
   */
  async on(location, ...opts) {
    let i = 0;
    for (const opt of opts) {
      /* Check if plugin hasn't exec */
      if (!opt.exec) continue;

      const hash = hashCRC32(location);
      const plugin = new Plugin(opt);
      plugin.location = location;

      if (this.filter) {
        if (!this.filter(this, plugin)) continue;
      }

      const newid = `${hash}-${i}`;
      this.plugins.set(newid, plugin);

      /* Check if plugin has cmd, so it is a command plugin */
      if (plugin.cmd) {
        this.genCMD(newid, plugin);
      } else {
        this.listens.set(newid, newid);
      }

      i++;
    }
  }

  /**
   * Remove plugin by hash
   * @param {string} hash
   */
  async removeOn(hash) {
    try {
      for (const id of this.plugins.keys()) {
        if (id.startsWith(hash)) {
          this.plugins.delete(id);
          for (const [id_ls, val] of this.listens) {
            if (val === id) {
              this.listens.delete(id_ls);
            }
          }
          for (const [id_cmd, val] of this.cmds) {
            if (val?.id?.startsWith(hash)) {
              this.cmds.delete(id_cmd);
            }
          }
        }
      }
    } catch (e) {
      this.pen.Error('remove-on', e);
    }
  }

  /**
   * Plugin scanner for given directory
   * @param {string} dir
   */
  async scanPlugin(dir) {
    let files = [];
    try {
      files = readdirSync(dir);
    } catch (e) {
      this.pen.Error('scan-plugin', e);
    }
    for (const file of files) {
      let loc = `${dir}/${file}`.replace('//', '/');

      try {
        if (statSync(loc)?.isDirectory()) await this.scanPlugin(loc);
      } catch (e) {
        this.pen.Error('scan-plugin-stat', e.message);
      }

      await this.loadFile(loc);
    }
  }

  /**
   * Preload plugins before start
   * @param {...Function} callbacks
   */
  async preLoad(...callbacks) {
    if (!callbacks) return;

    for (const callback of callbacks) {
      try {
        await callback(this);
      } catch (e) {
        this.pen.Error('pre-load', e);
      }
    }
  }

  /**
   * Load plugin file from given location
   * @param {string} loc
   */
  async loadFile(loc) {
    if (loc.endsWith('.js')) {
      try {
        const filename = loc.split('/').pop();
        if (
          filename.startsWith('_') ||
          filename.startsWith('.') ||
          filename.endsWith('.test.js')
        ) {
          this.pen.Debug('Skip:', loc)
          return;
        }

        if (platform() === 'win32') {
          loc = pathToFileURL(loc).href;
        }

        const loaded = await import(`${loc}?t=${Date.now()}`);
        let pre = 0;
        let def = 0;

        if (loaded.pre) {
          if (Array.isArray(loaded.pre)) {
            this.preLoad(...loaded.pre);
            pre = loaded.pre.length;
          } else {
            this.preLoad(loaded.pre);
            pre = 1;
          }
        }

        if (loaded.default) {
          if (Array.isArray(loaded.default)) {
            this.on(loc, ...loaded.default);
            def = loaded.default.length;
          } else {
            this.on(loc, loaded.default);
            def = 1;
          }
        }

        const msgs = ['Loaded'];
        if (pre > 0) msgs.push(`${pre} pre`);
        if (def > 0) msgs.push(`${def} default`);
        msgs.push(loc);

        this.pen.Debug(...msgs);
      } catch (e) {
        this.pen.Error('load-file', loc, e);
      }
    }

  }

  /** 
   * Get command by pattern
   * @param {string} p
   * @returns {{id: number, prefix: string, cmd: string, plugin:import('./plugin.js').Plugin}|undefined}
   */
  getCMD(p) {
    if (!p) return;
    const data = this.cmds.get(p.toLowerCase());
    if (!data) return;
    const plugin = this.plugins.get(data.id);
    if (!plugin) return;
    return {
      id: data.id,
      prefix: data.prefix,
      cmd: data.cmd,
      plugin: plugin,
    };
  }

  /** 
   * Check if given pattern is a command
   * @param {string} p
   * @returns {boolean}
   */
  isCMD(p) {
    if (!p) return false;
    return this.cmds.has(p.toLowerCase());
  }

  /**
   * Check if given context id is already exist in watchID
   * @param {import('./context.js').Ctx} ctx
   * @returns {boolean|undefined}
   */
  idExist(ctx) {
    if (this.watchID.includes(ctx?.id) || !ctx.type) {
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
    const idExist = isPrekey || isUndefined ? true : this.idExist(ctx);

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

      for (const lsid of this.listens.values()) {
        /** @type {import('./plugin.js').Plugin} */
        const listen = this.plugins.get(lsid);
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
          this.pen.Error('handle-listen', e);
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
        try {
          ctx.plugin = () => data.plugin;
          ctx.prefix = data.prefix;
          ctx.cmd = data.cmd

          /* Check rules and midware before exec */
          const reason = await data?.plugin?.check(ctx);
          if (!reason?.success) {
            if (data?.plugin?.final) await data?.plugin.final(ctx, reason);
            return;
          }

          /* Exec */
          if (data?.plugin?.exec) await data?.plugin?.exec(ctx);
        } catch (e) {
          this.pen.Error('handle-command', ctx.pattern, e);
          if (data?.plugin?.final) await data?.plugin?.final(ctx, new Reason({
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
      this.pen.Error('handle', e);
    }
  }

  /**
   * Handle update data 
   * @param {import('./context.js').Ctx} ctx
   */
  async updateData(ctx) {
    try {

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
          if (ctx?.fromMe && !ctx?.edited && ctx?.eventType !== 'append' && ctx?.type !== 'senderKeyDistributionMessage') {
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
            await delay(3000);
            try {
              this.runTask('update-data-fetch-blocklist', async () => {
                this.blockList = await this.client?.sock.fetchBlocklist();
              })
            } catch (e) {
              this.pen.Error('update-data-fetch-blocklist', e);
            }
          }
          break;
        }
      }
    } catch (e) {
      this.pen.Error('update-data', e);
    }
  }

  /** 
  * Attach client to handler & start listening for events
  * @param {import('./client.js').Wangsaf} client 
  */
  async attach(client) {
    this.pen.Debug('Attaching client');

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
      this.pen.Debug('Updating group metadata', jid, ctx ? `via ${ctx.eventName} with action : ${ctx.action}` : '');
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
      this.pen.Error('update-group-metadata', jid, e);
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
        .catch((e) => this.pen.Error('get-group-metadata', jid, e));
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
      this.pen.Error('update-contact', e);
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
    this.pen.Debug('Updating ephemeral for', jid, 'to', ephemeral, via ? `via ${via}` : '');
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
      options.ephemeralExpiration = ephemeral;

      return await this.client.sock.sendMessage(jid, content, options);
    } catch (e) {
      this.pen.Error('send-message', e);
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
      for (let key in content) {
        if (!content[key]) continue;
        if (typeof content[key] === 'object') {
          if (!content[key]?.contextInfo) {
            content[key].contextInfo = { expiration: ephemeral };
          } else {
            content[key].contextInfo.expiration = ephemeral;
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
      this.pen.Error('relay-message', e);
    }
  }

  /**
   * Send file to given jid
   * @param {string} jid
   * @param {string} filePath
   * @param {{caption?: string, filename?: string}} opts
   */
  async sendFile(jid, filePath, opts) {
    if (!opts) opts = {};
    if (!opts.filename) opts.filename = filePath.split(/\\|\//gi).pop();

    return this.sendMessage(jid, {
      document: {
        file: filePath
      },
      fileName: opts.filename,
      caption: opts.caption
    })
  }
}
