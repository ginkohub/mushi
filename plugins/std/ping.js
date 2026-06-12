/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { formatElapse, MESSAGES_UPSERT, Role, translate } from "#mushi";

const t = translate({
  en: {
    late: "*⏱️ Latency:* {val}",
    resp: "*⏱️ Response:* {val}",
  },
  id: {
    late: "*⏱️ Latensi:* {val}",
    resp: "*⏱️ Respon:* {val}",
  },
});

/** @type {import('#mushi').Plugin} */
export default {
  name: "std-ping",
  cmd: ["ping", "p"],
  timeout: 120,
  cat: "system",
  tags: ["system"],
  desc: "Ping the bot and get the response time.",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],
  exec: async (c) => {
    const current = Date.now();
    let latency = current - c.timestamp;

    let text = t("late", { val: formatElapse(latency) }, c);

    const beforeSend = Date.now();
    const resp = await c.reply({ text }, { quoted: c.event });
    const afterSend = Date.now();

    latency = afterSend - beforeSend;
    text += `\n${t("resp", { val: formatElapse(latency) }, c)}`;
    return await c.reply({
      text: text,
      edit: resp.key,
    });
  },
};
