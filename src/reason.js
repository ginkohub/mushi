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
 * Represents the result of an operation, typically used in middlewares.
 * It contains information about the success status, a code, author, message, and associated data.
 */
export class Reason {
  /**
   * Creates an instance of the Reason class.
   * @param {object} options - The options for the reason object.
   * @param {boolean} options.success - Indicates whether the operation was successful.
   * @param {number | string | any} [options.code] - A code representing the result status.
   * @param {string} [options.author] - The author or source of the reason.
   * @param {string} [options.message] - A descriptive message about the result.
   * @param {any} [options.data] - Any additional data related to the result.
   */
  constructor({ success, code, author, message, data }) {
    /** @type {boolean} */
    this.success = success ?? false;

    /** @type {number | string | any} */
    this.code = code;

    /** @type {string} */
    this.author = author ?? '';

    /** @type {string} */
    this.message = message ?? '';

    /** @type {any} */
    this.data = data;
  }

  /**
   * Sets the success status of the reason.
   * @param {boolean} success - The success status.
   * @returns {Reason} The current instance for chaining.
   */
  setSuccess(success) {
    this.success = success;
    return this;
  }

  /**
   * Sets the success status of the reason to false.
   * @returns {Reason} The current instance for chaining.
   */
  setBad() {
    this.success = false;
    return this;
  }
  /**
   * Sets the success status of the reason to true.
   * @returns {Reason} The current instance for chaining.
   */
  setOK() {
    this.success = true;
    return this;
  }

  /**
   * Sets the code of the reason.
   * @param {number | string | any} code - The code.
   * @returns {Reason} The current instance for chaining.
   */
  setCode(code) {
    this.code = code;
    return this;
  }

  /**
   * Sets the author of the reason.
   * @param {string} author - The author.
   * @returns {Reason} The current instance for chaining.
   */
  setAuthor(author) {
    this.author = author;
    return this;
  }

  /**
   * Sets the message of the reason.
   * @param {string} message - The message.
   * @returns {Reason} The current instance for chaining.
   */
  setMessage(message) {
    this.message = message;
    return this;
  }

  /**
   * Sets the data of the reason.
   * @param {any} data - The data.
   * @returns {Reason} The current instance for chaining.
   */
  setData(data) {
    this.data = data;
    return this;
  }
}


