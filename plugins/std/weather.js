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
    help_title: "🌦️ *WEATHER INFO*",
    help_usage: "Use `.weather [city_name]` to check current weather.",
    help_example: "💡 *Example:* `.weather jakarta` or `.weather london`",
    not_found: '❌ City *"{query}"* not found!',
    api_error: "❌ Failed to fetch weather data.",
    header: "🌦️ *WEATHER IN {location}*",
    temp: "🌡️ *Temperature:* {temp}°C",
    condition: "☁️ *Condition:* {condition}",
    humidity: "💧 *Humidity:* {humidity}%",
    wind: "💨 *Wind Speed:* {wind} km/h",
    footer: "_Data provided by Open-Meteo_",
  },
  id: {
    help_title: "🌦️ *INFO CUACA*",
    help_usage: "Gunakan `.weather [nama_kota]` untuk mengecek cuaca saat ini.",
    help_example: "💡 *Contoh:* `.weather jakarta` atau `.weather bandung`",
    not_found: '❌ Kota *"{query}"* tidak ditemukan!',
    api_error: "❌ Gagal memuat data cuaca.",
    header: "🌦️ *CUACA DI {location}*",
    temp: "🌡️ *Suhu:* {temp}°C",
    condition: "☁️ *Kondisi:* {condition}",
    humidity: "💧 *Kelembapan:* {humidity}%",
    wind: "💨 *Kecepatan Angin:* {wind} km/h",
    footer: "_Data oleh Open-Meteo_",
  },
});

/**
 * WMO Weather interpretation codes (WW)
 * @see https://open-meteo.com/en/docs
 */
const weatherCodes = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  95: "Thunderstorm",
};

export default {
  name: "std-weather",
  cmd: ["weather", "cuaca"],
  cat: "tool",
  tags: ["info"],
  desc: "Get real-time weather information for a city",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],

  exec: async (c) => {
    const query = (c.args || "").trim();

    if (!query || query === "?") {
      const helpText = [
        t("help_title", {}, c),
        "",
        t("help_usage", {}, c),
        t("help_example", {}, c),
      ];
      return await c.reply({ text: helpText.join("\n") }, { quoted: c.event });
    }

    try {
      // 1. Geocoding - Find coordinates
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl, {
        headers: {
          "User-Agent": "MushiBot/0.0.2",
        },
      });
      if (!geoRes.ok) throw new Error(`Geocoding failed: ${geoRes.status}`);
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        return await c.reply(
          { text: t("not_found", { query }, c) },
          { quoted: c.event },
        );
      }

      const location = geoData.results[0];
      const { latitude, longitude, name, country } = location;

      // 2. Weather - Fetch data
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
      const weatherRes = await fetch(weatherUrl, {
        headers: {
          "User-Agent": "MushiBot/0.0.2",
        },
      });
      if (!weatherRes.ok)
        throw new Error(`Weather fetch failed: ${weatherRes.status}`);
      const weatherData = await weatherRes.json();

      const current = weatherData.current;
      const condition = weatherCodes[current.weather_code] || "Unknown";

      const results = [
        t("header", { location: `${name}, ${country}` }, c),
        "",
        t("temp", { temp: current.temperature_2m }, c),
        t("condition", { condition }, c),
        t("humidity", { humidity: current.relative_humidity_2m }, c),
        t("wind", { wind: current.wind_speed_10m }, c),
        "",
        t("footer", {}, c),
      ];

      await c.reply({ text: results.join("\n") }, { quoted: c.event });
    } catch (e) {
      c.log().error(`weather-error: ${e.stack || e}`);
      if (e.cause) c.log().error(`weather-error-cause: ${e.cause}`);
      await c.reply({ text: t("api_error", {}, c) }, { quoted: c.event });
    }
  },
};
