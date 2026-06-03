import { MESSAGES_UPSERT } from "../../src/const.js";
import { Role } from "../../src/roles.js";
import { translate } from "../../src/translate.js";

const t = translate({
  en: {
    usage: "Usage: {cmd} [lang]\nExample: {cmd} id",
    success: "System language set to: *{lang}*",
    current: "Current system language: *{lang}*",
    reset_success: "System language preference cleared (default: *id*).",
  },
  id: {
    usage: "Penggunaan: {cmd} [bahasa]\nContoh: {cmd} id",
    success: "Bahasa sistem diatur ke: *{lang}*",
    current: "Bahasa sistem saat ini: *{lang}*",
    reset_success: "Preferensi bahasa sistem telah dihapus (bawaan: *id*).",
  },
});

export default [
  {
    name: "std-lang",
    cmd: ["lang", "set.lang", "lang?", "set.lang?"],
    includes: [],
    cat: "system",
    tags: ["system", "lang"],
    desc: "Set the global bot language.",
    events: [MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const lang = c.args?.trim()?.toLowerCase();
      const current = c.client()?.settings.get("lang") || "id";

      if (lang === "reset" || lang === "delete" || lang === "clear") {
        c.client()?.settings.delete("lang");
        return await c.reply(
          { text: t("reset_success", {}, c) },
          { quoted: c.event },
        );
      }

      if (!lang) {
        const text = `${t("current", { lang: current }, c)}\n\n${t("usage", { cmd: c.prefix + c.cmd.replace("?", "") }, c)}`;
        return await c.reply({ text }, { quoted: c.event });
      }

      c.client()?.settings.set("lang", lang);
      await c.reply({ text: t("success", { lang }, c) }, { quoted: c.event });
    },
  },
];
