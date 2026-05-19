/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";

/**
 * @readonly
 * @enum {number}
 */
export const LogLevel = Object.freeze({
  NONE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
});

/**
 * @typedef {Object} LogEntry
 * @property {number} timestamp
 * @property {string} level
 * @property {string} source
 * @property {string} message
 * @property {any[]} [args]
 */

/**
 * @typedef {Object} FileOpts
 * @property {string} path
 * @property {number} [maxSize] - max file size in bytes (e.g. 5 * 1024 * 1024 = 5MB)
 * @property {number} [maxFiles] - max number of old log files to keep
 */

class Logger {
  /** @type {LogEntry[]} */
  #logs = [];

  /** @type {number} */
  #maxLogs;

  /** @type {number} */
  #level;

  /** @type {boolean} */
  #console;

  /** @type {(level: string, source: string, message: string, args: any[]) => void} */
  #onLog;

  /** @type {string|null} */
  #filePath = null;

  /** @type {number} */
  #maxSize = 0;

  /** @type {number} */
  #maxFiles = 0;

  /** @type {string|null} */
  #lastDate = null;

  /** @type {string} */
  #prefix = "";

  /**
   * @param {{level?: number, maxLogs?: number, console?: boolean, prefix?: string}} opts
   */
  constructor({
    level = LogLevel.DEBUG,
    maxLogs = 1000,
    console = true,
    prefix = "",
  } = {}) {
    this.#maxLogs = maxLogs;
    this.#level = level;
    this.#console = console;
    this.#prefix = prefix;
  }

  /**
   * @param {string} message
   * @param {...any} args
   */
  debug(message, ...args) {
    if (this.#level > LogLevel.DEBUG) return;
    this.#log("DEBUG", this.#prefix || "root", message, args);
  }

  /**
   * @param {string} message
   * @param {...any} args
   */
  info(message, ...args) {
    if (this.#level > LogLevel.INFO) return;
    this.#log("INFO", this.#prefix || "root", message, args);
  }

  /**
   * @param {string} message
   * @param {...any} args
   */
  warn(message, ...args) {
    if (this.#level > LogLevel.WARN) return;
    this.#log("WARN", this.#prefix || "root", message, args);
  }

  /**
   * @param {string} message
   * @param {...any} args
   */
  error(message, ...args) {
    if (this.#level > LogLevel.ERROR) return;
    this.#log("ERROR", this.#prefix || "root", message, args);
  }

  /**
   * @param {string} level
   * @param {string} source
   * @param {string} message
   * @param {any[]} args
   */
  #log(level, source, message, args) {
    const entry = {
      timestamp: Date.now(),
      level,
      source,
      message,
      args,
    };

    this.#logs.push(entry);

    if (this.#logs.length > this.#maxLogs) {
      this.#logs.shift();
    }

    if (this.#console) {
      const prefix = `[${level}]`;
      const msg =
        args?.length > 0
          ? `${source} ${message} ${JSON.stringify(args)}`
          : `${source} ${message}`;

      if (level === "ERROR") console.error(prefix, msg);
      else if (level === "WARN") console.warn(prefix, msg);
      else console.log(prefix, msg);
    }

    if (this.#filePath) {
      this.#writeFile(entry);
    }

    if (this.#onLog) {
      this.#onLog(level, source, message, args);
    }
  }

  /**
   * Create a child logger with prefix
   * @param {string} prefix
   * @returns {Logger}
   */
  child(prefix) {
    return new Logger({
      level: this.#level,
      maxLogs: this.#maxLogs,
      console: this.#console,
      prefix: this.#prefix ? `${this.#prefix}:${prefix}` : prefix,
    });
  }

  /**
   * @param {LogEntry} entry
   */
  #writeFile(entry) {
    const now = new Date();
    const date = now.toISOString().split("T")[0];

    // Daily rotation
    if (this.#lastDate && this.#lastDate !== date) {
      this.#rotateFiles();
      this.#lastDate = date;
    }
    this.#lastDate = date;

    const dir = dirname(this.#filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const line = `${JSON.stringify(entry)}\n`;

    // Check size limit
    if (this.#maxSize > 0 && existsSync(this.#filePath)) {
      const stats = statSync(this.#filePath);
      if (stats.size >= this.#maxSize) {
        this.#rotateFiles();
      }
    }

    try {
      appendFileSync(this.#filePath, line, "utf-8");
    } catch (e) {
      console.error("Failed to write log:", e);
    }
  }

  #rotateFiles() {
    if (!this.#filePath || this.#maxFiles <= 0) return;

    const dir = dirname(this.#filePath);
    const base = this.#filePath.replace(/\.log$/, "");

    if (!existsSync(dir)) return;
    const files = readdirSync(dir)
      .filter((f) => f.startsWith(base.split("/").pop()) && f.endsWith(".log"))
      .map((f) => ({
        name: f,
        path: join(dir, f),
        time: statSync(join(dir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    for (let i = this.#maxFiles; i < files.length; i++) {
      try {
        unlinkSync(files[i].path);
      } catch (_e) {
        // ignore
      }
    }
  }

  /**
   * @param {FileOpts} opts
   */
  toFile({ path, maxSize = 5 * 1024 * 1024, maxFiles = 5 }) {
    this.#filePath = path;
    this.#maxSize = maxSize;
    this.#maxFiles = maxFiles;
  }

  stopFile() {
    this.#filePath = null;
  }

  /**
   * @returns {LogEntry[]}
   */
  getLogs() {
    return [...this.#logs];
  }

  /**
   * @param {number} [limit]
   * @returns {LogEntry[]}
   */
  getRecent(limit = 50) {
    return this.#logs.slice(-limit);
  }

  /**
   * @param {string} source
   * @returns {LogEntry[]}
   */
  getBySource(source) {
    return this.#logs.filter((l) => l.source === source);
  }

  /**
   * @param {"DEBUG"|"INFO"|"WARN"|"ERROR"} level
   * @returns {LogEntry[]}
   */
  getByLevel(level) {
    return this.#logs.filter((l) => l.level === level);
  }

  clear() {
    this.#logs = [];
  }

  /**
   * @param {number} level
   */
  setLevel(level) {
    this.#level = level;
  }

  /**
   * @param {(level: string, source: string, message: string, args: any[]) => void} callback
   */
  onLog(callback) {
    this.#onLog = callback;
  }
}

/**
 * Color helpers (ANSI escape codes)
 */
const colors = {
  Black: (...a) => `\x1b[30m${a.join(" ")}\x1b[0m`,
  Red: (...a) => `\x1b[31m${a.join(" ")}\x1b[0m`,
  Green: (...a) => `\x1b[32m${a.join(" ")}\x1b[0m`,
  Yellow: (...a) => `\x1b[33m${a.join(" ")}\x1b[0m`,
  Blue: (...a) => `\x1b[34m${a.join(" ")}\x1b[0m`,
  Magenta: (...a) => `\x1b[35m${a.join(" ")}\x1b[0m`,
  Cyan: (...a) => `\x1b[36m${a.join(" ")}\x1b[0m`,
  White: (...a) => `\x1b[37m${a.join(" ")}\x1b[0m`,
  RedBr: (...a) => `\x1b[91m${a.join(" ")}\x1b[0m`,
  GreenBr: (...a) => `\x1b[92m${a.join(" ")}\x1b[0m`,
  BlueBr: (...a) => `\x1b[94m${a.join(" ")}\x1b[0m`,
};

export const logger = new Logger();

// Attach colors to logger for convenience
Object.assign(logger, colors);

export default logger;
