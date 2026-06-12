/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub/mushi)
 */

import {
  extractTextContext,
  formatMD,
  MESSAGES_UPSERT,
  Role,
  translate,
} from "#mushi";
import { Gemini } from "./gemini.js";

/** @type {Map<string, import('#mushi').Store>} - To store ID */
const geminiStores = new Map();

/** @type {Map<string, import('./gemini.js').Gemini>} - To store Gemini client */
const geminiClients = new Map();

/**
 * @param {import('#mushi').Ctx} c
 * @returns {Promise<import('#mushi').Store|null>}
 */
async function getGeminiStore(c) {
  const clientName = c.client()?.name;
  if (!clientName) return null;

  if (!geminiStores.has(clientName)) {
    const store = c.client().store.use("gemini_id");
    geminiStores.set(clientName, store);
  }

  return geminiStores.get(clientName);
}

/**
 * @param {import('#mushi').Ctx} c
 * @returns {Promise<Gemini|null>}
 */
async function getGeminiClient(c) {
  const clientName = c.client()?.name;
  if (!clientName) return null;

  if (!geminiClients.has(clientName)) {
    const apiKey = c.client()?.settings?.get("gemini_api_key");

    if (!apiKey) {
      c.client().log.warn("gemini: no API key configured");
      return null;
    }

    try {
      const gemini = new Gemini({
        settings: c.client()?.settings,
        client: c.client(),
      });

      geminiClients.set(clientName, gemini);
      c.client().log.info(`gemini: initialized for ${clientName}`);
    } catch (e) {
      c.client().log.error("gemini-init", e);
      return null;
    }
  }

  return geminiClients.get(clientName);
}

const contentSupport = [
  "audioMessage",
  "imageMessage",
  "videoMessage",
  "documentMessage",
  "stickerMessage",
  "documentWithCaptionMessage",
];

const t = translate({
  en: {
    list_models: "*# List available models*",
    not_configured: "Gemini not configured. Use {prefix}gm.key to set API key.",
    model_set: "_Model set to {model}_",
    prompt_updated: "_Prompt updated successfully_",
    api_key_updated: "_API key updated_",
    usage_key: "Usage: {prefix}gm.key <api_key>",
    usage_chat: "Usage: {prefix}gm <message> or reply to a message",
  },
  id: {
    list_models: "*# Daftar model yang tersedia*",
    not_configured:
      "Gemini belum diatur. Gunakan {prefix}gm.key untuk mengatur API key.",
    model_set: "_Model diatur ke {model}_",
    prompt_updated: "_Prompt berhasil diperbarui_",
    api_key_updated: "_API key berhasil diperbarui_",
    usage_key: "Penggunaan: {prefix}gm.key <api_key>",
    usage_chat: "Penggunaan: {prefix}gm <pesan> atau balas pesan",
  },
});

/**
 * @param {import('#mushi').Ctx} c
 */
async function processChat(c) {
  let query = c.isCMD ? c.args : c.text;
  if (
    c.quotedText &&
    c.quotedText?.length > 0 &&
    !(await getGeminiStore(c))?.has(c.stanzaId)
  ) {
    query = query?.trim();
    if (query?.length > 0) {
      query = `${query} ${c.quotedText}`;
    } else {
      query = c.quotedText;
    }
  }

  /** @type {import('@google/genai').PartListUnion} */
  const parts = [];

  query = query?.trim() || "";

  if (query || query.length > 0) {
    parts.push({ text: query });
  } else {
    await c.reply({ text: t("usage_chat", {}, c) }, { quoted: c.event });
    return;
  }

  const msgs = [c.message, c.quotedMessage];
  for (let m of msgs) {
    const ext = extractTextContext(m);

    if (!m || !ext) continue;
    if (!contentSupport.includes(ext.type)) continue;

    let content = null;

    switch (ext.type) {
      case "audioMessage": {
        content = m.audioMessage;
        break;
      }
      case "imageMessage": {
        content = m.imageMessage;
        break;
      }
      case "videoMessage": {
        content = m.videoMessage;
        break;
      }
      case "documentWithCaptionMessage": {
        content = m.documentWithCaptionMessage.message.documentMessage;
        m = m.documentWithCaptionMessage.message;
        break;
      }
      case "documentMessage": {
        content = m.documentMessage;
        break;
      }
      case "stickerMessage": {
        content = m.stickerMessage;
        break;
      }
    }

    let mimetype = content?.mimetype || "unknown";
    if (mimetype?.startsWith("application/") && !mimetype?.endsWith("pdf"))
      mimetype = "text/plain";

    const buff = await c.downloadIt({ message: m }, "buffer", {});
    if (!buff) continue;

    parts.push({
      inlineData: {
        data: Buffer.from(buff).toString("base64"),
        mimeType: mimetype,
      },
    });
  }

  if (parts.length > 0) {
    try {
      const gem = await getGeminiClient(c);
      if (!gem) {
        await c.reply(
          { text: t("not_configured", { prefix: c.prefix }, c) },
          { quoted: c.event },
        );
        return;
      }

      const resp = await gem.chat(c.chat, { message: parts });
      const respText = formatMD(
        resp?.candidates?.[0]?.content?.parts?.[0]?.text?.trim(),
      );

      if (!respText || respText?.length === 0) return;
      const sent = await c.reply({ text: `${respText}` }, { quoted: c.event });
      if (sent) {
        const store = await getGeminiStore(c);
        store?.set(sent.key?.id, `${c.senderJid}_${c.chat}_${c.timestamp}`);
      }
    } catch (e) {
      c.client().log.error(e);
      if (e.status === 401 || e.status === 403) {
        geminiClients.delete(c.client()?.name);
      }
    }
  }
}

/** @type {import('#mushi').Plugin[]} */
export default [
  {
    name: "ai-gemini",
    cmd: ["gm", "gemini"],
    includes: [
      "ai-gemini-listener",
      "ai-gemini-models",
      "ai-gemini-key",
      "ai-gemini-model",
      "ai-gemini-prompt",
    ],
    desc: "Gemini chat plugin",
    cat: "ai",
    events: [MESSAGES_UPSERT],
    roles: [Role.PREMIUM],
    exec: processChat,
  },
  {
    name: "ai-gemini-listener",
    desc: "Gemini chat listener",
    events: [MESSAGES_UPSERT],
    roles: [Role.PREMIUM],
    midware: async (c) => ({
      success: (await getGeminiStore(c))?.has(c.stanzaId),
    }),
    exec: processChat,
  },
  {
    name: "ai-gemini-models",
    cmd: ["gm.models"],
    desc: "List available models",
    cat: "ai",
    roles: [Role.PREMIUM],
    exec: async (c) => {
      const client = await getGeminiClient(c);
      if (!client) {
        await c.reply(
          { text: t("not_configured", { prefix: c.prefix }, c) },
          { quoted: c.event },
        );
        return;
      }

      const texts = [t("list_models", {}, c), ""];

      for (const [key] of client.listModels.entries()) {
        texts.push(`- ${key}`);
      }

      await c.reply({ text: texts.join("\n") }, { quoted: c.event });
    },
  },
  {
    name: "ai-gemini-key",
    cmd: ["gm.key", "gemini.key"],
    desc: "Set API key",
    cat: "ai",
    roles: [Role.PREMIUM],
    exec: async (c) => {
      const key = c.args?.trim();
      if (!key) {
        await c.reply(
          { text: t("usage_key", { prefix: c.prefix }, c) },
          { quoted: c.event },
        );
        return;
      }

      c.client().settings.set("gemini_api_key", key);
      geminiClients.delete(c.client().name);
      await c.reply({ text: t("api_key_updated", {}, c) }, { quoted: c.event });
    },
  },
  {
    name: "ai-gemini-model",
    cmd: ["gm.model"],
    desc: "Set model name",
    cat: "ai",
    roles: [Role.PREMIUM],
    exec: async (c) => {
      const client = await getGeminiClient(c);
      if (!client) {
        await c.reply(
          { text: t("not_configured", { prefix: c.prefix }, c) },
          { quoted: c.event },
        );
        return;
      }

      const modelName = c.args?.trim();
      if (modelName && modelName.length > 0) {
        client.setModelName(modelName);
        await c.reply(
          { text: t("model_set", { model: modelName }, c) },
          { quoted: c.event },
        );
      }
    },
  },
  {
    name: "ai-gemini-prompt",
    cmd: ["gm.prompt"],
    desc: "Set system instruction",
    cat: "ai",
    roles: [Role.PREMIUM],
    exec: async (c) => {
      const client = await getGeminiClient(c);
      if (!client) {
        await c.reply(
          { text: t("not_configured", { prefix: c.prefix }, c) },
          { quoted: c.event },
        );
        return;
      }

      const prompt = c.args?.trim();
      if (prompt && prompt.length > 0) {
        client.systemInstruction = prompt;
        await c.reply(
          { text: t("prompt_updated", {}, c) },
          { quoted: c.event },
        );
      }
    },
  },
];
