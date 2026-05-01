/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { S_WHATSAPP_NET } from 'baileys';
import { midwareAnd, midwareOr } from './midware.js';
import { Reason } from './reason.js';

/**
 * @constant {string[]} onlyOfficial
 * @description A list of message types that are often associated with unofficial or modified WhatsApp clients.
 */
const onlyOfficial = [
  'buttonsMessage',
  'botInvokeMessage',
  'interactiveResponseMessage',
];

/**
 * @constant {Function} detect
 * @description A middleware composition that runs several checks to determine if a message is likely from a bot or unofficial client.
 * It returns a successful Reason if any of the following conditions are met:
 * - The message ID contains non-hexadecimal characters.
 * - The message ID is not in all-uppercase.
 * - The message type is one of the types listed in `onlyOfficial`.
 * - The participant JID is '0@s.whatsapp.net'.
 */
const detect = midwareOr(
  midwareAnd(
    (ctx) => {
      /* Check if id contains non hex char */
      return new Reason({ success: /[^0-9a-fA-F]+/.test(ctx.id) });
    }
  ),
  (ctx) => {
    if (!ctx.id) return new Reason({ success: false });
    /* Check if id contains lowercase */
    return new Reason({ success: ctx.id.toUpperCase() !== ctx.id });
  },
  (ctx) => {
    /* Check if message type is in onlyOfficial list */
    return new Reason({ success: onlyOfficial.includes(ctx.type) });
  },
  (ctx) => {
    /* Check if participant is a 0 + S_WHATSAPP_NET */
    return new Reason({ success: ctx.participant === '0' + S_WHATSAPP_NET });
  }
);

/**
 * A class to detect messages that may originate from bots or unofficial clients.
 */
export class BotDetector {
  /**
   * Creates an instance of BotDetector.
   * @param {object} options - The options for the detector.
   * @param {number} [options.delay=1000] - A delay parameter, currently not used in the detection logic but available for future use.
   */
  constructor({ delay }) {
    this.delay = delay ?? 1000;
  }

  /**
   * Runs the detection logic against a given message context.
   * @param {import('./context.js').Ctx} ctx - The message context to check.
   * @returns {Promise<Reason>} A promise that resolves with a Reason object indicating whether the message is suspected to be from a bot.
   */
  async isBot(ctx) {
    return await detect(ctx);
  }
}

export default new BotDetector({});
