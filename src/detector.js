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
import { midwareAnd, midwareOr } from "./midware.js";
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

/**
 * A class to detect messages that may originate from bots or unofficial clients.
 */
export class BotDetector {
  /** @type {Map<string, number>} */
  #msgTimestamps = new Map();

  /** @type {Function[]} */
  #checks;

  /** @type {Function} */
  #detect;

  /**
   * Creates an instance of BotDetector.
   * @param {object} options - The options for the detector.
   * @param {number} [options.delay=1000] - A delay parameter, currently not used in the detection logic but available for future use.
   */
  constructor({ delay }) {
    this.delay = delay ?? 1000;

    this.#checks = [
      midwareAnd((ctx) => {
        /* Check if id contains non hex char */
        return new Reason({
          success: /[^0-9a-fA-F]+/.test(ctx.id),
          code: "NON_HEX_ID",
          message: "Message ID contains non-hex characters",
        });
      }),
      (ctx) => {
        if (!ctx.id) return new Reason({ success: false });
        /* Check if id contains lowercase */
        return new Reason({
          success: ctx.id.toUpperCase() !== ctx.id,
          code: "LOWERCASE_ID",
          message: "Message ID contains lowercase letters",
        });
      },
      (ctx) => {
        /* Check if message type is in onlyOfficial list */
        return new Reason({
          success: onlyOfficial.includes(ctx.type),
          code: "UNOFFICIAL_TYPE",
          message: `Message type is ${ctx.type}`,
        });
      },
      (ctx) => {
        /* Check if participant is a 0 + S_WHATSAPP_NET */
        return new Reason({
          success: ctx.participant === `0${S_WHATSAPP_NET}`,
          code: "NULL_PARTICIPANT",
          message: "Participant is 0@s.whatsapp.net",
        });
      },
      (ctx) => {
        /* Check if response to a quoted message is under 3 seconds */
        if (!ctx.stanzaId) return new Reason({ success: false });
        const origTs = this.#msgTimestamps.get(ctx.stanzaId);
        if (!origTs) return new Reason({ success: false });
        const elapsed = ctx.timestamp - origTs;
        return new Reason({
          success: elapsed < this.delay,
          code: "FAST_RESPONSE",
          message: `Quoted message reply in ${elapsed}ms`,
        });
      },
    ];

    this.#rebuild();

    /* Cleanup stale entries every 5 minutes */
    setInterval(() => {
      const cutoff = Date.now() - 300_000;
      for (const [id, ts] of this.#msgTimestamps) {
        if (ts < cutoff) this.#msgTimestamps.delete(id);
      }
    }, 60_000);
  }

  /** Rebuilds the detect middleware from the checks array. */
  #rebuild() {
    this.#detect = midwareOr(...this.#checks);
  }

  /**
   * Adds a custom detection check.
   * @param {(ctx: import('./context.js').Ctx) => Reason} fn
   */
  addDetector(fn) {
    this.#checks.push(fn);
    this.#rebuild();
  }

  /**
   * Runs the detection logic against a given message context.
   * @param {import('./context.js').Ctx} ctx - The message context to check.
   * @returns {Promise<Reason>} A promise that resolves with a Reason object indicating whether the message is suspected to be from a bot.
   */
  async isBot(ctx) {
    this.#msgTimestamps.set(ctx.id, ctx.timestamp);
    return await this.#detect(ctx);
  }
}

export default new BotDetector({});
