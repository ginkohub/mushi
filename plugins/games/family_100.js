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
    help_title: "👨‍👩‍👧‍👦 *FAMILY 100*",
    help_desc: "Guess the most popular answers from a survey!",
    help_usage: "Use `.family100` or `.f100` to start.",
    help_important: "⚠️ *Important:*",
    help_reply: "- Must *Reply/Quote* the question to answer.",
    help_timeout_hint: "- Game lasts 90 seconds.",
    help_admin: "⚙️ *Admin:* `{prefix}f100.update` to sync question list.",
    session_active: "❌ There is still an active game in this chat!",
    no_data: "❌ Question data not found! Use `{prefix}f100.update` (Admin).",
    question_header: "👨‍👩‍👧‍👦 *FAMILY 100*",
    question_soal: "📋 *Question:* {soal}",
    question_hint: "💡 There are *{count}* answers. Find them all!",
    game_board:
      "━━━━━━━━━━━━━━\n{board}\n━━━━━━━━━━━━━━\n❌ *Strikes:* {strikes}/3\n{remaining}",
    answer_revealed: "✅ *{answer}* — {points} pts (by @{user})",
    strike: "❌ *Wrong!* Strike {strike}/3",
    game_over:
      "🏁 *Game Over!*\n\n*Question:* {soal}\n\n{answers}\n\nTotal points: *{total}* 🎯",
    timeout: "⌛ *Time's up!*\n\n*Question:* {soal}\n\n{answers}",
    sync_success: "✅ *Sync Success!*",
    sync_stats: "Successfully loaded {count} questions.",
    sync_failed: "❌ *Sync Failed:* {error}",
    stopped: "🛑 *Game stopped*",
  },
  id: {
    help_title: "👨‍👩‍👧‍👦 *FAMILY 100*",
    help_desc: "Tebak jawaban terbanyak dari sebuah survei!",
    help_usage: "Gunakan perintah `.family100` atau `.f100` untuk memulai.",
    help_important: "⚠️ *Penting:*",
    help_reply: "- Harus *Reply/Quote* pesan soal untuk menjawab.",
    help_timeout_hint: "- Permainan berlangsung 90 detik.",
    help_admin: "⚙️ *Admin:* `{prefix}f100.update` untuk sinkronisasi soal.",
    session_active: "❌ Masih ada permainan yang aktif di grup ini!",
    no_data:
      "❌ Data soal tidak ditemukan! Gunakan `{prefix}f100.update` (Admin).",
    question_header: "👨‍👩‍👧‍👦 *FAMILY 100*",
    question_soal: "📋 *Pertanyaan:* {soal}",
    question_hint: "💡 Ada *{count}* jawaban. Temukan semuanya!",
    game_board:
      "━━━━━━━━━━━━━━\n{board}\n━━━━━━━━━━━━━━\n❌ *Salah:* {strikes}/3\n{remaining}",
    answer_revealed: "✅ *{answer}* — {points} pts (oleh @{user})",
    strike: "❌ *Salah!* Salah {strike}/3",
    game_over:
      "🏁 *Permainan Selesai!*\n\n*Pertanyaan:* {soal}\n\n{answers}\n\nTotal poin: *{total}* 🎯",
    timeout: "⌛ *Waktu habis!*\n\n*Pertanyaan:* {soal}\n\n{answers}",
    sync_success: "✅ *Sinkronisasi Berhasil!*",
    sync_stats: "Berhasil memuat {count} soal.",
    sync_failed: "❌ *Sinkronisasi Gagal:* {error}",
    stopped: "🛑 *Permainan dihentikan*",
  },
});

const JSON_URL =
  "https://raw.githubusercontent.com/ginkohub/game-assets/main/family-100/data.json";

const MAX_STRIKES = 3;
const GAME_DURATION_MS = 90000;

const POINTS = [
  30, 25, 20, 15, 10, 8, 6, 5, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
];

/**
 * @typedef {Object} F100Session
 * @property {string} soal
 * @property {string[]} jawaban
 * @property {boolean[]} found
 * @property {number} strikes
 * @property {number} totalPoints
 * @property {string} questionId
 * @property {NodeJS.Timeout} timeout
 * @property {boolean} done
 * @property {string} resultId
 */

/** @type {Map<string, F100Session>} */
const sessions = new Map();

const REPLAY_WORDS = new Set(["lagi", "lanjut", "again", "next"]);
const STOP_WORDS = new Set(["stop", "nyerah"]);

/** @type {{soal: string, jawaban: string[]}[]} */
let questions = [];

function loadQuestions() {
  try {
    const path = getFile("family_100.json");
    if (existsSync(path)) {
      questions = JSON.parse(readFileSync(path, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load family_100.json:", e);
  }
}

loadQuestions();

async function autoFetch(c) {
  try {
    const res = await fetch(JSON_URL);
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data)) return;
    const path = getFile("family_100.json");
    writeFileSync(path, JSON.stringify(data, null, 2));
    questions = data;
    c.log().info(`auto-fetched ${data.length} questions`);
  } catch (e) {
    c.log().error(`auto-fetch failed: ${e.message}`);
  }
}

function renderBoard(session) {
  return session.jawaban
    .map((ans, i) => {
      if (session.found[i]) {
        const pts = POINTS[i] || 1;
        return `${i + 1}. ✅ *${ans.toUpperCase()}* — ${pts}`;
      }
      return `${i + 1}. ❓`;
    })
    .join("\n");
}

function startGame(c) {
  if (questions.length === 0) {
    c.reply(
      { text: t("no_data", { prefix: c.prefix }, c) },
      { quoted: c.event },
    );
    return;
  }

  const q = questions[Math.floor(Math.random() * questions.length)];
  const answers = q.jawaban;

  const remaining = answers.length;

  const text = [
    t("question_header", {}, c),
    "",
    t("question_soal", { soal: q.soal }, c),
    "",
    t("question_hint", { count: remaining }, c),
    "",
    t(
      "game_board",
      {
        board: renderBoard({
          jawaban: answers,
          found: answers.map(() => false),
        }),
        strikes: "0",
        remaining: `_Reply with your guess!_`,
      },
      c,
    ),
  ].join("\n");

  c.reply({ text }, { quoted: c.event }).then((resp) => {
    if (!resp) return;

    const timeout = setTimeout(() => {
      const s = sessions.get(c.chat);
      if (!s || s.done) return;
      s.done = true;

      const revealed = s.jawaban
        .map((ans, i) => `${i + 1}. *${ans.toUpperCase()}*`)
        .join("\n");

      c.reply(
        {
          text: t(
            "timeout",
            {
              soal: s.soal,
              answers: revealed,
            },
            c,
          ),
        },
        { quoted: c.event },
      ).then((r) => {
        if (r) s.resultId = r.key.id;
      });
    }, GAME_DURATION_MS);

    sessions.set(c.chat, {
      soal: q.soal,
      jawaban: answers,
      found: answers.map(() => false),
      strikes: 0,
      totalPoints: 0,
      questionId: resp.key.id,
      timeout,
      done: false,
      resultId: "",
    });
  });
}

/** @type {import('#mushi').Plugin[]} */
export default [
  {
    name: "games-family100",
    cmd: ["family100", "f100", "family100?"],
    includes: ["games-family100-listener", "games-family100-updater"],
    cat: "games",
    tags: ["game"],
    desc: "Family 100 quiz game",
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

      if (questions.length === 0) await autoFetch(c);
      startGame(c);
    },
  },
  {
    name: "games-family100-updater",
    cmd: ["f100.update", "family100.update"],
    cat: "games",
    tags: ["game", "admin"],
    desc: "Sync questions for Family 100 game",
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

        const path = getFile("family_100.json");
        writeFileSync(path, JSON.stringify(data, null, 2));

        questions = data;

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
    name: "games-family100-listener",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!sessions.has(c.chat) || c.isCMD) return;
      const session = sessions.get(c.chat);

      if (!session.done) {
        if (c.stanzaId !== session.questionId) return;

        const userAnswer = c.text?.toLowerCase().trim();
        if (!userAnswer) return;

        if (STOP_WORDS.has(userAnswer)) {
          clearTimeout(session.timeout);
          sessions.delete(c.chat);
          await c.reply({ text: t("stopped", {}, c) }, { quoted: c.event });
          return;
        }

        let foundIdx = -1;
        for (let i = 0; i < session.jawaban.length; i++) {
          if (
            !session.found[i] &&
            session.jawaban[i].toLowerCase().trim() === userAnswer
          ) {
            foundIdx = i;
            break;
          }
        }

        if (foundIdx >= 0) {
          session.found[foundIdx] = true;
          const pts = POINTS[foundIdx] || 1;
          session.totalPoints += pts;

          const allFound = session.found.every(Boolean);

          const remaining = session.found.filter((f) => !f).length;
          const board = renderBoard(session);
          const boardText = t(
            "game_board",
            {
              board,
              strikes: String(session.strikes),
              remaining: allFound
                ? "🎉 *All answers found!*"
                : `_${remaining} answers remaining_`,
            },
            c,
          );

          const resultText = `${t("answer_revealed", { answer: session.jawaban[foundIdx].toUpperCase(), points: pts, user: c.senderJid.split("@")[0] }, c)}\n\n${boardText}`;

          await c.reply(
            { text: resultText, mentions: [c.senderJid] },
            { quoted: c.event },
          );

          if (allFound) {
            clearTimeout(session.timeout);
            session.done = true;

            const revealed = session.jawaban
              .map(
                (ans, i) =>
                  `${i + 1}. *${ans.toUpperCase()}* — ${POINTS[i] || 1} pts`,
              )
              .join("\n");

            const finalText = t(
              "game_over",
              {
                soal: session.soal,
                answers: revealed,
                total: session.totalPoints,
              },
              c,
            );

            const xp = session.totalPoints;
            const user = c.user;
            if (user) {
              user.xp += xp;
              c.client().userManager.updateUser(c.senderJid, user);
            }

            await c
              .reply(
                { text: `${finalText}\n\n🌟 *+${xp} XP*` },
                { quoted: c.event },
              )
              .then((r) => {
                if (r) session.resultId = r.key.id;
              });
          }
        } else {
          session.strikes += 1;

          if (session.strikes >= MAX_STRIKES) {
            clearTimeout(session.timeout);
            session.done = true;

            const revealed = session.jawaban
              .map(
                (ans, i) =>
                  `${i + 1}. *${ans.toUpperCase()}* — ${POINTS[i] || 1} pts`,
              )
              .join("\n");

            await c
              .reply(
                {
                  text: t(
                    "game_over",
                    {
                      soal: session.soal,
                      answers: revealed,
                      total: session.totalPoints,
                    },
                    c,
                  ),
                },
                { quoted: c.event },
              )
              .then((r) => {
                if (r) session.resultId = r.key.id;
              });
          } else {
            await c.reply(
              { text: t("strike", { strike: String(session.strikes) }, c) },
              { quoted: c.event },
            );
          }
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
];
