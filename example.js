/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import pen from "./src/pen.js";
import { Wangsaf } from "./src/client.js";
import { Handler } from "./src/handler.js";
import { StoreJson } from "./src/store.js";
import { getFile } from "./src/data.js";
import { Browsers } from "baileys";
import pino from "pino";
import path from "node:path";
import { isBun, isDeno } from "./src/tools.js";

/* Load environment variables from .env file */
try {
  if (isDeno) {
    const { load } = await import('jsr:@std/dotenv');
    await load({ export: true });
  } else {
    if (!isBun) {
      const { loadEnvFile } = await import("process");
      loadEnvFile();
    }
  }
} catch (e) {
  pen.Debug('loadEnvFile', e.message);
}

const wea = new Wangsaf({
  dataDir: 'data',
  phone: process.env.PHONE ?? '',
  method: /** @type {any} */ (process.env.METHOD ?? 'otp'),
  session: process.env.SESSION ?? 'sesi',
  browser: Browsers.macOS(process.env.BROWSER ?? 'Safari'),
  handler: new Handler({
    pluginDir: process.env.PLUGIN_DIR ?? path.resolve(process.cwd() + '/plugins'),
    groupCache: new StoreJson({ saveName: getFile('group_metadata.json'), autoSave: true }),
    contactCache: new StoreJson({ saveName: getFile('contacts.json'), autoSave: true }),
    timerCache: new StoreJson({ saveName: getFile('timer.json'), autoSave: true }),
  }),
  socketOptions: {
    logger: pino({ level: 'silent' })
  },
  retry: true
});

try {
  wea.connect();
} catch (e) {
  pen.Error(e)
  wea.connect();
}




