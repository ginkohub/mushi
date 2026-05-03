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

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  desc: "Track message statistics for users",
  events: [MESSAGES_UPSERT],
  exec: async (c) => {
    if (!c.senderJid || !c.type) return;

    const user = c.handler().userManager.getUser(c.senderJid);
    if (!user) return;

    if (!user.stats) user.stats = {};
    user.stats[c.type] = (user.stats[c.type] || 0) + 1;

    c.handler().userManager.updateUser(c.senderJid, { stats: user.stats });
  },
};
