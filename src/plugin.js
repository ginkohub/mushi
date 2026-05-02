/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Reason } from "./reason.js";
import { nameToLevel } from "./roles.js";

/**
 * @typedef {Object} PluginOpts
 * @property {import('./handler.js').Handler} [handler]
 * @property {import('baileys').WASocket} [sock]
 * @property {string|string[]|undefined} [cmd]
 * @property {string} [prefix]
 * @property {string} [desc]
 * @property {string[]} [tags]
 * @property {string} [cat]
 * @property {boolean} [disabled]
 * @property {boolean} [hidden]
 * @property {string[]} [events]
 * @property {import('./roles.js').Role[]} [roles]
 * @property {number} [timeout]
 * @property {boolean} [noPrefix]
 * @property {(ctx: import('./context.js').Ctx) => Promise<Reason> | Reason} [midware]
 * @property {(ctx: import('./context.js').Ctx) => Promise<void>} exec
 * @property {(ctx: import('./context.js').Ctx, reason: Reason) => Promise<void>} [final]
 * @property {string} [location]
 */

/**
 * Plugin class for handling event as listener or command
 */
export class Plugin {
  /** @param {PluginOpts} opts */
  constructor(opts) {
    /** @type {import('./handler.js').Handler|undefined} */
    this.handler = undefined;

    /** @type {import('baileys').WASocket|undefined} */
    this.sock = undefined;

    /** @type {string|string[]|undefined}*/
    this.cmd = opts?.cmd;

    /** @type {string} */
    this.prefix = opts?.prefix;

    /** @type {boolean} */
    this.noPrefix = opts?.noPrefix;

    /** @type {string|undefined} */
    this.desc = opts?.desc;

    /** @type {string[]|undefined} */
    this.tags = opts?.tags;

    /** @type {string} */
    this.cat = opts?.cat || "uncategorized";

    /** @type {boolean} */
    this.disabled = opts?.disabled;

    /** @type {boolean} */
    this.hidden = opts?.hidden;

    /** @type {string[]|undefined} */
    this.events = opts?.events;

    /** @type {string[]} */
    this.roles = opts?.roles ?? [];
    if (!Array.isArray(this.roles)) throw new Error("Roles must be an array");

    /** @type {number|any} Timeout in second */
    this.timeout = opts?.timeout;

    /** @type {((ctx: import('./context.js').Ctx) => Promise<Reason>)|undefined} */
    this.midware = opts?.midware;

    /** @type {(ctx: import('./context.js').Ctx) => Promise<void>} */
    this.exec = opts?.exec;

    /** @type {((ctx: import('./context.js').Ctx, reason: Reason) => Promise<void>)|undefined} */
    this.final = opts?.final;

    /** @type {string|undefined} */
    this.location = opts?.location;
  }

  /**
   * Checker before execution
   * @param {import('./context.js').Ctx} ctx
   * @return {Promise<Reason>}
   */
  async check(ctx) {
    const reason = new Reason({
      success: true,
      code: "plugin-checker",
      author: this.location,
      message: `This plugin is ready to execute`,
    });

    if (this.disabled)
      return reason
        .setBad()
        .setCode("plugin-disabled")
        .setMessage(`This plugin is disabled`);

    if (this.timeout > 0) {
      const diff = Date.now() - ctx.timestamp;
      if (diff > this.timeout * 1000)
        return reason
          .setBad()
          .setCode("plugin-timeout")
          .setMessage(`This plugin is timed out`);
    }

    if (this.events && !this.events?.includes(ctx.eventName)) {
      return reason
        .setBad()
        .setCode("event-type")
        .setMessage("Event type not match");
    }

    if (this.roles?.length > 0) {
      const user = ctx.user();
      if (!user?.roles?.length) {
        return reason
          .setBad()
          .setCode("plugin-user-empty-role")
          .setMessage("User has no role");
      } else {
        const pluginRoles = this.roles.map((r) =>
          typeof r === "string" ? nameToLevel(r) : r,
        );
        const userRoles = user?.roles?.map((r) =>
          typeof r === "string" ? nameToLevel(r) : r,
        );
        const minLevelPlugin = Math.min(...pluginRoles);
        const maxLevelUser = Math.max(...userRoles);
        if (minLevelPlugin > maxLevelUser) {
          return reason
            .setBad()
            .setCode("plugin-user-role-not-match")
            .setMessage("User role not match");
        }
      }
    }

    if (this.midware) {
      return new Reason(await this.midware(ctx));
    }
    return reason;
  }
}
