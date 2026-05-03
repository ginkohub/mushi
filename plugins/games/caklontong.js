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
    question_reward: "🎁 *Reward:* 20-40 XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply to this message to answer!_",
    timeout: "⌛ *Time's up!*\nThe answer was: *{answer}*\n_{desc}_",
    sync_success: "✅ *Sync Success!*",
    sync_stats: "Successfully loaded {count} riddles.",
    sync_failed: "❌ *Sync Failed:* {error}",
    correct:
      "🎉 *Congratulations* @{user}!\nYour answer is correct: *{answer}*\n\n🌟 *+{xp} XP*\n\n_{desc}_",
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
    question_reward: "🎁 *Hadiah:* 20-40 XP",
    question_note: "📝 *Note:*",
    question_reply: "_Reply chat ini untuk menjawab!_",
    timeout: "⌛ *Waktu habis!*\nJawabannya adalah: *{answer}*\n_{desc}_",
    sync_success: "✅ *Sinkronisasi Berhasil!*",
    sync_stats: "Berhasil memuat {count} soal.",
    sync_failed: "❌ *Sinkronisasi Gagal:* {error}",
    correct:
      "🎉 *Selamat* @{user}!\nJawaban kamu benar: *{answer}*\n\n🌟 *+{xp} XP*\n\n_{desc}_",
  },
});

const JSON_URL =
  "https://raw.githubusercontent.com/MichaelAgam23/metadata/main/caklontong.json";

/** @type {Map<string, { answer: string, timeout: NodeJS.Timeout, xp: number, questionId: string, desc: string }>} */
const sessions = new Map();

/** @type {{soal: string, jawaban: string, deskripsi: string}[]} */
let questions = [];

/**
 * Load questions from JSON file
 */
function loadQuestions() {
  try {
    const path = getFile("caklontong.json");
    if (fs.existsSync(path)) {
      questions = JSON.parse(fs.readFileSync(path, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load caklontong.json:", e);
  }
}

// Initial load
loadQuestions();

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    cmd: ["caklontong", "cl", "caklontong?"],
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

      if (sessions.has(c.chat)) {
        return await c.reply(
          { text: t("session_active", {}, c) },
          { quoted: c.event },
        );
      }

      if (questions.length === 0) {
        return await c.reply(
          { text: t("no_data", { prefix: c.prefix }, c) },
          { quoted: c.event },
        );
      }

      const q = questions[Math.floor(Math.random() * questions.length)];
      const answer = q.jawaban.toLowerCase().trim();
      const xpReward = Math.floor(Math.random() * 21) + 20; // 20-40 XP

      const texts = [
        t("question_header", {}, c),
        "",
        `"${q.soal}"`,
        "",
        t("question_time", {}, c),
        t("question_reward", {}, c),
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
              text: t("timeout", { answer: q.jawaban, desc: q.deskripsi }, c),
            },
            { quoted: c.event },
          );
        }
      }, 45000);

      sessions.set(c.chat, {
        answer,
        timeout,
        xp: xpReward,
        questionId: resp.key.id,
        desc: q.deskripsi,
      });
    },
  },
  {
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
        fs.writeFileSync(path, JSON.stringify(data, null, 2));

        // Refresh local questions
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
                desc: session.desc,
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
