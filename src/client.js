/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import EventEmitter from "node:events";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
  Browsers,
  DisconnectReason,
  jidNormalizedUser,
  makeWASocket,
  useMultiFileAuthState,
} from "baileys";
import pino from "pino";
import QRCode from "qrcode";
import { useMongoDB } from "./auth_mongo.js";
import { usePostgres } from "./auth_postgres.js";
import { useSQLite } from "./auth_sqlite.js";
import { ChatManager } from "./chat_manager.js";
import { Events } from "./const.js";
import { Ctx } from "./context.js";
import { Pen } from "./pen.js";
import { StoreSQLite } from "./store.js";
import { delay, genHEX } from "./tools.js";
import { UserManager } from "./user_manager.js";

/* Initialize readline */
const question = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Ask for input text
 * @param {string} prompt
 */
function ask(prompt) {
  return new Promise((resolve) => question.question(prompt, resolve));
}

/**
 * Use the appropriate store based on the session string
 * @param {string} sessionStr
 * @returns {Promise<{ state:import('baileys').AuthenticationState, saveCreds: () => Promise<void>, clearState: () => Promise<void>, type: string }|undefined> }
 */
export async function useStore(sessionStr) {
  if (!sessionStr) return null;

  if (sessionStr.startsWith("mongodb")) {
    const { state, saveCreds, clearState } = await useMongoDB(sessionStr);
    return { state, saveCreds, clearState, type: "mongodb" };
  } else if (sessionStr.startsWith("postgres")) {
    const { state, saveCreds, clearState } = await usePostgres(sessionStr);
    return { state, saveCreds, clearState, type: "postgres" };
  } else if (sessionStr.includes(".sqlite") || sessionStr.includes(".db")) {
    const { state, saveCreds, clearState } = await useSQLite(sessionStr);
    return { state, saveCreds, clearState, type: "sqlite" };
  } else {
    const { state, saveCreds } = await useMultiFileAuthState(sessionStr);
    return { state, saveCreds, type: "folder" };
  }
}

/**
 * @enum {string}
 * @readonly
 */
export const ClientEvents = Object.freeze({
  READY: "ready",

  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
});

/**
 * @enum {string}
 */
export const Method = Object.freeze({
  OTP: "otp",
  QRCode: "qr",
});

/**
 * @typedef {Object} ClientOpts
 * @property {string} name
 * @property {string} phone
 * @property {Method} method
 * @property {string} botDir
 * @property {import('baileys').WABrowserDescription} browser
 * @property {import('baileys').UserFacingSocketConfig} socketCofig
 * @property {import('./handler.js').Handler} handler
 * @property {string[]} prefixes
 * @property {string[]} plugins
 */

/**
 * @class Client
 * @description WhatsApp client class
 */
export class Client extends EventEmitter {
  /** @param {ClientOpts} opts */
  constructor(opts) {
    super();

    if (!opts) throw Error("Client options are required");

    /** @type {import('baileys').WASocket} */
    this.sock = null;

    /** @type {string} */
    this.name = opts.name;

    /** @type {string} */
    this.phone = opts.phone;

    /** @type {Method} */
    this.method = opts.method;

    /** @type {string} */
    this.botDir = opts.botDir;

    /** @type {import('baileys').UserFacingSocketConfig} */
    this.socketCofig = {
      syncFullHistory: false,
      browser: Browsers.macOS("Safari"),
      logger: pino({ level: "error" }),
      version: [2, 3000, 1038162681],
    };

    Object.assign(this.socketCofig, opts.socketCofig);

    /** @type {import('./handler.js').Handler} */
    this.handler = opts.handler;

    this.pen = new Pen({ prefix: `${this.name}` });

    /** @type {import('./store.js').Store} */
    this.store = null;

    /** @type {import('./user_manager.js').UserManager} */
    this.userManager = null;

    /** @type {import('./chat_manager.js').ChatManager} */
    this.chatManager = null;

    /** @type {import('./store.js').Store} */
    this.settings = null;

    /** @type {import('./store.js').Store} */
    this.groupCache = null;

    /** @type {import('./store.js').Store} */
    this.contactCache = null;

    /** @type {import('./store.js').Store} */
    this.timerCache = null;

    /** @type {number} */
    this.createdAt = Date.now();

    /** @type {number} */
    this.startedAt = 0;

    /** @type {boolean} */
    this.retry = true;

    /** @type {Map<string, Promise<void>>} */
    this.taskList = new Map();

    /** @type {Set<string>} */
    this.blockList = new Set();

    this.ready = this.init();
    this.ready.catch((e) => this.pen.Error(e));
  }

  async runTask(id, func) {
    if (this.taskList.has(id)) {
      this.pen.Debug(`Task ${id} is already running`);
      return this.taskList.get(id);
    }

    this.pen.Debug(`Running task ${id}`);
    const task = (async () => {
      try {
        return await func();
      } catch (e) {
        this.pen.Error("run-task", id, e);
      } finally {
        this.taskList.delete(id);
      }
    })();

    this.taskList.set(id, task);
    return task;
  }

  withDir(name) {
    return path.resolve(this.botDir, name);
  }

  async init() {
    this.initBotDir();
    this.initDatabases();
    await this.initBot();

    this.handler.settings = this.settings;

    const prefixes = this.settings.get("prefixes");
    if (Array.isArray(prefixes) && prefixes?.length > 0) {
      this.handler.setPrefixes(prefixes);
    }
  }

  initDatabases() {
    this.store = new StoreSQLite({
      saveName: path.join(this.botDir, "settings.db"),
      tableName: "settings",
    });

    this.userManager = new UserManager({
      store: this.store.use("users"),
    });

    this.chatManager = new ChatManager({
      store: this.store.use("chats"),
    });

    this.contactCache = this.store.use("contacts");
    this.groupCache = this.store.use("group_metadata");
    this.timerCache = this.store.use("timers");

    this.settings = this.store.use("settings");
  }

  initBotDir() {
    /* Check existence of bot directory */
    if (!this.botDir) throw Error("Bot directory is required");

    const exist = fs.existsSync(this.botDir);
    if (!exist) {
      this.pen.Warn(`Creating ${this.botDir}`);
      fs.mkdirSync(this.botDir, { recursive: true });
    }
  }

  async initBot() {
    const { state, saveCreds, clearState, type } = await useStore(
      this.withDir("session.db"),
    );

    this.socketCofig.auth = state;

    this.saveCreds = saveCreds;
    this.clearState = clearState;
    this.dbType = type;
  }

  async handle({ eventName, event, eventType }) {
    try {
      const ctx = new Ctx({
        bot: this.sock.user,
        eventName: eventName,
        event: event,
        eventType: eventType,
        client: this,
        handler: this.handler,
      });

      await ctx.init();
      await this.handler.handle(ctx);
    } catch (e) {
      this.pen.Error("handle", e);
    }
  }

  async initHandler() {
    this.sock.ev.process(
      /** @param {import('baileys').BaileysEventMap} events */
      async (events) => {
        for (const eventName of Object.keys(events)) {
          const update = events[eventName];
          switch (eventName) {
            case Events.CONNECTION_UPDATE: {
              const owner = this.sock?.user;
              if (owner) {
                this.userManager?.addOwners(owner.id);
              }
              break;
            }
            case Events.MESSAGES_UPSERT: {
              for (const event of update?.messages ?? []) {
                await this.handle({
                  eventName: eventName,
                  event: event,
                  eventType: update.type,
                }).catch((e) => {
                  this.pen.Error(eventName, e);
                });
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
                await this.handle({
                  eventName: eventName,
                  event: event,
                  eventType: update.type,
                }).catch((e) => {
                  this.pen.Error(eventName, e);
                });
              }
              break;
            }

            case Events.GROUP_PARTICIPANTS_UPDATE:
            case Events.PRESENCE_UPDATE: {
              await this.handle({
                eventName: eventName,
                event: update,
                eventType: update.type,
              }).catch((e) => {
                this.pen.Error(eventName, e);
              });
              break;
            }

            default: {
              if (Array.isArray(update)) {
                for (const event of update) {
                  await this.handle({
                    eventName: eventName,
                    event: event,
                    eventType: update.type,
                  }).catch((e) => {
                    this.pen.Error(eventName, e);
                  });
                }
              } else {
                await this.handle({
                  eventName: eventName,
                  event: update,
                  eventType: update.type,
                }).catch((e) => {
                  this.pen.Error(eventName, e);
                });
              }
            }
          }
        }
      },
    );
  }

  async connect() {
    await this.ready;
    this.emit(ClientEvents.READY);

    this.startedAt = Date.now();
    this.sock = makeWASocket(this.socketCofig);

    await this.initHandler();

    if (
      this.method === Method.OTP &&
      !this.socketCofig.auth?.creds?.registered &&
      !this.socketCofig.auth?.creds?.platform
    ) {
      this.pen.Info("Delay 3s before requesting pairing code");
      await delay(3000);

      let phone = this.phone;
      if (!phone) {
        while (!phone) {
          phone = await ask(`Enter phone ${phone ?? ""}: `);
          phone = phone?.replace(/[^+0-9]/g, "");
          phone = phone?.trim();

          if (!phone || phone === "") this.pen.Error("Invalid phone number");
        }
      }

      this.pen.Info(`Using this phone : ${phone}`);
      const code = await this.sock.requestPairingCode(phone);
      if (code) {
        this.pen.Log("Enter this OTP :", code);
      } else {
        this.pen.Error("Failed to get pairing code");
      }
    }

    this.sock.ev.on(Events.CONNECTION_UPDATE, async (event) => {
      const { connection, lastDisconnect, qr } = event;
      if (qr && this.method === Method.QRCode) {
        this.pen.Info("Scan this QR :");
        console.log(
          await QRCode.toString(qr, { type: "terminal", small: true }),
        );
        this.emit("qr", { name: this.name, qr });
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut &&
          statusCode !== DisconnectReason.forbidden;
        if (shouldReconnect) {
          if (this.retry) {
            this.pen.Debug(
              Events.CONNECTION_UPDATE,
              "statusCode :",
              statusCode,
              `Reconnecting...`,
            );
            await delay(3000);
            this.connect();
          } else {
            this.pen.Error(
              Events.CONNECTION_UPDATE,
              "statusCode :",
              statusCode,
              "Not retrying.",
            );
          }
        } else if (
          statusCode === DisconnectReason.loggedOut ||
          statusCode === DisconnectReason.forbidden
        ) {
          this.pen.Debug(
            Events.CONNECTION_UPDATE,
            "statusCode :",
            statusCode,
            "Logged out, closing connection",
          );
          try {
            if (this.clearState) {
              await this.clearState();
            } else if (this.dbType === "folder") {
              fs.rmSync(this.withDir("session.db"), { recursive: true });
            }
          } catch (e) {
            this.pen.Error(e);
          } finally {
            this.pen.Warn(
              "statusCode :",
              statusCode,
              "Session terminated. Reconnecting in 5s...",
            );
            setTimeout(() => this.connect(), 5000);
          }
        }
      } else if (connection === "open") {
        this.emit("connected", { name: this.name });
        this.pen.Info("Client connected");
      }
    });

    this.sock.ev.on(Events.CREDS_UPDATE, this.saveCreds);
    this.emit(ClientEvents.CONNECTED);
  }

  async disconnect() {
    this.emit(ClientEvents.DISCONNECTED);
  }

  /* INFO: This section for data and updater methods */

  /**
   * Check whether given jid is blocked or not
   * @param {string} jid
   * @returns {boolean}
   */
  isBlocked(jid) {
    return this.blockList.has(jidNormalizedUser(jid));
  }

  /**
   * Block / unblock given jid
   * @param {string} jid
   * @param {string} action
   * @returns {Promise<boolean | undefined>}
   */
  async updateBlock(jid, action) {
    try {
      await this.sock?.updateBlockStatus(jid, action);
      switch (action) {
        case "block": {
          this.blockList.add(jidNormalizedUser(jid));
          break;
        }
        case "unblock": {
          this.blockList = this.blockList.delete(jidNormalizedUser(jid));
          break;
        }
      }
      return true;
    } catch (e) {
      this.pen.Error("update-block", e);
    }
  }

  /**
   * Get user by given jid
   * @param {string} jid
   * @returns {import('./user_manager.js').User|undefined}
   */
  getUser(jid) {
    return this.userManager.getUser(jid);
  }

  /**
   * Get user by given jid
   * @param {string} jid
   * @param {import('./user_manager.js').User} data
   */
  updateUser(jid, data) {
    return this.userManager.updateUser(jid, data);
  }

  /**
   * Get chat by given jid
   * @param {string} jid
   * @returns {import('./chat_manager.js').Chat|undefined}
   */
  getChat(jid) {
    return this.chatManager.getChat(jid);
  }

  /**
   * Update group metadata by given jid
   * @param {string} jid
   * @param {import('./context.js').Ctx} ctx
   * @returns {Promise<import('baileys').GroupMetadata>}
   */
  async updateGroupMetadata(jid, ctx) {
    try {
      this.pen.Debug(
        "Updating group metadata",
        jid,
        ctx ? `via ${ctx.eventName} with action : ${ctx.action}` : "",
      );
      let data = this.groupCache.get(jid);
      let updated = false;

      if (data) {
        switch (ctx?.eventName) {
          case Events.GROUP_PARTICIPANTS_UPDATE: {
            switch (ctx?.action) {
              case "add": {
                for (const add of ctx.mentionedJid) {
                  const part = { id: add, admin: null };
                  data.participants.push(part);
                  updated = !ctx.mentionedJid.some((jid) =>
                    jid.endsWith("@lid"),
                  );
                }
                break;
              }
              case "remove": {
                for (const rm of ctx.mentionedJid) {
                  const i = data.participants?.findIndex(
                    (part) =>
                      part.id === rm || part.lid === rm || part.jid === rm,
                  );
                  if (i !== -1) {
                    data.participants.splice(i, 1);
                    updated = true;
                  }
                }
                break;
              }
              case "promote": {
                data?.participants?.forEach((part) => {
                  if (
                    ctx.mentionedJid?.includes(part.id) ||
                    ctx.mentionedJid?.includes(part.lid)
                  ) {
                    part.admin = "admin";
                    updated = true;
                  }
                });
                break;
              }
              case "demote": {
                data?.participants?.forEach((part) => {
                  if (
                    ctx.mentionedJid?.includes(part.id) ||
                    ctx.mentionedJid?.includes(part.lid)
                  ) {
                    part.admin = null;
                    updated = true;
                  }
                });
                break;
              }
              case "modify": {
                break;
              }
              default:
                break;
            }
            break;
          }
          case Events.GROUPS_UPDATE: {
            const skip = ["author", "id"];
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
        data = await this.sock.groupMetadata(jid);
      }

      if (data) {
        data.size = data.participants.length;
        this.groupCache.set(jid, data);
        this.updateTimer(data.id, data.ephemeralDuration, ctx?.eventName);
        return data;
      }
    } catch (e) {
      this.pen.Error("update-group-metadata", jid, e);
    }
  }

  /**
   * Get group metadata by given jid
   * @param {string} jid
   * @returns {import('baileys').GroupMetadata|undefined}
   */
  getGroupMetadata(jid) {
    const data = this.groupCache.get(jid);
    if (!data)
      this.runTask(`get-group-metadata_${jid}`, async () => {
        try {
          await this.updateGroupMetadata(jid);
        } catch (e) {
          this.pen.Error("get-group-metadata", jid, e);
        }
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
      this.pen.Error("update-contact", e);
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
    this.pen.Debug(
      "Updating ephemeral for",
      jid,
      "to",
      ephemeral,
      via ? `via ${via}` : "",
    );
    if (jid) {
      const data = this.timerCache.get(jid);
      if (data !== ephemeral) {
        if (!ephemeral) {
          this.timerCache.delete(jid);
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
    if (!jid || jid === "") return null;

    if (jid.endsWith("@g.us")) {
      const data = this.getGroupMetadata(jid);
      return data?.subject;
    } else if (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid")) {
      const data = this.getContact(jid);
      return data?.name;
    }

    /* TODO: Handle other types of jids
    else if (jid.endsWith('@newsletter')) { } 
    */

    return null;
  }

  /* INFO: This is a placeholder for sender methods */

  /**
   * Send message to given jid
   * @param {string} jid
   * @param {import('baileys').AnyMessageContent} content
   * @param {import('baileys').MiscMessageGenerationOptions} [options]
   * @returns {Promise<import('baileys').proto.IWebMessageInfo|undefined>}
   */
  async sendMessage(jid, content, options) {
    try {
      if (!content) throw new Error("content not provided");
      if (!options) options = {};

      if (!options.messageId) options.messageId = genHEX(32);

      const ephemeral = this.getTimer(jid);
      options.ephemeralExpiration = ephemeral;

      return await this.sock.sendMessage(jid, content, options);
    } catch (e) {
      this.pen.Error("send-message", e);
    }
    return;
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
      if (!content) throw new Error("content not provided");
      if (!options) options = {};

      if (!options.messageId) options.messageId = genHEX(32);

      const ephemeral = this.getTimer(jid);
      for (const key in content) {
        if (!content[key]) continue;
        if (typeof content[key] === "object") {
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
              contextInfo: { expiration: ephemeral },
            },
          };
        }
      }
      return await this.sock.relayMessage(jid, content, options);
    } catch (e) {
      this.pen.Error("relay-message", e);
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
        file: filePath,
      },
      fileName: opts.filename,
      caption: opts.caption,
    });
  }
}
