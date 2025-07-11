/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Browsers, makeWASocket, useMultiFileAuthState } from "baileys";
import readline from "node:readline";
import pino from "pino";
import QRCode from "qrcode";
import { Pen } from "./pen.js";
import { DisconnectReason } from "baileys";
import { CONNECTION_UPDATE, CREDS_UPDATE } from "./const.js";
import { useSQLite } from "./auth_sqlite.js";
import { unlinkSync } from "node:fs";


/* Initialize readline */
const question = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

/* Ask for input text */
function ask(prompt) {
  return new Promise((resolve) => question.question(prompt, resolve))
}

/** @type {import('node:timers').Timer} */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


/**
 *
 * @param {string} sessionStr 
 * @returns {{ state:import('baileys').AuthenticationState, saveCreds: Promise<void>, type: 'folder' | 'sqlite' | 'mongodb' } }
 */
export async function useStore(sessionStr) {
  if (!sessionStr) return null;

  if (sessionStr.includes('mongodb')) {
    const { state, saveCreds } = await userMongoDB(sessionStr);
    return { state, saveCreds, type: 'mongodb' };
  } else if (sessionStr.includes('.sqlite') || sessionStr.includes('.db')) {
    const { state, saveCreds } = await useSQLite(sessionStr);
    return { state, saveCreds, type: 'sqlite' };
  } else {
    const { state, saveCreds } = await useMultiFileAuthState(sessionStr);
    return { state, saveCreds, type: 'folder' };
  }
}

export class Wangsaf {
  constructor({
    session,
    dataDir,
    phone,
    method,
    browser,
    handler,
    socketOptions,
    retry,
    pen
  }) {
    this.sock = null;
    this.session = session;
    this.dataDir = dataDir;
    this.phone = phone;
    this.method = method;
    this.browser = browser;

    /** @type {import('./handler.js').Handler} */
    this.handler = handler;
    this.socketOptions = socketOptions;
    this.retry = retry;
    this.pen = pen ?? new Pen({ prefix: 'sys' });
    this.dateCreated = new Date();
    this.dateStarted = null;
  }

  /**
   * @param {Config} config 
   */
  async connect() {
    if (!this.session) throw new Error('session is required');
    this.dateStarted = new Date();

    /** @type {{ state:import('baileys').AuthenticationState, saveCreds: Promise<void>, type: 'folder' | 'sqlite' | 'mongodb' } } */
    const { state, saveCreds, type } = await useStore(this.session)

    /** @type {import('baileys').UserFacingSocketConfig} */
    const socketOptions = {
      syncFullHistory: false,
      auth: state,
      browser: this.browser ? this.browser : Browsers.macOS('Safari'),
      logger: pino({ level: 'error' }),
    }

    if (this.socketOptions) {
      Object.assign(socketOptions, this.socketOptions)
    }

    /** @type {import('baileys').WASocket} */
    this.sock = makeWASocket(socketOptions)
    if (this.handler) {
      if (this.handler.attach) {
        this.handler.attach(this);
      }
    }

    this.pen.Debug('Method :', this.method, ', Registered :', state?.creds?.registered, ', Platform :', state?.creds?.platform);
    if (this.method == 'otp' && (!state?.creds?.registered && !state?.creds?.platform)) {

      this.pen.Debug('Delay for 3000ms before requesting pairing code')
      /* Delay needed for pairing code */
      await delay(3000);

      let phone = this.phone;
      if (!phone) {
        while (!phone) {
          phone = await ask(`Enter phone ${phone ?? ''}: `);
          phone = phone?.replace(/[^+0-9]/g, '');
          phone = phone?.trim()

          if (!phone || phone == '') this.pen.Error('Invalid phone number')
        }
      }

      this.pen.Info(`Using this phone : ${phone}`);


      let code = await this.sock.requestPairingCode(phone);
      if (code) this.pen.Log('Enter this OTP :', code)
    }

    this.sock.ev.on(CONNECTION_UPDATE, async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr && this.method == 'qr') {
        this.pen.Log('Scan this QR :\n', await QRCode.toString(qr, { type: 'terminal', small: true }))
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          if (this.retry) {
            this.pen.Debug(CONNECTION_UPDATE, 'Reconnecting...');
            this.connect()
          } else {
            this.pen.Debug(CONNECTION_UPDATE, 'Not retrying');
          }
        } else if (statusCode === DisconnectReason.loggedOut) {
          this.pen.Debug(CONNECTION_UPDATE, 'Logged out, closing connection');
          try {
            switch (type) {
              case "folder": {
                /* Destroy session directory */
                unlinkSync(this.session);
                break;
              }
              case "sqlite": {
                unlinkSync(this.session);
                break;
              }
              case "mongodb": {
                /* Not implemented yet */
              }
            }

          } catch (e) {
            this.pen.Error(e);
          }
        }
      } else if (connection === 'open') {
        this.pen.Debug(CONNECTION_UPDATE, 'Client connected');
      }
    });

    this.sock.ev.on(CREDS_UPDATE, saveCreds);
  }
}
