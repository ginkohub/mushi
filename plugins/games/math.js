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

/** @type {Map<string, { answer: number, timeout: NodeJS.Timeout, xp: number, questionId: string }>} */
const sessions = new Map();

const LEVELS = {
  easy: { range: 50, mult: 10, xp: [5, 15] },
  medium: { range: 200, mult: 20, xp: [15, 30] },
  hard: { range: 1000, mult: 50, xp: [30, 60] },
  impossible: { range: 5000, mult: 100, xp: [100, 200] },
};

const LEVEL_ALIAS = {
  e: "easy",
  m: "medium",
  h: "hard",
  i: "impossible",
};

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    cmd: ["math", "math?"],
    timeout: 120,
    cat: "games",
    tags: ["game"],
    desc: "Math game with levels (easy, medium, hard, impossible)",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      const levelArg = (c.argv?._?.[0] || "").toLowerCase();

      if (c.cmd === "math?" || levelArg === "?") {
        const helpText = [
          "🧮 *MATH GAME - CARA BERMAIN*",
          "",
          "Gunakan perintah `.math [level]` untuk memulai.",
          "",
          "*Daftar Level & Inisial:*",
          "🟢 `e` / `easy` : 5-15 XP",
          "🟡 `m` / `medium` : 15-30 XP",
          "🔴 `h` / `hard` : 30-60 XP",
          "💀 `i` / `impossible` : 100-200 XP",
          "",
          "💡 *Contoh:* `.math m` atau `.math h`",
          "",
          "⚠️ *Penting:*",
          "- Harus *Reply/Quote* pesan soal untuk menjawab.",
          "- Waktu menjawab adalah 30 detik.",
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
      const level = LEVELS[selectedLevel] || LEVELS.easy;

      const operators = ["+", "-", "*"];
      const op = operators[Math.floor(Math.random() * operators.length)];
      let a, b, answer;

      if (op === "*") {
        a = Math.floor(Math.random() * level.mult) + 1;
        b = Math.floor(Math.random() * level.mult) + 1;
        answer = a * b;
      } else {
        a = Math.floor(Math.random() * level.range) + 1;
        b = Math.floor(Math.random() * level.range) + 1;
        answer = op === "+" ? a + b : a - b;
      }

      const xpReward =
        Math.floor(Math.random() * (level.xp[1] - level.xp[0] + 1)) +
        level.xp[0];

      const texts = [
        `🧮 [ Level: *${selectedLevel.toUpperCase()}* ]`,
        `Berapakah hasil dari *${a} ${op} ${b}*?`,
        "",
        `⏱️ *Waktu:* 30 detik`,
        `🎁 *Hadiah:* ${level.xp[0]}-${level.xp[1]} XP`,
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
            { text: `⌛ *Waktu habis!* Jawabannya adalah *${answer}*` },
            { quoted: c.event },
          );
        }
      }, 30000);

      sessions.set(c.chat, {
        answer,
        timeout,
        xp: xpReward,
        questionId: resp.key.id,
      });
    },
  },
  {
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!sessions.has(c.chat) || c.isCMD) return;

      const session = sessions.get(c.chat);

      if (c.stanzaId !== session.questionId) return;

      const userAnswer = parseInt(c.text);

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
            text: `🎉 *Selamat* @${c.senderJid.split("@")[0]}!\nJawaban kamu benar: *${session.answer}*\n\n🌟 *+${xp} XP*`,
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
