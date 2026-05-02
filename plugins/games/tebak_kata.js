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
    cmd: ["tk", "tk?", 'tebakkata', 'tebakkata?'],
    timeout: 120,
    cat: "games",
    tags: ["game"],
    desc: "Word Scramble game (Tebak Kata)",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      const levelArg = (c.argv?._?.[0] || "").toLowerCase();

      if (c.cmd === "tk?" || levelArg === "?") {
        const helpText = [
          "🧩 *TEBAK KATA (SCRAMBLE)*",
          "",
          "Susunlah huruf-huruf yang diacak menjadi kata yang benar!",
          "Gunakan perintah `.tk [level]` untuk memulai.",
          "",
          "*Daftar Level & Inisial:*",
          "🟢 `e` / `easy` : Kata pendek (5-15 XP)",
          "🟡 `m` / `medium` : Kata sedang (15-30 XP)",
          "🔴 `h` / `hard` : Kata panjang (30-60 XP)",
          "",
          "💡 *Contoh:* `.tk m` atau `.tk h`",
          "",
          "⚠️ *Penting:*",
          "- Harus *Reply/Quote* pesan soal untuk menjawab.",
          "- Waktu menjawab adalah 45 detik.",
          "",
          `⚙️ *Admin:* \`${c.prefix}tk.update\` untuk sinkronisasi kata.`,
        ];
        return await c.reply({ text: helpText.join("\n") }, { quoted: c.event });
      }

      if (sessions.has(c.chat)) {
        return await c.reply(
          { text: "❌ Masih ada soal yang belum terjawab di grup ini!" },
          { quoted: c.event },
        );
      }

      const selectedLevel = LEVEL_ALIAS[levelArg] || levelArg || "easy";
      const levelInfo = LEVELS[selectedLevel] || LEVELS.easy;
      const words = wordList[selectedLevel] || wordList.easy;

      if (!words || words.length === 0) {
        return await c.reply(
          { text: `❌ Data kata tidak ditemukan atau kosong! Gunakan \`${c.prefix}tk.update\` (Admin).` },
          { quoted: c.event },
        );
      }

      const answer = words[Math.floor(Math.random() * words.length)];
      const scrambled = scramble(answer);

      const xpReward =
        Math.floor(
          Math.random() * (levelInfo.xp[1] - levelInfo.xp[0] + 1),
        ) + levelInfo.xp[0];

      const texts = [
        `🧩 [ Level: *${selectedLevel.toUpperCase()}* ]`,
        `Susunlah huruf berikut: *${scrambled.toUpperCase()}*`,
        "",
        `⏱️ *Waktu:* 45 detik`,
        `🎁 *Hadiah:* ${levelInfo.xp[0]}-${levelInfo.xp[1]} XP`,
        "",
        "📝 *Note:*",
        "_Reply chat ini untuk menjawab!_",
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
              text: `⌛ *Waktu habis!*\nJawabannya adalah *${answer.toUpperCase()}*`,
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
    timeout: 300,
    cat: "games",
    tags: ["game", "admin"],
    desc: "Sync Indonesian word list for Tebak Kata game",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],
    exec: async (c) => {
      await c.react("⌛");
      try {
        const response = await fetch(WORD_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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

        const stats = `✅ *Sync Success!*\n\n` +
          `🟢 *Easy:* ${newWordList.easy.length} words\n` +
          `🟡 *Medium:* ${newWordList.medium.length} words\n` +
          `🔴 *Hard:* ${newWordList.hard.length} words\n\n` +
          `Data saved and reloaded!`;

        await c.reply({ text: stats }, { quoted: c.event });
        await c.react("✅");
      } catch (e) {
        console.error("Sync failed:", e);
        await c.reply({ text: `❌ *Sync Failed:* ${e.message}` }, { quoted: c.event });
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
            text: `🎉 *Selamat* @${c.senderJid.split("@")[0]}!\nJawaban kamu benar: *${session.answer.toUpperCase()}*\n\n🌟 *+${xp} XP*`,
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
