/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import path from "node:path";

import { logger } from "./logger.js";
import { BotManager } from "./manager.js";
import { RegistryEvents } from "./registry.js";
import { getRoleLevelBadge, rolesToLevel } from "./roles.js";

/**
 * @param {Record<string, any>} items
 * @returns {string[]|undefined}
 */
function parseItems(items) {
  if (!items) {
    return;
  }

  const parsedItems = [];
  for (const [key, val] of Object.entries(items)) {
    const roles = rolesToLevel(val.roles) || [];
    const rolesMax = roles.length > 0 ? Math.max(...roles) : 0;
    parsedItems.push(`${key}:${getRoleLevelBadge(rolesMax)}`);
  }
  return parsedItems;
}

/**
 * Create a bot manager with plugins loaded
 * @param {Object} opts
 * @param {string} [opts.baseDir] - Base directory for bot data
 * @param {string} [opts.pluginDir] - Plugin directory
 * @returns {BotManager}
 */
export function createManager(opts = {}) {
  const baseDir = opts.baseDir || path.resolve(process.cwd(), "data");
  const pluginDir = opts.pluginDir || path.resolve(process.cwd(), "plugins");

  return new BotManager({
    baseDir,
    pluginDir,
    registryListeners: {
      [RegistryEvents.PLUGIN_LOAD]: async (item) => {
        const filename = path.basename(item.location);
        logger.info(
          `Load: ${filename} ${item?.estimate || 0}ms${parseItems(item?.items)?.map((i) => `\n  - ${i}`)}`,
        );
      },
    },
  });
}

/**
 * Default bot manager instance
 */
export const manager = createManager({
  baseDir: path.resolve(process.cwd(), "data"),
  pluginDir: path.resolve(process.cwd(), "plugins"),
});

export { BotManager, logger };
