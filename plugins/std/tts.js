import { MESSAGES_UPSERT } from "../../src/const.js";
import { Role } from "../../src/roles.js";
import { Languages, translate } from "../../src/translate.js";

const t = translate({
  en: {
    help_title: "🗣️ *TEXT TO SPEECH (TTS)*",
    help_usage: "Use `.tts [lang_code] [text]` or `.tts [text]`.",
    help_example: "💡 *Example:* `.tts en Hello world` or `.tts Halo dunia`",
    help_langs: "🌐 Use `.{cmd}?` to see supported language codes.",
    empty_text: "❌ Text cannot be empty!",
    limit_error: "❌ Text exceeds limit of 200 characters!",
    api_error: "❌ Failed to generate speech.",
    available: "*🌐 Supported Language Codes:*",
  },
  id: {
    help_title: "🗣️ *TEXT TO SPEECH (TTS)*",
    help_usage: "Gunakan `.tts [kode_bahasa] [teks]` atau `.tts [teks]`.",
    help_example: "💡 *Contoh:* `.tts en Hello world` atau `.tts Halo dunia`",
    help_langs: "🌐 Gunakan `.{cmd}?` untuk melihat kode bahasa yang didukung.",
    empty_text: "❌ Teks tidak boleh kosong!",
    limit_error: "❌ Teks melebihi batas 200 karakter!",
    api_error: "❌ Gagal menghasilkan suara.",
    available: "*🌐 Kode Bahasa yang Didukung:*",
  },
});

export default {
  name: "std-tts",
  cmd: ["tts", "tts?", "gtts"],
  cat: "system",
  tags: ["system", "utils"],
  desc: "Convert text to speech audio",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],

  exec: async (c) => {
    if (c.cmd.endsWith("?")) {
      const list = Object.keys(Languages).join(", ");
      const helpText = [
        t("help_title", {}, c),
        "",
        t("help_usage", { cmd: c.cmd.replace("?", "") }, c),
        t("help_example", {}, c),
        "",
        t("available", {}, c),
        `\`${list}\``,
      ];
      return await c.reply({ text: helpText.join("\n") }, { quoted: c.event });
    }

    const firstWord = c.argv?._?.[0]?.toLowerCase();
    let lang = "id";
    let text = "";

    if (firstWord && firstWord in Languages) {
      lang = firstWord;
      const rest = c.argv._.slice(1).join(" ");
      text = rest || c.quotedText || "";
    } else {
      const userLang = (c.user?.lang || "id").toLowerCase();
      lang = userLang in Languages ? userLang : "id";
      text = (c.args || "").trim() || c.quotedText || "";
    }

    text = text
      .replace(/[*_~`]/g, "")
      .replace(/[\r\n]+/g, ". ")
      .trim();

    if (!text) {
      return await c.reply(
        { text: t("empty_text", {}, c) },
        { quoted: c.event },
      );
    }

    if (text.length > 200) {
      return await c.reply(
        { text: t("limit_error", {}, c) },
        { quoted: c.event },
      );
    }

    try {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;

      const res = await fetch(ttsUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!res.ok) throw new Error(`TTS API error: ${res.status}`);

      const buffer = await res.arrayBuffer();

      return await c.reply(
        {
          audio: Buffer.from(buffer),
          mimetype: "audio/mpeg",
        },
        { quoted: c.event },
      );
    } catch (e) {
      c.log().error(`tts-error: ${e.stack || e}`);
      return await c.reply(
        { text: t("api_error", {}, c) },
        { quoted: c.event },
      );
    }
  },
};
