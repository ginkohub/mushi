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
    help_title: "🖼️ *GUESS THE PICTURE (TEBAK GAMBAR)*",
    help_desc: "Guess the word/phrase based on the picture and clue!",
    help_usage: "Use `.tg [level]` to start.",
    help_levels: "*Available Levels:*",
    help_level_hint: "Levels 1-13 available. Example: `.tg 5`",
    help_important: "⚠️ *Important:*",
    help_reply: "- Must *Reply/Quote* the question to answer.",
    help_timeout_hint: "- Time limit is 45 seconds.",
    help_admin:
      "⚙️ *Admin:* `{prefix}tg.update` to sync questions, `{prefix}tg.time <seconds>` to set time limit.",
    session_active: "❌ There is still an unanswered question in this chat!",
    no_data: "❌ Question data not found! Use `{prefix}tg.update` (Admin).",
    level_invalid: "❌ Invalid level! Available: 1-13",
    question_header: "🖼️ [ Level: *{level}* ]",
    question_time: "⏱️ *Time:* {time} seconds",
    question_reward: "🎁 *Reward:* {xp} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply with your answer, or 'hint/clue' to see a hint_",
    clue_reveal: "💡 *Clue:* {clue}",
    timeout: "⌛ *Time's up!*\nReply _lagi/again/next_ to play again",
    time_set_title: "⏱️ *Time Limit*",
    time_set_current: "Current time limit: *{time}* seconds",
    time_set_usage: "Usage: `{prefix}tg.time <seconds>`",
    time_set_updated: "✅ Time limit updated to *{time}* seconds",
    time_set_invalid: "❌ Invalid time! Enter a number between 10-300.",
    sync_success: "✅ *Sync Success!*",
    sync_stats: "Successfully loaded {levels} levels, {total} questions.",
    sync_failed: "❌ *Sync Failed:* {error}",
    correct:
      "🎉 *Congratulations* @{user}!\nYour answer is correct: *{answer}*\n\n🌟 *+{xp} XP*\n\nReply _lagi/again/next_ to play again, or _stop/nyerah_ to stop",
    level_title: "📊 *Your Progress*",
    level_current: "Current level: *{level}*",
    level_hint: "Use `{prefix}tg [1-13]` to jump to a specific level.",
    stopped: "🛑 *Game stopped*",
    reset_title: "🔄 *Progress Reset*",
    reset_done: "Your Tebak Gambar progress has been reset to level 1.",
  },
  id: {
    help_title: "🖼️ *TEBAK GAMBAR*",
    help_desc: "Tebak kata/frasa berdasarkan gambar dan petunjuk!",
    help_usage: "Gunakan perintah `.tg [level]` untuk memulai.",
    help_levels: "*Level yang Tersedia:*",
    help_level_hint: "Level 1-13 tersedia. Contoh: `.tg 5`",
    help_important: "⚠️ *Penting:*",
    help_reply: "- Harus *Reply/Quote* pesan soal untuk menjawab.",
    help_timeout_hint: "- Waktu menjawab adalah 45 detik.",
    help_admin:
      "⚙️ *Admin:* `{prefix}tg.update` untuk sinkronisasi soal, `{prefix}tg.time <detik>` untuk atur waktu.",
    session_active: "❌ Masih ada soal yang belum terjawab di grup ini!",
    no_data:
      "❌ Data soal tidak ditemukan! Gunakan `{prefix}tg.update` (Admin).",
    level_invalid: "❌ Level tidak valid! Tersedia: 1-13",
    question_header: "🖼️ [ Level: *{level}* ]",
    question_time: "⏱️ *Waktu:* {time} detik",
    question_reward: "🎁 *Hadiah:* {xp} XP",
    question_note: "📝 *Note:*",
    question_reply:
      "_Balas dengan jawabanmu, atau 'petunjuk/clue/hint' untuk petunjuk_",
    clue_reveal: "💡 *Petunjuk:* {clue}",
    timeout:
      "⌛ *Waktu habis!*\nBalas _lagi/lanjut/again/next_ untuk main lagi",
    time_set_title: "⏱️ *Batas Waktu*",
    time_set_current: "Batas waktu saat ini: *{time}* detik",
    time_set_usage: "Penggunaan: `{prefix}tg.time <detik>`",
    time_set_updated: "✅ Batas waktu diubah ke *{time}* detik",
    time_set_invalid: "❌ Waktu tidak valid! Masukkan angka antara 10-300.",
    sync_success: "✅ *Sinkronisasi Berhasil!*",
    sync_stats: "Berhasil memuat {levels} level, {total} soal.",
    sync_failed: "❌ *Sinkronisasi Gagal:* {error}",
    correct:
      "🎉 *Selamat* @{user}!\nJawaban kamu benar: *{answer}*\n\n🌟 *+{xp} XP*\n\nBalas _lagi/lanjut/again/next_ untuk main lagi, atau _stop/nyerah_ untuk berhenti",
    level_title: "📊 *Progress Kamu*",
    level_current: "Level saat ini: *{level}*",
    level_hint: "Gunakan `{prefix}tg [1-13]` untuk loncat ke level tertentu.",
    stopped: "🛑 *Permainan dihentikan*",
    reset_title: "🔄 *Reset Progress*",
    reset_done: "Progress Tebak Gambar kamu telah direset ke level 1.",
  },
});

const JSON_URL =
  "https://raw.githubusercontent.com/ginkohub/game-assets/main/tebak-gambar/data.json";

const MAX_LEVEL = 13;
const DEFAULT_TIMEOUT_MS = 60000;
const TIMEOUT_STORE_KEY = "tebakgambar_timeout";
const LEVEL_STORE_KEY = "tebakgambar_level";

function getTimeout(settings, chat) {
  const stored = settings?.get(`${TIMEOUT_STORE_KEY}_${chat}`);
  return parseInt(stored, 10) || DEFAULT_TIMEOUT_MS;
}

function getLevel(settings, chat) {
  const stored = settings?.get(`${LEVEL_STORE_KEY}_${chat}`);
  const lv = parseInt(stored, 10);
  return lv >= 1 && lv <= MAX_LEVEL ? String(lv) : "1";
}

function saveLevel(settings, chat, lv) {
  settings?.set(`${LEVEL_STORE_KEY}_${chat}`, lv);
}

/** @type {Map<string, import('#mushi').Store>} */
const gamesStores = new Map();

function getGamesStore(c) {
  const clientName = c.client()?.name;
  if (!clientName) return null;
  if (!gamesStores.has(clientName)) {
    const store = c.client().store.use("games_tebak_gambar");
    gamesStores.set(clientName, store);
  }
  return gamesStores.get(clientName);
}

const PROGRESS_STORE_KEY = "tebakgambar_progress";

async function getUserProgress(c, chat, user) {
  const store = getGamesStore(c);
  if (!store) return null;
  await store.waitReady();
  const stored = store.get(`${PROGRESS_STORE_KEY}_${chat}_${user}`);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

async function saveUserProgress(c, chat, user, progress) {
  const store = getGamesStore(c);
  if (!store) return;
  await store.waitReady();
  store.set(`${PROGRESS_STORE_KEY}_${chat}_${user}`, JSON.stringify(progress));
}

function isLevelComplete(level, answered) {
  const items = questions[level];
  if (!items || items.length === 0) return false;
  return items.every((q) => answered.includes(q.jawaban.toLowerCase().trim()));
}

/** @type {Map<string, { answer: string, timeout: NodeJS.Timeout, xp: number, questionId: string, level: string, desc: string, done: boolean, resultId: string, clueRevealed: boolean }>} */
const sessions = new Map();

const REPLAY_WORDS = new Set(["lagi", "lanjut", "again", "next"]);
const STOP_WORDS = new Set(["stop", "nyerah"]);
const CLUE_WORDS = new Set(["clue", "hint", "petunjuk"]);

/** @type {Record<string, {img: string, jawaban: string, deskripsi: string}[]>} */
let questions = {};

function loadQuestions() {
  try {
    const path = getFile("tebak_gambar.json");
    if (existsSync(path)) {
      questions = JSON.parse(readFileSync(path, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load tebak_gambar.json:", e);
  }
}

loadQuestions();

async function autoFetch(c) {
  try {
    const res = await fetch(JSON_URL);
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data !== "object" || Array.isArray(data)) return;
    const path = getFile("tebak_gambar.json");
    writeFileSync(path, JSON.stringify(data, null, 2));
    questions = data;
    c.log().info(`auto-fetched ${Object.keys(data).length} levels`);
  } catch (e) {
    c.log().error(`auto-fetch failed: ${e.message}`);
  }
}

function getTimeoutMs(c) {
  const settings = c.client()?.settings;
  return getTimeout(settings, c.chat);
}

function startGame(c, level, excludeAnswers) {
  const lv = level || "1";
  const items = questions[lv];

  if (!items || items.length === 0) {
    c.reply(
      { text: t("no_data", { prefix: c.prefix }, c) },
      { quoted: c.event },
    );
    return;
  }

  let pool = items;
  if (excludeAnswers?.length) {
    const filtered = items.filter(
      (q) => !excludeAnswers.includes(q.jawaban.toLowerCase().trim()),
    );
    if (filtered.length > 0) pool = filtered;
  }

  const q = pool[Math.floor(Math.random() * pool.length)];
  const answer = q.jawaban.toLowerCase().trim();
  const xpReward = answer.length * 10;
  const timeoutMs = getTimeoutMs(c);
  const timeoutSec = Math.round(timeoutMs / 1000);

  const caption = [
    t("question_header", { level: lv }, c),
    "",
    t("question_time", { time: timeoutSec }, c),
    t("question_reward", { xp: xpReward }, c),
    "",
    t("question_note", {}, c),
    t("question_reply", {}, c),
  ].join("\n");

  c.reply({ image: { url: q.img }, caption }, { quoted: c.event }).then(
    (resp) => {
      if (!resp) return;
      const timeout = setTimeout(() => {
        const s = sessions.get(c.chat);
        if (!s || s.done) return;
        s.done = true;
        c.reply(
          {
            text: t("timeout", {}, c),
          },
          { quoted: c.event },
        ).then((r) => {
          if (r) s.resultId = r.key.id;
        });
      }, timeoutMs);

      sessions.set(c.chat, {
        answer,
        timeout,
        xp: xpReward,
        questionId: resp.key.id,
        level: lv,
        desc: q.deskripsi,
        done: false,
        resultId: "",
        clueRevealed: false,
      });
    },
  );
}

/** @type {import('#mushi').Plugin[]} */
export default [
  {
    name: "games-tebakgambar",
    cmd: ["tebakgambar", "tg", "tebakgambar?"],
    includes: [
      "games-tebakgambar-listener",
      "games-tebakgambar-updater",
      "games-tebakgambar-timesetter",
      "games-tebakgambar-levelcheck",
      "games-tebakgambar-reset",
    ],
    cat: "games",
    tags: ["game"],
    desc: "Guess the Picture game (Tebak Gambar)",
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
          t("help_levels", {}, c),
          t("help_level_hint", {}, c),
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

      const levelArg = (c.argv?._?.[0] || "").trim();
      const settings = c.client()?.settings;

      if (levelArg) {
        const lvNum = parseInt(levelArg, 10);
        if (
          Number.isNaN(lvNum) ||
          lvNum < 1 ||
          lvNum > MAX_LEVEL ||
          String(lvNum) !== levelArg
        ) {
          return await c.reply(
            { text: t("level_invalid", {}, c) },
            { quoted: c.event },
          );
        }
      }

      if (!Object.keys(questions).length) await autoFetch(c);
      const targetLevel = levelArg || getLevel(settings, c.chat);
      const progress = await getUserProgress(c, c.chat, c.senderJid);

      if (levelArg) {
        const targetNum = parseInt(targetLevel, 10);
        const savedNum = parseInt(getLevel(settings, c.chat), 10);
        if (targetNum > savedNum) {
          const completed = progress?.completed || [];
          const missing = [];
          for (let i = 1; i < targetNum; i++) {
            const lv = String(i);
            if (!completed.includes(lv) && questions[lv]?.length) {
              missing.push(lv);
            }
          }
          if (missing.length > 0) {
            return await c.reply(
              {
                text: `❌ Complete level *${missing[0]}* first before jumping to level ${targetNum}.`,
              },
              { quoted: c.event },
            );
          }
        }
      }

      const excludeAnswers =
        progress?.level === targetLevel ? progress.answered : [];
      startGame(c, targetLevel, excludeAnswers);
    },
  },
  {
    name: "games-tebakgambar-updater",
    cmd: ["tg.update", "tebakgambar.update"],
    cat: "games",
    tags: ["game", "admin"],
    desc: "Sync questions for Tebak Gambar game",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],
    exec: async (c) => {
      await c.react("⌛");
      try {
        const response = await fetch(JSON_URL);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (typeof data !== "object" || Array.isArray(data))
          throw new Error(
            "Invalid data format: Expected an object with level keys",
          );

        const path = getFile("tebak_gambar.json");
        writeFileSync(path, JSON.stringify(data, null, 2));

        questions = data;

        const levelCount = Object.keys(data).length;
        const totalCount = Object.values(data).reduce(
          (sum, arr) => sum + arr.length,
          0,
        );

        const stats = `${t("sync_success", {}, c)}\n\n${t("sync_stats", { levels: levelCount, total: totalCount }, c)}`;

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
    name: "games-tebakgambar-timesetter",
    cmd: ["tg.time", "tebakgambar.time"],
    cat: "games",
    tags: ["game", "admin"],
    desc: "Set time limit for Tebak Gambar game",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],
    exec: async (c) => {
      const settings = c.client()?.settings;
      const current = getTimeout(settings, c.chat) / 1000;
      const arg = c.argv?._?.[0];

      if (!arg) {
        const text = [
          t("time_set_title", {}, c),
          "",
          t("time_set_current", { time: current }, c),
          "",
          t("time_set_usage", { prefix: c.prefix }, c),
        ].join("\n");
        return await c.reply({ text }, { quoted: c.event });
      }

      const sec = parseInt(arg, 10);
      if (Number.isNaN(sec) || sec < 10 || sec > 300) {
        return await c.reply(
          { text: t("time_set_invalid", {}, c) },
          { quoted: c.event },
        );
      }

      const key = `${TIMEOUT_STORE_KEY}_${c.chat}`;
      settings.set(key, String(sec * 1000));

      await c.reply(
        { text: t("time_set_updated", { time: sec }, c) },
        { quoted: c.event },
      );
    },
  },
  {
    name: "games-tebakgambar-levelcheck",
    cmd: ["tg.level", "tebakgambar.level"],
    cat: "games",
    tags: ["game"],
    desc: "Check your current level in Tebak Gambar",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      const settings = c.client()?.settings;
      const current = getLevel(settings, c.chat);
      const text = [
        t("level_title", {}, c),
        "",
        t("level_current", { level: current }, c),
        "",
        t("level_hint", { prefix: c.prefix }, c),
      ].join("\n");
      return await c.reply({ text }, { quoted: c.event });
    },
  },
  {
    name: "games-tebakgambar-listener",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!sessions.has(c.chat) || c.isCMD) return;
      const session = sessions.get(c.chat);

      if (!session.done) {
        if (c.stanzaId !== session.questionId) return;

        const userAnswer = c.text?.toLowerCase().trim();

        if (CLUE_WORDS.has(userAnswer)) {
          return await c.reply(
            { text: t("clue_reveal", { clue: session.desc }, c) },
            { quoted: c.event },
          );
        }

        if (userAnswer === session.answer) {
          clearTimeout(session.timeout);
          session.done = true;

          const xp = session.xp;
          const user = c.user;
          if (user) {
            user.xp += xp;
            c.client().userManager.updateUser(c.senderJid, user);
          }

          const settings = c.client()?.settings;
          const progress =
            (await getUserProgress(c, c.chat, c.senderJid)) || {
              level: session.level,
              answered: [],
              completed: [],
            };
          progress.level = session.level;
          if (!progress.answered.includes(session.answer)) {
            progress.answered.push(session.answer);
          }
          await saveUserProgress(c, c.chat, c.senderJid, progress);

          const allDone = isLevelComplete(session.level, progress.answered);
          if (allDone) {
            const completed = progress.completed || [];
            if (!completed.includes(session.level)) {
              completed.push(session.level);
            }
            const nextLv = Math.min(parseInt(session.level, 10) + 1, MAX_LEVEL);
            saveLevel(settings, c.chat, String(nextLv));
            await saveUserProgress(c, c.chat, c.senderJid, {
              level: String(nextLv),
              answered: [],
              completed,
            });
          }

          const result = await c.reply(
            {
              text: t(
                "correct",
                {
                  user: c.senderJid.split("@")[0],
                  answer: session.answer.toUpperCase(),
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
          const progress = await getUserProgress(
            c,
            c.chat,
            c.senderJid,
          );
          const excludeAnswers =
            progress?.level === session.level ? progress.answered : [];
          startGame(c, session.level, excludeAnswers);
        } else if (STOP_WORDS.has(text)) {
          sessions.delete(c.chat);
          await c.reply({ text: t("stopped", {}, c) }, { quoted: c.event });
        }
      }
    },
  },
  {
    name: "games-tebakgambar-reset",
    cmd: ["tg.reset", "tebakgambar.reset"],
    cat: "games",
    tags: ["game"],
    desc: "Reset your Tebak Gambar progress to level 1",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      const store = getGamesStore(c);
      if (store) {
        await store.waitReady();
        store.delete(`${PROGRESS_STORE_KEY}_${c.chat}_${c.senderJid}`);
      }
      saveLevel(c.client()?.settings, c.chat, "1");
      await c.reply(
        {
          text: [t("reset_title", {}, c), "", t("reset_done", {}, c)].join(
            "\n",
          ),
        },
        { quoted: c.event },
      );
    },
  },
];
