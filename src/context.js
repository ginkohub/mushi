/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { jidNormalizedUser } from 'baileys';
import { CONTACTS_UPDATE, GROUP_PARTICIAPANTS_UPDATE, GROUPS_UPDATE, PRESENCE_UPDATE } from './const.js';

const skipMessageTypes = [
  'messageContextInfo',
];

/**
 * Extracts text content and context info from a message
 * 
 * @param {Partial<import('baileys').WAMessage>} m - Message object
 * @returns {{text: string, contextInfo: import('baileys').WAContextInfo | null, type: string}} Extracted text and context
 */
export function extactTextContext(m) {
  let resp = {
    text: "",
    contextInfo: null,
    type: null
  }

  if (typeof m !== 'object' || m === null) return resp;

  for (let key in m) {
    if (key === 'protocolMessage') {
      if (m[key]?.editedMessage) {
        resp = extactTextContext(m[key].editedMessage);
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
   * @param {{handler: import('./handler.js').Handler }} - Handler instance
   */
  constructor({ handler, eventName, event, eventType }) {
    this.handler = () => handler;
    this.plugin = null;
    this.sock = () => handler?.client?.sock;
    this.getName = (jid) => handler?.getName(jid);
    this.sendMessage = async (jid, content, options) => handler?.sendMessage(jid, content, options);
    this.relayMessage = async (jid, content, options) => handler?.relayMessage(jid, content, options);
    this.reply = async (content, options) => {
      if (!this.chat) throw new Error('chat jid not provided');
      return await handler?.sendMessage(this.chat, content, options);
    };
    this.replyRelay = async (content, options) => {
      if (!this.chat) throw new Error('chat jid not provided');
      return await handler?.relayMessage(this.chat, content, options);
    };
    this.react = async (emoji, key) => await handler.sendMessage(this.chat, { react: { text: emoji, key: key, } });


    this.eventName = eventName;
    this.event = event;
    this.eventType = eventType;

    this.timestamp = event.messageTimestamp ? event.messageTimestamp * 1000 : new Date().getTime();

    if (eventName === GROUPS_UPDATE) {
      this.chat = event.id;
      this.sender = event.author;
    }

    if (eventName === GROUP_PARTICIAPANTS_UPDATE) {
      this.chat = event.id;
      this.sender = event.author;
      this.mentionedJid = event.participants;
      this.action = event.action;
    }

    if (eventName === CONTACTS_UPDATE) {
      this.sender = event.id;
      this.pushName = event.notify;
    }

    if (eventName === PRESENCE_UPDATE) {
      this.chat = event.id;
      for (const jid of Object.keys(event.presences)) {
        this.sender = jid;
        this.presence = event.presences[jid].lastKnownPresence;
      }
    }

    if (event.key) {
      this.key = event.key;
      this.id = event.key.id;
      this.fromMe = event.key.fromMe;
      this.chat = event.key.remoteJid;
      this.sender = event.key.participant;
    }

    if (event.message) {
      this.message = event.message;
      const ext = extactTextContext(event.message);
      this.type = ext.type;
      this.text = ext.text;
      this.contextInfo = ext.contextInfo;

      this.quotedMessage = ext?.contextInfo?.quotedMessage;
      const qext = extactTextContext(this.quotedMessage);
      this.quotedText = qext.text;
      this.stanzaId = ext.contextInfo?.stanzaId;
      this.participant = ext.contextInfo?.participant;
      this.remoteJid = ext.contextInfo?.remoteJid;
      this.mentionedJid = ext.contextInfo?.mentionedJid;
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

    /* Parsing cmd */
    if (this.text && this.text.length > 0) {
      const splitted = this.text.split(' ');
      this.pattern = splitted[0];
      this.args = splitted.slice(1)?.join(' ');

      this.isCMD = handler?.isCMD(this.pattern);
    }

    this.pushName = event?.pushName ?? this.pushName;
    this.chatName = this.getName(this.chat) ?? this.chat;
    this.senderName = this.pushName ?? this.getName(this.sender) ?? this.sender;

    if (this.sender && this.sender?.endsWith('@lid')) {
      const jidLID = jidNormalizedUser(handler?.client?.sock?.user?.lid);
      const isOwnLID = jidLID === this.sender;

      this.fromMe = isOwnLID || this.fromMe;
      // this.senderLID = this.sender;
    }

    this.isGroup = this.chat?.endsWith('@g.us');
    this.isStatus = this.chat === 'status@broadcast';

    if (this.isGroup) {
      const data = handler?.getGroupMetadata(this.chat);
      if (data) {
        for (const part of data.participants) {
          if (this.sender == part.jid || this.sender == part.lid || this.sender == part.id) {
            this.isAdmin = part.admin?.includes('admin');
            // this.sender = part.jid ?? this.sender;
          }
        }
      }
    }
  }
}
