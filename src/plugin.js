/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Reason } from './reason.js';

/**
 * @typedef {Object} Plugin
 * @property {import('./handler.js').Handler} handler
 * @property {import('baileys').WASocket} sock
 * @property {string | string[]} cmd
 * @property {string} prefix
 * @property {string} desc
 * @property {string[]} tags
 * @property {string} cat
 * @property {boolean} disabled
 * @property {boolean} hidden
 * @property {string[]} events
 * @property {any[]} roles
 * @property {number} timeout
 * @property {boolean} noPrefix
 * @property {(ctx: import('./context.js').Ctx) => Promise<Reason> | Reason} midware
 * @property {(ctx: import('./context.js').Ctx) => Promise<void>} exec
 * @property {(ctx: import('./context.js').Ctx, reason: Reason) => Promise<void>} final
 * @property {string} location
 */

/**
 * Plugin class for handling event as listener or command
 */
export class Plugin {
  /** @param {Plugin} */
  constructor({ cmd, prefix, desc, cat, tags, disabled, hidden, events, roles, timeout,
    noPrefix, midware, exec, final, location }) {
    /** @type {import('./handler.js').Handler} */
    this.handler = null;

    /** @type {import('baileys').WASocket} */
    this.sock = null;

    /** @type {string | string[]}*/
    this.cmd = cmd;

    /** @type {string} */
    this.prefix = prefix

    /** @type {boolean} */
    this.noPrefix = noPrefix;

    /** @type {string} */
    this.desc = desc;

    /** @type {string[]} */
    this.tags = tags;

    /** @type {string} */
    this.cat = (cat && cat !== '') ? cat : 'uncategorized';

    /** @type {boolean} */
    this.disabled = disabled;

    /** @type {boolean} */
    this.hidden = hidden;

    /** @type {string[]} */
    this.events = events;

    /** @type {any[]} */
    this.roles = roles ?? [];

    /** @type {number} Timeout in second */
    this.timeout = timeout;

    /** @type {(ctx: import('./context.js').Ctx) => Promise<Reason> | Reason} */
    this.midware = midware;

    /** @type {(ctx: import('./context.js').Ctx) => Promise<void>} */
    this.exec = exec;

    /** @type {(ctx: import('./context.js').Ctx, reason: Reason) => Promise<void>} */
    this.final = final;

    /** @type {string} */
    this.location = location;
  }

  /**
   * Checker before execution
   * @param {import('./context.js').Ctx} ctx
   * @return {Promise<Reason>}
   */
  async check(ctx) {
    const res = new Reason({
      success: true,
      code: 'plugin-checker',
      author: this.location,
      message: `This plugin is ready to execute`
    });

    if (this.disabled) return res.setBad()
      .setCode('plugin-disabled')
      .setMessage(`This plugin is disabled`);

    if (this.timeout > 0) {
      const diff = new Date().getTime() - ctx.timestamp;
      if (diff > (this.timeout * 1000)) return res.setBad()
        .setCode('plugin-timeout')
        .setMessage(`This plugin is timed out`);
    }

    if (this.events && !this.events?.includes(ctx.eventName)) {
      return res.setBad()
        .setCode('event-type')
        .setMessage('Event type not match');
    }

    if (this.midware) {
      return new Reason(await this.midware(ctx));
    }
    return res;
  }

}
