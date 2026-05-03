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
    help_title: "🧮 *MATH GAME - HOW TO PLAY*",
    help_usage: "Use `.math [level]` to start.",
    help_levels: "*Levels & Initials:*",
    help_example: "💡 *Example:* `.math m` or `.math h`",
    help_important: "⚠️ *Important:*",
    help_reply: "- Must *Reply/Quote* the question to answer.",
    help_timeout: "- Time limit is 30 seconds.",
    session_active: "❌ There is still an unanswered question in this chat!",
    question_header: "🧮 [ Level: *{level}* ]",
    question_query: "What is the result of *{a} {op} {b}*?",
    question_time: "⏱️ *Time:* 30 seconds",
    question_reward: "🎁 *Reward:* {min}-{max} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply to this message to answer!_",
    timeout: "⌛ *Time's up!*\n\nThe answer was *{answer}*",
    correct:
      "🎉 *Congratulations* @{user}!\nYour answer is correct: *{answer}*\n\n🌟 *+{xp} XP*",
  },
  id: {
    help_title: "🧮 *MATH GAME - CARA BERMAIN*",
    help_usage: "Gunakan perintah `.math [level]` untuk memulai.",
    help_levels: "*Daftar Level & Inisial:*",
    help_example: "💡 *Contoh:* `.math m` atau `.math h`",
    help_important: "⚠️ *Penting:*",
    help_reply: "- Harus *Reply/Quote* pesan soal untuk menjawab.",
    help_timeout: "- Waktu menjawab adalah 30 detik.",
    session_active: "❌ Masih ada soal yang belum terjawab di grup ini!",
    question_header: "🧮 [ Level: *{level}* ]",
    question_query: "Berapakah hasil dari *{a} {op} {b}*?",
    question_time: "⏱️ *Waktu:* 30 detik",
    question_reward: "🎁 *Hadiah:* {min}-{max} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply chat ini untuk menjawab!_",
    timeout: "⌛ *Waktu habis!*\n\nJawabannya adalah *{answer}*",
    correct:
      "🎉 *Selamat* @{user}!\nJawaban kamu benar: *{answer}*\n\n🌟 *+{xp} XP*",
  },
});

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

      if (c.cmd.endsWith("?") || levelArg === "?") {
        const helpText = [
          t("help_title", {}, c),
          "",
          t("help_usage", {}, c),
          "",
          t("help_levels", {}, c),
          "🟢 `e` / `easy` : 5-15 XP",
          "🟡 `m` / `medium` : 15-30 XP",
          "🔴 `h` / `hard` : 30-60 XP",
          "💀 `i` / `impossible` : 100-200 XP",
          "",
          t("help_example", {}, c),
          "",
          t("help_important", {}, c),
          t("help_reply", {}, c),
          t("help_timeout", {}, c),
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
        t("question_header", { level: selectedLevel.toUpperCase() }, c),
        t("question_query", { a, op, b }, c),
        "",
        t("question_time", {}, c),
        t("question_reward", { min: level.xp[0], max: level.xp[1] }, c),
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
          c.reply({ text: t("timeout", { answer }, c) }, { quoted: c.event });
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

      const userAnswer = parseInt(c.text, 10);

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
                answer: session.answer,
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
