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
import { BotDetector } from "../../src/detector.js";
import { formatElapse } from "../../src/tools.js";

const storeID = [];
function hasID(c) {
  const key = `${c.senderJid}_${c.id}`;
  if (storeID.indexOf(key) > -1) {
    return true;
  } else {
    if (storeID.length > 100) {
      storeID.shift();
    }
    storeID.push(key);
    return false;
  }
}
const detect = new BotDetector({ delay: 2000 });

/** @type {void} */
const sliceStr = (str, len, mid) => {
  if (!str || str?.length <= len) return str;
  if (!mid) mid = "";
  const half = Math.round(len / 2);
  const start = str.slice(0, half);
  const end = str.slice(str.length - half, str.length);
  return `${start}${mid}${end}`;
};

/** @type {void} */
const cleanName = (str) => {
  if (typeof str === "string") {
    str = str.replaceAll("\n", " ");
    while (str.includes("  ")) {
      str = str.replaceAll("  ", " ");
    }
    str = str.trim();
  }

  return str;
};

const skipEvents = [
  Events.MESSAGE_RECEIPT_UPDATE,
  Events.CONNECTION_UPDATE,
  Events.CONTACTS_UPDATE,
  Events.CREDS_UPDATE,
  Events.CHATS_UPDATE,
  Events.CHATS_UPSERT,
];

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  name: "std-log",
  desc: "Logs the message to the console",
  timeout: 0,
  midware: (c) => ({
    success: !skipEvents.includes(c.eventName),
  }),

  exec: async (c) => {
    const data = [];
    const chatName = cleanName(c.chatName);
    const senderName = cleanName(c.senderName);

    switch (c.eventType) {
      case "append": {
        data.push("📩");
        break;
      }
      case "notify": {
        data.push("📧");
        break;
      }
    }

    switch (c.eventName) {
      case Events.PRESENCE_UPDATE: {
        switch (c.presence) {
          case "composing": {
            data.push("✍️", "");
            break;
          }
          case "recording": {
            data.push("🎤");
            break;
          }
          default:
            data.push(c.presence);
        }

        data.push(chatName, "<", senderName);

        break;
      }

      case Events.MESSAGES_REACTION:
      case Events.MESSAGES_UPSERT: {
        /* Indicator section */
        if (c.isAdmin) data.push("🛡️", "");

        if (c.isCMD) {
          data.push("⚡");

          const dataCMD = c.handler()?.getCMD(c.pattern);
          const resCheck = await dataCMD?.plugin?.check(c);
          if (!resCheck?.success) data.push("❌");
        }

        if (c.id && c.type !== "senderKeyDistributionMessage") {
          if (hasID(c)) {
            data.push("⚠️", "");
          }
        }
        if ((await detect.isBot(c))?.success) data.push("🤖");
        if (c.sender?.endsWith("@lid")) data.push("🥷");

        /* Data section */
        data.push(formatElapse(Date.now() - c.timestamp));
        if (c.stanzaId) data.push(sliceStr(c.stanzaId, 8, "-"), "<<");
        data.push(sliceStr(c.id, 8, "-"));

        data.push(
          c.type?.replaceAll("Message", ""),
          chatName,
          "<",
          senderName,
          c.text?.slice(0, 100).replaceAll("\n", " ") || "",
        );

        break;
      }

      case Events.GROUP_PARTICIPANTS_UPDATE: {
        data.push("👥");

        switch (c.action) {
          case "invite":
          case "add": {
            data.push("⤵️");
            break;
          }
          case "promote": {
            data.push("⬆️");
            break;
          }
          case "demote": {
            data.push("⬇️");
            break;
          }
          case "leave": {
            data.push("⤴️");
            break;
          }
          default:
            data.push(c.action);
        }
        data.push("", chatName, "<", senderName, c.mentionedJid?.join(", "));

        break;
      }

      case Events.CALL: {
        data.push("📞", c.callStatus, "from", chatName);
        break;
      }

      default:
        data.push(c.eventName);
    }

    if (data.length > 0) c.log().info(...data);
  },
};
