/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { MESSAGES_UPSERT } from "../../src/const.js";
import { Role } from "../../src/roles.js";
import { translate } from "../../src/translate.js";

const t = translate({
  en: {
    help_title: "⏰ *REMINDER*",
    help_usage: "Use `{prefix}remind [time] [message]`",
    help_example:
      "💡 *Example:*\n- `{prefix}remind 10m buy milk` (10 minutes)\n- `{prefix}remind 1h study` (1 hour)\n- `{prefix}remind 18:00 dinner` (at 6 PM)",
    success:
      "✅ *Reminder set!* I will remind you in *{duration}* (at *{time}*).",
    notify:
      '⏰ *REMINDER!* ⏰\n\nHi @{user}, you asked me to remind you:\n\n"{message}"',
    invalid_time: "❌ Invalid time format! Use `10m`, `1h`, or `HH:mm`.",
    no_message: "❌ Please provide a message for the reminder.",
    list_title: "📋 *YOUR REMINDERS*",
    empty: "You have no active reminders.",
    delete_success: "✅ Reminder deleted.",
  },
  id: {
    help_title: "⏰ *PENGINGAT*",
    help_usage: "Gunakan `{prefix}remind [waktu] [pesan]`",
    help_example:
      "💡 *Contoh:*\n- `{prefix}remind 10m beli susu` (10 menit)\n- `{prefix}remind 1j belajar` (1 jam)\n- `{prefix}remind 18:00 makan malam` (jam 6 sore)",
    success:
      "✅ *Pengingat diatur!* Saya akan mengingatkanmu dalam *{duration}* (pada *{time}*).",
    notify:
      '⏰ *PENGINGAT!* ⏰\n\nHalo @{user}, kamu memintaku untuk mengingatkan:\n\n"{message}"',
    invalid_time: "❌ Format waktu salah! Gunakan `10m`, `1j`, atau `HH:mm`.",
    no_message: "❌ Harap berikan pesan untuk diingatkan.",
    list_title: "📋 *PENGINGAT KAMU*",
    empty: "Kamu tidak memiliki pengingat aktif.",
    delete_success: "✅ Pengingat dihapus.",
  },
});

let checkInterval = null;

function parseTime(input, timezone = "UTC") {
  const now = new Date();

  /* Relative time: 10m, 1h, 1d */
  const relativeMatch = input.match(/^(\d+)([smjhd])$/i);
  if (relativeMatch) {
    const num = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    let ms = 0;
    switch (unit) {
      case "s":
        ms = num * 1000;
        break;
      case "m":
        ms = num * 60 * 1000;
        break;
      case "j":
      case "h":
        ms = num * 60 * 60 * 1000;
        break;
      case "d":
        ms = num * 24 * 60 * 60 * 1000;
        break;
    }
    return now.getTime() + ms;
  }

  /* Absolute time: HH:mm */
  const absoluteMatch = input.match(/^(\d{1,2}):(\d{2})$/);
  if (absoluteMatch) {
    const hours = parseInt(absoluteMatch[1], 10);
    const minutes = parseInt(absoluteMatch[2], 10);

    /* Create date in target timezone */
    const targetDate = new Date(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false,
      }).format(now),
    );

    targetDate.setHours(hours, minutes, 0, 0);

    /* If time has passed today, set for tomorrow */
    if (targetDate.getTime() <= now.getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    /* Convert back to UTC timestamp
    This is tricky in JS without libraries, but since we are in the same env */
    const diff =
      Date.now() -
      new Date(
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(now),
      ).getTime();
    return targetDate.getTime() + diff;
  }

  return null;
}

function formatDuration(ms, lang = "id") {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (lang === "id") {
    if (days > 0) return `${days} hari`;
    if (hours > 0) return `${hours} jam ${minutes % 60} menit`;
    if (minutes > 0) return `${minutes} menit`;
    return `${seconds} detik`;
  } else {
    if (days > 0) return `${days} days`;
    if (hours > 0) return `${hours} hours ${minutes % 60} minutes`;
    if (minutes > 0) return `${minutes} minutes`;
    return `${seconds} seconds`;
  }
}

function startReminderChecker(c) {
  if (checkInterval) return;

  checkInterval = setInterval(async () => {
    try {
      const store = c.client().store.use("reminders");
      await store.waitReady();
      const allReminders = store.get("list") || [];
      const now = Date.now();

      const toTrigger = allReminders.filter((r) => r.time <= now);
      if (toTrigger.length === 0) return;

      const remaining = allReminders.filter((r) => r.time > now);
      store.set("list", remaining);

      for (const r of toTrigger) {
        try {
          const userLang = r.lang || "id";
          const text = t(
            "notify",
            {
              user: r.sender.split("@")[0],
              message: r.message,
            },
            userLang,
          );

          await c.client().sendMessage(r.chat, {
            text,
            mentions: [r.sender],
          });
          c.log().info(`Reminder sent to ${r.sender} in ${r.chat}`);
        } catch (err) {
          c.log().error(
            `Failed to send reminder to ${r.sender}: ${err.stack || err}`,
          );
        }
      }
    } catch (e) {
      c.log().error(`Reminder checker error: ${e.stack || e}`);
    }
  }, 10000);
}

export default [
  {
    name: "std-remind",
    cmd: ["remind", "ingatkan", "ingetin", "reminders", "remind?"],
    cat: "tool",
    tags: ["user", "tool"],
    desc: "Set a reminder",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],

    exec: async (c) => {
      startReminderChecker(c);

      if (c.cmd.endsWith("?") || (c.cmd === "remind" && !c.args)) {
        const helpText = [
          t("help_title", {}, c),
          "",
          t("help_usage", { prefix: c.prefix }, c),
          t("help_example", { prefix: c.prefix }, c),
        ];
        return await c.reply(
          { text: helpText.join("\n") },
          { quoted: c.event },
        );
      }

      if (c.cmd === "reminders") {
        const store = c.client().store.use("reminders");
        await store.waitReady();
        const list = store.get("list") || [];
        const myReminders = list.filter((r) => r.sender === c.senderJid);

        if (myReminders.length === 0) {
          return await c.reply({ text: t("empty", {}, c) });
        }

        const text = [
          t("list_title", {}, c),
          "",
          ...myReminders.map(
            (r, i) =>
              `${i + 1}. [${new Date(r.time).toLocaleString()}] ${r.message}`,
          ),
        ].join("\n");

        return await c.reply({ text });
      }

      const args = c.args.split(" ");
      const timeStr = args[0];
      let message = args.slice(1).join(" ");

      if (!message && c.quotedMessage) {
        message = c.quotedText;
      }

      if (!message) {
        return await c.reply({ text: t("no_message", {}, c) });
      }

      const tz =
        c.user?.tz || c.chatData?.tz || c.client()?.settings.get("tz") || "UTC";
      const time = parseTime(timeStr, tz);

      if (!time) {
        return await c.reply({ text: t("invalid_time", {}, c) });
      }

      const store = c.client().store.use("reminders");
      await store.waitReady();
      const list = store.get("list") || [];

      const newReminder = {
        chat: c.chat,
        sender: c.senderJid,
        time,
        message,
        lang: c.user?.lang || c.chatData?.lang || "id",
        addedAt: Date.now(),
      };

      list.push(newReminder);
      store.set("list", list);

      const durationMs = time - Date.now();
      const lang = c.user?.lang || c.chatData?.lang || "id";
      const duration = formatDuration(durationMs, lang);
      const displayTime = new Date(time).toLocaleString("id-ID", {
        timeZone: tz,
      });

      await c.reply({ text: t("success", { time: displayTime, duration }, c) });
    },
  },
];
