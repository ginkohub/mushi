/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getFile, MESSAGES_UPSERT, Role, translate } from "#mushi";

const t = translate({
  en: {
    help_title: "🏴 *GUESS THE FLAG (TEBAK BENDERA)*",
    help_desc: "Guess the country name based on the flag!",
    help_usage: "Use `.tebakbendera` or `.tb` to start.",
    help_important: "⚠️ *Important:*",
    help_reply: "- Must *Reply/Quote* the question to answer.",
    help_timeout_hint: "- Time limit is 45 seconds.",
    help_admin: "⚙️ *Admin:* `{prefix}tb.update` to sync flag list.",
    session_active: "❌ There is still an active game in this chat!",
    no_data: "❌ Flag data not found! Use `{prefix}tb.update` (Admin).",
    question_header: "🏴 *GUESS THE FLAG*",
    question_time: "⏱️ *Time:* 45 seconds",
    question_reward: "🎁 *Reward:* {xp} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply to this message to answer!_",
    timeout:
      "⌛ *Time's up!*\nThe answer was: *{answer}*\n📍 *Region:* {region}\n🏙️ *Capital:* {capital}\n\nReply _lagi/again/next_ to play again",
    sync_success: "✅ *Sync Success!*",
    sync_stats: "Successfully loaded {count} flags.",
    sync_failed: "❌ *Sync Failed:* {error}",
    correct:
      "🎉 *Congratulations* @{user}!\nYour answer is correct: *{answer}*\n📍 *Region:* {region}\n🏙️ *Capital:* {capital}\n\n🌟 *+{xp} XP*\n\nReply _lagi/again/next_ to play again, or _stop/nyerah_ to stop",
    stopped: "🛑 *Game stopped*",
  },
  id: {
    help_title: "🏴 *TEBAK BENDERA*",
    help_desc: "Tebak nama negara berdasarkan benderanya!",
    help_usage: "Gunakan perintah `.tebakbendera` atau `.tb` untuk memulai.",
    help_important: "⚠️ *Penting:*",
    help_reply: "- Harus *Reply/Quote* pesan soal untuk menjawab.",
    help_timeout_hint: "- Waktu menjawab adalah 45 detik.",
    help_admin: "⚙️ *Admin:* `{prefix}tb.update` untuk sinkronisasi bendera.",
    session_active: "❌ Masih ada permainan yang aktif di grup ini!",
    no_data:
      "❌ Data bendera tidak ditemukan! Gunakan `{prefix}tb.update` (Admin).",
    question_header: "🏴 *TEBAK BENDERA*",
    question_time: "⏱️ *Waktu:* 45 detik",
    question_reward: "🎁 *Hadiah:* {xp} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Balas pesan ini untuk menjawab!_",
    timeout:
      "⌛ *Waktu habis!*\nJawabannya adalah: *{answer}*\n📍 *Wilayah:* {region}\n🏙️ *Ibukota:* {capital}\n\nBalas _lagi/lanjut/again/next_ untuk main lagi",
    sync_success: "✅ *Sinkronisasi Berhasil!*",
    sync_stats: "Berhasil memuat {count} bendera.",
    sync_failed: "❌ *Sinkronisasi Gagal:* {error}",
    correct:
      "🎉 *Selamat* @{user}!\nJawaban kamu benar: *{answer}*\n📍 *Wilayah:* {region}\n🏙️ *Ibukota:* {capital}\n\n🌟 *+{xp} XP*\n\nBalas _lagi/lanjut/again/next_ untuk main lagi, atau _stop/nyerah_ untuk berhenti",
    stopped: "🛑 *Permainan dihentikan*",
  },
});

const BASE_URL =
  "https://raw.githubusercontent.com/ginkohub/game-assets/main/tebak-negara";
const JSON_URL = `${BASE_URL}/data.json`;

/** @type {Map<string, { answer: string, timeout: NodeJS.Timeout, xp: number, questionId: string, done: boolean, resultId: string, region: string, capital: string }>} */
const sessions = new Map();

const REPLAY_WORDS = new Set(["lagi", "lanjut", "again", "next"]);
const STOP_WORDS = new Set(["stop", "nyerah"]);
const REWARD_PER_CHAR = 10;

/** @type {{bendera: string, negara: string, wilayah: string, ibukota: string}[]} */
let flags = [];

function loadFlags() {
  try {
    const path = getFile("tebak_negara.json");
    if (existsSync(path)) {
      flags = JSON.parse(readFileSync(path, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load tebak_negara.json:", e);
  }
}

/** @type {Map<string, { answer: string, timeout: NodeJS.Timeout, xp: number, questionId: string, done: boolean, resultId: string, country: string, region: string }>} */
const capitalSessions = new Map();

const tCapital = translate({
  en: {
    help_title: "🏙️ *GUESS THE CAPITAL (TEBAK IBUKOTA)*",
    help_desc: "Guess the capital city of a country!",
    help_usage: "Use `.tebakibukota` or `.tbi` to start.",
    help_important: "⚠️ *Important:*",
    help_reply: "- Must *Reply/Quote* the question to answer.",
    help_timeout_hint: "- Time limit is 45 seconds.",
    help_admin: "⚙️ *Admin:* `{prefix}tbi.update` to sync country list.",
    session_active: "❌ There is still an active game in this chat!",
    no_data: "❌ Country data not found! Use `{prefix}tbi.update` (Admin).",
    question_header: "🏙️ *GUESS THE CAPITAL*",
    question_country: "🌍 *Country:* {country}",
    question_time: "⏱️ *Time:* 45 seconds",
    question_reward: "🎁 *Reward:* {xp} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply to this message to answer!_",
    timeout:
      "⌛ *Time's up!*\nThe capital of *{country}* is *{answer}*\n📍 *Region:* {region}\n\nReply _lagi/again/next_ to play again",
    sync_success: "✅ *Sync Success!*",
    sync_stats: "Successfully loaded {count} countries.",
    sync_failed: "❌ *Sync Failed:* {error}",
    correct:
      "🎉 *Congratulations* @{user}!\nThe capital of *{country}* is *{answer}*\n📍 *Region:* {region}\n\n🌟 *+{xp} XP*\n\nReply _lagi/again/next_ to play again, or _stop/nyerah_ to stop",
    stopped: "🛑 *Game stopped*",
  },
  id: {
    help_title: "🏙️ *TEBAK IBUKOTA*",
    help_desc: "Tebak ibu kota dari suatu negara!",
    help_usage: "Gunakan perintah `.tebakibukota` atau `.tbi` untuk memulai.",
    help_important: "⚠️ *Penting:*",
    help_reply: "- Harus *Reply/Quote* pesan soal untuk menjawab.",
    help_timeout_hint: "- Waktu menjawab adalah 45 detik.",
    help_admin:
      "⚙️ *Admin:* `{prefix}tbi.update` untuk sinkronisasi data negara.",
    session_active: "❌ Masih ada permainan yang aktif di grup ini!",
    no_data:
      "❌ Data negara tidak ditemukan! Gunakan `{prefix}tbi.update` (Admin).",
    question_header: "🏙️ *TEBAK IBUKOTA*",
    question_country: "🌍 *Negara:* {country}",
    question_time: "⏱️ *Waktu:* 45 detik",
    question_reward: "🎁 *Hadiah:* {xp} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Balas pesan ini untuk menjawab!_",
    timeout:
      "⌛ *Waktu habis!*\nIbu kota *{country}* adalah *{answer}*\n📍 *Wilayah:* {region}\n\nBalas _lagi/lanjut/again/next_ untuk main lagi",
    sync_success: "✅ *Sinkronisasi Berhasil!*",
    sync_stats: "Berhasil memuat {count} negara.",
    sync_failed: "❌ *Sinkronisasi Gagal:* {error}",
    correct:
      "🎉 *Selamat* @{user}!\nIbu kota *{country}* adalah *{answer}*\n📍 *Wilayah:* {region}\n\n🌟 *+{xp} XP*\n\nBalas _lagi/lanjut/again/next_ untuk main lagi, atau _stop/nyerah_ untuk berhenti",
    stopped: "🛑 *Permainan dihentikan*",
  },
});

function startCapitalGame(c) {
  if (flags.length === 0) {
    c.reply(
      { text: tCapital("no_data", { prefix: c.prefix }, c) },
      { quoted: c.event },
    );
    return;
  }

  const q = flags[Math.floor(Math.random() * flags.length)];
  const answer = q.ibukota.toLowerCase().trim();
  const xpReward = answer.length * REWARD_PER_CHAR;
  const imgUrl = `${BASE_URL}/${q.bendera}`;

  const caption = [
    tCapital("question_header", {}, c),
    "",
    tCapital("question_country", { country: q.negara }, c),
    "",
    tCapital("question_time", {}, c),
    tCapital("question_reward", { xp: xpReward }, c),
    "",
    tCapital("question_note", {}, c),
    tCapital("question_reply", {}, c),
  ].join("\n");

  c.reply({ image: { url: imgUrl }, caption }, { quoted: c.event }).then(
    (resp) => {
      if (!resp) return;
      const timeout = setTimeout(() => {
        const s = capitalSessions.get(c.chat);
        if (!s || s.done) return;
        s.done = true;
        c.reply(
          {
            text: tCapital(
              "timeout",
              { country: q.negara, answer: q.ibukota, region: q.wilayah },
              c,
            ),
          },
          { quoted: c.event },
        ).then((r) => {
          if (r) s.resultId = r.key.id;
        });
      }, 45000);

      capitalSessions.set(c.chat, {
        answer,
        timeout,
        xp: xpReward,
        questionId: resp.key.id,
        done: false,
        resultId: "",
        country: q.negara,
        region: q.wilayah,
      });
    },
  );
}

loadFlags();

async function autoFetch(c) {
  try {
    const res = await fetch(JSON_URL);
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data)) return;
    const path = getFile("tebak_negara.json");
    writeFileSync(path, JSON.stringify(data, null, 2));
    flags = data;
    c.log().info(`auto-fetched ${data.length} countries`);
  } catch (e) {
    c.log().error(`auto-fetch failed: ${e.message}`);
  }
}

function startGame(c) {
  if (flags.length === 0) {
    c.reply(
      { text: t("no_data", { prefix: c.prefix }, c) },
      { quoted: c.event },
    );
    return;
  }

  const q = flags[Math.floor(Math.random() * flags.length)];
  const answer = q.negara.toLowerCase().trim();
  const xpReward = answer.length * REWARD_PER_CHAR;
  const imgUrl = `${BASE_URL}/${q.bendera}`;

  const caption = [
    t("question_header", {}, c),
    "",
    t("question_time", {}, c),
    t("question_reward", { xp: xpReward }, c),
    "",
    t("question_note", {}, c),
    t("question_reply", {}, c),
  ].join("\n");

  c.reply({ image: { url: imgUrl }, caption }, { quoted: c.event }).then(
    (resp) => {
      if (!resp) return;
      const timeout = setTimeout(() => {
        const s = sessions.get(c.chat);
        if (!s || s.done) return;
        s.done = true;
        c.reply(
          {
            text: t(
              "timeout",
              { answer: q.negara, region: q.wilayah, capital: q.ibukota },
              c,
            ),
          },
          { quoted: c.event },
        ).then((r) => {
          if (r) s.resultId = r.key.id;
        });
      }, 45000);

      sessions.set(c.chat, {
        answer,
        timeout,
        xp: xpReward,
        questionId: resp.key.id,
        done: false,
        resultId: "",
        region: q.wilayah,
        capital: q.ibukota,
      });
    },
  );
}

/** @type {import('#mushi').Plugin[]} */
export default [
  {
    name: "games-tebakbendera",
    cmd: ["tebakbendera", "tb", "tebakbendera?"],
    includes: ["games-tebakbendera-listener", "games-tebakbendera-updater"],
    cat: "games",
    tags: ["game"],
    desc: "Guess the flag game (Tebak Bendera)",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (c.cmd.endsWith("?")) {
        const helpText = [
          t("help_title", {}, c),
          "",
          t("help_desc", {}, c),
          t("help_usage", {}, c),
          "",
          t("help_important", {}, c),
          t("help_reply", {}, c),
          t("help_timeout_hint", {}, c),
          "",
          t("help_admin", { prefix: c.prefix }, c),
        ];
        return await c.reply(
          { text: helpText.join("\n") },
          { quoted: c.event },
        );
      }

      const existing = sessions.get(c.chat);
      if (existing && !existing.done) {
        return await c.reply(
          { text: t("session_active", {}, c) },
          { quoted: c.event },
        );
      }

      if (flags.length === 0) await autoFetch(c);
      startGame(c);
    },
  },
  {
    cmd: ["tb.update", "tebakbendera.update"],
    cat: "games",
    tags: ["game", "admin"],
    desc: "Sync flag list for Tebak Bendera game",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],
    exec: async (c) => {
      await c.react("⌛");
      try {
        const response = await fetch(JSON_URL);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (!Array.isArray(data))
          throw new Error("Invalid data format: Expected an array");

        const path = getFile("tebak_negara.json");
        writeFileSync(path, JSON.stringify(data, null, 2));

        flags = data;

        const stats = `${t("sync_success", {}, c)}\n\n${t("sync_stats", { count: data.length }, c)}`;

        await c.reply({ text: stats }, { quoted: c.event });
        await c.react("✅");
      } catch (e) {
        console.error("Sync failed:", e);
        await c.reply(
          { text: t("sync_failed", { error: e.message }, c) },
          { quoted: c.event },
        );
        await c.react("❌");
      }
    },
  },
  {
    name: "games-tebakbendera-listener",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!sessions.has(c.chat) || c.isCMD) return;
      const session = sessions.get(c.chat);

      if (!session.done) {
        if (c.stanzaId !== session.questionId) return;

        const userAnswer = c.text?.toLowerCase().trim();

        if (userAnswer === session.answer) {
          clearTimeout(session.timeout);
          session.done = true;

          const xp = session.xp;
          const user = c.user;
          if (user) {
            user.xp += xp;
            c.client().userManager.updateUser(c.senderJid, user);
          }

          const result = await c.reply(
            {
              text: t(
                "correct",
                {
                  user: c.senderJid.split("@")[0],
                  answer: session.answer.toUpperCase(),
                  region: session.region,
                  capital: session.capital,
                  xp,
                },
                c,
              ),
              mentions: [c.senderJid],
            },
            { quoted: c.event },
          );
          if (result) session.resultId = result.key.id;
        } else if (STOP_WORDS.has(userAnswer)) {
          clearTimeout(session.timeout);
          sessions.delete(c.chat);
          await c.reply({ text: t("stopped", {}, c) }, { quoted: c.event });
        } else {
          return await c.react("❌");
        }
      } else {
        const text = c.text?.toLowerCase().trim();
        if (c.stanzaId !== session.resultId) return;

        if (REPLAY_WORDS.has(text)) {
          await c.react("🔄");
          sessions.delete(c.chat);
          startGame(c);
        } else if (STOP_WORDS.has(text)) {
          sessions.delete(c.chat);
          await c.reply({ text: t("stopped", {}, c) }, { quoted: c.event });
        }
      }
    },
  },
  {
    name: "games-tebakibukota",
    cmd: ["tebakibukota", "tbi", "tebakibukota?"],
    includes: ["games-tebakibukota-listener", "games-tebakibukota-updater"],
    cat: "games",
    tags: ["game"],
    desc: "Guess the capital city game (Tebak Ibukota)",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (c.cmd.endsWith("?")) {
        const helpText = [
          tCapital("help_title", {}, c),
          "",
          tCapital("help_desc", {}, c),
          tCapital("help_usage", {}, c),
          "",
          tCapital("help_important", {}, c),
          tCapital("help_reply", {}, c),
          tCapital("help_timeout_hint", {}, c),
          "",
          tCapital("help_admin", { prefix: c.prefix }, c),
        ];
        return await c.reply(
          { text: helpText.join("\n") },
          { quoted: c.event },
        );
      }

      const existing = capitalSessions.get(c.chat);
      if (existing && !existing.done) {
        return await c.reply(
          { text: tCapital("session_active", {}, c) },
          { quoted: c.event },
        );
      }

      if (flags.length === 0) await autoFetch(c);
      startCapitalGame(c);
    },
  },
  {
    name: "games-tebakibukota-updater",
    cmd: ["tbi.update", "tebakibukota.update"],
    cat: "games",
    tags: ["game", "admin"],
    desc: "Sync country list for Tebak Ibukota game",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],
    exec: async (c) => {
      await c.react("⌛");
      try {
        const response = await fetch(JSON_URL);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (!Array.isArray(data))
          throw new Error("Invalid data format: Expected an array");

        const path = getFile("tebak_negara.json");
        writeFileSync(path, JSON.stringify(data, null, 2));

        flags = data;

        const stats = `${tCapital("sync_success", {}, c)}\n\n${tCapital("sync_stats", { count: data.length }, c)}`;

        await c.reply({ text: stats }, { quoted: c.event });
        await c.react("✅");
      } catch (e) {
        console.error("Sync failed:", e);
        await c.reply(
          { text: tCapital("sync_failed", { error: e.message }, c) },
          { quoted: c.event },
        );
        await c.react("❌");
      }
    },
  },
  {
    name: "games-tebakibukota-listener",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!capitalSessions.has(c.chat) || c.isCMD) return;
      const session = capitalSessions.get(c.chat);

      if (!session.done) {
        if (c.stanzaId !== session.questionId) return;

        const userAnswer = c.text?.toLowerCase().trim();

        if (userAnswer === session.answer) {
          clearTimeout(session.timeout);
          session.done = true;

          const xp = session.xp;
          const user = c.user;
          if (user) {
            user.xp += xp;
            c.client().userManager.updateUser(c.senderJid, user);
          }

          const result = await c.reply(
            {
              text: tCapital(
                "correct",
                {
                  user: c.senderJid.split("@")[0],
                  answer: session.answer.toUpperCase(),
                  country: session.country,
                  region: session.region,
                  xp,
                },
                c,
              ),
              mentions: [c.senderJid],
            },
            { quoted: c.event },
          );
          if (result) session.resultId = result.key.id;
        } else if (STOP_WORDS.has(userAnswer)) {
          clearTimeout(session.timeout);
          capitalSessions.delete(c.chat);
          await c.reply(
            { text: tCapital("stopped", {}, c) },
            { quoted: c.event },
          );
        } else {
          return await c.react("❌");
        }
      } else {
        const text = c.text?.toLowerCase().trim();
        if (c.stanzaId !== session.resultId) return;

        if (REPLAY_WORDS.has(text)) {
          await c.react("🔄");
          capitalSessions.delete(c.chat);
          startCapitalGame(c);
        } else if (STOP_WORDS.has(text)) {
          capitalSessions.delete(c.chat);
          await c.reply(
            { text: tCapital("stopped", {}, c) },
            { quoted: c.event },
          );
        }
      }
    },
  },
];
