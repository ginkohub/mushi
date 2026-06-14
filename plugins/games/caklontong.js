/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

/**
 * Credits to MichaelAgam23 for game data (https://github.com/MichaelAgam23/metadata).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getFile, MESSAGES_UPSERT, Role, translate } from "#mushi";

const t = translate({
  en: {
    help_title: "🍟 *CAK LONTONG GAME*",
    help_desc: "Answer the funny/illogical riddles!",
    help_usage: "Use `.caklontong` or `.cl` to start.",
    help_important: "⚠️ *Important:*",
    help_reply: "- Must *Reply/Quote* the question to answer.",
    help_timeout_hint: "- Time limit is 45 seconds.",
    help_admin: "⚙️ *Admin:* `{prefix}cl.update` to sync riddles.",
    session_active: "❌ There is still an active riddle in this chat!",
    no_data: "❌ Riddle data not found! Use `{prefix}cl.update` (Admin).",
    question_header: "🍟 *CAK LONTONG*",
    question_time: "⏱️ *Time:* 45 seconds",
    question_reward: "🎁 *Reward:* {xp} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply to this message to answer!_",
    timeout: "⌛ *Time's up!*\nThe answer was: *{answer}*\n_{desc}_",
    sync_success: "✅ *Sync Success!*",
    sync_stats: "Successfully loaded {count} riddles.",
    sync_failed: "❌ *Sync Failed:* {error}",
    correct:
      "🎉 *Congratulations* @{user}!\nYour answer is correct: *{answer}*\n\n🌟 *+{xp} XP*\n\n_{desc}_\n\nReply _lagi/again/next_ to play again, or _stop/nyerah_ to stop",
    stopped: "🛑 *Game stopped*",
  },
  id: {
    help_title: "🍟 *GAME CAK LONTONG*",
    help_desc: "Jawablah teka-teki sulit dan lucu ala Cak Lontong!",
    help_usage: "Gunakan perintah `.caklontong` atau `.cl` untuk memulai.",
    help_important: "⚠️ *Penting:*",
    help_reply: "- Harus *Reply/Quote* pesan soal untuk menjawab.",
    help_timeout_hint: "- Waktu menjawab adalah 45 detik.",
    help_admin: "⚙️ *Admin:* `{prefix}cl.update` untuk sinkronisasi soal.",
    session_active: "❌ Masih ada soal yang belum terjawab di grup ini!",
    no_data:
      "❌ Data soal tidak ditemukan! Gunakan `{prefix}cl.update` (Admin).",
    question_header: "🍟 *CAK LONTONG*",
    question_time: "⏱️ *Waktu:* 45 detik",
    question_reward: "🎁 *Hadiah:* {xp} XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply chat ini untuk menjawab!_",
    timeout: "⌛ *Waktu habis!*\nJawabannya adalah: *{answer}*\n_{desc}_",
    sync_success: "✅ *Sinkronisasi Berhasil!*",
    sync_stats: "Berhasil memuat {count} soal.",
    sync_failed: "❌ *Sinkronisasi Gagal:* {error}",
    correct:
      "🎉 *Selamat* @{user}!\nJawaban kamu benar: *{answer}*\n\n🌟 *+{xp} XP*\n\n_{desc}_\n\nBalas _lagi/lanjut/again/next_ untuk main lagi, atau _stop/nyerah_ untuk berhenti",
    stopped: "🛑 *Permainan dihentikan*",
  },
});

const JSON_URL =
  "https://raw.githubusercontent.com/MichaelAgam23/metadata/main/caklontong.json";

/** @type {Map<string, { answer: string, timeout: NodeJS.Timeout, xp: number, questionId: string, desc: string, done: boolean, resultId: string }>} */
const sessions = new Map();

const REPLAY_WORDS = new Set(["lagi", "lanjut", "again", "next"]);
const STOP_WORDS = new Set(["stop", "nyerah"]);

/** @type {{soal: string, jawaban: string, deskripsi: string}[]} */
let questions = [];

/**
 * Load questions from JSON file
 */
function loadQuestions() {
  try {
    const path = getFile("caklontong.json");
    if (existsSync(path)) {
      questions = JSON.parse(readFileSync(path, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load caklontong.json:", e);
  }
}

// Initial load
loadQuestions();

function startGame(c) {
  if (questions.length === 0) {
    c.reply(
      { text: t("no_data", { prefix: c.prefix }, c) },
      { quoted: c.event },
    );
    return;
  }

  const q = questions[Math.floor(Math.random() * questions.length)];
  const answer = q.jawaban.toLowerCase().trim();
  const xpReward = answer.length * 10;

  const texts = [
    t("question_header", {}, c),
    "",
    `"${q.soal}"`,
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
      c.reply(
        { text: t("timeout", { answer: q.jawaban, desc: q.deskripsi }, c) },
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
      desc: q.deskripsi,
      done: false,
      resultId: "",
    });
  });
}

/** @type {import('#mushi').Plugin[]} */
export default [
  {
    name: "games-caklontong",
    cmd: ["caklontong", "cl", "caklontong?"],
    includes: ["games-caklontong-listener", "games-caklontong-updater"],
    cat: "games",
    tags: ["game"],
    desc: "Cak Lontong puzzle game",
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

      startGame(c);
    },
  },
  {
    name: "games-caklontong-updater",
    cmd: ["cl.update", "caklontong.update"],
    cat: "games",
    tags: ["game", "admin"],
    desc: "Sync questions for Cak Lontong game",
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

        const path = getFile("caklontong.json");
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
    name: "games-caklontong-listener",
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
                  xp,
                  desc: session.desc,
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
];
