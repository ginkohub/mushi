/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import pino from "pino";

import { ClientEvents, Method } from "./src/client.js";
import { logger, manager } from "./src/index.js";

const mainBot = await manager.addBot({
  name: "example",
  method: process.env.METHOD || Method.QRCode,
  phone: process.env.PHONE || "",
  socketConfig: {
    browser: process.env.BROWSER || "Safari",
    logger: pino({ level: "fatal" }),
    syncFullHistory: false,
  },
  prefixes: [".", "/"],
});

mainBot.on(ClientEvents.CONNECTED, async () => {
  logger.info("Connected");
});

mainBot.connect();
