/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { MESSAGES_UPSERT } from "../../src/const.js";
import { Role } from "../../src/roles.js";
import { formatElapse } from "../../src/tools.js";
import { translate } from "../settings.js";

const t = translate({
  en: {
    late: "*⏱️ Latency:* {val}",
    resp: "*⏱️ Response:* {val}",
  },
  id: {
    late: "*⏱️ Laten:* {val}",
    resp: "*⏱️ Respon:* {val}",
  },
});

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ["ping", "p"],
  timeout: 120,
  cat: "system",
  tags: ["system"],
  desc: "Ping the bot and get the response time.",
  events: [MESSAGES_UPSERT],
  roles: [Role.GUEST],
  exec: async (c) => {
    const current = Date.now();
    let latency = current - c.timestamp;

    let text = t("late", { val: formatElapse(latency) });

    const beforeSend = Date.now();
    const resp = await c.reply({ text }, { quoted: c.event });
    const afterSend = Date.now();

    latency = afterSend - beforeSend;
    text += `\n${t("resp", { val: formatElapse(latency) })}`;
    return await c.reply({
      text: text,
      edit: resp.key,
    });
  },
};
