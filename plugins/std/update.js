/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { MESSAGES_UPSERT } from "../../src/const.js";
import { Role } from "../../src/roles.js";

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  name: "std-update",
  cmd: ["update"],
  cat: "system",
  tags: ["system"],
  desc: "Execute git fetch and pull command shell command, also removing git lock files before execution.",
  events: [MESSAGES_UPSERT],
  roles: [Role.SUPERADMIN],

  exec: async (c) => {
    await c.react("⌛");
    let hasStashed = false;
    try {
      let isLocked = false;
      const force = c.argv?.f || c.argv?.force || false;

      const branch = execSync("git rev-parse --abbrev-ref HEAD")
        ?.toString()
        .trim();
      const lockFiles = [
        ".git/index.lock",
        ".git/HEAD.lock",
        `.git/refs/heads/${branch}.lock`,
      ];
      for (const lf of lockFiles) {
        if (existsSync(lf)) {
          isLocked = isLocked || true;
          unlinkSync(lf);
        }
      }

      if (isLocked || force) {
        await c.react("🔒");
        execSync("git stash");
        hasStashed = true;
      }

      const src = `git fetch ; git pull origin ${branch}`;
      let stdout = execSync(src);
      stdout = stdout?.toString();

      if (stdout && stdout?.length > 0) {
        return await c.reply(
          { text: `${stdout.toString()}`.trim() },
          { quoted: c.event },
        );
      } else {
        return await c.reply(
          { text: "Update completed successfully." },
          { quoted: c.event },
        );
      }
    } catch (e) {
      await c.react("❌");
      await c.reply({ text: `${e}` }, { quoted: c.event });
    } finally {
      if (hasStashed) {
        try {
          execSync("git stash pop");
        } catch {
          /* ignore */
        }
      }
      await c.react("");
    }
  },
};
