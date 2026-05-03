/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import {
  downloadMediaMessage,
  jidNormalizedUser,
  S_WHATSAPP_NET,
} from "baileys";
import minimist from "minimist";
import parseArgsStringToArgv from "string-argv";
import { Events } from "./const.js";

const PHONE_REGEX = /(?:\+?([\d\s-]{5,16}))/g;

const JIDBy = {
  Participant: 0,
  Mentions: 1,
  Text: 2,
};

const skipMessageTypes = ["messageContextInfo"];

const TextExtractors = {
  conversation: (m) => m,
  extendedTextMessage: (m) => m.text,
  imageMessage: (m) => m.caption,
  videoMessage: (m) => m.caption,
  documentMessage: (m) => m.caption,
  buttonsResponseMessage: (m) => m.selectedButtonId,
  listResponseMessage: (m) => m.singleSelectReply?.selectedRowId,
  templateButtonReplyMessage: (m) => m.selectedId,
  interactiveResponseMessage: (m) => {
    const body = JSON.parse(m.nativeFlowResponseMessage?.paramsJson || "{}");
    return body.id || m.nativeFlowResponseMessage?.selectedDisplayText;
  },
};

/**
 * Extracts text content and context info from a message
 * @param {Partial<import('baileys').WAMessage>} m - Message object
 * @returns {{text: string, contextInfo: import('baileys').WAContextInfo | undefined, type: string, edited: boolean}}
 */
export function extractTextContext(m) {
  let resp = { text: "", contextInfo: undefined, type: "", edited: false };

  if (typeof m !== "object" || m === null) return resp;

  if (m.protocolMessage?.editedMessage) {
    resp = extractTextContext(m.protocolMessage.editedMessage);
    resp.edited = true;
    return resp;
  }

  const type = Object.keys(m).find((key) => !skipMessageTypes.includes(key));
  if (!type) return resp;

  resp.type = type;
  const content = m[type];

  if (typeof content === "string") {
    resp.text = content;
  } else if (TextExtractors[type]) {
    resp.text = TextExtractors[type](content) || "";
  } else if (content?.text || content?.caption) {
    resp.text = content.text || content.caption || "";
  }

  resp.contextInfo = content.contextInfo || m.contextInfo;
  return resp;
}

/**
 * @class Ctx
 * @description Context parsed from a message
 */
export class Ctx {
  /**
   * @param {{handler: import('./handler.js').Handler, eventName: import('./const.js').Events, eventType: string, event: any}} opts
   */
  constructor({ handler, eventName, eventType, event }) {
    /** @returns {import('./handler.js').Handler} */
    this.handler = () => handler;

    /** @returns {import('baileys').WASocket} */
    this.sock = () => handler?.client?.sock;

    /** @type {import('./const.js').Events} */
    this.eventName = eventName;

    /** @type {import('baileys').WAMessage|undefined} */
    this.event = event;

    /** @type {string} */
    this.eventType = eventType;
  }

  async init() {
    /** @returns {import('./plugin.js').Plugin|undefined} */
    this.plugin = () => null;

    /** @type {string} */
    this.prefix = "";

    /** @type {number} */
    this.timestamp = this.event?.messageTimestamp
      ? this.event.messageTimestamp * 1000
      : Date.now();

    /** @type {string} */
    this.me = jidNormalizedUser(this.handler()?.client?.sock?.user?.id);

    /** @type {string} */
    this.meLID = jidNormalizedUser(this.handler()?.client?.sock?.user?.lid);

    if (this.eventName === Events.GROUPS_UPDATE) {
      /** @type {string} */
      this.chat = this.event?.id;

      /** @type {string} */
      this.sender = this.event?.author;
    }

    if (this.eventName === Events.GROUP_PARTICIPANTS_UPDATE) {
      this.chat = this.event?.id;
      this.sender = this.event?.author;

      /** @type {string[]} */
      this.mentionedJid = this.event?.participants;

      /** @type {import('baileys').ParticipantAction} */
      this.action = this.event?.action;
    }

    if (this.eventName === Events.CONTACTS_UPDATE) {
      this.sender = this.event?.id;

      /** @type {string} */
      this.pushName = this.event?.notify;
    }

    if (this.eventName === Events.PRESENCE_UPDATE) {
      this.chat = this.event?.id;
      for (const jid of Object.keys(this.event?.presences)) {
        this.sender = jid;

        /** @type {import('baileys').WAPresence} */
        this.presence = this.event?.presences[jid].lastKnownPresence;
      }
    }

    if (this.event?.key) {
      /** @type {import('baileys').WAMessageKey} */
      this.key = this.event?.key;

      /** @type {string} */
      this.id = this.event?.key.id;

      /** @type {boolean} */
      this.fromMe = this.event?.key.fromMe;
      this.chat = this.event?.key.remoteJid;
      this.sender = this.event?.key.participant;
    }

    if (this.event?.message) {
      /** @type {import('baileys').proto.Message} */
      this.message = this.event?.message;
      const ext = extractTextContext(this.event?.message);

      /** @type {boolean} */
      this.edited = ext.edited;

      /** @type {string} */
      this.type = ext.type;

      /** @type {string} */
      this.text = ext.text;

      /* parse text for command and args */
      this.parseText(ext.text);

      /** @type {import('baileys').WAContextInfo|undefined} */
      this.contextInfo = ext.contextInfo;

      /** @type {import('baileys').proto.IMessage|undefined} */
      this.quotedMessage = ext?.contextInfo?.quotedMessage;
      const qext = extractTextContext(this.quotedMessage);

      /** @type {string} */
      this.quotedText = qext.text;

      /** @type {string|any} */
      this.stanzaId = ext.contextInfo?.stanzaId;

      /** @type {string|any} */
      this.participant = ext.contextInfo?.participant;

      /** @type {string|any} */
      this.remoteJid = ext.contextInfo?.remoteJid;

      /** @type {string[]|any} */
      this.mentionedJid = ext.contextInfo?.mentionedJid;

      /** @type {number} */
      this.expiration = ext.contextInfo?.expiration;
    }

    if (this.eventType === "append") {
      this.sender = jidNormalizedUser(this.event?.participant);
    }

    if (this.event?.reaction) {
      this.text = this.event?.reaction.text;
      this.stanzaId = this.event?.reaction.key?.id;
      this.remoteJid = this.event?.reaction.key?.remoteJid;
      this.participant = this.event?.reaction.key?.participant;
    }

    if (this.eventName === Events.CALL) {
      this.chat = this.event?.groupJid ?? this.event?.chatId;
      this.sender = jidNormalizedUser(this.event?.from);
      this.id = this.event?.id;
      this.timestamp = this.event?.date * 1000;
      this.isGroup = this.event?.isGroup;

      /** @type {boolean} */
      this.isVideo = this.event?.isVideo;

      /** @type {string} */
      this.callStatus = this.event?.status;
    }

    this.pushName = this.event?.pushName ?? this.pushName;

    /** @type {string} */
    this.chatName = this.getName(this.chat) ?? this.chat;

    /** @type {string} */
    this.senderName = this.pushName ?? this.getName(this.sender) ?? this.sender;

    if (this.sender?.includes(":"))
      this.sender = jidNormalizedUser(this.sender);

    if (this.sender?.endsWith("@lid")) {
      this.fromMe = this.sender === this.meLID || this.fromMe;
    } else if (this.sender && this.sender === this.me) {
      this.fromMe = true;
    }

    if (this.participant) {
      /** @type {boolean} */
      this.mentionMe =
        this.participant === this.me || this.participant === this.meLID;
    }

    if (this.key) this.key.fromMe = this.fromMe;

    /** @type {boolean} */
    this.isGroup = this.chat?.endsWith("@g.us");

    /** @type {boolean} */
    this.isStatus = this.chat === "status@broadcast";

    if (this.isGroup) {
      const data = this.handler()?.getGroupMetadata(this.chat);
      if (data && Array.isArray(data?.participants)) {
        /** @type {'lid' | 'pn'} */
        this.addressingMode = data.addressingMode;

        const botPart = data?.participants?.find(
          (part) =>
            part.id === this.sender ||
            part.jid === this.sender ||
            part.lid === this.sender,
        );
        this.isBotAdmin = botPart?.isAdmin ?? botPart?.isSuperAdmin ?? false;

        const part = data?.participants?.find(
          (part) =>
            part.id === this.sender ||
            part.jid === this.sender ||
            part.lid === this.sender,
        );

        /** @type {boolean} */
        this.isAdmin = part?.isAdmin ?? part?.isSuperAdmin ?? false;
      }
    }

    /** @type {string} */
    this.senderJid = this.sender?.includes("@lid")
      ? await this.LIDToPN(this.sender)
      : this.sender;

    /** @type {boolean} */
    this.isViewOnce =
      !this.type &&
      this.event?.messageStubParameters?.includes("Message absent from node");

    /** @returns {string} */
    this.user = () => this.handler().userManager?.getUser(this.senderJid);
  }

  /**
   * Clone the context object
   * @returns {Ctx}
   */
  clone() {
    const cloned = Object.create(Object.getPrototypeOf(this));
    Object.assign(cloned, this);
    return cloned;
  }

  /**
   * @param {string} jid
   * @returns {string}
   */
  getName(jid) {
    return this.handler()?.getName(jid);
  }

  /**
   * @param {string} jid
   * @param {import('baileys').AnyMessageContent} content
   * @param {import('baileys').MessageGenerationOptions} options
   * @returns {Promise<import('baileys').proto.WebMessageInfo>}
   */
  async sendMessage(jid, content, options) {
    return await this.handler()?.sendMessage(jid, content, options);
  }

  /**
   * @param {string} jid
   * @param {import('baileys').proto.IMessage} content
   * @param {import('baileys').MessageRelayOptions} options
   * @returns {Promise<string>}
   */
  async relayMessage(jid, content, options) {
    return await this.handler()?.relayMessage(jid, content, options);
  }

  /**
   * @param {import('baileys').AnyMessageContent} content
   * @param {import('baileys').MiscMessageGenerationOptions} options
   * @returns {Promise<import('baileys').proto.IWebMessageInfo>}
   */
  async reply(content, options) {
    if (!this.chat) throw new Error("chat jid not provided");
    return await this.sendMessage(this.chat, content, options);
  }

  /**
   * @param {import('baileys').proto.IMessage} content
   * @param {import('baileys').MessageRelayOptions} options
   * @returns {Promise<string>}
   */
  async replyRelay(content, options) {
    if (!this.chat) throw new Error("chat jid not provided");
    return await this.relayMessage(this.chat, content, options);
  }

  /**
   * @param {string} jid - JID to download media from
   * @param {string} emoji - Emoji to react with
   * @param {import('baileys').WAMessageKey} key - Message key to react to
   * @param {import('baileys').MessageGenerationOptions} [options] - Message options
   * @returns {Promise<import('baileys').proto.IWebMessageInfo>}
   */
  async reactIt(jid, emoji, key, options) {
    return await this.sendMessage(
      jid,
      { react: { text: emoji, key: key } },
      options,
    );
  }

  /**
   * @param {string} emoji - Emoji to react with
   * @param {import('baileys').WAMessageKey} key - Message key to react to
   * @returns {Promise<import('baileys').proto.IWebMessageInfo>}
   */
  async react(emoji, key) {
    return await this.reactIt(this.chat, emoji, key ?? this.key);
  }

  /**
   * @param {import('baileys').ChatModification} mods
   * @param {string} jid
   */
  async chatModify(mods, jid) {
    return await this.sock()?.chatModify(mods, jid);
  }

  /**
   * @param {import('baileys').proto.IMessageKey[]} keys
   * @returns {Promise<void>}
   */
  async readMessages(keys) {
    return await this.sock()?.readMessages(keys);
  }

  /**
   * @param {string} lid
   * @returns {Promise<string>}
   */
  async LIDToPN(lid) {
    return jidNormalizedUser(
      await this.sock().signalRepository.lidMapping.getPNForLID(lid),
    );
  }

  /**
   * @param {string} jid
   * @returns {Promise<string>}
   */
  async PNToLID(jid) {
    return jidNormalizedUser(
      await this.sock().signalRepository.lidMapping.getLIDForPN(jid),
    );
  }

  /**
   * @param {string} text - Text to parse
   */
  parseText(text) {
    this.text = text;

    /* Parsing cmd */
    if (text && text.length > 0) {
      const splitted = text.split(" ");
      /** @type {string} - With prefix */
      this.pattern = splitted[0];

      /** @type {string} - No prefixed */
      this.cmd = this.pattern?.slice(this.prefix?.length ?? 1);

      /** @type {string} */
      this.args = splitted.slice(1)?.join(" ");

      /** @type {boolean} */
      this.isCMD = this.handler()?.isCMD(this.pattern);

      if (this.args && this.args?.length > 0) {
        try {
          /** @type {import('minimist').ParsedArgs} */
          this.argv = minimist(parseArgsStringToArgv(this.args));
        } catch {
          /* do nothing */
        }
      }
    }
  }

  /**
   * @param {import('baileys').WAMessage} m
   * @param {'buffer' | 'stream'} output
   * @param {import('baileys').DownloadMediaOptions} options
   * @returns {Promise<import('fs').ReadStream | Buffer>}
   */
  async downloadIt(m, output, options) {
    if (!output || typeof output !== "string" || output.length === 0)
      output = "buffer";
    if (m?.message?.documentWithCaptionMessage)
      m = m.message.documentWithCaptionMessage;
    if (m?.message?.viewOnceMessage) m = m.message.viewOnceMessage;
    return downloadMediaMessage(m, output, options);
  }

  /**
   * @param {'buffer' | 'stream'} output
   * @param {import('baileys').DownloadMediaOptions} options
   * @returns {Promise<import('fs').ReadStream | Buffer>}
   */
  download(output, options) {
    return this.downloadIt({ message: this.message }, output, options);
  }

  /**
   * @param {'buffer' | 'stream'} output
   * @param {import('baileys').DownloadMediaOptions} options
   * @returns {Promise<import('fs').ReadStream | Buffer>}
   */
  downloadQuoted(output, options) {
    if (!this.quotedMessage) return;
    return this.downloadIt({ message: this.quotedMessage }, output, options);
  }

  /**
   * @param {...JIDBy} by
   * @returns {string[]}
   */
  parseJIDs(...by) {
    if (!by || by.length === 0)
      by = [JIDBy.Participant, JIDBy.Mentions, JIDBy.Text];

    const jids = [];

    if (by?.includes(JIDBy.Participant)) {
      if (this.participant) jids.push(this.participant);
    }
    if (by?.includes(JIDBy.Mentions)) {
      if (this.mentionedJid) jids.push(...this.mentionedJid);
    }

    if (by?.includes(JIDBy.Text)) {
      const uncat = this.argv?._?.join(" ") ?? "";
      const matches = uncat.matchAll(PHONE_REGEX);

      for (const match of matches) {
        const cleanNumber = match[1].replace(/[^\d]/g, "");
        if (cleanNumber.length > 6 && cleanNumber.length < 16) {
          const suffix =
            this.addressingMode === "lid" ? "@lid" : S_WHATSAPP_NET;
          jids.push(`${cleanNumber}${suffix}`);
        }
      }
    }

    /* remove duplicate in jids */
    return [...new Set(jids)];
  }
}
