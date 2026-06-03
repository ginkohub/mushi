/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { jidNormalizedUser } from "baileys";
import { StoreJson } from "./store.js";

/**
 * @property {Object} Chat
 * @property {string} [jid]
 * @property {string} [lang]
 * @property {string} [tz]
 * @property {boolean} [welcome]
 * @property {boolean} [allowCommand]

 * @property {Record<string, any>} [settings]
 * @property {number} addedAt
 */

/**
 * @typedef {Object} ChatManagerOpts
 * @property {string} [saveName]
 * @property {import('./store.js').StoreSQLite} store
 */

export class ChatManager {
  /**
   * @param {ChatManagerOpts} opts
   */
  constructor(opts) {
    this.storage =
      opts.store ||
      new StoreJson({
        saveName: opts.saveName,
        autoSave: true,
        autoLoad: true,
      });
  }

  /**
   * Clear all chat data
   * @returns {void}
   */
  clear() {
    this.storage?.clear();
  }

  /**
   * Get chat data
   * @param {string} jid
   * @returns {Chat|undefined}
   */
  getChat(jid) {
    jid = jidNormalizedUser(jid);
    if (!jid || jid === "") return;
    /** @type {Chat} */
    let chat = this.storage.get(jid);

    if (!chat) {
      chat = {
        jid: jid,
        lang: undefined,
        tz: undefined,
        welcome: false,
        allowCommand: false,
        settings: {},
        addedAt: Date.now(),
      };
      this.storage.set(jid, chat);
    }
    return chat;
  }

  /**
   * @param {string} jid
   * @param {Chat} data
   * @returns {Chat}
   */
  updateChat(jid, data) {
    const id = jidNormalizedUser(jid);
    const chat = this.getChat(id);
    const updated = { ...chat, ...data };
    this.storage.set(id, updated);
    return updated;
  }
}
