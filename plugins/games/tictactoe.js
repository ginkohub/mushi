/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { delay, MESSAGES_UPSERT, Role, translate } from "#mushi";

const t = translate({
  en: {
    help_title: "❌ *TIC-TAC-TOE (TTT)* ⭕",
    help_desc: "Play Tic-Tac-Toe against the AI or challenge a friend!",
    help_usage:
      "Commands:\n- `.ttt` : Play against the bot.\n- `.ttt @user` : Challenge a friend.",
    help_rules: "📝 *How to Play:*",
    help_rule_1:
      "- Reply/Quote the board message with a number `1-9` to make a move.",
    help_rule_2: "- Get 3 in a row (horizontal, vertical, or diagonal) to win!",
    session_active: "❌ There is already an active game in this chat!",
    no_opponent:
      "❌ Invalid opponent! Please mention a valid user or use `.ttt` to play against the bot.",
    game_started:
      "🎮 *Tic-Tac-Toe Started!*\n❌ *Player 1:* {p1}\n⭕ *Player 2:* {p2}\n\n*Turn:* {turn}\n_Reply to the board with a number 1-9 to play._",
    invalid_turn: "⚠️ It's not your turn! Current turn: {turn}",
    invalid_move: "❌ Invalid move! Spot is already taken or not valid.",
    game_win:
      "🎉 *Congratulations!* {winner} won the game!\n🌟 *+{xp} XP* (after {turns} turns)",
    game_draw: "🤝 *Draw!* The game ended in a tie.",
    timeout: "⌛ *Game Timeout!* The game has ended due to inactivity.",
    turn_msg: "👉 *Turn:* {turn}",
    bot_thinking: "🤖 *Bot is thinking...*",
  },
  id: {
    help_title: "❌ *TIC-TAC-TOE (TTT)* ⭕",
    help_desc: "Mainkan Tic-Tac-Toe melawan bot atau tantang teman Anda!",
    help_usage:
      "Perintah:\n- `.ttt` : Bermain melawan bot.\n- `.ttt @user` : Menantang teman.",
    help_rules: "📝 *Cara Bermain:*",
    help_rule_1:
      "- Balas/Quote pesan papan game dengan angka `1-9` untuk melangkah.",
    help_rule_2:
      "- Dapatkan 3 baris (horizontal, vertikal, atau diagonal) untuk menang!",
    session_active:
      "❌ Sudah ada sesi game Tic-Tac-Toe yang aktif di obrolan ini!",
    no_opponent:
      "❌ Lawan tidak valid! Tag seseorang atau ketik `.ttt` untuk melawan bot.",
    game_started:
      "🎮 *Tic-Tac-Toe Dimulai!*\n❌ *Pemain 1:* {p1}\n⭕ *Pemain 2:* {p2}\n\n*Giliran:* {turn}\n_Balas pesan papan game dengan angka 1-9 untuk melangkah._",
    invalid_turn: "⚠️ Ini bukan giliranmu! Giliran saat ini: {turn}",
    invalid_move:
      "❌ Langkah tidak valid! Kotak sudah terisi atau tidak valid.",
    game_win:
      "🎉 *Selamat!* {winner} memenangkan permainan!\n🌟 *+{xp} XP* (setelah {turns} giliran)",
    game_draw: "🤝 *Seri!* Permainan berakhir dengan hasil imbang.",
    timeout: "⌛ *Waktu Habis!* Permainan berakhir karena tidak ada aktivitas.",
    turn_msg: "👉 *Giliran:* {turn}",
    bot_thinking: "🤖 *Bot sedang berpikir...*",
  },
});

const sessions = new Map();

const WIN_PATTERNS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const EMOJI_MAP = {
  " ": ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"],
  X: "❌",
  O: "⭕",
};

function renderBoard(board) {
  const lines = [];
  for (let i = 0; i < 9; i += 3) {
    const row = [
      board[i] === " " ? EMOJI_MAP[" "][i] : EMOJI_MAP[board[i]],
      board[i + 1] === " " ? EMOJI_MAP[" "][i + 1] : EMOJI_MAP[board[i + 1]],
      board[i + 2] === " " ? EMOJI_MAP[" "][i + 2] : EMOJI_MAP[board[i + 2]],
    ];
    lines.push(row.join(" | "));
  }
  return lines.join("\n-----------\n");
}

function checkWin(board, player) {
  return WIN_PATTERNS.some((pattern) =>
    pattern.every((index) => board[index] === player),
  );
}

function checkDraw(board) {
  return board.every((spot) => spot !== " ");
}

function getBotMove(board) {
  for (let i = 0; i < 9; i++) {
    if (board[i] === " ") {
      board[i] = "O";
      if (checkWin(board, "O")) {
        board[i] = " ";
        return i;
      }
      board[i] = " ";
    }
  }

  for (let i = 0; i < 9; i++) {
    if (board[i] === " ") {
      board[i] = "X";
      if (checkWin(board, "X")) {
        board[i] = " ";
        return i;
      }
      board[i] = " ";
    }
  }

  if (board[4] === " ") return 4;

  const corners = [0, 2, 6, 8].filter((i) => board[i] === " ");
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  const available = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === " ") available.push(i);
  }
  return available[Math.floor(Math.random() * available.length)];
}

function formatMention(jid) {
  if (jid === "bot") return "🤖 BOT";
  return `@${jid.split("@")[0]}`;
}

export default [
  {
    name: "games-tictactoe",
    cmd: ["tictactoe", "ttt", "tictactoe?"],
    includes: ["games-tictactoe-listener"],
    cat: "games",
    tags: ["game"],
    desc: "Play Tic-Tac-Toe",
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
          t("help_rules", {}, c),
          t("help_rule_1", {}, c),
          t("help_rule_2", {}, c),
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

      const jids = c.parseJIDs();
      let opponentJid = "bot";

      if (jids.length > 0) {
        opponentJid = jids[0];
        if (opponentJid.includes("@lid")) {
          opponentJid = await c.LIDToPN(opponentJid);
        }
        if (opponentJid === c.senderJid) {
          return await c.reply(
            { text: t("no_opponent", {}, c) },
            { quoted: c.event },
          );
        }
      }

      const board = Array(9).fill(" ");
      const playerX = c.senderJid;
      const playerO = opponentJid;
      const turn = playerX;

      const boardStr = renderBoard(board);
      const gameInfo = t(
        "game_started",
        {
          p1: formatMention(playerX),
          p2: formatMention(playerO),
          turn: formatMention(turn),
        },
        c,
      );

      const responseText = `${gameInfo}\n\n${boardStr}`;
      const mentions = [playerX, playerO].filter((p) => p !== "bot");

      const resp = await c.reply(
        { text: responseText, mentions },
        { quoted: c.event },
      );

      const timeout = setTimeout(async () => {
        if (sessions.has(c.chat)) {
          sessions.delete(c.chat);
          await c.reply({ text: t("timeout", {}, c) });
        }
      }, 60000);

      sessions.set(c.chat, {
        board,
        playerX,
        playerO,
        turn,
        boardIds: new Set([resp.key.id]),
        timeout,
        movesX: [],
        movesO: [],
      });
    },
  },
  {
    name: "games-tictactoe-listener",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      if (!sessions.has(c.chat) || c.isCMD) return;

      const session = sessions.get(c.chat);

      if (!session.boardIds.has(c.stanzaId)) return;
      const senderJid = c.senderJid;
      const move = parseInt(c.text?.trim(), 10) - 1;

      if (senderJid !== session.turn) {
        return await c.reply(
          { text: t("invalid_turn", { turn: formatMention(session.turn) }, c) },
          { quoted: c.event },
        );
      }

      if (
        Number.isNaN(move) ||
        move < 0 ||
        move > 8 ||
        session.board[move] !== " "
      ) {
        return await c.reply(
          { text: t("invalid_move", {}, c) },
          { quoted: c.event },
        );
      }

      clearTimeout(session.timeout);

      const currentMarker = session.turn === session.playerX ? "X" : "O";
      session.board[move] = currentMarker;

      const movesKey = currentMarker === "X" ? "movesX" : "movesO";
      session[movesKey].push(move);
      if (session[movesKey].length > 3) {
        const removed = session[movesKey].shift();
        session.board[removed] = " ";
      }

      if (checkWin(session.board, currentMarker)) {
        sessions.delete(c.chat);
        const totalMoves = session.movesX.length + session.movesO.length;
        const xp = totalMoves * 10;
        const boardStr = renderBoard(session.board);
        const winMsg = t(
          "game_win",
          { winner: formatMention(session.turn), xp, turns: totalMoves },
          c,
        );
        const user = c.user;
        if (user && session.turn !== "bot") {
          user.xp += xp;
          c.client().updateUser(session.turn, user);
        }
        const mentions = [session.playerX, session.playerO].filter(
          (p) => p !== "bot",
        );
        return await c.reply(
          { text: `${winMsg}\n\n${boardStr}`, mentions },
          { quoted: c.event },
        );
      }

      if (checkDraw(session.board)) {
        sessions.delete(c.chat);
        const boardStr = renderBoard(session.board);
        const drawMsg = t("game_draw", {}, c);
        const mentions = [session.playerX, session.playerO].filter(
          (p) => p !== "bot",
        );
        return await c.reply(
          { text: `${drawMsg}\n\n${boardStr}`, mentions },
          { quoted: c.event },
        );
      }

      session.turn =
        session.turn === session.playerX ? session.playerO : session.playerX;

      if (session.turn === "bot") {
        await c.react("⌛", c.event.key);
        await delay(1500);

        const botMove = getBotMove(session.board);
        session.board[botMove] = "O";

        session.movesO.push(botMove);
        if (session.movesO.length > 3) {
          const removed = session.movesO.shift();
          session.board[removed] = " ";
        }

        if (checkWin(session.board, "O")) {
          sessions.delete(c.chat);
          await c.react("", c.event.key);
          const totalMoves = session.movesX.length + session.movesO.length;
          const xp = totalMoves * 10;
          const boardStr = renderBoard(session.board);
          const winMsg = t(
            "game_win",
            { winner: formatMention("bot"), xp, turns: totalMoves },
            c,
          );
          const mentions = [session.playerX].filter((p) => p !== "bot");
          return await c.reply(
            { text: `${winMsg}\n\n${boardStr}`, mentions },
            { quoted: c.event },
          );
        }

        if (checkDraw(session.board)) {
          sessions.delete(c.chat);
          await c.react("", c.event.key);
          const boardStr = renderBoard(session.board);
          const drawMsg = t("game_draw", {}, c);
          const mentions = [session.playerX].filter((p) => p !== "bot");
          return await c.reply(
            { text: `${drawMsg}\n\n${boardStr}`, mentions },
            { quoted: c.event },
          );
        }

        session.turn = session.playerX;
        const boardStr = renderBoard(session.board);
        const nextTurnMsg = t(
          "turn_msg",
          { turn: formatMention(session.turn) },
          c,
        );
        const responseText = `${nextTurnMsg}\n\n${boardStr}`;
        const mentions = [session.playerX, session.playerO].filter(
          (p) => p !== "bot",
        );

        const botResp = await c.reply(
          { text: responseText, mentions },
          { quoted: c.event },
        );
        session.boardIds.add(botResp.key.id);

        await c.react("", c.event.key);

        session.timeout = setTimeout(async () => {
          if (sessions.has(c.chat)) {
            sessions.delete(c.chat);
            await c.reply({ text: t("timeout", {}, c) });
          }
        }, 60000);
        return;
      }

      const boardStr = renderBoard(session.board);
      const nextTurnMsg = t(
        "turn_msg",
        { turn: formatMention(session.turn) },
        c,
      );
      const responseText = `${nextTurnMsg}\n\n${boardStr}`;
      const mentions = [session.playerX, session.playerO].filter(
        (p) => p !== "bot",
      );

      const playerResp = await c.reply(
        { text: responseText, mentions },
        { quoted: c.event },
      );
      session.boardIds.add(playerResp.key.id);

      session.timeout = setTimeout(async () => {
        if (sessions.has(c.chat)) {
          sessions.delete(c.chat);
          await c.reply({ text: t("timeout", {}, c) });
        }
      }, 60000);
    },
  },
];
