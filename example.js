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
import { Browsers } from "baileys";
import pino from "pino";
import { ClientEvents } from "./src/client.js";
import { BotManager } from "./src/manager.js";
import pen from "./src/pen.js";
import { RegistryEvents } from "./src/registry.js";
import { getRoleLevelBadge, RoleLevel, rolesToLevel } from "./src/roles.js";
import { isBun, isDeno } from "./src/tools.js";

/* Load environment variables from .env file */
try {
  if (isDeno) {
    const { load } = await import("jsr:@std/dotenv");
    await load({ export: true });
  } else {
    if (!isBun) {
      const { loadEnvFile } = await import("node:process");
      loadEnvFile();
    }
  }
} catch (e) {
  pen.Debug("loadEnvFile", e.message);
}

function parseItems(items) {
  if (!items) {
    return;
  }

  const parsedItems = [];
  for (const [key, val] of Object.entries(items)) {
    const roles = rolesToLevel(val.roles) || [];
    const rolesMax = roles.length > 0 ? Math.max(...roles) : RoleLevel.guest;
    parsedItems.push(`${key}:${getRoleLevelBadge(rolesMax)}`);
  }
  return parsedItems;
}

const manager = new BotManager({
  baseDir: path.resolve(process.cwd(), "data"),
  pluginDir: path.resolve(process.cwd(), "plugins"),
  registryListeners: {
    [RegistryEvents.PLUGIN_LOAD]: async (item) => {
      const filename = path.basename(item.location);
      pen.Info(
        `Load: ${pen.MagentaBr(filename)} ${item?.estimate || 0}ms${parseItems(item?.items)?.map((i) => `\n  - ${i}`)}`,
      );
    },
  },
});

const mainBot = manager.addBot({
  name: "example",
  method: process.env.METHOD || "otp",
  phone: process.env.PHONE || "",
  socketCofig: {
    browser: Browsers.macOS(process.env.BROWSER || "Safari"),
    logger: pino({ level: "silent" }),
    syncFullHistory: false,
    version: [2, 3000, 1038162681],
  },
  prefixes: [".", "/"],
  /* plugins: ["std-log", "std-ping", "dev-dump"], */
});

mainBot.on(ClientEvents.CONNECTED, async () => {
  pen.Info("Connected");
});

try {
  await manager.connectAll();
} catch (e) {
  pen.Error(e);
}
