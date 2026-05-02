/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { rmSync } from "node:fs";
import readline from "node:readline";
import {
  Browsers,
  DisconnectReason,
  makeWASocket,
  useMultiFileAuthState,
} from "baileys";
import pino from "pino";
import QRCode from "qrcode";
import { useMongoDB } from "./auth_mongo.js";
import { usePostgres } from "./auth_postgres.js";
import { useSQLite } from "./auth_sqlite.js";
import { Events } from "./const.js";
import { Pen } from "./pen.js";
import { delay } from "./tools.js";

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
 *
 * @param {string} sessionStr
 * @returns {Promise<{ state:import('baileys').AuthenticationState, saveCreds: () => Promise<void>, clearState: () => Promise<void>, type: string }|any> }
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
 * @typedef {Object} Config
 * @property {string} session
 * @property {string} dataDir
 * @property {string} phone
 * @property {'qr' | 'otp'} method
 * @property {import('baileys').WABrowserDescription} browser
 * @property {import('./handler.js').Handler} handler
 * @property {import('baileys').UserFacingSocketConfig} socketOptions
 * @property {boolean} retry
 * @property {import('./pen.js').Pen} pen
 */

/**
 * WhatsApp client class
 */
export class Wangsaf {
  /**
   * @param {Config} config
   */
  constructor({
    session,
    dataDir,
    phone,
    method,
    browser,
    handler,
    socketOptions,
    retry,
    pen,
  }) {
    /** @type {import('baileys').WASocket|any} */
    this.sock = null;

    /** @type {string} */
    this.session = session;

    /** @type {string} */
    this.dataDir = dataDir;

    /** @type {string} */
    this.phone = phone;

    /** @type {'qr' | 'otp'} */
    this.method = method;

    /** @type {import('baileys').WABrowserDescription} */
    this.browser = browser;

    /** @type {import('./handler.js').Handler} */
    this.handler = handler;

    /** @type {import('baileys').UserFacingSocketConfig} */
    this.socketOptions = socketOptions;

    /** @type {boolean} */
    this.retry = retry;

    /** @type {import('./pen.js').Pen} */
    this.pen = pen ?? new Pen({ prefix: "sys" });

    /** @type {number} */
    this.dateCreated = Date.now();

    /** @type {number} */
    this.dateStarted = 0;
  }

  async connect() {
    await this.handler?.waitReady();

    if (!this.session) throw new Error("session is required");
    this.dateStarted = Date.now();

    /** @type {{ state:import('baileys').AuthenticationState, saveCreds: () => Promise<void>, clearState: () => Promise<void>, type: 'folder' | 'sqlite' | 'mongodb' | 'postgres'} } */
    const { state, saveCreds, clearState, type } = await useStore(this.session);

    /** @type {import('baileys').UserFacingSocketConfig} */
    const socketOptions = {
      syncFullHistory: false,
      auth: state,
      browser: this.browser ? this.browser : Browsers.macOS("Safari"),
      logger: pino({ level: "error" }),
      version: [2, 3000, 1038162681],
    };

    if (this.socketOptions) {
      Object.assign(socketOptions, this.socketOptions);
    }

    /** @type {import('baileys').WASocket|any} */
    this.sock = makeWASocket(socketOptions);
    if (this.handler) {
      if (this.handler.attach) {
        await this.handler.attach(this);
      }
    }

    this.pen.Debug(
      "Method :",
      this.method,
      ", Registered :",
      state?.creds?.registered,
      ", Platform :",
      state?.creds?.platform,
    );
    if (
      this.method === "otp" &&
      !state?.creds?.registered &&
      !state?.creds?.platform
    ) {
      this.pen.Debug("Delay for 3000ms before requesting pairing code");
      /* Delay needed for pairing code */
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
      if (code) this.pen.Log("Enter this OTP :", code);
    }

    this.sock.ev.on(Events.CONNECTION_UPDATE, async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr && this.method === "qr") {
        this.pen.Log(
          "Scan this QR :\n",
          await QRCode.toString(qr, { type: "terminal", small: true }),
        );
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
            if (clearState) {
              await clearState();
            } else if (type === "folder") {
              rmSync(this.session, { recursive: true });
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
        this.pen.Debug(Events.CONNECTION_UPDATE, "Client connected");
      }
    });

    this.sock.ev.on(Events.CREDS_UPDATE, saveCreds);
  }
}
