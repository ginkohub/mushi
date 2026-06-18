/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 *
 * Credits to Google Gemini AI for the generative AI capabilities.
 * This plugin uses Gemini Web (cookie-based) as an alternative to the API key method.
 */

import crypto from "node:crypto";
import { MESSAGES_UPSERT, Role, translate } from "#mushi";

const GEMINI_APP_URL = "https://gemini.google.com/app";
const GEMINI_STREAM_GENERATE_URL =
  "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate";

const MODEL_HEADER_NAME = "x-goog-ext-525001261-jspb";

function makeModelHeader(hash, idx) {
  return JSON.stringify([
    1,
    null,
    null,
    null,
    hash,
    null,
    null,
    0,
    [4, 5, 6, 8],
    null,
    null,
    2,
    null,
    null,
    idx,
    1,
    crypto.randomUUID(),
  ]);
}

const MODEL_HEADERS = {
  "gemini-3.1-pro": makeModelHeader("e6fa609c3fa255c0", 3),
  "gemini-3.5-flash": makeModelHeader("56fdd199312815e2", 1),
  "gemini-3.1-flash-lite": makeModelHeader("8c46e95b1a07cecc", 6),
};

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

function tagIt(tagName, content, attrs = {}) {
  return `<${tagName}${Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("")}>${content}</${tagName}>`;
}

class GeminiClient {
  #cachedAccessToken = null;
  #accessTokenTime = 0;
  #cookieMap = {};
  #timeout = 120000;

  constructor(cookieMap) {
    if (cookieMap) this.#cookieMap = { ...cookieMap };
  }

  #buildCookieHeader() {
    return Object.entries(this.#cookieMap)
      .filter(([, v]) => typeof v === "string" && v.length > 0)
      .map(([n, v]) => `${n}=${v}`)
      .join("; ");
  }

  async #getAccessToken() {
    const now = Date.now();
    if (
      this.#cachedAccessToken &&
      now - this.#accessTokenTime < 5 * 60 * 1000
    ) {
      return this.#cachedAccessToken;
    }
    const res = await fetch(GEMINI_APP_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Cookie: this.#buildCookieHeader(),
      },
    });
    const html = await res.text();
    for (const key of ["SNlM0e", "thykhd"]) {
      const match = html.match(new RegExp(`"${key}":"(.*?)"`));
      if (match?.[1]) {
        this.#cachedAccessToken = match[1];
        this.#accessTokenTime = now;
        return this.#cachedAccessToken;
      }
    }
    throw new Error("Failed to get access token. Cookies may be expired.");
  }

  #trimJsonEnvelope(text) {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("Invalid JSON response");
    return text.slice(start, end + 1);
  }

  #get(data, path, fallback) {
    let cur = data;
    for (const p of path) {
      if (cur == null) return fallback;
      cur = typeof p === "number" ? cur[p] : cur[p];
    }
    return cur ?? fallback;
  }

  #parseResponse(raw) {
    const parts = JSON.parse(this.#trimJsonEnvelope(raw));
    const texts = [];
    for (const part of parts) {
      const s = this.#get(part, [2], null);
      if (!s || typeof s !== "string") continue;
      try {
        const d = JSON.parse(s);
        const c = this.#get(d, [4, 0, 1, 0], null);
        if (c && typeof c === "string" && !c.includes("rc_")) texts.push(c);
      } catch { }
    }
    return (texts.sort((a, b) => b.length - a.length)[0] || "").trim();
  }

  async ask(prompt, model = DEFAULT_MODEL, info, systemPrompt) {
    const systems = [];
    const now = new Date();
    systems.push(
      tagIt("time", "", {
        utc: now.toISOString(),
        local: now.toLocaleString("sv-SE", { hour12: false }),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    );

    if (info) {
      if (info.user) systems.push(tagIt("user", "", info.user));
      if (info.chat) systems.push(tagIt("chat", info.chat));
      if (info.bot) systems.push(tagIt("bot", info.bot));
    }

    if (systemPrompt) systems.push(tagIt("instruction", systemPrompt));

    const fullPrompt = `${tagIt("system", systems.join("\n"))}\n\n${prompt}`;
    const at = await this.#getAccessToken();
    const fReq = JSON.stringify([
      null,
      JSON.stringify([[fullPrompt], null, null]),
    ]);
    const params = new URLSearchParams({ at, "f.req": fReq });

    const res = await fetch(GEMINI_STREAM_GENERATE_URL, {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        Cookie: this.#buildCookieHeader(),
        [MODEL_HEADER_NAME]:
          MODEL_HEADERS[model] || MODEL_HEADERS[DEFAULT_MODEL],
      },
      body: params.toString(),
      signal: AbortSignal.timeout(this.#timeout),
    });

    if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`);
    return this.#parseResponse(await res.text());
  }
}

const t = translate({
  en: {
    usage: "Usage: `.gmw <message>` or reply to a message",
    no_cookies:
      "Gemini Web cookies not set.\nUse `.gmwset cookies key=value key2=value2` first.",
    set_usage:
      "Usage: `.gmwset cookies <name>=<value> ...` or `.gmwset cookies clear`",
    set_done: "Cookies saved.",
    set_cleared: "Cookies cleared.",
    prompt_usage: "Usage: `.gmwset prompt <text>` or `.gmwset prompt clear`",
    prompt_updated: "System prompt updated.",
    prompt_cleared: "System prompt cleared.",
    prompt_current: "Current prompt:\n{val}",
    prompt_empty: "No system prompt set.",
  },
  id: {
    usage: "Gunakan: `.gmw <pesan>` atau balas pesan",
    no_cookies:
      "Cookie Gemini Web belum diatur.\nGunakan `.gmwset cookies key=value key2=value2` terlebih dahulu.",
    set_usage:
      "Gunakan: `.gmwset cookies <nama>=<nilai> ...` atau `.gmwset cookies clear`",
    set_done: "Cookie tersimpan.",
    set_cleared: "Cookie dihapus.",
    prompt_usage:
      "Gunakan: `.gmwset prompt <teks>` atau `.gmwset prompt clear`",
    prompt_updated: "Prompt sistem diperbarui.",
    prompt_cleared: "Prompt sistem dihapus.",
    prompt_current: "Prompt saat ini:\n{val}",
    prompt_empty: "Belum ada prompt sistem.",
  },
});

/** @type {Map<string, import('#mushi').Store>} */
const geminiStores = new Map();

function getStore(c) {
  const clientName = c.client()?.name;
  if (!clientName) return null;
  if (!geminiStores.has(clientName)) {
    const store = c.client().store.use("gemini_web_id");
    geminiStores.set(clientName, store);
  }
  return geminiStores.get(clientName);
}

function loadCookies(c) {
  const raw = c.client()?.settings.get("gemini_web_cookies");
  if (!raw) return {};
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

function saveCookies(c, map) {
  const existing = loadCookies(c);
  c.client()?.settings.set("gemini_web_cookies", { ...existing, ...map });
}

function getSystemPrompt(c) {
  return c.client()?.settings.get("gemini_web_prompt") || null;
}

async function processChat(c) {
  const query = c.isCMD ? (c.args || "").trim() : (c.text || "").trim();
  let prompt = query;

  if (c.quotedText) {
    const quoted = tagIt("quoted", c.quotedText, {
      name: c.senderName || "Unknown",
    });
    prompt = query ? `${quoted}\n${query}` : quoted;
  }

  if (!prompt)
    return await c.reply({ text: t("usage", {}, c) }, { quoted: c.event });

  const cookies = loadCookies(c);
  if (Object.keys(cookies).length === 0) {
    return await c.reply({ text: t("no_cookies", {}, c) }, { quoted: c.event });
  }

  await c.react("🧠");

  try {
    const client = new GeminiClient(cookies);
    const info = {
      user: { name: c.senderName || c.pushName || "Unknown" },
      chat: c.chatName || (c.isGroup ? c.chat : "Private Chat"),
      bot: c.me,
    };
    const systemPrompt = getSystemPrompt(c);
    const response = await client.ask(
      prompt,
      DEFAULT_MODEL,
      info,
      systemPrompt,
    );
    if (!response) return await c.react("❌");
    const sent = await c.reply({ text: response }, { quoted: c.event });
    if (sent?.key?.id) {
      const store = getStore(c);
      store?.set(sent.key.id, `${c.senderJid}_${c.chat}_${c.timestamp}`);
    }
    await c.react("");
  } catch (e) {
    c.log().error(`gmw-error: ${e.stack || e}`);
    await c.react("❌");
  }
}

/** @type {import('#mushi').Plugin} */
const chatPlugin = {
  name: "ai-gemini-web",
  cmd: ["gmw"],
  includes: ["ai-gemini-web-listener"],
  cat: "ai",
  desc: "Chat with Gemini Web (cookie-based, no API key)",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],
  exec: processChat,
};

/** @type {import('#mushi').Plugin} */
const listenerPlugin = {
  name: "ai-gemini-web-listener",
  desc: "Gemini Web reply listener",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],
  midware: async (c) => ({
    success: (await getStore(c))?.has(c.stanzaId),
  }),
  exec: processChat,
};

/** @type {import('#mushi').Plugin} */
const gmwsetPlugin = {
  name: "ai-gemini-web-set",
  cmd: ["gmwset"],
  cat: "ai",
  desc: "Set Gemini Web cookies and system prompt",
  roles: [Role.ADMIN],
  exec: async (c) => {
    const raw = (c.args || "").trim();
    const [sub, ...rest] = raw.split(/ +/);
    const val = rest.join(" ").trim();

    if (!raw || raw === "?") {
      const stored = loadCookies(c);
      const keys = Object.keys(stored);
      const prompt = getSystemPrompt(c);
      const lines = [];
      if (keys.length > 0) lines.push(`*Cookies:* ${keys.length} set`);
      if (prompt)
        lines.push(
          `*Prompt:* ${prompt.slice(0, 50)}${prompt.length > 50 ? "..." : ""}`,
        );
      if (lines.length === 0) lines.push("Nothing configured.");
      lines.push(
        "",
        `.gmwset cookies             — list cookies`,
        `.gmwset cookies key=val ... — set cookies`,
        `.gmwset cookies clear       — clear cookies`,
        `.gmwset prompt              — view prompt`,
        `.gmwset prompt <text>       — set prompt`,
        `.gmwset prompt clear        — clear prompt`,
      );
      return c.reply({ text: lines.join("\n") }, { quoted: c.event });
    }

    if (sub === "prompt") {
      if (!val) {
        const current = getSystemPrompt(c);
        if (!current)
          return c.reply(
            { text: t("prompt_empty", {}, c) },
            { quoted: c.event },
          );
        return c.reply(
          { text: t("prompt_current", { val: current }, c) },
          { quoted: c.event },
        );
      }
      if (val === "clear") {
        c.client()?.settings.delete("gemini_web_prompt");
        return c.reply(
          { text: t("prompt_cleared", {}, c) },
          { quoted: c.event },
        );
      }
      c.client()?.settings.set("gemini_web_prompt", val);
      return c.reply({ text: t("prompt_updated", {}, c) }, { quoted: c.event });
    }

    if (sub === "cookies") {
      if (!val) {
        const stored = loadCookies(c);
        const keys = Object.keys(stored);
        if (keys.length === 0)
          return c.reply({ text: "No cookies set." }, { quoted: c.event });
        return c.reply(
          { text: keys.map((k) => `${k}=${stored[k]}`).join("\n") },
          { quoted: c.event },
        );
      }
      if (val === "clear") {
        c.client()?.settings.delete("gemini_web_cookies");
        return c.reply({ text: t("set_cleared", {}, c) }, { quoted: c.event });
      }
      const map = {};
      for (const pair of val.split(/ +/)) {
        const sep = pair.indexOf("=");
        if (sep === -1) continue;
        const name = pair.slice(0, sep).trim();
        const value = pair
          .slice(sep + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
        if (name && value) map[name] = value;
      }
      if (Object.keys(map).length === 0) return c.react("❌");
      saveCookies(c, map);
      return c.reply({ text: t("set_done", {}, c) }, { quoted: c.event });
    }

    return c.reply({ text: t("prompt_usage", {}, c) }, { quoted: c.event });
  },
};

/** @type {import('#mushi').Plugin[]} */
export default [chatPlugin, listenerPlugin, gmwsetPlugin];
