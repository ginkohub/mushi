/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { MESSAGES_UPSERT, Role, translate } from "#mushi";

/**
 * Credits to Wikipedia for the API and data.
 */

const t = translate({
  en: {
    help_title: "📚 *WIKIPEDIA SEARCH*",
    help_usage: "Use `.wiki [query]` to search on Wikipedia.",
    help_example: "💡 *Example:* `.wiki Albert Einstein`",
    not_found: '❌ Information about *"{query}"* not found!',
    api_error: "❌ Failed to fetch data from Wikipedia.",
    read_more: "🔗 *Read more:*",
  },
  id: {
    help_title: "📚 *PENCARIAN WIKIPEDIA*",
    help_usage: "Gunakan `.wiki [kueri]` untuk mencari di Wikipedia.",
    help_example: "💡 *Contoh:* `.wiki Borobudur`",
    not_found: '❌ Informasi tentang *"{query}"* tidak ditemukan!',
    api_error: "❌ Gagal memuat data dari Wikipedia.",
    read_more: "🔗 *Baca selengkapnya:*",
  },
});

export default {
  name: "std-wiki",
  cmd: ["wiki", "wikipedia"],
  cat: "tool",
  tags: ["info", "search"],
  desc: "Search for information on Wikipedia",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],

  exec: async (c) => {
    const query = (c.args || "").trim();

    if (!query || query === "?") {
      const helpText = [
        t("help_title", {}, c),
        "",
        t("help_usage", {}, c),
        t("help_example", {}, c),
      ];
      return await c.reply({ text: helpText.join("\n") }, { quoted: c.event });
    }

    const lang =
      c.user?.lang ||
      c.chatData?.lang ||
      c.client()?.settings.get("lang") ||
      "id";

    try {
      // Wikipedia REST API for summary
      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/\s+/g, "_"))}`;
      c.log().info(`wiki-fetching: ${url}`);

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "MushiBot/0.0.2 (https://github.com/ginkohub/mushi; ginkohub@example.com)",
        },
      });

      if (res.status === 404) {
        return await c.reply(
          { text: t("not_found", { query }, c) },
          { quoted: c.event },
        );
      }

      if (!res.ok) throw new Error(`Wikipedia error: ${res.status}`);

      const data = await res.json();

      const results = [
        `*${data.title}*`,
        "",
        data.extract,
        "",
        `${t("read_more", {}, c)} ${data.content_urls.desktop.page}`,
      ];

      if (data.thumbnail?.source) {
        await c.reply(
          {
            image: { url: data.thumbnail.source },
            caption: results.join("\n"),
          },
          { quoted: c.event },
        );
      } else {
        await c.reply({ text: results.join("\n") }, { quoted: c.event });
      }
    } catch (e) {
      c.log().error(`wiki-error: ${e.stack || e}`);
      if (e.cause) c.log().error(`wiki-error-cause: ${e.cause}`);
      await c.reply({ text: t("api_error", {}, c) }, { quoted: c.event });
    }
  },
};
