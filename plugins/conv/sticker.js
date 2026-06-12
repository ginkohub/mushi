/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import sharp from "sharp";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import { extractTextContext, MESSAGES_UPSERT, Role, translate } from "#mushi";

const t = translate({
  en: {
    help_title: "🖼️ *STICKER MAKER*",
    help_usage:
      "Send/reply to an image, short video, or sticker with `.s` or `.sticker`.",
    help_example:
      "💡 *Options:* `--circle` (or `-c`) to make circular, `--crop` (or `-r`) to crop, `--nobg` (or `-n`) [color] to remove solid color background (e.g. `--nobg` for auto-detect, `-n green` or `-n #ffffff`).",
    no_media: "❌ Please send or reply to an image, short video, or sticker!",
    nobg_video_error: "❌ Background removal is only supported for images!",
    nobg_animated_error:
      "❌ Background removal is only supported for static images!",
    api_error: "❌ Failed to create sticker.",
  },
  id: {
    help_title: "🖼️ *PEMBUAT STIKER*",
    help_usage:
      "Kirim/balas gambar, video pendek, atau stiker dengan `.s` atau `.sticker`.",
    help_example:
      "💡 *Pilihan:* `--circle` (atau `-c`) untuk stiker bulat, `--crop` (atau `-r`) untuk potong, `--nobg` (atau `-n`) [warna] untuk transparan (contoh: `--nobg` untuk deteksi otomatis, `-n green` atau `-n #ffffff`).",
    no_media: "❌ Silakan kirim atau balas gambar, video pendek, atau stiker!",
    nobg_video_error:
      "❌ Penghapusan latar belakang hanya didukung untuk gambar!",
    nobg_animated_error:
      "❌ Penghapusan latar belakang hanya didukung untuk gambar statis!",
    api_error: "❌ Gagal membuat stiker.",
  },
});

const colorMap = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
  red: [255, 0, 0],
  yellow: [255, 255, 0],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  orange: [255, 165, 0],
  purple: [128, 0, 128],
  pink: [255, 192, 203],
  brown: [165, 42, 42],
};

function parseColor(val) {
  let strVal;
  if (typeof val === "number") {
    strVal = String(val);
    if (strVal.length <= 3) {
      strVal = strVal.padStart(3, "0");
    } else if (strVal.length <= 6) {
      strVal = strVal.padStart(6, "0");
    }
  } else if (typeof val === "string") {
    strVal = val;
  } else {
    return "auto";
  }

  const name = strVal.toLowerCase().trim();
  if (name === "auto" || name === "true") return "auto";
  if (name in colorMap) return colorMap[name];

  const hex = name.replace("#", "");
  if (hex.length === 3 || hex.length === 6) {
    const expanded =
      hex.length === 3
        ? hex
            .split("")
            .map((x) => x + x)
            .join("")
        : hex;
    const r = Number.parseInt(expanded.slice(0, 2), 16);
    const g = Number.parseInt(expanded.slice(2, 4), 16);
    const b = Number.parseInt(expanded.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r, g, b];
    }
  }
  return "auto";
}

async function removeColorBackground(buffer, targetColor, threshold = 30) {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;

  let targetR, targetG, targetB;
  if (targetColor === "auto") {
    const getPixel = (x, y) => {
      const idx = (y * width + x) * channels;
      return [data[idx], data[idx + 1], data[idx + 2]];
    };
    const tl = getPixel(0, 0);
    const tr = getPixel(width - 1, 0);
    const bl = getPixel(0, height - 1);
    const br = getPixel(width - 1, height - 1);
    const corners = [tl, tr, bl, br];
    const dist = (c1, c2) =>
      Math.sqrt(
        (c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2,
      );
    const scores = corners.map((c, i) => {
      let sum = 0;
      for (let j = 0; j < corners.length; j++) {
        if (i !== j) sum += dist(c, corners[j]);
      }
      return { color: c, score: sum };
    });
    scores.sort((a, b) => a.score - b.score);
    [targetR, targetG, targetB] = scores[0].color;
  } else {
    [targetR, targetG, targetB] = targetColor;
  }

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const distance = Math.sqrt(
      (r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2,
    );

    if (distance <= threshold) {
      data[i + 3] = 0;
    }
  }

  return await sharp(data, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

export default {
  name: "std-conv-sticker",
  cmd: ["s", "sticker", "s?", "sticker?"],
  cat: "conv",
  tags: ["system", "utils"],
  desc: "Convert image or video to sticker",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],

  exec: async (c) => {
    if (c.cmd.endsWith("?")) {
      const helpText = [
        t("help_title", {}, c),
        "",
        t("help_usage", {}, c),
        t("help_example", {}, c),
      ];
      return await c.reply({ text: helpText.join("\n") }, { quoted: c.event });
    }

    let targetMsg = null;
    const currentExt = extractTextContext(c.message);
    const quotedExt = extractTextContext(c.quotedMessage);

    if (
      currentExt.type === "imageMessage" ||
      currentExt.type === "videoMessage" ||
      currentExt.type === "stickerMessage"
    ) {
      targetMsg = c.message;
    } else if (
      quotedExt.type === "imageMessage" ||
      quotedExt.type === "videoMessage" ||
      quotedExt.type === "stickerMessage"
    ) {
      targetMsg = c.quotedMessage;
    }

    if (!targetMsg) {
      return await c.reply({ text: t("no_media", {}, c) }, { quoted: c.event });
    }

    try {
      let buffer = await c.downloadIt({ message: targetMsg }, "buffer", {});
      if (!buffer || buffer.length === 0) {
        throw new Error("Failed to download media");
      }

      const noBgArg = c.argv?.nobg || c.argv?.n;
      if (noBgArg !== undefined) {
        if (
          currentExt.type === "videoMessage" ||
          quotedExt.type === "videoMessage"
        ) {
          return await c.reply(
            { text: t("nobg_video_error", {}, c) },
            { quoted: c.event },
          );
        }

        const metadata = await sharp(buffer).metadata();
        if (metadata.pages && metadata.pages > 1) {
          return await c.reply(
            { text: t("nobg_animated_error", {}, c) },
            { quoted: c.event },
          );
        }

        const targetColor = parseColor(noBgArg);
        const threshold = Number.parseInt(
          c.argv?.threshold || c.argv?.t || "30",
          10,
        );
        buffer = await removeColorBackground(buffer, targetColor, threshold);
      }

      let stickerType = StickerTypes.FULL;
      if (c.argv?.circle || c.argv?.c) {
        stickerType = StickerTypes.CIRCLE;
      } else if (c.argv?.crop || c.argv?.r) {
        stickerType = StickerTypes.CROPPED;
      }

      const packName = c.argv?.pack || c.argv?.p || "Mushi";

      const authorName = c.argv?.author || c.argv?.a || c.pushName || "Mushi";

      const sticker = new Sticker(buffer, {
        pack: packName,
        author: authorName,
        type: stickerType,
        quality: 60,
      });

      const stickerBuffer = await sticker.toBuffer();
      return await c.reply({ sticker: stickerBuffer }, { quoted: c.event });
    } catch (e) {
      c.log().error(`sticker-error: ${e.stack || e}`);
      return await c.reply(
        { text: t("api_error", {}, c) },
        { quoted: c.event },
      );
    }
  },
};
