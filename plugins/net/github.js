/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 *
 * Credits to GitHub for the API and data.
 */

import { MESSAGES_UPSERT, Role, translate } from "#mushi";

const t = translate({
  en: {
    help_title: "📊 *GITHUB USER*",
    help_usage: "Use `.github [username]` to stalk a GitHub profile.",
    help_example: "💡 *Example:* `.github torvalds`",
    not_found: '❌ GitHub user *"{query}"* not found!',
    api_error: "❌ Failed to fetch GitHub data.",
    section_profile: "👤 *Profile Info*",
    label_name: "Name",
    label_username: "Username",
    label_bio: "Bio",
    label_id: "ID",
    label_type: "Type",
    section_contact: "📍 *Location & Contact*",
    label_location: "Location",
    label_company: "Company",
    label_blog: "Blog/Web",
    label_twitter: "Twitter",
    label_email: "Email",
    section_stats: "📈 *Statistics*",
    label_public_repos: "Public Repos",
    label_public_gists: "Public Gists",
    label_followers: "Followers",
    label_following: "Following",
    section_languages: "🔤 *Languages Used*",
    label_languages: "Languages",
    no_languages: "No public repos with languages",
    section_dates: "📅 *Date Details*",
    label_joined: "Joined",
    label_updated: "Last Updated",
    label_link: "Link",
    na: "-",
  },
  id: {
    help_title: "📊 *GITHUB USER*",
    help_usage: "Gunakan `.github [username]` untuk stalk profil GitHub.",
    help_example: "💡 *Contoh:* `.github torvalds`",
    not_found: '❌ Pengguna GitHub *"{query}"* tidak ditemukan!',
    api_error: "❌ Gagal memuat data GitHub.",
    section_profile: "👤 *Profile Info*",
    label_name: "Nama",
    label_username: "Username",
    label_bio: "Bio",
    label_id: "ID",
    label_type: "Tipe",
    section_contact: "📍 *Location & Contact*",
    label_location: "Lokasi",
    label_company: "Perusahaan",
    label_blog: "Blog/Web",
    label_twitter: "Twitter",
    label_email: "Email",
    section_stats: "📈 *Statistics*",
    label_public_repos: "Public Repos",
    label_public_gists: "Public Gists",
    label_followers: "Followers",
    label_following: "Following",
    section_languages: "🔤 *Bahasa yang Digunakan*",
    label_languages: "Bahasa",
    no_languages: "Tidak ada repositori publik",
    section_dates: "📅 *Date Details*",
    label_joined: "Bergabung",
    label_updated: "Update Terakhir",
    label_link: "Link",
    na: "-",
  },
});

const monthNamesID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const monthNamesEN = [
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

function formatDate(dateStr, lang) {
  const d = new Date(dateStr);
  const months = lang === "id" ? monthNamesID : monthNamesEN;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function val(v, na) {
  return v || na;
}

const ghPlugin = {
  name: "net-github",
  cmd: ["github", "gh"],
  cat: "tool",
  tags: ["info", "social"],
  desc: "View GitHub user profile statistics",
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

    const lang =
      c.user?.lang ||
      c.chatData?.lang ||
      c.client()?.settings.get("lang") ||
      "en";

    try {
      const username = encodeURIComponent(query);

      const token = c.client()?.settings.get("gh_token");
      const headers = {
        "User-Agent":
          "MushiBot/0.0.2 (https://github.com/ginkohub/mushi; ginkohub@example.com)",
        Accept: "application/vnd.github.v3+json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const userRes = await fetch(`https://api.github.com/users/${username}`, {
        headers,
      });

      if (userRes.status === 404) {
        return await c.reply(
          { text: t("not_found", { query }, c) },
          { quoted: c.event },
        );
      }

      if (userRes.status === 403) {
        const rateLimit = userRes.headers.get("x-ratelimit-remaining");
        c.log().warn(`github-rate-limit: ${rateLimit} remaining`);
        if (rateLimit === "0") {
          const resetEpoch = userRes.headers.get("x-ratelimit-reset");
          const resetTime = resetEpoch
            ? new Date(parseInt(resetEpoch, 10) * 1000).toLocaleTimeString()
            : "soon";
          return await c.reply(
            {
              text: `❌ *Rate limit exceeded!*\n_Resets at ${resetTime}_\n_Set \`gh_token\` in settings for higher limits.`,
            },
            { quoted: c.event },
          );
        }
        throw new Error(`GitHub API error: ${userRes.status}`);
      }

      if (!userRes.ok) throw new Error(`GitHub API error: ${userRes.status}`);

      const user = await userRes.json();
      const na = t("na", {}, c);

      const repoRes = await fetch(
        `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`,
        { headers },
      );
      const langCount = {};
      if (repoRes.ok) {
        const repos = await repoRes.json();
        for (const repo of repos) {
          if (repo.language) {
            langCount[repo.language] = (langCount[repo.language] || 0) + 1;
          }
        }
      }
      const topLangs = Object.entries(langCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([lang, count]) => `${lang} (${count})`)
        .join(", ");

      const text = [
        "📊 *GITHUB USER*",
        "",
        t("section_profile", {}, c),
        `* ${t("label_name", {}, c)}: ${val(user.name, na)}`,
        `* ${t("label_username", {}, c)}: ${user.login}`,
        `* ${t("label_bio", {}, c)}: ${user.bio ? `${user.bio}` : na}`,
        `* ${t("label_id", {}, c)}: ${user.id}`,
        `* ${t("label_type", {}, c)}: ${user.type}`,
        "",
        t("section_contact", {}, c),
        `* ${t("label_location", {}, c)}: ${val(user.location, na)}`,
        `* ${t("label_company", {}, c)}: ${val(user.company, na)}`,
        `* ${t("label_blog", {}, c)}: ${val(user.blog, na)}`,
        `* ${t("label_twitter", {}, c)}: ${val(user.twitter_username, na)}`,
        `* ${t("label_email", {}, c)}: ${val(user.email, na)}`,
        "",
        t("section_stats", {}, c),
        `* ${t("label_public_repos", {}, c)}: ${user.public_repos}`,
        `* ${t("label_public_gists", {}, c)}: ${user.public_gists}`,
        `* ${t("label_followers", {}, c)}: ${user.followers}`,
        `* ${t("label_following", {}, c)}: ${user.following}`,
        "",
        t("section_languages", {}, c),
        `* ${t("label_languages", {}, c)}: ${topLangs || t("no_languages", {}, c)}`,
        "",
        t("section_dates", {}, c),
        `* ${t("label_joined", {}, c)}: ${formatDate(user.created_at, lang)}`,
        `* ${t("label_updated", {}, c)}: ${formatDate(user.updated_at, lang)}`,
        "",
        `${t("label_link", {}, c)}: https://github.com/${user.login}`,
      ].join("\n");

      if (user.avatar_url) {
        await c.reply(
          { image: { url: user.avatar_url }, caption: text },
          { quoted: c.event },
        );
      } else {
        await c.reply({ text }, { quoted: c.event });
      }
    } catch (e) {
      c.log().error(`github-error: ${e.stack || e}`);
      if (e.cause) c.log().error(`github-error-cause: ${e.cause}`);
      await c.reply({ text: t("api_error", {}, c) }, { quoted: c.event });
    }
  },
};

const ghSetPlugin = {
  name: "net-github-set",
  cmd: ["ghset"],
  cat: "tool",
  tags: ["config", "github"],
  desc: "Set GitHub token for higher API rate limits",
  events: [MESSAGES_UPSERT],
  roles: [Role.ADMIN],

  exec: async (c) => {
    const token = (c.args || "").trim();

    if (!token || token === "?") {
      return await c.reply(
        {
          text: [
            "🔑 *GITHUB TOKEN SETUP*",
            "",
            "Set a GitHub personal access token to increase API rate limits (5000/hr vs 60/hr).",
            "",
            "*Usage:* `.ghset [token]`",
            "*Remove:* `.ghset remove`",
            "",
            "💡 *Example:* `.ghset ghp_xxxxxxxxxxxx`",
            "🔗 *Create token:* https://github.com/settings/tokens",
          ].join("\n"),
        },
        { quoted: c.event },
      );
    }

    if (token === "remove" || token === "delete") {
      await c.client()?.settings.delete("gh_token");
      return await c.reply(
        { text: "✅ *GitHub token removed.*" },
        { quoted: c.event },
      );
    }

    await c.client()?.settings.set("gh_token", token);
    await c.reply({ text: "✅ *GitHub token saved.*" }, { quoted: c.event });
  },
};

export default [ghPlugin, ghSetPlugin];
