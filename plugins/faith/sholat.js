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
import { translate } from "../../src/translate.js";

const t = translate({
  en: {
    help_title: "🕌 *PRAYER SCHEDULE*",
    help_usage: "Use `.sholat [city_name]` to view prayer times.",
    help_example: "💡 *Example:* `.sholat jakarta` or `.sholat surabaya`",
    not_found: '❌ City *"{query}"* not found!',
    api_error: "❌ Failed to fetch prayer times.",
    header: "🕌 *PRAYER TIMES ({location})*",
    date: "📅 *Date:* {date}",
    search_title: "🔍 *CITY SEARCH RESULTS ({query})*",
    search_item: "{index}. *{lokasi}* (ID: {id})",
    search_footer:
      "_Reply to this message with a number (e.g., `1`) to view its prayer schedule._",
    help_title_cari: "🔍 *CITY SEARCH*",
    help_usage_cari: "Use `.sholat? [city_name]` to search for city codes.",
    help_example_cari: "💡 *Example:* `.sholat? kediri` or `.sholat? surabaya`",
    api_error_cari: "❌ Failed to search city.",
  },
  id: {
    help_title: "🕌 *JADWAL SHOLAT*",
    help_usage: "Gunakan `.sholat [nama_kota]` untuk melihat jadwal sholat.",
    help_example: "💡 *Contoh:* `.sholat jakarta` atau `.sholat surabaya`",
    not_found: '❌ Kota *"{query}"* tidak ditemukan!',
    api_error: "❌ Gagal memuat jadwal sholat.",
    header: "🕌 *JADWAL SHOLAT ({location})*",
    date: "📅 *Tanggal:* {date}",
    search_title: "🔍 *HASIL PENCARIAN KOTA ({query})*",
    search_item: "{index}. *{lokasi}* (ID: {id})",
    search_footer:
      "_Balas pesan ini dengan angka urutan (contoh: `1`) untuk melihat jadwal sholat._",
    help_title_cari: "🔍 *CARI KOTA*",
    help_usage_cari: "Gunakan `.sholat? [nama_kota]` untuk mencari kode kota.",
    help_example_cari:
      "💡 *Contoh:* `.sholat? kediri` atau `.sholat? surabaya`",
    api_error_cari: "❌ Gagal mencari kota.",
  },
});

const searchSessions = new Map();

async function sendPrayerSchedule(c, city) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    const scheduleUrl = `https://api.myquran.com/v3/sholat/jadwal/${city.id}/${dateStr}`;
    const scheduleRes = await fetch(scheduleUrl);
    if (!scheduleRes.ok) throw new Error("Schedule failed");
    const scheduleData = await scheduleRes.json();

    if (!scheduleData.status || !scheduleData.data) {
      return await c.reply(
        { text: t("api_error", {}, c) },
        { quoted: c.event },
      );
    }

    const info = scheduleData.data;
    const j = info.jadwal[dateStr];

    const texts = [
      t("header", { location: `${info.kabko}, ${info.prov}` }, c),
      t("date", { date: j.tanggal }, c),
      "",
      `- *Imsak:* ${j.imsak}`,
      `- *Subuh:* ${j.subuh}`,
      `- *Terbit:* ${j.terbit}`,
      `- *Dhuha:* ${j.dhuha}`,
      `- *Dzuhur:* ${j.dzuhur}`,
      `- *Ashar:* ${j.ashar}`,
      `- *Maghrib:* ${j.maghrib}`,
      `- *Isya:* ${j.isya}`,
      "",
      c.prefix
        ? `_Ketik \`${c.prefix}sholat <nama_kota>\` untuk mencari kota lain._`
        : `_Ketik \`.sholat <nama_kota>\` untuk mencari kota lain._`,
    ];

    return await c.reply({ text: texts.join("\n") }, { quoted: c.event });
  } catch (e) {
    c.log().error(`sholat-send-error: ${e.stack || e}`);
    return await c.reply({ text: t("api_error", {}, c) }, { quoted: c.event });
  }
}

export default [
  {
    name: "faith-sholat",
    cmd: ["sholat", "jadwalsholat"],
    includes: ["faith-sholat-cari", "faith-sholat-listener"],
    cat: "faith",
    tags: ["info"],
    desc: "Get daily prayer times schedule",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      const hasQuery = !!c.args && c.args.trim().length > 0;
      const query = (hasQuery ? c.args : "jakarta").trim();

      if (query === "?") {
        const helpText = [
          t("help_title", {}, c),
          "",
          t("help_usage", {}, c),
          t("help_example", {}, c),
        ];
        return await c.reply(
          { text: helpText.join("\n") },
          { quoted: c.event },
        );
      }

      try {
        const key = query.toLowerCase();
        const store = c.client().store.use("sholat_cities");
        await store.waitReady();
        let city = store.get(key);

        if (!city) {
          const searchUrl = `https://api.myquran.com/v3/sholat/kabkota/cari/${encodeURIComponent(query)}`;
          const searchRes = await fetch(searchUrl);
          if (!searchRes.ok) throw new Error("Search failed");
          const searchData = await searchRes.json();

          if (
            !searchData.status ||
            !searchData.data ||
            searchData.data.length === 0
          ) {
            return await c.reply(
              { text: t("not_found", { query }, c) },
              { quoted: c.event },
            );
          }

          city = searchData.data[0];
          store.set(key, city);
          for (const item of searchData.data) {
            store.set(item.lokasi.toLowerCase(), item);
          }
        }

        return await sendPrayerSchedule(c, city);
      } catch (e) {
        c.log().error(`sholat-error: ${e.stack || e}`);
        return await c.reply(
          { text: t("api_error", {}, c) },
          { quoted: c.event },
        );
      }
    },
  },
  {
    name: "faith-sholat-cari",
    cmd: ["sholat?", "jadwalsholat?"],
    cat: "faith",
    tags: ["info"],
    desc: "Search for prayer times city codes",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      const query = (c.args || "").trim();

      if (!query || query === "?") {
        const helpText = [
          t("help_title_cari", {}, c),
          "",
          t("help_usage_cari", {}, c),
          t("help_example_cari", {}, c),
        ];
        return await c.reply(
          { text: helpText.join("\n") },
          { quoted: c.event },
        );
      }

      try {
        const searchUrl = `https://api.myquran.com/v3/sholat/kabkota/cari/${encodeURIComponent(query)}`;
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) throw new Error("Search failed");
        const searchData = await searchRes.json();

        if (
          !searchData.status ||
          !searchData.data ||
          searchData.data.length === 0
        ) {
          return await c.reply(
            { text: t("not_found", { query }, c) },
            { quoted: c.event },
          );
        }

        const store = c.client().store.use("sholat_cities");
        await store.waitReady();
        for (const item of searchData.data) {
          store.set(item.lokasi.toLowerCase(), item);
        }
        store.set(query.toLowerCase(), searchData.data[0]);

        const prefix = c.prefix || ".";
        const resultsText = [
          t("search_title", { query }, c),
          "",
          ...searchData.data.map((item, idx) =>
            t(
              "search_item",
              { index: idx + 1, lokasi: item.lokasi, id: item.id },
              c,
            ),
          ),
          "",
          t("search_footer", { prefix }, c),
        ];

        const resp = await c.reply(
          { text: resultsText.join("\n") },
          { quoted: c.event },
        );

        if (searchSessions.has(c.chat)) {
          clearTimeout(searchSessions.get(c.chat).timeout);
        }

        const timeout = setTimeout(() => {
          searchSessions.delete(c.chat);
        }, 60000);

        searchSessions.set(c.chat, {
          messageId: resp.key.id,
          cities: searchData.data,
          timeout,
        });
      } catch (e) {
        c.log().error(`sholat-search-error: ${e.stack || e}`);
        return await c.reply(
          { text: t("api_error_cari", {}, c) },
          { quoted: c.event },
        );
      }
    },
  },
  {
    name: "faith-sholat-listener",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!searchSessions.has(c.chat) || c.isCMD) return;

      const session = searchSessions.get(c.chat);

      if (c.stanzaId !== session.messageId) return;

      const userText = c.text?.trim();
      const index = Number.parseInt(userText, 10) - 1;

      if (Number.isNaN(index) || index < 0 || index >= session.cities.length) {
        return;
      }

      clearTimeout(session.timeout);
      searchSessions.delete(c.chat);

      const city = session.cities[index];
      return await sendPrayerSchedule(c, city);
    },
  },
];
