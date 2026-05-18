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
  ERROR: 4,
});

/** @type {string} */
export const TIME_FORMAT = "HH:mm:ss.SSS";

export const TimeFormats = Object.freeze({
  // "Thu May 16 10:30:00 2026"
  ANSIC: "ddd MMM DD HH:mm:ss YYYY",

  // "Thu May 16 10:30:00 WIB 2026"
  UnixDate: "ddd MMM DD HH:mm:ss ZZ YYYY",

  // "Thu May 16 10:30:00 +0700 2026"
  RubyDate: "ddd MMM DD HH:mm:ss ZZ YYYY",

  // "16 May 26 10:30 WIB"
  RFC822: "DD MMM YY HH:mm ZZ",

  // "16 May 26 10:30 +0700"
  RFC822Z: "DD MMM YY HH:mm ZZ",

  // "Saturday, 16-May-26 10:30:00 WIB"
  RFC850: "dddd, DD-MMM-YY HH:mm:ss ZZ",

  // "Thu, 16 May 2026 10:30:00 WIB"
  RFC1123: "ddd, DD MMM YYYY HH:mm:ss ZZ",

  // "Thu, 16 May 2026 10:30:00 +0700"
  RFC1123Z: "ddd, DD MMM YYYY HH:mm:ss ZZ",

  // "2026-05-16T10:30:00+07:00"
  RFC3339: "YYYY-MM-DDTHH:mm:ssZ",

  // "2026-05-16T10:30:00.123456789+07:00"
  RFC3339Nano: "YYYY-MM-DDTHH:mm:ss.SSSSSSSSSZ",

  // "10:30AM"
  Kitchen: "h:mmA",
});

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * getTime returns the current time in the specified format.
 *
 * @param {string} format - The format of the time.
 * @returns {string} The current time in the specified format.
 */
export function getTime(format) {
  if (!format || format === "") {
    format = TimeFormats.Kitchen;
  }

  const now = new Date();
  const hours24 = now.getHours();
  const hours12 = hours24 % 12 || 12;

  // offset timezone, e.g. "+0700" dan "+07:00"
  const offsetMin = -now.getTimezoneOffset();
  const offsetSign = offsetMin >= 0 ? "+" : "-";
  const offsetAbs = Math.abs(offsetMin);
  const offsetH = Math.floor(offsetAbs / 60)
    .toString()
    .padStart(2, "0");
  const offsetM = (offsetAbs % 60).toString().padStart(2, "0");
  const offsetFlat = `${offsetSign}${offsetH}${offsetM}`; // +0700
  const offsetColon = `${offsetSign}${offsetH}:${offsetM}`; // +07:00

  // timezone name, e.g. "WIB"
  const tzName =
    now.toLocaleTimeString("en", { timeZoneName: "short" }).split(" ").pop() ??
    offsetFlat;

  /** @type {Record<string, string>} */
  const repl = {
    YYYY: now.getFullYear().toString(),
    YY: now.getFullYear().toString().slice(-2),

    MMMM: MONTHS_LONG[now.getMonth()],
    MMM: MONTHS_SHORT[now.getMonth()],
    MM: (now.getMonth() + 1).toString().padStart(2, "0"),
    M: (now.getMonth() + 1).toString(),

    dddd: DAYS_LONG[now.getDay()],
    ddd: DAYS_SHORT[now.getDay()],
    DD: now.getDate().toString().padStart(2, "0"),
    D: now.getDate().toString(),

    HH: hours24.toString().padStart(2, "0"),
    H: hours24.toString(),
    hh: hours12.toString().padStart(2, "0"),
    h: hours12.toString(),

    mm: now.getMinutes().toString().padStart(2, "0"),
    ss: now.getSeconds().toString().padStart(2, "0"),
    SSS: now.getMilliseconds().toString().padStart(3, "0"),

    A: hours24 < 12 ? "AM" : "PM",
    a: hours24 < 12 ? "am" : "pm",

    ZZ: tzName,
    Z: offsetColon,
  };

  const tokens = Object.keys(repl).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(tokens.join("|"), "g");

  return format.replace(pattern, (match) => repl[match] ?? match);
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
    this.format = format ?? TimeFormats.Kitchen;
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
    return args
      ?.map((arg) =>
        typeof arg === "object" && arg !== null
          ? JSON.stringify(arg)
          : String(arg),
      )
      .join(" ");
  }

  /**
   * @param {number} code
   * @param {...any} args
   * @returns {string}
   */
  asColor(code, ...args) {
    return `\x1b[${code}m${this.asString(...args)}\x1b[0m`;
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Black(...args) {
    return this.asColor(30, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Red(...args) {
    return this.asColor(31, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Green(...args) {
    return this.asColor(32, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Yellow(...args) {
    return this.asColor(33, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Blue(...args) {
    return this.asColor(34, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Magenta(...args) {
    return this.asColor(35, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  Cyan(...args) {
    return this.asColor(36, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  White(...args) {
    return this.asColor(37, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  BlackFG(...args) {
    return this.asColor(40, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  RedFG(...args) {
    return this.asColor(41, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  GreenFG(...args) {
    return this.asColor(42, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  YellowFG(...args) {
    return this.asColor(43, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  BlueFG(...args) {
    return this.asColor(44, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  MagentaFG(...args) {
    return this.asColor(45, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  CyanFG(...args) {
    return this.asColor(46, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  WhiteFG(...args) {
    return this.asColor(47, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  BlackBr(...args) {
    return this.asColor(90, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  RedBr(...args) {
    return this.asColor(91, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  GreenBr(...args) {
    return this.asColor(92, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  YellowBr(...args) {
    return this.asColor(93, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  BlueBr(...args) {
    return this.asColor(94, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  MagentaBr(...args) {
    return this.asColor(95, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  CyanBr(...args) {
    return this.asColor(96, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  WhiteBr(...args) {
    return this.asColor(97, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  BlackBrFG(...args) {
    return this.asColor(100, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  RedBrFG(...args) {
    return this.asColor(101, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  GreenBrFG(...args) {
    return this.asColor(102, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  YellowBrFG(...args) {
    return this.asColor(103, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  BlueBrFG(...args) {
    return this.asColor(104, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  MagentaBrFG(...args) {
    return this.asColor(105, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  CyanBrFG(...args) {
    return this.asColor(106, ...args);
  }

  /**
   * @param {...any} args
   * @returns {string}
   */
  WhiteBrFG(...args) {
    return this.asColor(107, ...args);
  }

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
      return;
    }
    this.Log(this.Magenta("[D]"), ...args);
  }

  /**
   * @param {...any} args
   */
  Info(...args) {
    if (this.level > LogLevel.INFO || this.level === LogLevel.NONE) {
      return;
    }
    this.Log(this.Cyan("[I]"), ...args);
  }

  /**
   * @param {...any} args
   */
  Warn(...args) {
    if (this.level > LogLevel.WARN || this.level === LogLevel.NONE) {
      return;
    }
    this.Log(this.Yellow("[W]"), ...args);
  }

  /**
   * @param {...any} args
   */
  Error(...args) {
    if (this.level > LogLevel.ERROR || this.level === LogLevel.NONE) {
      return;
    }
    this.Log(this.Red("[E]"), ...args);
  }
}

export const pen = new Pen({ format: "HH:mm:ss" });

export default pen;
