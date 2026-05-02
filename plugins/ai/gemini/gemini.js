/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { getFile } from "../../../src/data.js";
import pen from "../../../src/pen.js";

/**
 * @typedef {Object} Gemini - Gemini AI model
 * @property {import('@google/genai').GoogleGenAI} [genAI] - Google Generative AI instance
 * @property {import('@google/genai').Model} [model] - Generative model instance
 * @property {Map<string,import('@google/genai').Session>} [chats] - Chat sessions map
 */

/**
 * @typedef {Object} GeminiOpts
 * @property {string} apiKey - API key for the Gemini AI model
 * @property {string} modelName - Name of the Gemini AI model to use
 * @property {string} systemInstruction - System instruction for the Gemini AI model
 * @property {string} settingName - Name of the configuration to use for the gemini
 */

const DEFAULT_SYSTEM_INSTRUCTION = [
  "Nama lu Ginko, humble, expert ngoding bahasa apa aja, kalem, gk banyak ngomong, gk suka pamer.",
  'Bicara pake bahasa sehari-hari "lu" "gw".',
  "Sebisa mungkin persingkat kalimat, seperti sedang chat di WhatsApp.",
];

/**
 * @class Gemini - Gemini AI model
 */
export class Gemini {
  /**
   * @param {GeminiOpts} options - Options for the Gemini AI model
   */
  constructor({ apiKey, modelName, systemInstruction, settingName }) {
    /** @type {string} */
    this.settingName = settingName;

    /** @type {string} */
    this.apiKey = apiKey;

    /** @type {string} */
    this.modelName = modelName ?? "gemini-2.0-flash";

    /** @type {string} */
    this.systemInstruction =
      systemInstruction ?? DEFAULT_SYSTEM_INSTRUCTION.join(" ");

    this.genAI = new GoogleGenAI({
      apiKey: apiKey ?? process.env.GEMINI_API_KEY,
    });

    /** @type {Map<string,import('@google/genai').Model>} */
    this.listModels = new Map();

    /** @param {import('@google/genai').UploadFileParameters} params */
    this.uploadFile = async (params) => {
      try {
        await this.genAI.files.upload(params);
      } catch (e) {
        pen.Error("gemini-upload", e);
      }
    };

    /** @param {string} name */
    this.getFile = async (name) => await this.genAI.files.get({ name: name });

    /** @param {string} name */
    this.deleteFile = async (name) => {
      try {
        await this.genAI.files.delete({ name: name });
      } catch (e) {
        pen.Error("gemini-delete", e);
      }
    };

    /** @returns {Promise<Array<import('@google/genai').File>|undefined>} */
    this.listFiles = async () => {
      try {
        return await this.genAI.files.list({});
      } catch (e) {
        pen.Error("gemini-list-file", e);
      }
      return;
    };

    this.clearFiles = async () => {
      const files = await this.listFiles();
      for (const file of files) {
        await this.deleteFile(file.name);
      }
    };

    /** @type {Record<string, Object>} */
    this.settings = {
      limitedModels: {},
    };

    /** @type {Map<string,import('@google/genai').Chat>} */
    this.chats = new Map();

    this.init().catch((e) => pen.Error("gemini-init", e));
  }

  async init() {
    await this.load();
    await this.fetchModels();
  }

  /**
   * Load configuration from the given name
   */
  async load() {
    if (!this.settingName) return;
    try {
      const text = readFileSync(this.settingName, "utf-8");
      const config = JSON.parse(text);
      this.settings = { ...this.settings, ...config };

      if (!this.settings) {
        this.settings = {
          limitedModels: {},
        };
      }

      if (!this.settings.limitedModels) {
        this.settings.limitedModels = {};
      }

      if (this.settings?.systemInstruction)
        this.systemInstruction = this.settings.systemInstruction;
    } catch (e) {
      if (e.code !== "ENOENT") pen.Error("gemini-load", e);
    }
  }

  async save() {
    if (this.settingName) {
      try {
        const text = JSON.stringify(this.settings, null, 2);
        writeFileSync(this.settingName, text, "utf-8");
      } catch (e) {
        pen.Error("gemini-save", e);
      }
    }
  }

  /**
   * @param {string} id
   * @param {import('@google/genai').SendMessageParameters} params
   * @returns {Promise<import('@google/genai').GenerateContentResponse>}
   */
  async chat(id, params) {
    if (!id) return;
    if (!params) return;
    let chat = this.chats.get(id);
    if (!chat) {
      chat = this.genAI.chats.create({
        model: this.modelName,
        config: {
          systemInstruction: {
            text: this.systemInstruction,
          },
        },
      });
      this.chats.set(id, chat);
    }

    try {
      const resp = await chat.sendMessage(params);
      return resp;
    } catch (e) {
      this.chats.delete(id);
      switch (e.status) {
        case 429: {
          if (this.listModels.size > 0) {
            if (this.settings) {
              this.settings.limitedModels[this.modelName] = Date.now();
            }
            const prevModel = this.modelName;
            this.switchModel();
            pen.Warn(
              e.status,
              `try switching model from ${prevModel} to ${this.modelName}`,
            );
            return await this.chat(id, params);
          } else {
            pen.Error(
              "gemini-chat",
              this.modelName,
              "All model is limited, please try again later.",
            );
          }
          break;
        }
        case 400: {
          break;
        }
        default: {
          pen.Error("gemini-chat", this.modelName, e.message);
        }
      }
    }
  }

  switchModel() {
    const limitedModels = this.settings?.limitedModels ?? {};
    const currentModel = this.modelName;
    this.listModels.delete(currentModel);

    for (const key of this.listModels.keys()) {
      if (key === currentModel) continue;

      const aLimited = limitedModels[key];
      if (!aLimited) {
        this.setModelName(key);
        break;
      } else {
      }
    }

    this.save();
  }

  /**
   * Generates a response to the given message
   * @param {import('@google/genai').GenerateContentParameters} params - Parameter to generate a response for
   * @returns {Promise<import('@google/genai').GenerateContentResponse>}
   */
  async generate(params) {
    if (!params) return;
    if (!params?.model) params.model = this.modelName;
    if (!params?.config) params.config = {};
    if (!params.config?.systemInstruction)
      params.config.systemInstruction = {
        text: DEFAULT_SYSTEM_INSTRUCTION.join("\n"),
      };

    return await this.genAI.models.generateContent(params);
  }

  /**
   * Fetch lists all available gemini models
   */
  async fetchModels() {
    const pager = await this.genAI?.models.list();
    if (pager) {
      for (const model of pager.page) {
        if (!model?.name.includes("tts") && model?.name?.includes("gemini")) {
          const keyName = model.name.split("/")?.pop();
          if (keyName) {
            this.listModels.set(keyName, model);
          }
        }
      }
    }
  }

  /**
   * Set model name
   * @param {string} name - Name of the model to use
   */
  setModelName(name) {
    this.modelName = name;
  }
}

/** @type {Gemini} */
export const gemini = new Gemini({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  systemInstruction: DEFAULT_SYSTEM_INSTRUCTION.join(" "),
  settingName: getFile("gemini_settings.json"),
});
