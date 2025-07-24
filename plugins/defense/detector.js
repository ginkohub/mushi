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
  'reactionMessage',
];

/** @enum {string} */
export const Actions = {
  LOG: 'log',
  BLOCK: 'block',
  SEND_SAMPLE: 'send_sample',
  DELETE_FOR_ALL: 'delete_for_all',
  DELETE_FOR_ME: 'delete_for_me',
  KICK_FROM_GROUP: 'kick_from_group'
}

let DO_ALL = true;

/** @typedef {(c: import('../../src/context.js').Ctx, r: Result) => any} Action */
/** @type {Record<Actions, Action>} */
export const ActionMap = {
  'log': async (c, r) => {

    const doActionLog = DO_ALL ?? settings.get(Actions.LOG);
    if (typeof doActionLog === 'undefined' || doActionLog) pen.Warn(`Log : ${c.senderName} (${c.sender}) in ${c.chatName}, Reason : ${r.reason} `);

    const doAction = DO_ALL ?? settings.get(Actions.SEND_SAMPLE);
    if (doAction) {
      return await c.sendMessage(c.me, {
        document: Buffer.from(JSON.stringify(r, null, 2)),
        fileName: `${c.chat}_${c.sender}_${c.timestamp}.json`,
        mimetype: 'application/json',
        caption: `*From* : ${c.senderName} (${c.sender})\n*Chat* : ${c.chatName} (${c.chat})\n*Detected* : ${r.reason}`
      });
    }
  },

  'block': async (c, r) => {
    const doAction = DO_ALL ?? settings.get(Actions.BLOCK);
    if (doAction) {
      pen.Warn(`Try to block : ${c.senderName} (${c.sender})`);
      if (!c.handler().isBlocked(c.sender)) {
        pen.Warn(`Block : ${c.senderName} (${c.sender}) in ${c.chatName}, Reason : ${r.reason} `);
        return await c.handler().updateBlock(c.sender, 'block');
      }
    }
  },

  'delete_for_all': async (c, r) => {
    const doAction = DO_ALL ?? settings.get(Actions.DELETE_FOR_ALL);
    if (doAction) {
      try {
        pen.Warn(`Try to delete for all : ${c.id} from ${c.senderName} in ${c.chatName}, Reason : ${r.reason} `);
        const possible = false;
        if (c.isGroup) {
          const meta = c.handler()?.getGroupMetadata(c.chat);
          /* check if bot are admin */
          meta?.participants?.map((p) => {
            if ((p.lid == c.meLID || p.id == c.me) && (p.isAdmin || p.isSuperAdmin)) possible = true;
          });
        }
        if (possible) return await c.reply({ delete: c.key });
        pen.Warn(`Not possible to delete : ${possible} ${c.id} `);
      } catch (e) {
        pen.Error(e);
      }
    }
  },

  'delete_for_me': async (c, r) => {
    const doAction = DO_ALL ?? settings.get(Actions.DELETE_FOR_ME);
    if (doAction) {
      pen.Warn(`Delete for me : ${c.id} from ${c.senderName} in ${c.chatName}, Reason : ${r.reason} `);
      return await c?.chatModify({
        deleteForMe: {
          deleteMedia: true,
          timestamp: Date.now(),
          key: c.key
        },
      }, c.chat);
    }
  },

  'kick_from_group': async (c, r) => {
    const doAction = DO_ALL ?? settings.get(Actions.KICK_FROM_GROUP);
    if (doAction) {
      pen.Warn(`Try to kick : ${c.senderName} (${c.sender}) from ${c.chatName}, Reason : ${r.reason} `);
      try {
        const possible = false;
        if (c.isGroup) {
          const meta = c.handler()?.getGroupMetadata(c.chat);
          /* check if bot are admin */
          meta?.participants?.map((p) => {
            if ((p.lid == c.meLID || p.id == c.me) && (p.isAdmin || p.isSuperAdmin)) possible = true;
          });
        }
        if (possible) return await c.sock().groupParticipantsUpdate(c.chat, [c.sender], 'remove');
        pen.Warn(`Not possible to kick : ${possible} ${c.senderName} (${c.sender}) `);
      } catch (e) {
        pen.Error(e);
      }
    }
  }
};

/**
 * @typedef {Object} Result
 * @property {boolean} suspect
 * @property {string} reason
 * @property {any} data
 * @property {Action[] } actions
 */

class Result {
  /** @param {Result} */
  constructor({ suspect, reason, data, actions }) {
    this.suspect = suspect;
    this.reason = reason;
    this.data = data;

    this.actions = actions;
  }

  /** 
   * @param {import('../../src/context.js').Ctx} c 
   * @param {...Actions[]} acts
   */
  async process(c, ...acts) {
    if (!this.suspect) return;

    for (const act of acts) {
      const action = ActionMap[act];
      await action(c, this);
    }

    if (Array.isArray(this.actions)) {
      for (const act of this.actions) {
        const action = ActionMap[act];
        if (typeof action === 'function') {
          await action(c, this);
        }
      }
    } else if (typeof this.actions === 'string') {
      const action = ActionMap[this.actions];
      if (typeof action === 'function') await action(c, this);
    }
  }
}

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    desc: 'Defense system',
    midware: midwareAnd(
      eventNameIs(Events.MESSAGES_UPSERT),
      (c) => ({ success: settings.get(`defense`) && !c.fromMe }),
    ),

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
      pen.Warn('Defense :', c.eventName, detect.suspect, detect.reason);
      try {
        await detect.process(c);
      } catch (e) {
        pen.Error(e);
      }
    }
  },];

/** @typedef {(c: import('../../src/context.js').Ctx) => Result } Detector */
/** @type {Detector[]} */
const listDetectors = [
  (c) => {
    if (!c.isStatus || !c.type) return {
      suspect: false,
      reason: 'Not a status message',
    }

    let allow = settings.get('defense_allow_status');
    if (!allow) allow = [];
    allow.push(...allowed);
    allow = allow.filter((v, i, a) => a.indexOf(v) === i);

    return {
      suspect: c.isStatus && !allow?.includes(c.type) && c.type,
      reason: 'Status message with not allowed type',
      data: c,
      actions: [
        Actions.LOG,
        Actions.BLOCK
      ],
    };
  },

  (c) => {
    return {
      suspect: c.mentionedJid?.length > 1024,
      reason: 'Too many mentioned jids',
      data: c,
      actions: [
        Actions.LOG,
        Actions.BLOCK,
        Actions.DELETE_FOR_ALL,
        Actions.DELETE_FOR_ME,
        Actions.KICK_FROM_GROUP,
      ]
    }
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
      actions: [
        Actions.LOG,
        Actions.BLOCK,
        Actions.DELETE_FOR_ALL,
        Actions.DELETE_FOR_ME,
        Actions.KICK_FROM_GROUP,
      ],
    }
  },
];


