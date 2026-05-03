/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { CALL, MESSAGES_UPSERT } from "../../src/const.js";
import { midwareAnd } from "../../src/midware.js";
import pen from "../../src/pen.js";
import { Role } from "../../src/roles.js";
import { delay, randomNumber } from "../../src/tools.js";
import { settings, translate } from "../settings.js";

const AUTO_REJECT_KEY = "auto_reject";

const t = translate({
  en: {
    status: "📵 *Auto reject status* : *{val}*",
    nb: "NB :",
    deactivating: " `{pattern}-` _to deactivating_",
    activating: " `{pattern}+` _to activating_",
  },
  id: {
    status: "📵 *Status tolak otomatis* : *{val}*",
    nb: "Catatan :",
    deactivating: " `{pattern}-` _untuk menonaktifkan_",
    activating: " `{pattern}+` _untuk mengaktifkan_",
  },
});

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    desc: "Auto reject call",
    timeout: 0,
    events: [CALL],

    midware: midwareAnd(
      (ctx) => ({ success: !ctx.isStatus }),
      (ctx) => ({ success: !ctx.fromMe }),
      (_) => ({ success: settings.get(AUTO_REJECT_KEY) }),
    ),

    exec: async (c) => {
      if (c.callStatus !== "offer") return;

      await delay(randomNumber(1000, 2000));
      pen.Warn("Rejecting call from", c.senderName, c.sender);

      await c.handler().client.sock.rejectCall(c.id, c.sender);
    },
  },

  {
    cmd: ["reject", "reject+", "reject-"],
    cat: "whatsapp",
    desc: "Set auto reject message",
    events: [MESSAGES_UPSERT],
    roles: [Role.SUPERADMIN],
    exec: async (c) => {
      let pattern = c.pattern;
      const tail = c.pattern.slice(-1);
      switch (tail) {
        case "+": {
          settings.set(AUTO_REJECT_KEY, true);
          pattern = c.pattern.slice(0, -1);
          pen.Warn(`Activating auto reject for ${c.me}`);
          break;
        }

        case "-": {
          settings.set(AUTO_REJECT_KEY, false);
          pattern = c.pattern.slice(0, -1);
          pen.Warn(`Deactivating auto reject for ${c.me}`);
          break;
        }
      }

      let set = settings.get(AUTO_REJECT_KEY);
      if (!set) set = false;
      const texts = [];
      texts.push(t("status", { val: set }));

      texts.push(
        "",
        t("nb"),
        t("deactivating", { pattern }),
        t("activating", { pattern }),
      );
      await c.reply({ text: texts.join("\n") }, { quoted: c.event });
    },
  },
];
