/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { loadEnvFile } from 'process';
import pen from './src/pen.js';
import { Wangsaf } from './src/client.js';
import { Handler } from './src/handler.js';
import { Browsers } from 'baileys';
import pino from 'pino';
import path from 'path';
import { PluginManager } from './src/manager.js';

/* Load environment variables from .env file */
try {
  loadEnvFile();
} catch (e) {
  pen.Debug('loadEnvFile', e.message);
}

export const pm = new PluginManager({
  pluginDir: path.join(import.meta.dirname, 'plugins/'),
});

const wea = new Wangsaf({
  dataDir: 'data',
  phone: process.env.PHONE ?? '',
  method: process.env.METHOD ?? 'otp',
  session: process.env.SESSION ?? 'sesi',
  browser: Browsers.macOS(process.env.BROWSER ?? 'Safari'),
  handler: new Handler({
    pluginManager: pm,
    filter: null,
  }),
  socketOptions: {
    logger: pino({ level: 'silent' })
  },
  retry: true
});

try {
  wea.connect();
  wea.disconnect();
} catch (e) {
  pen.Error(e)
  wea.connect();
}




