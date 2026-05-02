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

/**
 * A middleware function that checks if at least one of the provided middlewares passes.
 *
 * @param {...((ctx: import('./context.js').Ctx) => Promise<Reason> | Reason)} midwares - The middlewares to check.
 * @returns {(ctx: import('./context.js').Ctx) => Promise<Reason>} A middleware function.
 */
export function midwareOr(...midwares) {
  return async (ctx) => {
    for (const midware of midwares) {
      const result = new Reason(await midware(ctx));
      if (result?.success) {
        return result;
      }
    }
    return new Reason({
      success: false,
      code: "midware-or",
      author: import.meta.url,
      message: "Forbidden",
    });
  };
}

/**
 * A middleware function that checks if all of the provided middlewares pass.
 *
 * @param {...((ctx: import('./context.js').Ctx) => Promise<Reason> | Reason)} midwares - The middlewares to check.
 * @returns {(ctx: import('./context.js').Ctx) => Promise<Reason>} A middleware function.
 */
export function midwareAnd(...midwares) {
  return async (ctx) => {
    for (const midware of midwares) {
      const result = new Reason(await midware(ctx));
      if (!result?.success) {
        return result;
      }
    }
    return new Reason({
      success: true,
      code: "midware-and",
      author: import.meta.url,
      message: "OK",
    });
  };
}

/**
 * A middleware function that checks if the event name is one of the provided names.
 *
 * @param {...string} names - The event names to check.
 * @returns {(ctx: import('./context.js').Ctx) => Promise<Reason>} A middleware function.
 */
export function eventNameIs(...names) {
  return async (ctx) => {
    return new Reason({
      success: names?.includes(ctx?.eventName),
      code: "midware-event-name-is",
      author: import.meta.url,
      message: "Event name is not allowed",
    });
  };
}

/**
 * A middleware function that checks if the message is from the bot itself.
 *
 * @param {import('./context.js').Ctx} ctx - The context object.
 * @returns {Reason} A reason object.
 */
export function fromMe(ctx) {
  return new Reason({
    success: !!ctx?.fromMe,
    code: 403,
    author: import.meta.url,
    message: "It is not from me",
  });
}

/**
 * A middleware function that checks if the message is from a group.
 *
 * @param {import('./context.js').Ctx} ctx - The context object.
 * @returns {Reason} A reason object.
 */
export function isGroup(ctx) {
  return new Reason({
    success: !!ctx?.isGroup,
    code: "is-group",
    author: import.meta.url,
    message: "It is not from a group",
  });
}

/**
 * A middleware function that checks if the message is from a private chat.
 *
 * @param {import('./context.js').Ctx} ctx - The context object.
 * @returns {Reason} A reason object.
 */
export function isPrivate(ctx) {
  return new Reason({
    success: !ctx?.isGroup,
    code: "is-private",
    author: import.meta.url,
    message: "It is not from a private chat",
  });
}

/**
 * A middleware function that checks if the message is a status message.
 *
 * @param {import('./context.js').Ctx} ctx - The context object.
 * @returns {Reason} A reason object.
 */
export function isStatus(ctx) {
  return new Reason({
    success: !!ctx?.isStatus,
    code: "is-status",
    author: import.meta.url,
    message: "It is not a status message",
  });
}
