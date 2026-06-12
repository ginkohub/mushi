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
    question_reward: "🎁 *Reward:* {xp} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply to this message to answer!_",
    timeout: "⌛ *Time's up!*\n\nThe answer was *{answer}*",
    correct:
      "🎉 *Congratulations* @{user}!\nYour answer is correct: *{answer}*\n\n🌟 *+{xp} XP*\n\nReply _lagi/again/next_ to play again, or _stop/nyerah_ to stop",
    stopped: "🛑 *Game stopped*",
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
    question_reward: "🎁 *Hadiah:* {xp} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply chat ini untuk menjawab!_",
    timeout: "⌛ *Waktu habis!*\n\nJawabannya adalah *{answer}*",
    correct:
      "🎉 *Selamat* @{user}!\nJawaban kamu benar: *{answer}*\n\n🌟 *+{xp} XP*\n\nBalas _lagi/lanjut/again/next_ untuk main lagi, atau _stop/nyerah_ untuk berhenti",
    stopped: "🛑 *Permainan dihentikan*",
  },
});

/** @type {Map<string, { answer: number, timeout: NodeJS.Timeout, xp: number, questionId: string, level: string, done: boolean, resultId: string }>} */
const sessions = new Map();

const REPLAY_WORDS = new Set(["lagi", "lanjut", "again", "next"]);
const STOP_WORDS = new Set(["stop", "nyerah"]);

const LEVELS = {
  easy: { range: 50, mult: 10, xp: 20 },
  medium: { range: 200, mult: 20, xp: 40 },
  hard: { range: 1000, mult: 50, xp: 60 },
  impossible: { range: 5000, mult: 100, xp: 150 },
};

const LEVEL_ALIAS = {
  e: "easy",
  m: "medium",
  h: "hard",
  i: "impossible",
};

function startGame(c, levelName) {
  const selectedLevel = LEVEL_ALIAS[levelName] || levelName || "easy";
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

  const xpReward = level.xp;

  const texts = [
    t("question_header", { level: selectedLevel.toUpperCase() }, c),
    t("question_query", { a, op, b }, c),
    "",
    t("question_time", {}, c),
    t("question_reward", { xp: xpReward }, c),
    "",
    t("question_note", {}, c),
    t("question_reply", {}, c),
  ];

  c.reply({ text: texts.join("\n") }, { quoted: c.event }).then((resp) => {
    if (!resp) return;
    const timeout = setTimeout(() => {
      const s = sessions.get(c.chat);
      if (!s || s.done) return;
      s.done = true;
      c.reply({ text: t("timeout", { answer }, c) }, { quoted: c.event })
        .then((r) => { if (r) s.resultId = r.key.id; });
    }, 30000);

    sessions.set(c.chat, {
      answer,
      timeout,
      xp: xpReward,
      questionId: resp.key.id,
      level: selectedLevel,
      done: false,
      resultId: "",
    });
  });
}

/** @type {import('#mushi').Plugin[]} */
export default [
  {
    name: "games-math",
    cmd: ["math", "math?"],
    includes: ["games-math-listener"],
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
          "🟢 `e` / `easy` : 20 XP",
          "🟡 `m` / `medium` : 40 XP",
          "🔴 `h` / `hard` : 60 XP",
          "💀 `i` / `impossible` : 150 XP",
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

      const existing = sessions.get(c.chat);
      if (existing && !existing.done) {
        return await c.reply(
          { text: t("session_active", {}, c) },
          { quoted: c.event },
        );
      }

      startGame(c, levelArg);
    },
  },
  {
    name: "games-math-listener",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!sessions.has(c.chat) || c.isCMD) return;
      const session = sessions.get(c.chat);

      if (!session.done) {
        if (c.stanzaId !== session.questionId) return;

        const userAnswer = parseInt(c.text, 10);
        const text = c.text?.toLowerCase().trim();

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
                  answer: session.answer,
                  xp,
                },
                c,
              ),
              mentions: [c.senderJid],
            },
            { quoted: c.event },
          );
          if (result) session.resultId = result.key.id;
        } else if (STOP_WORDS.has(text)) {
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
          startGame(c, session.level);
        } else if (STOP_WORDS.has(text)) {
          sessions.delete(c.chat);
          await c.reply({ text: t("stopped", {}, c) }, { quoted: c.event });
        }
      }
    },
  },
];
