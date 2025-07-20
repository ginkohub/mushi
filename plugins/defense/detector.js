/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Events } from '../../src/const.js';
import { eventNameIs, midwareAnd } from '../../src/midware.js';
import pen from '../../src/pen.js';
import { settings } from '../settings.js';

export const allowed = [
  'extendedTextMessage',
  'videoMessage',
  'imageMessage',
  'audioMessage',
  'protocolMessage',
  'senderKeyDistributionMessage',
  'associatedChildMessage',
];

/**
 * @typedef {Object} Result
 * @property {boolean} suspect
 * @property {string} reason
 * @property {any} data
 * @actions {import('./action.js').Action[] | import('./action.js').Action} actions
 */

export let blockedUsers = [];

let BLOCKLIST_UPDATED = false;
/** @type {import('../../src/plugin.js').Plugin} */

/** @typedef {(c: import('../../src/context.js').Ctx) => any} Action */
/** @type {Record<any, Action>} */
const Actions = {
  LOG: async (c) => {
    return await c.sendMessage(c.me, {
      document: Buffer.from(JSON.stringify(detect, null, 2)),
      fileName: `${c.chat}_${c.sender}_${c.timestamp}.json`,
      mimetype: 'application/json',
    });
  },

  BLOCK: async (c) => {
    if (!blockedUsers.includes(c.sender)) {
      c.handler().client.sock.updateBlockStatus(c.sender, 'block');
      blockedUsers.push(c.sender);
    }
  },

  DELETE_FOR_ALL: async (c) => {
    return c.reply({ delete: c.key });
  },

  DELETE_FOR_ME: async (c) => {
    return c.sock()?.chatModify({ deleteForMe: { key: c.key } })
  },
};

class Result {
  /** @param {Result} */
  constructor({ suspect, reason, data, actions }) {
    this.suspect = suspect;
    this.reason = reason;
    this.data = data;

    /** @type {Action[] | Action} */
    this.actions = actions;
  }

  /** 
   * @param {import('../../src/context.js').Ctx} c 
   * @param {...Action[]} acts
   */
  async process(c, ...acts) {
    if (!this.suspect) return;

    for (const act of acts) {
      if (typeof act === 'function') {
        await act(c);
      }
    }

    if (Array.isArray(this.actions)) {
      for (const act of this.actions) {
        if (typeof act === 'function') {
          await act(c);
        }
      }
    } else if (typeof this.actions === 'function') {
      await this.actions(c);
    }
  }
}

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    desc: 'Defense system',
    midware: midwareAnd(
      eventNameIs(Events.MESSAGES_UPSERT),
      (c) => ({ success: settings.get(`defense_${c.me}`) }),
    ),

    /** @param {import('../../src/context.js').Ctx} c */
    exec: async (c) => {
      let detect = new Result({ suspect: false });
      for (const detector of listDetectors) {
        detect = new Result(detector(c));
        if (detect?.suspect) {
          break;
        }
      }

      if (!detect.suspect) {
        return;
      }
      pen.Warn('Defense :', c.eventName, detect.suspect, detect.reason, detect.data);
      try {
        await detect.process(c);
      } catch (e) {
        pen.Error(e);
      }
    }
  },
  {
    midware: eventNameIs(Events.CONNECTION_UPDATE, Events.MESSAGES_UPSERT),
    exec: async (c) => {
      if (BLOCKLIST_UPDATED) return
      try {
        pen.Warn('Updating blacklist.');
        blockedUsers = await c.sock()?.fetchBlocklist();
        BLOCKLIST_UPDATED = true
      } catch (e) {
        pen.Error(e.message);
      }
    }
  }
];

/** @typedef {(c: import('../../src/context.js').Ctx) => Result } Detector */
/** @type {Detector[]} */
const listDetectors = [
  (c) => {
    if (!c.isStatus || !c.type) return {
      suspect: false,
      reason: 'Not a status message',
      actions: [Actions.LOG]
    }

    let allow = settings.get('defense_allow_status');
    if (!allow) allow = [];
    allow.push(...allowed);
    allow = allow.filter((v, i, a) => a.indexOf(v) === i);

    return {
      suspect: c.isStatus && !allow?.includes(c.type) && c.type,
      reason: 'Status message with not allowed type',
      data: c,
      actions: [Actions.LOG, Actions.DELETE_FOR_ALL, Actions.DELETE_FOR_ME]
    };
  },
  (c) => {
    return {
      suspect: c.mentionedJid?.length > 1024,
      reason: 'Too many mentioned jids',
      data: c.contextInfo,
    };
  },

  (c) => {
    let suspect = false;

    /** @type {import('baileys').proto.Message[]} */
    const msgs = [
      c.message?.botInvokeMessage?.message,
      c.message,
    ];

    for (const m of msgs) {
      if (!m) continue;

      suspect ||= (m?.newsletterAdminInviteMessage?.caption?.length > 256);
      suspect ||= (m?.interactiveMessage?.nativeFlowMessage?.messageParamsJson?.length > 2048);

      if (suspect) break;
    }
    return {
      suspect: suspect,
      reason: 'Overloaded text',
      data: c,
      actions: [Actions.LOG, Actions.DELETE_FOR_ALL, Actions.DELETE_FOR_ME],
    }
  },
];


