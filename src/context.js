/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { downloadMediaMessage, jidNormalizedUser, S_WHATSAPP_NET } from 'baileys';
import { Events } from './const.js';
import minimist from 'minimist';
import parseArgsStringToArgv from 'string-argv';

const JIDBy = {
  Participant: 0,
  Mentions: 1,
  Text: 2
}

const skipMessageTypes = [
  'messageContextInfo',
];

/**
 * Extracts text content and context info from a message
 * 
 * @param {Partial<import('baileys').WAMessage>} m - Message object
 * @returns {{text: string, contextInfo: import('baileys').WAContextInfo | null, type: string, edited: boolean}} Extracted text and context
 */
export function extractTextContext(m) {
  let resp = {
    text: "",
    contextInfo: null,
    type: null,
    edited: false
  }

  if (typeof m !== 'object' || m === null) return resp;

  for (let key in m) {
    if (key === 'protocolMessage') {
      if (m[key]?.editedMessage) {
        resp = extractTextContext(m[key].editedMessage);
        resp.edited = true;
        break;
      }
    }

    if (m[key] === null || m[key] === undefined) { continue; }
    if (key === 'conversation') {
      if (m[key].length > 0) {
        resp.text = m[key];
        if (!skipMessageTypes.includes(key)) resp.type = key;
        continue;
      }
    }

    if (typeof m[key] === 'object') {
      if (!skipMessageTypes.includes(key)) resp.type = key;
      if (m[key].caption?.length > 0) resp.text = m[key].caption;
      if (m[key].text?.length > 0) resp.text = m[key].text;
      if (m[key].selectedId?.length > 0) resp.text = m[key].selectedId;
      if (m[key].contextInfo) resp.contextInfo = m[key].contextInfo;
    }
  }

  return resp;
}

export class Ctx {
  /**
   * @param {{handler: import('./handler.js').Handler, eventName: string, eventType: string, event: any}}
   */
  constructor({ handler, eventName, eventType, event }) {

    /** @returns {import('./handler.js').Handler} */
    this.handler = () => handler;

    /** @type {import('./plugin.js').Plugin} */
    this.plugin = null;

    /** @type {string} */
    this.prefix = '';

    /** @returns {import('baileys').WASocket} */
    this.sock = () => handler?.client?.sock;

    /** @returns {string} */
    this.getName = (jid) => handler?.getName(jid);

    /**
     * @param {import('baileys').AnyMessageContent} content
     * @param {import('baileys').MessageGenerationOptions} options 
     * @returns {Promise<import('baileys').proto.WebMessageInfo>} 
     */
    this.sendMessage = async (jid, content, options) => await handler?.sendMessage(jid, content, options);

    /** 
     * @param {string} jid
     * @param {import('baileys').proto.IMessage} content
     * @param {import('baileys').MessageRelayOptions} options
     * @returns {Promise<string>} 
     */
    this.relayMessage = async (jid, content, options) => await handler?.relayMessage(jid, content, options);

    /** 
     * @param {import('baileys').AnyMessageContent} content
     * @param {import('baileys').MessageGenerationOptions} options
     * @returns {Promise<import('baileys').proto.IWebMessageInfo>}
     */
    this.reply = async (content, options) => {
      if (!this.chat) throw new Error('chat jid not provided');
      return await handler?.sendMessage(this.chat, content, options);
    };

    /**
     * @param {import('baileys').proto.IMessage} content
     * @param {import('baileys').MessageRelayOptions} options
     * @returns {Promise<string>} 
     */
    this.replyRelay = async (content, options) => {
      if (!this.chat) throw new Error('chat jid not provided');
      return await handler?.relayMessage(this.chat, content, options);
    };

    /**
     * @param {string} jid - JID to download media from
     * @param {string} emoji - Emoji to react with
     * @param {import('baileys').WAMessageKey} key - Message key to react to
     * @param {import('baileys').MessageGenerationOptions} options - Message options
     * @returns {Promise<import('baileys').proto.IWebMessageInfo>}
     */
    this.reactIt = async (jid, emoji, key, options) => await handler.sendMessage(jid, { react: { text: emoji, key: key } }, options);

    /**
     * @param {string} emoji - Emoji to react with
     * @param {import('baileys').WAMessageKey} key - Message key to react to
     * @returns {Promise<import('baileys').proto.IWebMessageInfo>}
     */
    this.react = async (emoji, key) => await this.reactIt(this.chat, emoji, key ?? this.key);

    /**
     * @param {import('baileys').ChatModification} mods
     * @param {string} jid
     */
    this.chatModify = async (mods, jid) => await this.sock()?.chatModify(mods, jid);

    /**
     * @param {import('baileys').proto.IMessageKey[]} keys
     * @returns {Promise<void>}
     */
    this.readMessages = async (keys) => await this.sock()?.readMessages(keys);

    /**
     * @param {string} text - Text to parse
     */
    this.parseText = (text) => {
      this.text = text;

      /* Parsing cmd */
      if (text && text.length > 0) {
        const splitted = text.split(' ');
        /** @type {string} - With prefix */
        this.pattern = splitted[0];

        /** @type {string} - No prefixed */
        this.cmd = this.pattern?.slice(-(this.prefix?.length ?? 0));

        /** @type {string} */
        this.args = splitted.slice(1)?.join(' ');

        /** @type {boolean} */
        this.isCMD = handler?.isCMD(this.pattern);

        if (this.args && this.args?.length > 0) {
          try {
            /** @type {import('minimist').ParsedArgs} */
            this.argv = minimist(parseArgsStringToArgv(this.args));
          } catch (e) {
            /* do nothing */
          }
        }
      }
    };

    /** @type {string} */
    this.eventName = eventName;

    /** @type {import('baileys').WAMessage | any} */
    this.event = event;

    /** @type {string} */
    this.eventType = eventType;

    /** @type {number} */
    this.timestamp = event?.messageTimestamp ? event.messageTimestamp * 1000 : Date.now();

    /** @type {string} */
    this.me = jidNormalizedUser(handler?.client?.sock?.user?.id);

    /** @type {string} */
    this.meLID = jidNormalizedUser(handler?.client?.sock?.user?.lid);

    if (eventName === Events.GROUPS_UPDATE) {
      /** @type {string} */
      this.chat = event.id;

      /** @type {string} */
      this.sender = event.author;
    }

    if (eventName === Events.GROUP_PARTICIPANTS_UPDATE) {
      this.chat = event.id;
      this.sender = event.author;

      /** @type {string[]} */
      this.mentionedJid = event.participants;

      /** @type {import('baileys').ParticipantAction} */
      this.action = event.action;
    }

    if (eventName === Events.CONTACTS_UPDATE) {
      this.sender = event.id;

      /** @type {string} */
      this.pushName = event.notify;
    }

    if (eventName === Events.PRESENCE_UPDATE) {
      this.chat = event.id;
      for (const jid of Object.keys(event.presences)) {
        this.sender = jid;

        /** @type {import('baileys').WAPresence} */
        this.presence = event.presences[jid].lastKnownPresence;
      }
    }

    if (event.key) {
      /** @type {import('baileys').WAMessageKey} */
      this.key = event.key;

      /** @type {string} */
      this.id = event.key.id;

      /** @type {boolean} */
      this.fromMe = event.key.fromMe;
      this.chat = event.key.remoteJid;
      this.sender = event.key.participant;
    }

    if (event.message) {
      /** @type {import('baileys').proto.Message} */
      this.message = event.message;
      const ext = extractTextContext(event.message);

      /** @type {boolean} */
      this.edited = ext.edited;

      /** @type {string} */
      this.type = ext.type;

      /** @type {string} */
      this.text = ext.text;

      /* parse text for command and args */
      this.parseText(ext.text);

      /** @type {import('baileys').WAContextInfo} */
      this.contextInfo = ext.contextInfo;

      /** @type {import('baileys').proto.IMessage} */
      this.quotedMessage = ext?.contextInfo?.quotedMessage;
      const qext = extractTextContext(this.quotedMessage);

      /** @type {string} */
      this.quotedText = qext.text;

      /** @type {string} */
      this.stanzaId = ext.contextInfo?.stanzaId;

      /** @type {string} */
      this.participant = ext.contextInfo?.participant;

      /** @type {string} */
      this.remoteJid = ext.contextInfo?.remoteJid;
      this.mentionedJid = ext.contextInfo?.mentionedJid;

      /** @type {number} */
      this.expiration = ext.contextInfo?.expiration;
    }

    if (eventType === 'append') {
      this.sender = jidNormalizedUser(event.participant);
    }

    if (event.reaction) {
      this.text = event.reaction.text
      this.stanzaId = event.reaction.key?.id;
      this.remoteJid = event.reaction.key?.remoteJid;
      this.participant = event.reaction.key?.participant;
    }

    if (eventName === Events.CALL) {
      this.chat = event.groupJid ?? event.chatId;
      this.sender = jidNormalizedUser(event.from);
      this.id = event.id;
      this.timestamp = event.date * 1000;
      this.isGroup = event.isGroup;

      /** @type {boolean} */
      this.isVideo = event.isVideo;

      /** @type {string} */
      this.callStatus = event.status;
    }

    this.pushName = event?.pushName ?? this.pushName;

    /** @type {string} */
    this.chatName = this.getName(this.chat) ?? this.chat;

    /** @type {string} */
    this.senderName = this.pushName ?? this.getName(this.sender) ?? this.sender;

    if (this.sender?.includes(':')) this.sender = jidNormalizedUser(this.sender);

    if (this.sender && this.sender?.endsWith('@lid')) {
      this.fromMe = this.sender === this.meLID || this.fromMe;
    } else if (this.sender && this.sender === this.me) {
      this.fromMe = true;
    }

    if (this.participant) {
      /** @type {boolean} */
      this.mentionMe = this.participant === this.me || this.participant === this.meLID;
    }

    if (this.key) this.key.fromMe = this.fromMe;

    /** @type {boolean} */
    this.isGroup = this.chat?.endsWith('@g.us');

    /** @type {boolean} */
    this.isStatus = this.chat === 'status@broadcast';

    if (this.isGroup) {
      const data = handler?.getGroupMetadata(this.chat);
      if (data && Array.isArray(data?.participants)) {
        /** @type {'lid' | 'pn'} */
        this.addressingMode = data.addressingMode;

        const botPart = data?.participants?.find(
          part => (part.id == this.sender || part.jid == this.sender || part.lid == this.sender)
        );
        this.isBotAdmin = botPart?.isAdmin ?? botPart?.isSuperAdmin ?? false;


        const part = data?.participants?.find(
          part => (part.id == this.sender || part.jid == this.sender || part.lid == this.sender)
        );

        /** @type {boolean} */
        this.isAdmin = part?.isAdmin ?? part?.isSuperAdmin ?? false;

        /** @type {string} */
        this.senderAlt = (this.sender?.endsWith('@lid') && part) ? part.jid : this.sender;
      }
    }

    /** @type {boolean} */
    this.isViewOnce = !this.type && this.event?.messageStubParameters?.includes('Message absent from node');

    /**
     * @param {import('baileys').WAMessage} m
     * @param {'buffer' | 'stream'} output
     * @param {import('baileys').DownloadMediaOptions} options
     * @returns {Promise<import('fs').ReadStream | Buffer>}
     */
    this.downloadIt = async (m, output, options) => {
      if (!output || typeof output !== 'string' || output.length === 0) output = 'buffer';
      if (m?.message?.documentWithCaptionMessage) m = m.message.documentWithCaptionMessage;
      if (m?.message?.viewOnceMessage) m = m.message.viewOnceMessage;
      return downloadMediaMessage(m, output, options);
    }

    /**
    * @param {'buffer' | 'stream'} output
    * @param {import('baileys').DownloadMediaOptions} options
    * @returns {Promise<import('fs').ReadStream | Buffer>}
    */
    this.download = async (output, options) => {
      return this.downloadIt({ message: this.message }, output, options)
    }

    /**
     * @param {'buffer' | 'stream'} output
     * @param {import('baileys').DownloadMediaOptions} options
     * @returns {Promise<import('fs').ReadStream | Buffer>}
     */
    this.downloadQuoted = async (output, options) => {
      if (!this.quotedMessage) return;
      return this.downloadIt({ message: this.quotedMessage }, output, options)
    }

    /**
     * @param {...JIDBy} by
     * @returns {string[]}
     */
    this.parseJIDs = (...by) => {
      if (!by || by.length === 0) by = [JIDBy.Participant, JIDBy.Mentions, JIDBy.Text];

      const jids = [];

      if (by?.includes(JIDBy.Participant)) { if (this.participant) jids.push(this.participant); }
      if (by?.includes(JIDBy.Mentions)) {
        if (this.mentionedJid) jids.push(...this.mentionedJid);
      }

      if (by?.includes(JIDBy.Text)) {
        const uncat = this.argv?._?.join(' ') ?? '';

        /* check if uncat contains /\+?\d+\s?[\d-]+/gi */
        const parsed = [...uncat.matchAll(/\+?\d+\s?[\d-]+/gi)].map(
          (match) => match[0]?.replaceAll(/[^\d]/g, '') + (this.addressingMode === 'lid') ? '@lid' : S_WHATSAPP_NET
        );
        if (parsed?.length > 0) jids.push(...parsed);
      }

      /* remove duplicate in jids */
      jids = jids.filter((value, index, self) => self.indexOf(value) === index);

      return jids;
    }

  }
}
