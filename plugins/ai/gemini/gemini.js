/**
 * Copyright (C) 2025-2026 Ginko
 *
* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { GoogleGenAI } from '@google/genai';

/**
 * @typedef {Object} Gemini - Gemini AI model
 * @property {import('@google/genai').GoogleGenAI} [genAI] - Google Generative AI instance
 * @property {import('@google/genai').Model} [model] - Generative model instance
 * @property {Map<string,import('@google/genai').Session>} [chats] - Chat sessions map
 */

const DEFAULT_SYSTEM_INSTRUCTION = [
  'Nama lu Ginko, humble, expert ngoding bahasa apa aja, kalem, gk banyak ngomong, gk suka pamer.',
  'Bicara pake bahasa sehari-hari "lu" "gw".',
  'Sebisa mungkin persingkat kalimat, seperti sedang chat di WhatsApp.',
];
/**
 * @class
 */
export class Gemini {

  /**
   * @param {Object} options - Options for the Gemini AI model
   * @param {string} options.apiKey - API key for the Gemini AI model
   * @param {string} options.modelName - Name of the Gemini AI model to use
   * @param {string} options.systemInstruction - System instruction for the Gemini AI model
   * @returns {Gemini}
   */
  constructor(options) {
    this.genAI = new GoogleGenAI({ apiKey: options.apiKey ?? process.env.GEMINI_API_KEY });

    /** @type {string} */
    this.modelName = options.modelName ?? 'gemini-2.0-flash';

    /** @type {string} */
    this.systemInstruction = options.systemInstruction ?? DEFAULT_SYSTEM_INSTRUCTION.join(' ');

    /** @param {import('@google/genai').UploadFileParameters} params */
    this.uploadFile = async (params) => await this.genAI.files.upload(params);

    /** @param {string} name */
    this.getFile = async (name) => await this.genAI.files.get({ name: name });

    /** @param {string} name */
    this.deleteFile = async (name) => await this.genAI.files.delete({ name: name });

    /** @returns {Promise<Array<import('@google/genai').File>>} */
    this.listFiles = async () => await this.genAI.files.list({});

    this.clearFiles = async () => {
      const files = await this.listFiles();
      for (const file of files) {
        await this.genAI.files.delete({
          name: file.name
        })
      }
    }

    /** @type {Map<string,import('@google/genai').Chat>} */
    this.chats = new Map();
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
          }
        }
      })
      this.chats.set(id, chat);
    }

    return await chat.sendMessage(params);
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
    if (!params.config?.systemInstruction) params.config.systemInstruction = {
      text: DEFAULT_SYSTEM_INSTRUCTION.join('\n'),
    };

    return await this.genAI.models.generateContent(params);
  }
}

/** @type {Gemini} */
export const gemini = new Gemini({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  systemInstruction: DEFAULT_SYSTEM_INSTRUCTION.join(' '),
});
