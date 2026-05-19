/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { GoogleGenAI } from "@google/genai";

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
 * @property {import("../../../src/store.js").Store} settings - Settings store
 */

/**
 * Available model names
 * @constant
 * @enum {string}
 */
export const Model = Object.freeze({
  GEMINI_3_1_PRO: "gemini-3.1-pro-preview",
  GEMINI_3_FLASH: "gemini-3-flash-preview",
  GEMINI_3_1_FLASH_LITE: "gemini-3.1-flash-lite",
  GEMINI_2_5_PRO: "gemini-2.5-pro",
  GEMINI_2_5_FLASH: "gemini-2.5-flash",
});

export const DEFAULT_SYSTEM_INSTRUCTION = [
  "Nama lu Ginko, humble, expert ngoding bahasa apa aja, kalem, gk banyak ngomong, gk suka pamer.",
  'Bicara pake bahasa sehari-hari "lu" "gw".',
  "Sebisa mungkin persingkat kalimat, seperti sedang chat di WhatsApp.",
];

/**
 * @class Gemini - Gemini AI model
 */
export class Gemini {
  /**
   * @param {GeminiOpts} opts - Options for the Gemini AI model
   */
  constructor(opts) {
    /** @type {import('../../../src/store.js').Store} */
    this.settings = opts?.settings;

    /** @type {any} */
    this.client = opts?.client;

    /** @type {string} */
    this.apiKey = opts?.apiKey || this.settings?.get("gemini_api_key");

    /** @type {string} */
    this.modelName =
      opts?.modelName ||
      this.settings?.get("gemini_model_name") ||
      Model.GEMINI_3_1_FLASH_LITE;

    /** @type {string} */
    this.systemInstruction =
      opts?.systemInstruction ||
      this.settings?.get("gemini_system_instruction") ||
      DEFAULT_SYSTEM_INSTRUCTION.join(" ");

    this.genAI = new GoogleGenAI({
      apiKey: this.apiKey,
    });

    /** @type {Map<string,import('@google/genai').Model>} */
    this.listModels = new Map();

    /** @param {import('@google/genai').UploadFileParameters} params */
    this.uploadFile = async (params) => {
      try {
        await this.genAI.files.upload(params);
      } catch (e) {
        this.client?.log.error("gemini-upload", e);
      }
    };

    /** @param {string} name */
    this.getFile = async (name) => await this.genAI.files.get({ name: name });

    /** @param {string} name */
    this.deleteFile = async (name) => {
      try {
        await this.genAI.files.delete({ name: name });
      } catch (e) {
        this.client?.log.error("gemini-delete", e);
      }
    };

    /** @returns {Promise<Array<import('@google/genai').File>|undefined>} */
    this.listFiles = async () => {
      try {
        return await this.genAI.files.list({});
      } catch (e) {
        this.client?.log.error("gemini-list-file", e);
      }
      return;
    };

    this.clearFiles = async () => {
      const files = await this.listFiles();
      for (const file of files) {
        await this.deleteFile(file.name);
      }
    };

    if (
      this.settings &&
      typeof this.settings.get === "function" &&
      !this.settings.get("limited_models")
    ) {
      this.settings.set("limited_models", {});
    }

    /** @type {Map<string,import('@google/genai').Chat>} */
    this.chats = new Map();

    this.fetchModels().catch((e) => this.client?.log.error("gemini-init", e));
  }

  /**
   * @param {string} id
   * @param {import('@google/genai').SendMessageParameters} params
   * @returns {Promise<import('@google/genai').GenerateContentResponse>}
   */
  async chat(id, params) {
    if (!id) {
      return;
    }
    if (!params) {
      return;
    }
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
      this.client?.log.error("gemini sendMessage error:", e);
      this.chats.delete(id);
      switch (e.status) {
        case 429: {
          if (this.listModels.size > 0) {
            if (this.settings) {
              const limited = this.settings.get("limited_models") || {};
              limited[this.modelName] = Date.now();
              this.settings.set("limited_models", limited);
            }
            const prevModel = this.modelName;
            this.switchModel();
            this.client?.log.warn(
              e.status,
              `try switching model from ${prevModel} to ${this.modelName}`,
            );
            return await this.chat(id, params);
          } else {
            this.client?.log.error(
              "gemini-chat",
              this.modelName,
              "All model is limited, please try again later.",
            );
          }
          break;
        }
        case 400: {
          return;
        }
        default: {
          this.client?.log.error("gemini-chat", this.modelName, e.message);
          return;
        }
      }
    }
  }

  switchModel() {
    const limitedModels = this.settings?.get("limited_models") || {};
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
      const allowedModels = Object.values(Model);
      for (const model of pager.page) {
        if (!model?.name.includes("tts") && model?.name?.includes("gemini")) {
          const keyName = model.name.split("/")?.pop();
          if (keyName && allowedModels.includes(keyName)) {
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
