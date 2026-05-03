/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import fs from "node:fs";
import { MESSAGES_UPSERT } from "../../src/const.js";
import { getFile } from "../../src/data.js";
import { Role } from "../../src/roles.js";
import { translate } from "../../src/translate.js";

const t = translate({
  en: {
    help_title: "🧩 *GUESS THE WORD (TEBAK KATA)*",
    help_desc: "Guess the word based on the clues provided!",
    help_usage: "Use `.tk [level]` to start.",
    help_levels: "*Levels & Initials:*",
    help_level_e: "🟢 `e` / `easy` : 1-6 characters (5-15 XP)",
    help_level_m: "🟡 `m` / `medium` : 7-9 characters (15-30 XP)",
    help_level_h: "🔴 `h` / `hard` : 10+ characters (30-60 XP)",
    help_example: "💡 *Example:* `.tk m` or `.tk h`",
    help_important: "⚠️ *Important:*",
    help_reply: "- Must *Reply/Quote* the question to answer.",
    help_timeout_hint: "- Time limit is 45 seconds.",
    help_admin: "⚙️ *Admin:* `{prefix}tk.update` to sync word list.",
    session_active: "❌ There is still an unanswered question in this chat!",
    no_data:
      "❌ Word data not found or empty! Use `{prefix}tk.update` (Admin).",
    question_header: "🧩 [ Level: *{level}* ]",
    question_query: "Clues: *{clues}*",
    question_time: "⏱️ *Time:* 45 seconds",
    question_reward: "🎁 *Reward:* {min}-{max} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply to this message to answer!_",
    timeout: "⌛ *Time's up!*\nThe answer was *{answer}*",
    sync_success: "✅ *Sync Success!*",
    sync_stats:
      "🟢 *Easy:* {easy} words\n🟡 *Medium:* {medium} words\n🔴 *Hard:* {hard} words",
    sync_saved: "Data saved and reloaded!",
    sync_failed: "❌ *Sync Failed:* {error}",
    correct:
      "🎉 *Congratulations* @{user}!\nYour answer is correct: *{answer}*\n\n🌟 *+{xp} XP*",
  },
  id: {
    help_title: "🧩 *TEBAK KATA*",
    help_desc: "Tebaklah kata berdasarkan petunjuk yang diberikan!",
    help_usage: "Gunakan perintah `.tk [level]` untuk memulai.",
    help_levels: "*Daftar Level & Inisial:*",
    help_level_e: "🟢 `e` / `easy` : 1-6 huruf (5-15 XP)",
    help_level_m: "🟡 `m` / `medium` : 7-9 huruf (15-30 XP)",
    help_level_h: "🔴 `h` / `hard` : 10+ huruf (30-60 XP)",
    help_example: "💡 *Contoh:* `.tk m` atau `.tk h`",
    help_important: "⚠️ *Penting:*",
    help_reply: "- Harus *Reply/Quote* pesan soal untuk menjawab.",
    help_timeout_hint: "- Waktu menjawab adalah 45 detik.",
    help_admin: "⚙️ *Admin:* `{prefix}tk.update` untuk sinkronisasi kata.",
    session_active: "❌ Masih ada soal yang belum terjawab di grup ini!",
    no_data:
      "❌ Data kata tidak ditemukan atau kosong! Gunakan `{prefix}tk.update` (Admin).",
    question_header: "🧩 [ Level: *{level}* ]",
    question_query: "Petunjuk: *{clues}*",
    question_time: "⏱️ *Waktu:* 45 detik",
    question_reward: "🎁 *Hadiah:* {min}-{max} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply chat ini untuk menjawab!_",
    timeout: "⌛ *Waktu habis!*\nJawabannya adalah *{answer}*",
    sync_success: "✅ *Sinkronisasi Berhasil!*",
    sync_stats:
      "🟢 *Mudah:* {easy} kata\n🟡 *Sedang:* {medium} kata\n🔴 *Sulit:* {hard} kata",
    sync_saved: "Data disimpan dan dimuat ulang!",
    sync_failed: "❌ *Sinkronisasi Gagal:* {error}",
    correct:
      "🎉 *Selamat* @{user}!\nJawaban kamu benar: *{answer}*\n\n🌟 *+{xp} XP*",
  },
});

/** @type {Map<string, { answer: string, timeout: NodeJS.Timeout, xp: number, questionId: string }>} */
const sessions = new Map();

/** @type {Record<string, {pertanyaan: string, jawaban: string}[]>} */
let wordList = {
  easy: [],
  medium: [],
  hard: [],
};

const LEVELS = {
  easy: { xp: [5, 15] },
  medium: { xp: [15, 30] },
  hard: { xp: [30, 60] },
};

const LEVEL_ALIAS = {
  e: "easy",
  m: "medium",
  h: "hard",
};

const WORD_URL =
  "https://raw.githubusercontent.com/MichaelAgam23/metadata/main/tebakkata.json";

/**
 * Load word list from JSON file
 */
function loadWords() {
  try {
    const path = getFile("tebak_kata.json");
    if (fs.existsSync(path)) {
      wordList = JSON.parse(fs.readFileSync(path, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load tebak_kata.json:", e);
  }
}

// Initial load
loadWords();

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    cmd: ["tk", "tk?", "tebakkata", "tebakkata?"],
    cat: "games",
    tags: ["game"],
    desc: "Guess the Word game (Tebak Kata)",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      const levelArg = (c.argv?._?.[0] || "").toLowerCase();

      if (c.cmd.endsWith("?") || levelArg === "?") {
        const helpText = [
          t("help_title", {}, c),
          "",
          t("help_desc", {}, c),
          t("help_usage", {}, c),
          "",
          t("help_levels", {}, c),
          t("help_level_e", {}, c),
          t("help_level_m", {}, c),
          t("help_level_h", {}, c),
          "",
          t("help_example", {}, c),
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

      if (sessions.has(c.chat)) {
        return await c.reply(
          { text: t("session_active", {}, c) },
          { quoted: c.event },
        );
      }

      const selectedLevel = LEVEL_ALIAS[levelArg] || levelArg || "easy";
      const levelInfo = LEVELS[selectedLevel] || LEVELS.easy;
      const words = wordList[selectedLevel] || wordList.easy;

      if (!words || words.length === 0) {
        return await c.reply(
          { text: t("no_data", { prefix: c.prefix }, c) },
          { quoted: c.event },
        );
      }

      const item = words[Math.floor(Math.random() * words.length)];
      const answer = item.jawaban.toUpperCase();
      const clues = item.pertanyaan;

      const xpReward =
        Math.floor(Math.random() * (levelInfo.xp[1] - levelInfo.xp[0] + 1)) +
        levelInfo.xp[0];

      const texts = [
        t("question_header", { level: selectedLevel.toUpperCase() }, c),
        t("question_query", { clues }, c),
        "",
        t("question_time", {}, c),
        t("question_reward", { min: levelInfo.xp[0], max: levelInfo.xp[1] }, c),
        "",
        t("question_note", {}, c),
        t("question_reply", {}, c),
      ];

      const resp = await c.reply(
        { text: texts.join("\n") },
        { quoted: c.event },
      );

      const timeout = setTimeout(() => {
        if (sessions.has(c.chat)) {
          sessions.delete(c.chat);
          c.reply(
            {
              text: t("timeout", { answer }, c),
            },
            { quoted: c.event },
          );
        }
      }, 45000);

      sessions.set(c.chat, {
        answer: answer.toLowerCase().trim(),
        timeout,
        xp: xpReward,
        questionId: resp.key.id,
      });
    },
  },
  {
    cmd: ["tk.update"],
    cat: "games",
    tags: ["game", "admin"],
    desc: "Sync word list for Tebak Kata game",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],
    exec: async (c) => {
      await c.react("⌛");
      try {
        const response = await fetch(WORD_URL);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (!Array.isArray(data))
          throw new Error("Invalid data format: Expected an array");

        const newWordList = {
          easy: data.filter((w) => w.jawaban.length <= 6),
          medium: data.filter(
            (w) => w.jawaban.length >= 7 && w.jawaban.length <= 9,
          ),
          hard: data.filter((w) => w.jawaban.length >= 10),
        };

        const path = getFile("tebak_kata.json");
        fs.writeFileSync(path, JSON.stringify(newWordList, null, 2));

        // Refresh local wordList
        wordList = newWordList;

        const stats =
          `${t("sync_success", {}, c)}\n\n` +
          t(
            "sync_stats",
            {
              easy: newWordList.easy.length,
              medium: newWordList.medium.length,
              hard: newWordList.hard.length,
            },
            c,
          ) +
          `\n\n${t("sync_saved", {}, c)}`;

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
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!sessions.has(c.chat) || c.isCMD) return;

      const session = sessions.get(c.chat);

      if (c.stanzaId !== session.questionId) return;

      const userAnswer = c.text?.toLowerCase().trim();

      if (userAnswer === session.answer) {
        clearTimeout(session.timeout);
        sessions.delete(c.chat);

        const xp = session.xp;
        const user = c.user();
        if (user) {
          user.xp += xp;
          c.handler().userManager.updateUser(c.senderJid, user);
        }

        return await c.reply(
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
      } else {
        return await c.react("❌");
      }
    },
  },
];
