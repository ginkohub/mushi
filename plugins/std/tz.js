import { MESSAGES_UPSERT } from "../../src/const.js";
import { Role } from "../../src/roles.js";
import { translate } from "../../src/translate.js";

const t = translate({
  en: {
    admin_only: "This command is for group admins or bot admins only.",
    usage: "Usage: {cmd} [timezone]\nExample: {cmd} Asia/Jakarta",
    success: "System timezone set to: *{tz}*",
    chat_success: "Chat timezone set to: *{tz}*",
    user_success: "Your personal timezone set to: *{tz}*",
    current: "Current system timezone: *{tz}*",
    current_chat: "Current chat timezone: *{tz}*",
    current_user: "Your personal timezone: *{tz}*",
    reset_success: "System timezone preference cleared (default: *UTC*).",
    chat_reset: "Chat timezone preference cleared.",
    user_reset: "Your personal timezone preference cleared.",
    invalid:
      "❌ Invalid timezone! Example: `Asia/Jakarta`, `Europe/London`, `UTC`.",
  },
  id: {
    admin_only: "Perintah ini hanya untuk admin grup atau admin bot.",
    usage: "Penggunaan: {cmd} [timezone]\nContoh: {cmd} Asia/Jakarta",
    success: "Timezone sistem diatur ke: *{tz}*",
    chat_success: "Timezone chat diatur ke: *{tz}*",
    user_success: "Timezone kamu telah diatur ke: *{tz}*",
    current: "Timezone sistem saat ini: *{tz}*",
    current_chat: "Timezone chat saat ini: *{tz}*",
    current_user: "Timezone kamu saat ini: *{tz}*",
    reset_success: "Preferensi timezone sistem telah dihapus (bawaan: *UTC*).",
    chat_reset: "Preferensi timezone chat telah dihapus.",
    user_reset: "Preferensi timezone personal kamu telah dihapus.",
    invalid:
      "❌ Timezone tidak valid! Contoh: `Asia/Jakarta`, `Europe/London`, `UTC`.",
  },
});

function isValidTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export default [
  {
    name: "std-tz",
    cmd: ["tz", "set.tz", "tz?", "set.tz?"],
    includes: ["std-tz-chat", "std-tz-user"],
    cat: "system",
    tags: ["system", "tz"],
    desc: "Set the global bot timezone.",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const tz = c.args?.trim();
      const current = c.client()?.settings.get("tz") || "UTC";

      if (tz === "reset" || tz === "delete" || tz === "clear") {
        c.client()?.settings.delete("tz");
        return await c.reply({ text: t("reset_success", {}, c) });
      }

      if (!tz) {
        const text = `${t("current", { tz: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`;
        return await c.reply({ text });
      }

      if (!isValidTimezone(tz)) {
        return await c.reply({ text: t("invalid", {}, c) });
      }

      c.client()?.settings.set("tz", tz);
      await c.reply({ text: t("success", { tz }, c) });
    },
  },
  {
    name: "std-tz-chat",
    cmd: ["tz.chat", "chattz", "tz.chat?", "chattz?"],
    cat: "system",
    tags: ["admin", "chat", "tz"],
    desc: "Set the default timezone for this chat.",
    events: [MESSAGES_UPSERT],
    roles: [Role.USER],
    exec: async (c) => {
      const isQuestion = c.cmd.endsWith("?");
      const tz = c.args?.trim();
      const current = c.chatData?.tz || c.client()?.settings.get("tz") || "UTC";

      if (isQuestion || !tz) {
        return await c.reply({
          text: `${t("current_chat", { tz: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`,
        });
      }

      if (
        !c.isAdmin &&
        !c.client().userManager.rolesEnough(c.senderJid, [Role.ADMIN])
      )
        return await c.reply({ text: t("admin_only", {}, c) });

      if (tz === "reset" || tz === "delete" || tz === "clear") {
        c.client().chatManager.updateChat(c.chat, { tz: null });
        return await c.reply({ text: t("chat_reset", {}, c) });
      }

      if (!isValidTimezone(tz)) {
        return await c.reply({ text: t("invalid", {}, c) });
      }

      c.client().chatManager.updateChat(c.chat, { tz });
      await c.reply({ text: t("chat_success", { tz }, c) });
    },
  },
  {
    name: "std-tz-user",
    cmd: ["tz.user", "mytz", "tz.user?", "mytz?"],
    cat: "user",
    tags: ["user", "tz"],
    desc: "Set your personal timezone preference.",
    events: [MESSAGES_UPSERT],
    roles: [Role.GUEST],
    exec: async (c) => {
      const isQuestion = c.cmd.endsWith("?");
      const tz = c.args?.trim();
      const current = c.user?.tz || c.client()?.settings.get("tz") || "UTC";

      if (isQuestion || !tz) {
        return await c.reply({
          text: `${t("current_user", { tz: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`,
        });
      }

      if (tz === "reset" || tz === "delete" || tz === "clear") {
        c.client().userManager.updateUser(c.senderJid, { tz: null });
        return await c.reply({ text: t("user_reset", {}, c) });
      }

      if (!isValidTimezone(tz)) {
        return await c.reply({ text: t("invalid", {}, c) });
      }

      c.client().userManager.updateUser(c.senderJid, { tz });
      await c.reply({ text: t("user_success", { tz }, c) });
    },
  },
];
