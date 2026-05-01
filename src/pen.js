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
 * @readonly
 * @enum {number}
 */
export const LogLevel = Object.freeze({
  NONE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4
})


/** @type {string} */
export const TIME_FORMAT = 'HH:mm:ss.SSS';

/** 
 * getTime returns the current time in the specified format.
 *
 * @param {string} format - The format of the time.
 * @returns {string} The current time in the specified format.
 */
export function getTime(format) {
  if (!format || format === '') {
    format = TIME_FORMAT;
  }
  const now = new Date();

  /** @type {Record<string, any>} */
  const repl = {
    'HH': now.getHours().toString().padStart(2, '0'),
    'mm': now.getMinutes().toString().padStart(2, '0'),
    'ss': now.getSeconds().toString().padStart(2, '0'),
    'SSS': now.getMilliseconds().toString().padStart(3, '0')
  }

  for (const key in repl) {
    format = format.replaceAll(key, repl[key]);
  }
  return format;
}


/**
 * Pen is a class that provides methods to print colored logs to the console.
 *
 * @param {number} level - The level of the log.
 * @returns {Pen} A new instance of the Pen class with the specified level.
 */
export class Pen {

  /**
   * @param {{level?: number, format?:string, prefix?:string}} opts
   */
  constructor({ level = LogLevel.DEBUG, format, prefix }) {
    this.prefix = prefix;
    this.level = level;
    this.format = format ?? TIME_FORMAT;
  }

  /**
   * Set the prefix of the logs.
   * @param {string} prefix
   */
  SetPrefix(prefix) {
    this.prefix = prefix;
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  asString(...args) {
    return args?.map(arg =>
      typeof arg === 'object' && arg !== null
        ? JSON.stringify(arg)
        : String(arg)
    ).join(' ')
  }

  /**
   * @param {number} code
   * @param {...any} args
   * @returns {string}
   */
  asColor(code, ...args) { return `\x1b[${code}m` + this.asString(...args) + '\x1b[0m'; }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Black(...args) { return this.asColor(30, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Red(...args) { return this.asColor(31, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Green(...args) { return this.asColor(32, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Yellow(...args) { return this.asColor(33, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Blue(...args) { return this.asColor(34, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Magenta(...args) { return this.asColor(35, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Cyan(...args) { return this.asColor(36, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  White(...args) { return this.asColor(37, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  BlackFG(...args) { return this.asColor(40, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  RedFG(...args) { return this.asColor(41, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  GreenFG(...args) { return this.asColor(42, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  YellowFG(...args) { return this.asColor(43, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  BlueFG(...args) { return this.asColor(44, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  MagentaFG(...args) { return this.asColor(45, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  CyanFG(...args) { return this.asColor(46, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  WhiteFG(...args) { return this.asColor(47, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  BlackBr(...args) { return this.asColor(90, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  RedBr(...args) { return this.asColor(91, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  GreenBr(...args) { return this.asColor(92, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  YellowBr(...args) { return this.asColor(93, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  BlueBr(...args) { return this.asColor(94, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  MagentaBr(...args) { return this.asColor(95, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  CyanBr(...args) { return this.asColor(96, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  WhiteBr(...args) { return this.asColor(97, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  BlackBrFG(...args) { return this.asColor(100, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  RedBrFG(...args) { return this.asColor(101, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  GreenBrFG(...args) { return this.asColor(102, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  YellowBrFG(...args) { return this.asColor(103, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  BlueBrFG(...args) { return this.asColor(104, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  MagentaBrFG(...args) { return this.asColor(105, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  CyanBrFG(...args) { return this.asColor(106, ...args); }

  /**
   * @param {...any} args
   * @returns {string}
   */
  WhiteBrFG(...args) { return this.asColor(107, ...args); }

  /**
   * @param {...any} args
  */
  Log(...args) {
    if (this.prefix) {
      console.log(getTime(this.format), this.prefix, ...args);
    } else {
      console.log(getTime(this.format), ...args);
    }
  }

  /**
   * @param {...any} args
  */
  Debug(...args) {
    if (this.level > LogLevel.DEBUG || this.level === LogLevel.NONE) {
      return
    }
    this.Log(this.Magenta('[D]'), ...args);
  }

  /**
   * @param {...any} args
  */
  Info(...args) {
    if (this.level > LogLevel.INFO || this.level === LogLevel.NONE) {
      return
    }
    this.Log(this.Cyan('[I]'), ...args);
  }

  /**
 * @param {...any} args
*/
  Warn(...args) {
    if (this.level > LogLevel.WARN || this.level === LogLevel.NONE) {
      return
    }
    this.Log(this.Yellow('[W]'), ...args);
  }

  /**
 * @param {...any} args
*/
  Error(...args) {
    if (this.level > LogLevel.ERROR || this.level === LogLevel.NONE) {
      return
    }
    this.Log(this.Red('[E]'), ...args);
  }
}

export const pen = new Pen({ format: 'HH:mm:ss' });

export default pen;
