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
import { translate } from "../settings.js";

const t = translate({
  en: {
    help_title: "🧩 *WORD SCRAMBLE (TEBAK KATA)*",
    help_desc: "Unscramble the letters to form the correct word!",
    help_usage: "Use `.tk [level]` to start.",
    help_levels: "*Levels & Initials:*",
    help_level_e: "🟢 `e` / `easy` : Short words (5-15 XP)",
    help_level_m: "🟡 `m` / `medium` : Medium words (15-30 XP)",
    help_level_h: "🔴 `h` / `hard` : Long words (30-60 XP)",
    help_example: "💡 *Example:* `.tk m` or `.tk h`",
    help_important: "⚠️ *Important:*",
    help_reply: "- Must *Reply/Quote* the question to answer.",
    help_timeout_hint: "- Time limit is 45 seconds.",
    help_admin: "⚙️ *Admin:* `{prefix}tk.update` to sync word list.",
    session_active: "❌ There is still an unanswered question in this chat!",
    no_data: "❌ Word data not found or empty! Use `{prefix}tk.update` (Admin).",
    question_header: "🧩 [ Level: *{level}* ]",
    question_query: "Unscramble these letters: *{word}*",
    question_time: "⏱️ *Time:* 45 seconds",
    question_reward: "🎁 *Reward:* {min}-{max} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply to this message to answer!_",
    timeout: "⌛ *Time's up!*\nThe answer was *{answer}*",
    sync_success: "✅ *Sync Success!*",
    sync_stats: "🟢 *Easy:* {easy} words\n🟡 *Medium:* {medium} words\n🔴 *Hard:* {hard} words",
    sync_saved: "Data saved and reloaded!",
    sync_failed: "❌ *Sync Failed:* {error}",
    correct: "🎉 *Congratulations* @{user}!\nYour answer is correct: *{answer}*\n\n🌟 *+{xp} XP*",
  },
  id: {
    help_title: "🧩 *TEBAK KATA (SCRAMBLE)*",
    help_desc: "Susunlah huruf-huruf yang diacak menjadi kata yang benar!",
    help_usage: "Gunakan perintah `.tk [level]` untuk memulai.",
    help_levels: "*Daftar Level & Inisial:*",
    help_level_e: "🟢 `e` / `easy` : Kata pendek (5-15 XP)",
    help_level_m: "🟡 `m` / `medium` : Kata sedang (15-30 XP)",
    help_level_h: "🔴 `h` / `hard` : Kata panjang (30-60 XP)",
    help_example: "💡 *Contoh:* `.tk m` atau `.tk h`",
    help_important: "⚠️ *Penting:*",
    help_reply: "- Harus *Reply/Quote* pesan soal untuk menjawab.",
    help_timeout_hint: "- Waktu menjawab adalah 45 detik.",
    help_admin: "⚙️ *Admin:* `{prefix}tk.update` untuk sinkronisasi kata.",
    session_active: "❌ Masih ada soal yang belum terjawab di grup ini!",
    no_data: "❌ Data kata tidak ditemukan atau kosong! Gunakan `{prefix}tk.update` (Admin).",
    question_header: "🧩 [ Level: *{level}* ]",
    question_query: "Susunlah huruf berikut: *{word}*",
    question_time: "⏱️ *Waktu:* 45 detik",
    question_reward: "🎁 *Hadiah:* {min}-{max} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply chat ini untuk menjawab!_",
    timeout: "⌛ *Waktu habis!*\nJawabannya adalah *{answer}*",
    sync_success: "✅ *Sinkronisasi Berhasil!*",
    sync_stats: "🟢 *Mudah:* {easy} kata\n🟡 *Sedang:* {medium} kata\n🔴 *Sulit:* {hard} kata",
    sync_saved: "Data disimpan dan dimuat ulang!",
    sync_failed: "❌ *Sinkronisasi Gagal:* {error}",
    correct: "🎉 *Selamat* @{user}!\nJawaban kamu benar: *{answer}*\n\n🌟 *+{xp} XP*",
  },
});

/** @type {Map<string, { answer: string, timeout: NodeJS.Timeout, xp: number, questionId: string }>} */
const sessions = new Map();

/** @type {Record<string, string[]>} */
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

const WORD_URL = "https://ginkohub.github.io/indonesian.txt";

/**
 * Scramble a word
 * @param {string} word
 * @returns {string}
 */
function scramble(word) {
  const arr = word.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const scrambled = arr.join("-");
  return scrambled === word.split("").join("-") ? scramble(word) : scrambled;
}

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
    desc: "Word Scramble game (Tebak Kata)",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      const levelArg = (c.argv?._?.[0] || "").toLowerCase();

      if (c.cmd.endsWith("?") || levelArg === "?") {
        const helpText = [
          t("help_title"),
          "",
          t("help_desc"),
          t("help_usage"),
          "",
          t("help_levels"),
          t("help_level_e"),
          t("help_level_m"),
          t("help_level_h"),
          "",
          t("help_example"),
          "",
          t("help_important"),
          t("help_reply"),
          t("help_timeout_hint"),
          "",
          t("help_admin", { prefix: c.prefix }),
        ];
        return await c.reply({ text: helpText.join("\n") }, { quoted: c.event });
      }

      if (sessions.has(c.chat)) {
        return await c.reply(
          { text: t("session_active") },
          { quoted: c.event },
        );
      }

      const selectedLevel = LEVEL_ALIAS[levelArg] || levelArg || "easy";
      const levelInfo = LEVELS[selectedLevel] || LEVELS.easy;
      const words = wordList[selectedLevel] || wordList.easy;

      if (!words || words.length === 0) {
        return await c.reply(
          { text: t("no_data", { prefix: c.prefix }) },
          { quoted: c.event },
        );
      }

      const answer = words[Math.floor(Math.random() * words.length)];
      const scrambled = scramble(answer);

      const xpReward =
        Math.floor(Math.random() * (levelInfo.xp[1] - levelInfo.xp[0] + 1)) +
        levelInfo.xp[0];

      const texts = [
        t("question_header", { level: selectedLevel.toUpperCase() }),
        t("question_query", { word: scrambled.toUpperCase() }),
        "",
        t("question_time"),
        t("question_reward", { min: levelInfo.xp[0], max: levelInfo.xp[1] }),
        "",
        t("question_note"),
        t("question_reply"),
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
              text: t("timeout", { answer: answer.toUpperCase() }),
            },
            { quoted: c.event },
          );
        }
      }, 45000);

      sessions.set(c.chat, {
        answer: answer.toLowerCase(),
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
    desc: "Sync Indonesian word list for Tebak Kata game",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],
    exec: async (c) => {
      await c.react("⌛");
      try {
        const response = await fetch(WORD_URL);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const text = await response.text();
        const allWords = text
          .split("\n")
          .map((w) => w.trim().toLowerCase())
          .filter((w) => /^[a-z]+$/.test(w));

        const newWordList = {
          easy: allWords.filter((w) => w.length >= 4 && w.length <= 5),
          medium: allWords.filter((w) => w.length >= 6 && w.length <= 8),
          hard: allWords.filter((w) => w.length >= 9),
        };

        const path = getFile("tebak_kata.json");
        fs.writeFileSync(path, JSON.stringify(newWordList, null, 2));

        // Refresh local wordList
        wordList = newWordList;

        const stats =
          `${t("sync_success")}\n\n` +
          t("sync_stats", {
            easy: newWordList.easy.length,
            medium: newWordList.medium.length,
            hard: newWordList.hard.length,
          }) +
          `\n\n${t("sync_saved")}`;

        await c.reply({ text: stats }, { quoted: c.event });
        await c.react("✅");
      } catch (e) {
        console.error("Sync failed:", e);
        await c.reply(
          { text: t("sync_failed", { error: e.message }) },
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
            text: t("correct", {
              user: c.senderJid.split("@")[0],
              answer: session.answer.toUpperCase(),
              xp,
            }),
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
