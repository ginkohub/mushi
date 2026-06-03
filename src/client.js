/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
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
import { logger as rootLogger } from "./logger.js";
import { StoreSQLite } from "./store.js";
import { delay, genHEX } from "./tools.js";
import { UserManager } from "./user_manager.js";

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
  } else if (sessionStr.endsWith(".sqlite") || sessionStr.endsWith(".db")) {
    const { state, saveCreds, clearState } = await useSQLite(sessionStr);
    return { state, saveCreds, clearState, type: "sqlite" };
  } else {
    const { state, saveCreds } = await useMultiFileAuthState(sessionStr);
    return { state, saveCreds, type: "folder" };
  }
}

/**
 * @readonly
 * @enum {string}
 */
export const ClientEvents = Object.freeze({
  READY: "ready",

  CONNECTED: "connected",
  DISCONNECTED: "disconnected",

  AUTH_OTP: "auth_otp",
  AUTH_QRCODE: "auth_qrcode",

  MESSAGE_RECEIVED: "message_received",
  MESSAGE_SENT: "message_sent",

  ERROR: "error",

  LOG_DEBUG: "log_debug",
  LOG_INFO: "log_info",
  LOG_WARN: "log_warn",
  LOG_ERROR: "log_error",
});

/**
 * @enum {string}
 */
export const Method = Object.freeze({
  OTP: "otp",
  QRCode: "qr",
});

/**
 * @enum {string}
 */
export const ConnectionStatus = Object.freeze({
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
});

/**
 * @typedef {Object} ClientOpts
 * @property {string} name
 * @property {string} phone
 * @property {Method} method
 * @property {string} botDir
 * @property {import('baileys').WABrowserDescription} browser
 * @property {import('baileys').UserFacingSocketConfig} socketConfig
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
    this.socketConfig = {
      syncFullHistory: false,
      browser: Browsers.macOS("Safari"),
      logger: pino({ level: "error" }),
    };

    Object.assign(this.socketConfig, opts.socketConfig);

    /** @type {import('./handler.js').Handler} */
    this.handler = opts.handler;

    this.log = null;

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

    this.messageReceived = 0;
    this.messageSent = 0;
    this.lastSeen = null;

    this.isAuthenticated = false;
    this.status = ConnectionStatus.DISCONNECTED;

    /** @type {boolean} */
    this.retry = true;

    /** @type {Map<string, Promise<void>>} */
    this.taskList = new Map();

    /** @type {Set<string>} */
    this.blockList = new Set();

    this.ready = this.init();
    this.ready.catch((e) => rootLogger?.error(e));
  }

  /**
   * Run a task with deduplication
   * @param {string} id
   * @param {() => Promise<unknown>} func
   * @returns {Promise<unknown>}
   */
  async runTask(id, func) {
    if (this.taskList.has(id)) {
      this.log.debug(`Task ${id} is already running`);
      return this.taskList.get(id);
    }

    this.log.debug(`Running task ${id}`);
    const task = (async () => {
      try {
        return await func();
      } catch (e) {
        this.log.error("run-task", id, e);
      } finally {
        this.taskList.delete(id);
      }
    })();

    this.taskList.set(id, task);
    return task;
  }

  /**
   * Resolve path relative to bot directory
   * @param {string} name
   * @returns {string}
   */
  withDir(name) {
    return path.resolve(this.botDir, name);
  }

  /**
   * Initialize client
   * @returns {Promise<void>}
   */
  async init() {
    this.initBotDir();

    const logDir = path.join(this.botDir, "logs");
    const clientLog = rootLogger.child(this.name);
    clientLog.toFile({ path: path.join(logDir, `${this.name}.log`) });
    this.log = clientLog;

    this.initDatabases();
    await this.initBot();

    this.handler.settings = this.settings;

    const prefixes = this.settings.get("prefixes");
    if (Array.isArray(prefixes) && prefixes?.length > 0) {
      this.handler.setPrefixes(prefixes);
    }

    this.messageReceived = this.store.get("message_received") || 0;
    this.messageSent = this.store.get("message_sent") || 0;
    this.lastSeen = this.store.get("last_seen") || null;
  }

  /**
   * Initialize database stores
   */
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

  /**
   * Initialize bot directory
   */
  initBotDir() {
    /* Check existence of bot directory */
    if (!this.botDir) throw Error("Bot directory is required");

    const exist = existsSync(this.botDir);
    if (!exist) {
      this.log?.warn(`Creating ${this.botDir}`);
      mkdirSync(this.botDir, { recursive: true });
    }
  }

  /**
   * Initialize bot authentication
   * @returns {Promise<void>}
   */
  async initBot() {
    const { state, saveCreds, clearState, type } = await useStore(
      this.withDir("session.db"),
    );

    this.socketConfig.auth = state;

    this.saveCreds = saveCreds;
    this.clearState = clearState;
    this.dbType = type;

    this.isAuthenticated = this.socketConfig.auth?.creds?.registered;
  }

  /**
   * Handle event with context
   * @param {{eventName: string, event: unknown, eventType: string}} param0
   * @returns {Promise<void>}
   */
  async handle({ eventName, event, eventType }) {
    try {
      const c = new Ctx({
        bot: this.sock.user,
        eventName: eventName,
        event: event,
        eventType: eventType,
        client: this,
        handler: this.handler,
      });

      await c.init();
      await this.updateData(c);
      await this.handler.handle(c);
    } catch (e) {
      this.log.error("handle", e);
    }
  }

  /**
   * Initialize event handler
   * @returns {Promise<void>}
   */
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
              for (const event of update?.messages || []) {
                this._messageReceived();
                this._seenNow();
                await this.handle({
                  eventName: eventName,
                  event: event,
                  eventType: update?.type,
                }).catch((e) => {
                  this.log.error(eventName, e);
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
              for (const event of update || []) {
                await this.handle({
                  eventName: eventName,
                  event: event,
                  eventType: update?.type,
                }).catch((e) => {
                  this.log.error(eventName, e);
                });
              }
              break;
            }

            case Events.GROUP_PARTICIPANTS_UPDATE:
            case Events.PRESENCE_UPDATE: {
              await this.handle({
                eventName: eventName,
                event: update,
                eventType: update?.type,
              }).catch((e) => {
                this.log.error(eventName, e);
              });
              break;
            }

            default: {
              if (Array.isArray(update)) {
                for (const event of update) {
                  await this.handle({
                    eventName: eventName,
                    event: event,
                    eventType: update?.type,
                  }).catch((e) => {
                    this.log.error(eventName, e);
                  });
                }
              } else {
                await this.handle({
                  eventName: eventName,
                  event: update,
                  eventType: update?.type,
                }).catch((e) => {
                  this.log.error(eventName, e);
                });
              }
            }
          }
        }
      },
    );
  }

  /**
   * Connect to WhatsApp
   * @returns {Promise<void>}
   */
  async connect() {
    if (!this.retry) {
      this.log.warn(
        "Connect skipped: Client is in disconnected state (retry=false)",
      );
      return;
    }

    if (this.status === ConnectionStatus.CONNECTED) {
      this.log.warn("Already connected");
      return;
    }

    if (this.status === ConnectionStatus.CONNECTING) {
      this.log.warn("Connection in progress, skipping");
      return;
    }

    this.status = ConnectionStatus.CONNECTING;

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
        this.sock.end();
      } catch { }
      this.sock = null;
    }

    await this.ready;
    this.emit(ClientEvents.READY);

    this.startedAt = Date.now();
    this.sock = makeWASocket(this.socketConfig);

    await this.initHandler();

    if (
      this.method === Method.OTP &&
      !this.socketConfig.auth?.creds?.registered &&
      !this.socketConfig.auth?.creds?.platform
    ) {
      this.log.info("Delay 3s before requesting pairing code");
      await delay(3000);

      const phone = this.phone;
      if (!phone) {
        this.status = ConnectionStatus.DISCONNECTED;
        throw new Error(
          "Phone number is required for 'otp' method but was not provided.",
        );
      }

      try {
        this.log.info(`Using this phone : ${phone}`);
        const code = await this.sock.requestPairingCode(phone);
        if (code) {
          this.log.info(`Pairing Code (OTP): ${code}`);
          this.emit(ClientEvents.AUTH_OTP, { name: this.name, code });
        } else {
          this.log.error("Failed to get pairing code");
          this.emit(ClientEvents.ERROR, {
            name: this.name,
            code: "request-pairing-code",
            message: "Failed to get pairing code",
          });
        }
      } catch (e) {
        this.status = ConnectionStatus.DISCONNECTED;
        throw e;
      }
    }

    this.sock.ev.on(Events.CONNECTION_UPDATE, async (event) => {
      const { connection, lastDisconnect, qr } = event;

      if (qr && this.method === Method.QRCode) {
        const qrTerminal = await QRCode.toString(qr, {
          type: "terminal",
          small: true,
        });
        this.log.info(`Scan this QR :\n${qrTerminal}`);
        this.emit(ClientEvents.AUTH_QRCODE, { name: this.name, qr });
      }

      if (connection === "close") {
        this.status = ConnectionStatus.DISCONNECTED;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || "Unknown reason";

        const isLoggedOut =
          statusCode === DisconnectReason.loggedOut ||
          statusCode === DisconnectReason.forbidden;

        if (isLoggedOut) {
          this.log.error(
            "Connection closed: Logged out or Forbidden. Manual intervention required.",
          );
          this.retry = false;
          try {
            if (this.clearState) await this.clearState();
            else if (this.dbType === "folder")
              rmSync(this.withDir("session.db"), { recursive: true });
          } catch (e) {
            this.log.error("Error clearing state:", e);
          }
          this.emit(ClientEvents.DISCONNECTED, { reason: "logged_out" });
          return;
        }

        if (this.retry) {
          const delayTime = 5000;
          this.log.warn(
            `Connection closed (${reason}, code: ${statusCode}). Reconnecting in ${delayTime / 1000}s...`,
          );
          this._reconnectTimer = setTimeout(() => this.connect(), delayTime);
        } else {
          this.log.info(`Connection closed (${reason}). No retry requested.`);
        }
      } else if (connection === "open") {
        this.status = ConnectionStatus.CONNECTED;
        this.emit(ClientEvents.CONNECTED, { name: this.name });
        this.log.info("Client connected successfully");
      }
    });

    this.sock.ev.on(Events.CREDS_UPDATE, this.saveCreds.bind(this));
  }

  /**
   * Disconnect from WhatsApp
   * @returns {Promise<void>}
   */
  async disconnect() {
    this.retry = false;
    this.status = ConnectionStatus.DISCONNECTED;
    this.log.info("Disconnecting and silencing bot...");
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
        this.sock.end();
      } catch (e) {
        this.log.error("Error during socket end:", e);
      }
    }

    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);

    if (this._updateTimer) {
      clearTimeout(this._updateTimer);
      this._scheduleUpdate(true);
    }
    this.log.flush();
    this.emit(ClientEvents.DISCONNECTED);

    /* TODO: Should we remove all listener on disconnect ?
     * this.removeAllListeners();
     */
  }

  /* INFO: This section for data and updater methods */

  /**
   * Schedule update data
   * @param {boolean} force
   */
  _scheduleUpdate(force) {
    if (this._updateTimer) clearTimeout(this._updateTimer);
    if (force) {
      this._updateTimer = null;
      this.store.set("message_received", this.messageReceived);
      this.store.set("message_sent", this.messageSent);
      this.store.set("last_seen", this.lastSeen);
    } else {
      this._updateTimer = setTimeout(() => {
        this._updateTimer = null;
        this.store.set("message_received", this.messageReceived);
        this.store.set("message_sent", this.messageSent);
        this.store.set("last_seen", this.lastSeen);
      }, 5000);
    }
  }

  _messageReceived() {
    this.messageReceived++;
    this._scheduleUpdate();
  }

  _messageSent() {
    this.messageSent++;
    this._scheduleUpdate();
  }

  _seenNow() {
    this.lastSeen = Date.now();
    this._scheduleUpdate();
  }

  /**
   * Handle update data
   * @param {import('./context.js').Ctx} c
   */
  async updateData(c) {
    try {
      switch (c.eventName) {
        case Events.GROUPS_UPSERT:
        case Events.GROUP_PARTICIPANTS_UPDATE:
        case Events.GROUPS_UPDATE: {
          await this.updateGroupMetadata(c.chat, c);
          break;
        }

        case Events.CONTACTS_UPDATE:
        case Events.CONTACTS_UPSERT: {
          const contact = c.event;
          if (contact?.id) {
            const name = contact.name ?? contact.notify ?? contact.verifiedName;
            if (name) {
              this.updateContact(contact.id, {
                id: contact.id,
                name: name,
              });
            }
          }
          break;
        }

        case Events.MESSAGES_UPSERT: {
          if (
            c?.fromMe &&
            !c?.edited &&
            c?.eventType !== "append" &&
            c?.type !== "senderKeyDistributionMessage"
          ) {
            this.updateTimer(c.chat, c.expiration, c.eventName);
          }

          if (c.sender && c.pushName) {
            if (c.user && c.user.name !== c.pushName) {
              this.updateContact(c.sender, {
                id: c.sender,
                name: c.pushName,
              });
              c.user = this.updateUser(c.sender, { name: c.pushName });
            }
          }
          break;
        }

        case Events.BLOCKLIST_SET:
        case Events.BLOCKLIST_UPDATE: {
          /** @type {{blocklist: string[], type: 'add' | 'remove'}} */
          const ev = c.event;
          switch (ev?.type) {
            case "add": {
              ev?.blocklist?.forEach((jid) => {
                this.blockList.add(jidNormalizedUser(jid));
              });
              break;
            }
            case "remove": {
              ev.blocklist?.forEach((jid) => {
                this.blockList.delete(jidNormalizedUser(jid));
              });
              break;
            }
            default: {
              if (c.eventName === Events.BLOCKLIST_SET)
                this.blockList = new Set(ev.blocklist || []);
            }
          }
          break;
        }

        case Events.CONNECTION_UPDATE: {
          if (c?.event?.isOnline) {
            await delay(3000);
            try {
              this.runTask("update-data-fetch-blocklist", async () => {
                this.blockList = new Set(
                  (await this.sock.fetchBlocklist()) || [],
                );
              });
            } catch (e) {
              this.log.error("update-data-fetch-blocklist", e);
            }
          }
          break;
        }
      }
    } catch (e) {
      this.log.error("update-data", e);
    }
  }

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
          this.blockList.delete(jidNormalizedUser(jid));
          break;
        }
      }
      return true;
    } catch (e) {
      this.log.error("update-block", e);
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
   * @param {import('./context.js').Ctx} c
   * @returns {Promise<import('baileys').GroupMetadata>}
   */
  async updateGroupMetadata(jid, c) {
    try {
      this.log.debug(
        "Updating group metadata",
        jid,
        c ? `via ${c.eventName} with action : ${c.action}` : "",
      );
      let data = this.groupCache.get(jid);
      let updated = false;

      if (data) {
        switch (c?.eventName) {
          case Events.GROUP_PARTICIPANTS_UPDATE: {
            switch (c?.action) {
              case "add": {
                for (const add of c.mentionedJid || []) {
                  const part = { id: add, admin: null };
                  data.participants.push(part);
                  updated = c.mentionedJid?.some((jid) => jid.endsWith("@lid"));
                }
                break;
              }
              case "remove": {
                for (const rm of c.mentionedJid || []) {
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
                    c.mentionedJid?.includes(part.id) ||
                    c.mentionedJid?.includes(part.lid)
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
                    c.mentionedJid?.includes(part.id) ||
                    c.mentionedJid?.includes(part.lid)
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
            for (const key in c?.event) {
              if (skip.includes(key)) continue;
              data[key] = c.event[key];
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
        this.updateTimer(data.id, data.ephemeralDuration, c?.eventName);
        return data;
      }
    } catch (e) {
      this.log.error("update-group-metadata", jid, e);
    }
  }

  /**
   * Get group metadata by given jid (synchronously from cache)
   * @param {string} jid
   * @returns {import('baileys').GroupMetadata|undefined}
   */
  getGroupMetadata(jid) {
    const data = this.groupCache.get(jid);
    if (!data) {
      this.runTask(`get-group-metadata_${jid}`, async () => {
        try {
          await this.updateGroupMetadata(jid);
        } catch (e) {
          this.log.error("get-group-metadata", jid, e);
        }
      });
    }
    return data;
  }

  /**
   * Get group metadata by given jid asynchronously (awaits fetch if not cached)
   * @param {string} jid
   * @returns {Promise<import('baileys').GroupMetadata|undefined>}
   */
  async getGroupMetadataAsync(jid) {
    let data = this.groupCache.get(jid);
    if (!data) {
      await this.runTask(`get-group-metadata_${jid}`, async () => {
        try {
          await this.updateGroupMetadata(jid);
        } catch (e) {
          this.log.error("get-group-metadata", jid, e);
        }
      });
      data = this.groupCache.get(jid);
    }
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
      this.log.error("update-contact", e);
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
    this.log.debug(
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
    if (!jid || jid === "") return;

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

    return;
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

      const result = await this.sock.sendMessage(jid, content, options);
      this._messageSent();
      return result;
    } catch (e) {
      this.log.error("send-message", e);
      this.emit(ClientEvents.ERROR, {
        name: this.name,
        code: "send-message",
        message: e.message,
      });
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

      /** @type {import('baileys').proto.IMessage} */
      let finalContent = { ...content };
      if (finalContent.conversation && ephemeral > 0) {
        finalContent = {
          extendedTextMessage: {
            text: finalContent.conversation,
            contextInfo: { expiration: ephemeral },
          },
        };
      } else {
        for (const key in finalContent) {
          if (!finalContent[key]) continue;
          if (typeof finalContent[key] === "object") {
            finalContent[key] = {
              ...finalContent[key],
              contextInfo: {
                ...finalContent[key].contextInfo,
                expiration: ephemeral,
              },
            };
          }
        }
      }
      return await this.sock.relayMessage(jid, finalContent, options);
    } catch (e) {
      this.log.error("relay-message", e);
      this.emit(ClientEvents.ERROR, {
        name: this.name,
        code: "relay-message",
        message: e.message,
      });
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
    if (!opts.filename) opts.filename = path.basename(filePath);

    return await this.sendMessage(jid, {
      document: {
        url: filePath,
      },
      fileName: opts.filename,
      caption: opts.caption,
    });
  }
}

/**
 * @param {ClientOpts} opts
 * @returns {Client}
 */
export async function createClient(opts) {
  const client = new Client(opts);
  await client.init();
  return client;
}
