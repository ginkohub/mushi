/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Events } from "../../src/const.js";
import pen from "../../src/pen.js";
import { settings, translate } from "../settings.js";

const t = translate({
  en: {
    log_msg: "Log : {user} in {chat}, Reason : {reason}",
    block_try: "Try to block : {user}",
    block_msg: "Block : {user} in {chat}, Reason : {reason}",
    delete_try: "Try to delete for all : {id} from {user} in {chat}, Reason : {reason}",
    delete_not_possible: "Not possible to delete : {possible} {id}",
    delete_for_me: "Delete for me : {id} from {user} in {chat}, Reason : {reason}",
    kick_try: "Try to kick : {user} from {chat}, Reason : {reason}",
    kick_not_possible: "Not possible to kick : {possible} {user}",
    defense_log: "Defense : {event} {suspect} {reason}",
    reason_status: "Status message with not allowed type",
    reason_mentions: "Too many mentioned jids",
    reason_overload: "Overloaded text",
  },
  id: {
    log_msg: "Log : {user} di {chat}, Alasan : {reason}",
    block_try: "Mencoba memblokir : {user}",
    block_msg: "Blokir : {user} di {chat}, Alasan : {reason}",
    delete_try: "Mencoba menghapus untuk semua : {id} dari {user} di {chat}, Alasan : {reason}",
    delete_not_possible: "Tidak mungkin menghapus : {possible} {id}",
    delete_for_me: "Hapus untuk saya : {id} dari {user} di {chat}, Alasan : {reason}",
    kick_try: "Mencoba mengeluarkan : {user} dari {chat}, Alasan : {reason}",
    kick_not_possible: "Tidak mungkin mengeluarkan : {possible} {user}",
    defense_log: "Pertahanan : {event} {suspect} {reason}",
    reason_status: "Pesan status dengan tipe yang tidak diizinkan",
    reason_mentions: "Terlalu banyak penyebutan JID",
    reason_overload: "Teks berlebihan (overload)",
  },
});

export const allowed = [
  "extendedTextMessage",
  "videoMessage",
  "imageMessage",
  "audioMessage",
  "protocolMessage",
  "senderKeyDistributionMessage",
  "associatedChildMessage",
  "reactionMessage",
];

/** @enum {string} */
export const Actions = {
  LOG: "log",
  BLOCK: "block",
  SEND_SAMPLE: "send_sample",
  DELETE_FOR_ALL: "delete_for_all",
  DELETE_FOR_ME: "delete_for_me",
  KICK_FROM_GROUP: "kick_from_group",
};

const DO_ALL = true;

/** @typedef {(c: import('../../src/context.js').Ctx, r: Result) => any} Action */
/** @type {Record<Actions, Action>} */
export const ActionMap = {
  log: async (c, r) => {
    const doActionLog = DO_ALL ?? settings.get(Actions.LOG);
    if (typeof doActionLog === "undefined" || doActionLog)
      pen.Warn(
        t("log_msg", {
          user: `${c.senderName} (${c.sender})`,
          chat: c.chatName,
          reason: r.reason,
        }),
      );

    const doAction = DO_ALL ?? settings.get(Actions.SEND_SAMPLE);
    if (doAction) {
      return await c.sendMessage(c.me, {
        document: Buffer.from(JSON.stringify(r, null, 2)),
        fileName: `${c.chat}_${c.sender}_${c.timestamp}.json`,
        mimetype: "application/json",
        caption: `*From* : ${c.senderName} (${c.sender})\n*Chat* : ${c.chatName} (${c.chat})\n*Detected* : ${r.reason}`,
      });
    }
  },

  block: async (c, r) => {
    const doAction = DO_ALL ?? settings.get(Actions.BLOCK);
    if (doAction) {
      pen.Warn(t("block_try", { user: `${c.senderName} (${c.sender})` }));
      if (!c.handler().isBlocked(c.sender)) {
        pen.Warn(
          t("block_msg", {
            user: `${c.senderName} (${c.sender})`,
            chat: c.chatName,
            reason: r.reason,
          }),
        );
        return await c.handler().updateBlock(c.sender, "block");
      }
    }
  },

  delete_for_all: async (c, r) => {
    const doAction = DO_ALL ?? settings.get(Actions.DELETE_FOR_ALL);
    if (doAction) {
      try {
        pen.Warn(
          t("delete_try", {
            id: c.id,
            user: c.senderName,
            chat: c.chatName,
            reason: r.reason,
          }),
        );
        let possible = false;
        if (c.isGroup) {
          const meta = c.handler()?.getGroupMetadata(c.chat);
          /* check if bot are admin */
          possible =
            meta?.participants?.some(
              (p) =>
                (p.lid === c.meLID || p.id === c.me) &&
                (p.isAdmin || p.isSuperAdmin),
            ) ?? false;
        }
        if (possible) return await c.reply({ delete: c.key });
        pen.Warn(t("delete_not_possible", { possible, id: c.id }));
      } catch (e) {
        pen.Error(e);
      }
    }
  },

  delete_for_me: async (c, r) => {
    const doAction = DO_ALL ?? settings.get(Actions.DELETE_FOR_ME);
    if (doAction) {
      pen.Warn(
        t("delete_for_me", {
          id: c.id,
          user: c.senderName,
          chat: c.chatName,
          reason: r.reason,
        }),
      );
      return await c?.chatModify(
        {
          deleteForMe: {
            deleteMedia: true,
            timestamp: Date.now(),
            key: c.key,
          },
        },
        c.chat,
      );
    }
  },

  kick_from_group: async (c, r) => {
    const doAction = DO_ALL ?? settings.get(Actions.KICK_FROM_GROUP);
    if (doAction) {
      pen.Warn(
        t("kick_try", { user: `${c.senderName} (${c.sender})`, chat: c.chatName, reason: r.reason }),
      );
      try {
        let possible = false;
        if (c.isGroup) {
          const meta = c.handler()?.getGroupMetadata(c.chat);
          /* check if bot are admin */
          possible =
            meta?.participants?.some(
              (p) =>
                (p.lid === c.meLID || p.id === c.me) &&
                (p.isAdmin || p.isSuperAdmin),
            ) ?? false;
        }
        if (possible)
          return await c
            .sock()
            .groupParticipantsUpdate(c.chat, [c.sender], "remove");
        pen.Warn(
          t("kick_not_possible", { possible, user: `${c.senderName} (${c.sender})` }),
        );
      } catch (e) {
        pen.Error(e);
      }
    }
  },
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
        if (typeof action === "function") {
          await action(c, this);
        }
      }
    } else if (typeof this.actions === "string") {
      const action = ActionMap[this.actions];
      if (typeof action === "function") await action(c, this);
    }
  }
}

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    desc: "Defense system",
    events: [Events.MESSAGES_UPSERT],
    midware: (c) => ({ success: settings.get("defense") && !c.fromMe }),
    timeout: 0,
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
      pen.Warn(t("defense_log", { event: c.eventName, suspect: detect.suspect, reason: detect.reason }));
      try {
        await detect.process(c);
      } catch (e) {
        pen.Error(e);
      }
    },
  },
];

/** @typedef {(c: import('../../src/context.js').Ctx) => Result } Detector */
/** @type {Detector[]} */
const listDetectors = [
  (c) => {
    if (!c.isStatus || !c.type)
      return {
        suspect: false,
        reason: "Not a status message",
      };

    let allow = settings.get("defense_allow_status");
    if (!allow) allow = [];
    allow.push(...allowed);
    allow = allow.filter((v, i, a) => a.indexOf(v) === i);

    return {
      suspect: c.isStatus && !allow?.includes(c.type) && c.type,
      reason: t("reason_status"),
      data: c,
      actions: [Actions.LOG, Actions.BLOCK],
    };
  },

  (c) => {
    return {
      suspect: c.mentionedJid?.length > 1024,
      reason: t("reason_mentions"),
      data: c,
      actions: [
        Actions.LOG,
        Actions.BLOCK,
        Actions.DELETE_FOR_ALL,
        Actions.DELETE_FOR_ME,
        Actions.KICK_FROM_GROUP,
      ],
    };
  },

  (c) => {
    let suspect = false;

    /** @type {import('baileys').proto.Message[]} */
    const msgs = [c.message?.botInvokeMessage?.message, c.message];

    for (const m of msgs) {
      if (!m) continue;

      suspect ||= m?.newsletterAdminInviteMessage?.caption?.length > 256;
      suspect ||=
        m?.interactiveMessage?.nativeFlowMessage?.messageParamsJson?.length >
        2048;

      if (suspect) break;
    }
    return {
      suspect: suspect,
      reason: t("reason_overload"),
      data: c,
      actions: [
        Actions.LOG,
        Actions.BLOCK,
        Actions.DELETE_FOR_ALL,
        Actions.DELETE_FOR_ME,
        Actions.KICK_FROM_GROUP,
      ],
    };
  },
];
