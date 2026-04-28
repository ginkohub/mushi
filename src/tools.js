/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import pen from "./pen.js";

/** @type {boolean} True if the current runtime are Deno */
export const isDeno = typeof Deno !== "undefined";

/** @type {boolean} True if the current runtime are Bun */
export const isBun = typeof Bun !== "undefined";


/**
 * Generates a random hexadecimal string of a given length.
 * @param {number} n The desired length of the hex string.
 * @returns {string} The generated uppercase hex string.
 */
export function genHEX(n) {
  let hex = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < n; i++) {
    result += hex.charAt(Math.floor(Math.random() * 16));
  }
  return result.toUpperCase();
}

/**
 * Computes the CRC32 hash of a string.
 * @param {string} str The input string.
 * @returns {string} The CRC32 hash as an uppercase hexadecimal string.
 */
export function hashCRC32(str) {
  let crc = 0;
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 1) ^ (str.charCodeAt(i) & 1 ? 0xedb88320 : 0);
  }
  return (crc >>> 0).toString(16).toUpperCase();
}

/**
 * Number of milliseconds in a second.
 * @type {number}
 */
const SECOND = 1000;

/**
 * Number of milliseconds in a minute.
 * @type {number}
 */
const MINUTE = 60 * SECOND;

/**
 * Number of milliseconds in an hour.
 * @type {number}
 */
const HOUR = 60 * MINUTE;

/**
 * Number of milliseconds in a day.
 * @type {number}
 */
const DAY = 24 * HOUR;

/**
 * Formats elapsed time in milliseconds into a human-readable string.
 * @param {number} elapse Time in milliseconds.
 * @returns {string} Formatted string (e.g., "5d 12h 30m 20s", "45m 30s", "30s", "100ms").
 */
export function formatElapse(elapse, space) {
  if (!space) space = '';
  let est = `${elapse}ms`;
  if (elapse >= DAY) {
    est = [
      `${Math.floor(elapse / DAY)}d`,
      `${Math.floor((elapse % DAY) / HOUR)}h`,
      `${Math.floor((elapse % HOUR) / MINUTE)}m`,
      `${Math.floor((elapse % MINUTE) / SECOND)}s`
    ].join(space);
  } else if (elapse >= HOUR) {
    est = [
      `${Math.floor((elapse % DAY) / HOUR)}h`,
      `${Math.floor((elapse % HOUR) / MINUTE)}m`,
      `${Math.floor((elapse % MINUTE) / SECOND)}s`
    ].join(space);
  } else if (elapse >= MINUTE) {
    est = [
      `${Math.floor((elapse % HOUR) / MINUTE)}m`,
      `${Math.floor((elapse % MINUTE) / SECOND)}s`
    ].join(space);
  } else if (elapse >= SECOND) {
    est = [
      `${Math.floor((elapse % MINUTE) / SECOND)}s`
    ].join(space);
  }
  return est
}

/**
 * Creates a promise that resolves after a specified number of milliseconds.
 * Useful for creating delays in async functions.
 * @param {number} ms The number of milliseconds to delay.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates a random integer between a minimum and maximum value (inclusive).
 * @param {number} min The minimum value.
 * @param {number} max The maximum value.
 * @returns {number} A random integer within the specified range.
 */
export function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const reBoldItalic = /\*\*\*(.+?)\*\*\*/g;
const reBold = /\*\*(.+?)\*\*/g;
const reItalic = /\*(.+?)\*/g;
const reStrike = /~~(.+?)~~/g;
const reMono = /```[\w]*\n([\s\S]+?)\n```/g;

const BOLD_ITALIC_START = '#{BI}';
const BOLD_ITALIC_END = '#{BE}';
const BOLD = '#{BB}';
const ITALIC = '#{II}';

/**
 * Formats a string with Markdown-like syntax to WhatsApp's formatting syntax.
 * - `***bold-italic***` becomes `_*bold-italic*_`
 * - `**bold**` becomes `*bold*`
 * - `*italic*` becomes `_italic_`
 * - `~~strike~~` becomes `~strike~`
 * - ` ```code``` ` becomes ` ```code``` `
 * @param {string} s The string to format.
 * @returns {string} The formatted string.
 */
export function formatMD(s) {
  if (!s || typeof s !== 'string') return s;
  s = s.replace(reBoldItalic, `${BOLD_ITALIC_START}$1${BOLD_ITALIC_END}`);
  s = s.replace(reBold, `${BOLD}$1${BOLD}`);
  s = s.replace(reItalic, `${ITALIC}$1${ITALIC}`);
  s = s.replace(reStrike, `~$1~`);

  s = s.replace(new RegExp(BOLD_ITALIC_START, 'g'), '_*');
  s = s.replace(new RegExp(BOLD_ITALIC_END, 'g'), '*_');
  s = s.replace(new RegExp(BOLD, 'g'), '*');
  s = s.replace(new RegExp(ITALIC, 'g'), '_');

  s = s.replace(reMono, '```$1```');
  return s;
}

/**
 * Formats a number of bytes into a human-readable string (e.g., KB, MB, GB).
 * @param {number} bytes The number of bytes.
 * @returns {string} The formatted string representation of the bytes.
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Checks if the current platform should use polling instead of events for file changes.
 * @returns {boolean} Whether to use polling instead of events for file changes.
 */
export function shouldUsePolling() {
  try {
    if (fs.existsSync('/.dockerenv')) return true;
  } catch {
    return true;
  }
  return false;
}

/**
 * Import module with timestamp
 * @param {string} path The path to the module.
 * @param {import.meta} meta
 * @returns {any} The imported module.
 */
export async function importy(path, meta) {
  const dirs = [];
  if (meta) dirs.push(meta.dirname);
  dirs.push(path);
  const loc = pathToFileURL(dirs.join('/')).href;
  return import(loc + '?t=' + Date.now());
}

/** @type {Object} */
const taskList = {}

/**
 * @param {string} id 
 * @param {() => Promise<any>} fn
 * @returns {Promise<any>}
 */
export async function runTask(id, fn, onError, onFinal) {
  if (taskList[id]) {
    pen.Debug(`Task ${id} is already running`);
    return taskList[id];
  }

  pen.Debug(`Task ${id} started`);
  const task = (async () => {
    try {
      return await fn();
    } catch (e) {
      if (onError && typeof onError == 'function') onError(e);
    } finally {
      delete taskList[id];
      if (onFinal && typeof onFinal == 'function') onFinal(id);
    }
  })();

  taskList[id] = task;
  return task;
}

/**
 * Watch dir changes
 * @param {string} filePath
 * @param {Function} onChange
 * @returns {any}
 */
export async function watchDir(dir, { onChange, onAdd, onRemove }) {
  if (isDeno) {
    const watcher = Deno.watchFs(dir);
    (async () => {
      for await (const event of watcher) {
        const path = event.paths[0];
        switch (event.kind) {
          case 'modify': onChange?.(path); break;
          case 'create':
          case 'rename':
            onAdd?.(path); break;
          case 'remove': onRemove?.(path); break;
        }
      }
    })();
    return watcher;
  } else {
    const { default: chokidar } = await import('chokidar');
    return chokidar.watch(dir, {
      ignoreInitial: true,
      usePolling: shouldUsePolling(),
      interval: 1000,
    })
      .on('change', onChange ?? (() => { }))
      .on('add', onAdd ?? (() => { }))
      .on('unlink', onRemove ?? (() => { }));
  }
}
