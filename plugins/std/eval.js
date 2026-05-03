/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Role } from "../../src/roles.js";

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: [">"],
  cat: "system",
  tags: ["system"],
  desc: "Evaluate JavaScript code",
  roles: [Role.SUPERADMIN],

  exec: async (c) => {
    const src = c.args?.trim();
    if (!src) {
      return await c.react("⁉️");
    }

    try {
      /* biome-ignore lint/security/noGlobalEval: it's a feature */
      let res = await eval(`(async () => { ${src} })()`);
      if (!res) {
        return await c.react("❔");
      }

      if (typeof res === "object" && !(res instanceof Buffer))
        res = JSON.stringify(res, null, 2);

      await c.reply({ text: `${res}` }, { quoted: c.event });
    } catch (e) {
      await c.react("‼️");
      await c.reply({ text: `${e}` }, { quoted: c.event });
    }
  },
};
