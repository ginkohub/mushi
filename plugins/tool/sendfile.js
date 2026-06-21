/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { existsSync, readFileSync } from "node:fs";
import { MESSAGES_UPSERT, Role, translate } from "#mushi";

const t = translate({
  en: {
    usage: "❌ Usage: `.sf <filepath>`\nExample: `.sf ./media/photo.jpg`",
    not_found: "❌ File not found: `{path}`",
    error: "❌ Error: {msg}",
  },
  id: {
    usage: "❌ Penggunaan: `.sf <filepath>`\nContoh: `.sf ./media/photo.jpg`",
    not_found: "❌ Berkas tidak ditemukan: `{path}`",
    error: "❌ Galat: {msg}",
  },
});

/** @type {import('#mushi').Plugin} */
export default {
  name: "tool-sendfile",
  cmd: ["sf", "sendfile"],
  cat: "tool",
  tags: ["file", "utility"],
  desc: "Send a local file as a document",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],
  exec: async (c) => {
    const filepath = (c.args || "").trim();
    if (!filepath) {
      return await c.reply(
        { text: t("usage", {}, c) },
        { quoted: c.event },
      );
    }

    if (!existsSync(filepath)) {
      return await c.reply(
        { text: t("not_found", { path: filepath }, c) },
        { quoted: c.event },
      );
    }

    try {
      const buffer = readFileSync(filepath);
      const filename = filepath.split("/").pop() || "file";
      const ext = filename.includes(".") ? filename.split(".").pop() : "";

      await c.reply(
        {
          document: buffer,
          fileName: filename,
          mimetype: ext ? undefined : "application/octet-stream",
        },
        { quoted: c.event },
      );
    } catch (e) {
      c.log().error(`sendfile-error: ${e.message}`);
      await c.reply({ text: t("error", { msg: e.message }, c) }, { quoted: c.event });
    }
  },
};
