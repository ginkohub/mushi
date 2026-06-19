/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { S_WHATSAPP_NET } from "baileys";
import { Reason } from "./reason.js";

/**
 * updated 2026-06-13 20:13
 * @constant {string[]} onlyOfficial
 * @description A list of message types that are often associated with unofficial or modified WhatsApp clients.
 */
const onlyOfficial = [
  "buttonsMessage",
  "botInvokeMessage",
  "interactiveResponseMessage",
  "botForwardedMessage",
];

const AUTHOR = "BotDetector";

/**
 * A class to detect messages that may originate from bots or unofficial clients.
 */
export class BotDetector {
  /** @type {Map<string, number>} */
  #msgTimestamps = new Map();

  /** @type {Function[]} */
  #checks;

  /**
   * Creates an instance of BotDetector.
   * @param {object} options - The options for the detector.
   * @param {number} [options.threshold=3000] - Max response time in ms for FAST_RESPONSE detection.
   */
  constructor({ threshold }) {
    this.threshold = threshold ?? 3000;

    this.#checks = [
      (ctx) => {
        /* Check if id contains non hex char */
        return new Reason({
          success: /[^0-9a-fA-F]+/.test(ctx.id),
          code: "NON_HEX_ID",
          author: AUTHOR,
          message: "Message ID contains non-hex characters",
          data: ctx.event,
        });
      },
      (ctx) => {
        if (!ctx.id) return new Reason({ success: false, author: AUTHOR, data: ctx.event });
        /* Check if id contains lowercase */
        return new Reason({
          success: ctx.id.toUpperCase() !== ctx.id,
          code: "LOWERCASE_ID",
          author: AUTHOR,
          message: "Message ID contains lowercase letters",
          data: ctx.event,
        });
      },
      (ctx) => {
        /* Check if message type is in onlyOfficial list */
        return new Reason({
          success: onlyOfficial.includes(ctx.type),
          code: "UNOFFICIAL_TYPE",
          author: AUTHOR,
          message: `Message type is ${ctx.type}`,
          data: ctx.event,
        });
      },
      (ctx) => {
        /* Check if participant is a 0 + S_WHATSAPP_NET */
        return new Reason({
          success: ctx.participant === `0${S_WHATSAPP_NET}`,
          code: "NULL_PARTICIPANT",
          author: AUTHOR,
          message: "Participant is 0@s.whatsapp.net",
          data: ctx.event,
        });
      },
      (ctx) => {
        /* Check if response to a quoted message is under 3 seconds */
        if (!ctx.stanzaId) return new Reason({ success: false, author: AUTHOR, data: ctx.event });
        const origTs = this.#msgTimestamps.get(ctx.stanzaId);
        if (!origTs) return new Reason({ success: false, author: AUTHOR, data: ctx.event });
        const elapsed = ctx.timestamp - origTs;
        return new Reason({
          success: elapsed < this.threshold,
          code: "FAST_RESPONSE",
          author: AUTHOR,
          message: `Quoted message reply in ${elapsed}ms`,
          data: ctx.event,
        });
      },
    ];

    /* Cleanup stale entries every 5 minutes */
    setInterval(() => {
      const cutoff = Date.now() - 300_000;
      for (const [id, ts] of this.#msgTimestamps) {
        if (ts < cutoff) this.#msgTimestamps.delete(id);
      }
    }, 60_000);
  }

  /**
   * Adds a custom detection check.
   * @param {(ctx: import('./context.js').Ctx) => Reason} fn
   */
  addDetector(fn) {
    this.#checks.push(fn);
  }

  /**
   * Runs the detection logic against a given message context.
   * @param {import('./context.js').Ctx} ctx - The message context to check.
   * @returns {Promise<Reason>} A promise that resolves with a Reason object indicating whether the message is suspected to be from a bot.
   */
  async isBot(ctx) {
    this.#msgTimestamps.set(ctx.id, ctx.timestamp);
    for (const check of this.#checks) {
      const result = new Reason(await check(ctx));
      if (result.success) return result;
    }
    return new Reason({ success: false, author: AUTHOR, data: ctx.event });
  }
}

export default new BotDetector({});
