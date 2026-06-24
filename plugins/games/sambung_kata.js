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
    help_title: "🔗 *WORD CHAIN (SAMBUNG KATA)*",
    help_desc:
      "Take turns chaining words! Each word must start with the last letter of the previous word.",
    help_usage: "Use `.sambungkata` or `.skata` to start.",
    help_important: "⚠️ *Important:*",
    help_reply: "- Must *Reply/Quote* the question to answer.",
    help_timeout_hint: "- Each turn has a 60 second time limit.",
    help_admin: "⚙️ *Admin:* `{prefix}skata.update` to sync word list.",
    session_active: "❌ There is still an active game in this chat!",
    no_data: "❌ Word data not found! Use `{prefix}skata.update` (Admin).",
    game_started:
      "🔗 *SAMBUNG KATA*\n\n📝 *First word:* *{word}*\n\n⚡ Reply with a word starting with *{letter}*!\n📖 Type *stop* to end.",
    turn: "🔗 *{word}*\n\n⚡ Reply with a word starting with *{letter}*!\n👤 *Turn:* anyone\n⏱️ 60 seconds",
    correct:
      "✅ *{word}* ({points} pts) — by @{user}\n🌟 *+{xp} XP*\n\n🔗 *{nextWord}*\n\n⚡ Reply with a word starting with *{letter}*!",
    invalid_word: "❌ *{word}* is not a valid word!",
    invalid_letter: "❌ *{word}* must start with *{letter}*!",
    duplicate_word: "❌ *{word}* has already been used!",
    timeout:
      "⌛ *Time's up!*\n\n🏁 *Game Over!*\nTotal words: *{count}*\nTotal points: *{total}*",
    stopped:
      "🛑 *Game stopped*\n\n🏁 *Game Over!*\nTotal words: *{count}*\nTotal points: *{total}*",
    sync_success: "✅ *Sync Success!*",
    sync_stats: "Successfully loaded {count} words.",
    sync_failed: "❌ *Sync Failed:* {error}",
  },
  id: {
    help_title: "🔗 *SAMBUNG KATA*",
    help_desc:
      "Sambung kata secara bergiliran! Setiap kata harus dimulai dengan huruf terakhir dari kata sebelumnya.",
    help_usage: "Gunakan perintah `.sambungkata` atau `.skata` untuk memulai.",
    help_important: "⚠️ *Penting:*",
    help_reply: "- Harus *Reply/Quote* pesan soal untuk menjawab.",
    help_timeout_hint: "- Setiap giliran memiliki batas waktu 60 detik.",
    help_admin: "⚙️ *Admin:* `{prefix}skata.update` untuk sinkronisasi kata.",
    session_active: "❌ Masih ada permainan yang aktif di grup ini!",
    no_data:
      "❌ Data kata tidak ditemukan! Gunakan `{prefix}skata.update` (Admin).",
    game_started:
      "🔗 *SAMBUNG KATA*\n\n📝 *Kata pertama:* *{word}*\n\n⚡ Balas dengan kata berawalan *{letter}*!\n📖 Ketik *stop* untuk berhenti.",
    turn: "🔗 *{word}*\n\n⚡ Balas dengan kata berawalan *{letter}*!\n👤 *Giliran:* siapa saja\n⏱️ 60 detik",
    correct:
      "✅ *{word}* ({points} pts) — oleh @{user}\n🌟 *+{xp} XP*\n\n🔗 *{nextWord}*\n\n⚡ Balas dengan kata berawalan *{letter}*!",
    invalid_word: "❌ *{word}* bukan kata yang valid!",
    invalid_letter: "❌ *{word}* harus berawalan *{letter}*!",
    duplicate_word: "❌ *{word}* sudah pernah digunakan!",
    timeout:
      "⌛ *Waktu habis!*\n\n🏁 *Permainan Selesai!*\nTotal kata: *{count}*\nTotal poin: *{total}*",
    stopped:
      "🛑 *Permainan dihentikan*\n\n🏁 *Permainan Selesai!*\nTotal kata: *{count}*\nTotal poin: *{total}*",
    sync_success: "✅ *Sinkronisasi Berhasil!*",
    sync_stats: "Berhasil memuat {count} kata.",
    sync_failed: "❌ *Sinkronisasi Gagal:* {error}",
  },
});

const DATA_URL =
  "https://raw.githubusercontent.com/ginkohub/game-assets/main/sambung-kata/data.txt";
const TURN_TIMEOUT_MS = 60000;

/** @type {Map<string, { used: Set<string>, timeout: NodeJS.Timeout, word: string, totalPoints: number, questionId: string, done: boolean, resultId: string }>} */
const sessions = new Map();

const STOP_WORDS = new Set(["stop", "nyerah"]);

/** @type {Set<string>} */
let dictionary = new Set();

function loadDictionary() {
  try {
    const path = getFile("sambung_kata.txt");
    if (existsSync(path)) {
      const text = readFileSync(path, "utf-8");
      dictionary = new Set(
        text
          .split("\n")
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean),
      );
    }
  } catch (e) {
    console.error("Failed to load sambung_kata.txt:", e);
  }
}

loadDictionary();

async function autoFetch(c) {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) return;
    const text = await res.text();
    const path = getFile("sambung_kata.txt");
    writeFileSync(path, text, "utf-8");
    dictionary = new Set(
      text
        .split("\n")
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean),
    );
    c.log().info(`auto-fetched ${dictionary.size} words`);
  } catch (e) {
    c.log().error(`auto-fetch failed: ${e.message}`);
  }
}

function pickRandomWord() {
  const words = [...dictionary];
  return words[Math.floor(Math.random() * words.length)];
}

const _KONSONAN = new Set([
  "q",
  "w",
  "r",
  "t",
  "y",
  "p",
  "s",
  "d",
  "f",
  "g",
  "h",
  "j",
  "k",
  "l",
  "z",
  "x",
  "c",
  "v",
  "b",
  "n",
  "m",
]);

function sukuKata(text) {
  if (text.length < 3) return text;

  /* kons ganda: "tanduk" → "k", "lempar" → "r" */
  if (/([qwrtypsdfghjklzxcvbnm][qwrtypsdfhjklzxcvbnm])$/.test(text)) {
    return /([qwrtypsdfhjklzxcvbnm])$/.exec(text)[0];
  }

  /* kons + vokal + ng: "pisang" → "ng", "kijang" → "ng" */
  if (/([qwrtypsdfghjklzxcvbnm][aiueo]ng)$/.test(text)) {
    return /([qwrtypsdfghjklzxcvbnm][aiueo]ng)$/.exec(text)[0];
  }

  /* vokal rangkap ± kons: "tiup" → "up", "portofolio" → "o" */
  if (/([aiueo][aiueo]([qwrtypsdfghjklzxcvbnm]|ng)?)$/i.test(text)) {
    if (/(ng)$/i.test(text)) return text.slice(-3);
    if (/([qwrtypsdfghjklzxcvbnm])$/i.test(text)) return text.slice(-2);
    return text.slice(-1);
  }

  /* ng/ny + vokal + kons: "sinyal" → "nyal", "langit" → "ngit" */
  const m = /n[gy]([aiueo]([qwrtypsdfghjklzxcvbnm])?)$/.exec(text);
  if (m) return m[0];

  /* konsonan akhir: "kuku" → "ku", "batu" → "tu" */
  const kons = [...text].filter((c) => _KONSONAN.has(c));
  let last = kons[kons.length - 1];
  for (const h of _KONSONAN) {
    if (text.endsWith(h)) {
      last = kons[kons.length - 2];
      break;
    }
  }
  const parts = text.split(last);
  return text.endsWith(last)
    ? last + parts[parts.length - 2] + last
    : last + parts.pop();
}

function startGame(c) {
  if (dictionary.size === 0) {
    c.reply(
      { text: t("no_data", { prefix: c.prefix }, c) },
      { quoted: c.event },
    );
    return;
  }

  const word = pickRandomWord();
  const suku = sukuKata(word);

  const text = t(
    "game_started",
    { word: word.toUpperCase(), letter: suku.toUpperCase() },
    c,
  );

  c.reply({ text }, { quoted: c.event }).then((resp) => {
    if (!resp) return;
    const timeout = setTimeout(() => {
      endGame(c);
    }, TURN_TIMEOUT_MS);

    sessions.set(c.chat, {
      used: new Set([word]),
      timeout,
      word,
      totalPoints: 0,
      questionId: resp.key.id,
      done: false,
      resultId: "",
    });
  });
}

function endGame(c) {
  const s = sessions.get(c.chat);
  if (!s || s.done) return;
  s.done = true;
  clearTimeout(s.timeout);

  c.reply(
    {
      text: t("timeout", { count: s.used.size, total: s.totalPoints }, c),
    },
    { quoted: c.event },
  ).then((r) => {
    if (r) s.resultId = r.key.id;
  });
}

/** @type {import('#mushi').Plugin[]} */
export default [
  {
    name: "games-sambungkata",
    cmd: ["sambungkata", "skata", "sambungkata?"],
    includes: ["games-sambungkata-listener", "games-sambungkata-updater"],
    cat: "games",
    tags: ["game"],
    desc: "Word chain game (Sambung Kata)",
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

      if (dictionary.size === 0) await autoFetch(c);
      startGame(c);
    },
  },
  {
    name: "games-sambungkata-updater",
    cmd: ["skata.update", "sambungkata.update"],
    cat: "games",
    tags: ["game", "admin"],
    desc: "Sync word list for Sambung Kata game",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],
    exec: async (c) => {
      await c.react("⌛");
      try {
        const response = await fetch(DATA_URL);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const text = await response.text();

        const path = getFile("sambung_kata.txt");
        writeFileSync(path, text, "utf-8");

        dictionary = new Set(
          text
            .split("\n")
            .map((w) => w.trim().toLowerCase())
            .filter(Boolean),
        );

        const stats = `${t("sync_success", {}, c)}\n\n${t("sync_stats", { count: dictionary.size }, c)}`;

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
    name: "games-sambungkata-listener",
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
          session.done = true;

          await c
            .reply(
              {
                text: t(
                  "stopped",
                  { count: session.used.size, total: session.totalPoints },
                  c,
                ),
              },
              { quoted: c.event },
            )
            .then((r) => {
              if (r) session.resultId = r.key.id;
            });
          return;
        }

        const suku = sukuKata(session.word);
        if (!userAnswer.startsWith(suku)) {
          await c.reply(
            {
              text: t(
                "invalid_letter",
                { word: userAnswer.toUpperCase(), letter: suku.toUpperCase() },
                c,
              ),
            },
            { quoted: c.event },
          );
          return;
        }

        if (session.used.has(userAnswer)) {
          await c.reply(
            {
              text: t("duplicate_word", { word: userAnswer.toUpperCase() }, c),
            },
            { quoted: c.event },
          );
          return;
        }

        if (!dictionary.has(userAnswer)) {
          await c.reply(
            { text: t("invalid_word", { word: userAnswer.toUpperCase() }, c) },
            { quoted: c.event },
          );
          return;
        }

        clearTimeout(session.timeout);
        session.word = userAnswer;
        session.used.add(userAnswer);
        session.totalPoints += userAnswer.length;

        const nextSuku = sukuKata(userAnswer);
        const timeout = setTimeout(() => {
          endGame(c);
        }, TURN_TIMEOUT_MS);
        session.timeout = timeout;

        const xpReward = userAnswer.length * 10;
        const user = c.user;
        if (user) {
          user.xp += xpReward;
          c.client().userManager.updateUser(c.senderJid, user);
        }

        const replyText = t(
          "correct",
          {
            word: userAnswer.toUpperCase(),
            points: userAnswer.length,
            xp: xpReward,
            user: c.senderJid.split("@")[0],
            nextWord: session.word.toUpperCase(),
            letter: nextSuku.toUpperCase(),
          },
          c,
        );

        await c
          .reply(
            { text: replyText, mentions: [c.senderJid] },
            { quoted: c.event },
          )
          .then((resp) => {
            if (resp) session.questionId = resp.key.id;
          });
      } else {
        /* game over, no replay for multi-session chain games */
      }
    },
  },
];
