/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import zlib from "node:zlib";
import AdmZip from "adm-zip";
import { MESSAGES_UPSERT } from "../../src/const.js";
import { Role } from "../../src/roles.js";
import { translate } from "../../src/translate.js";

const ScannerType = Object.freeze({
  SEARCH: "search",
  OBFUSCATION: "obfuscation",
  SECRETS: "secrets",
  SUSPICIOUS: "suspicious",
});

function globToRegex(glob) {
  if (glob instanceof RegExp) return glob;
  const escaped = glob.replace(/[.+^${}()|[\]\\*?]/g, "\\$&");
  const regex = escaped
    .replace(/\\\*\\\*\//g, "(?:.*/)?")
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*")
    .replace(/\\\?/g, "[^/]");
  return new RegExp(`^${regex}$`);
}

function shouldScan(path, include, exclude) {
  const match = (p, list) => list.some((regex) => regex.test(p));
  if (exclude.length > 0 && match(path, exclude)) return false;
  if (include.length > 0) return match(path, include);
  return true;
}

const DEFAULT_INCLUDE = [
  "**/*.ts",
  "**/*.js",
  "**/*.mjs",
  "**/*.cjs",
  "**/*.jsx",
  "**/*.tsx",
  "**/*.mts",
  "**/*.cts",
  "**/*.vue",
];
const DEFAULT_EXCLUDE = [
  "node_modules/**",
  "dist/**",
  "build/**",
  ".next/**",
  ".git/**",
  "*.min.js",
  "*.bundle.js",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

function* parseTar(buffer) {
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    const name = header
      .subarray(0, 100)
      .toString("utf-8")
      .replace(/\0.*/, "")
      .trim();
    if (!name) break;

    const size = parseInt(
      header.subarray(124, 136).toString("utf-8").replace(/\0/, "").trim(),
      8,
    );
    if (Number.isNaN(size)) break;

    const type = String.fromCharCode(header[156]);
    offset += 512;

    if (type === "0" || type === "" || type === "\0") {
      const content = buffer.subarray(offset, offset + size).toString("utf-8");
      yield {
        name: name.replace(/^[^/]+\//, ""),
        content,
        size,
      };
    }
    offset += Math.ceil(size / 512) * 512;
  }
}

const createMatch = (line, text, reason, sample) => ({
  line,
  text: text.trim(),
  reason,
  sample,
});

const REGISTRY = {
  [ScannerType.SEARCH]: (options = {}) => {
    const keywords = Array.isArray(options.keywords)
      ? options.keywords
      : ["newsletterFollow("];
    return {
      name: ScannerType.SEARCH,
      exec: (lines) => {
        const matches = [];
        const bufferLines = 4;
        lines.forEach((line, i) => {
          for (const kw of keywords) {
            if (!line.includes(kw)) continue;
            const startAt = Math.max(i - bufferLines, 0);
            const endAt = Math.min(i + bufferLines + 1, lines.length);
            const sample = {};
            let trimLeft = Infinity;
            const rawSample = lines.slice(startAt, endAt);
            rawSample.forEach((l) => {
              const spaces = l.match(/^\s*/)?.[0].length || 0;
              if (l.trim() && spaces < trimLeft) trimLeft = spaces;
            });
            rawSample.forEach((l, ii) => {
              sample[ii + startAt + 1] = l
                .substring(trimLeft === Infinity ? 0 : trimLeft)
                .trimEnd();
            });
            matches.push(createMatch(i + 1, line, kw, sample));
          }
        });
        return matches.length ? matches : null;
      },
    };
  },
  [ScannerType.OBFUSCATION]: () => ({
    name: ScannerType.OBFUSCATION,
    exec: (lines) => {
      const patterns = [
        {
          id: "charCode",
          test: (c) =>
            /\b(?:fromCharCode|String\.fromCharCode|dcd)\s*\(/.test(c),
        },
        {
          id: "numArray",
          test: (c) => /\[\s*(?:\d{2,3}\s*,\s*){7,}\d{2,3}\s*\]/.test(c),
        },
        {
          id: "hexEscapes",
          test: (c) => /\\x[0-9a-f]{2}/i.test(c) && /\\u[0-9a-f]{4}/i.test(c),
        },
        { id: "eval", test: (c) => /\beval\s*\(/.test(c) },
        { id: "funcConstructor", test: (c) => /new\s+Function\s*\(/.test(c) },
        { id: "atob", test: (c) => /\batob\s*\(/.test(c) },
        { id: "longLine", test: (c) => c.length > 5000 },
        { id: "hexVar", test: (c) => /\b_0x[0-9a-f]{4,6}\b/.test(c) },
        {
          id: "largeStringArray",
          test: (c) =>
            /\[\s*['"][^'"]{2,}['"]\s*(?:,\s*['"][^'"]{2,}['"]\s*){15,}\]/.test(
              c,
            ),
        },
      ];
      const matches = [];
      lines.forEach((line, i) => {
        patterns.forEach((p) => {
          if (p.test(line)) matches.push(createMatch(i + 1, line, p.id));
        });
      });
      return matches.length ? matches : null;
    },
  }),
  [ScannerType.SECRETS]: () => ({
    name: ScannerType.SECRETS,
    exec: (lines) => {
      const patterns = [
        { id: "githubToken", regex: /ghp_[a-zA-Z0-9]{36}/ },
        {
          id: "genericSecret",
          regex:
            /(?:key|secret|token|password|auth|api_key).*['"][a-zA-Z0-9\-_]{20,}['"]/i,
        },
        { id: "mongoUri", regex: /mongodb(?:\+srv)?:\/\/[^\s'"]+/ },
        { id: "awsKey", regex: /AKIA[0-9A-Z]{16}/ },
      ];
      const matches = [];
      lines.forEach((line, i) => {
        patterns.forEach((p) => {
          const m = line.match(p.regex);
          if (m) matches.push(createMatch(i + 1, line, p.id));
        });
      });
      return matches.length ? matches : null;
    },
  }),
  [ScannerType.SUSPICIOUS]: () => ({
    name: ScannerType.SUSPICIOUS,
    exec: (lines) => {
      const keywords = [
        "eval(atob(",
        "exec(",
        "spawn(",
        "shell:true",
        "base64",
        "http://",
        "https://",
      ];
      const matches = [];
      lines.forEach((line, i) => {
        keywords.forEach((kw) => {
          if (line.includes(kw)) matches.push(createMatch(i + 1, line, kw));
        });
      });
      return matches.length ? matches : null;
    },
  }),
};

const scanners = {
  get: (type, options = {}) => REGISTRY[type]?.(options),
  all: () => Object.values(ScannerType).map((type) => REGISTRY[type]()),
  types: () => Object.values(ScannerType),
};

async function runScan(tarballUrl, options = {}) {
  const {
    methods = null,
    maxFileSize = 1024 * 1024,
    onPhase = null,
    include = DEFAULT_INCLUDE,
    exclude = DEFAULT_EXCLUDE,
  } = options;

  const normalize = (p) => (Array.isArray(p) ? p : [p]).map(globToRegex);
  const includeRules = normalize(include);
  const excludeRules = normalize(exclude);

  const selectedMethods = Array.isArray(methods)
    ? methods
    : methods
      ? [methods]
      : [];
  const activeScanners =
    selectedMethods.length === 0
      ? scanners.all()
      : selectedMethods
        .map((s) => (typeof s === "string" ? scanners.get(s) : s))
        .filter(Boolean);

  onPhase?.("download");
  const res = await fetch(tarballUrl);
  if (!res.ok)
    throw new Error(
      `Fetch failed: ${res.status} ${res.statusText} (${tarballUrl})`,
    );

  onPhase?.("extract");
  let buf = Buffer.from(await res.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);

  onPhase?.("scan");
  const results = [];
  for (const file of parseTar(buf)) {
    if (file.size > maxFileSize) continue;
    if (!shouldScan(file.name, includeRules, excludeRules)) continue;

    const lines = file.content.split("\n");
    const findings = {};
    for (const scanner of activeScanners) {
      const hits = scanner.exec(lines);
      if (hits) findings[scanner.name] = hits;
    }

    if (Object.keys(findings).length) {
      results.push({
        path: file.name,
        size: file.size,
        lines: lines.length,
        findings,
      });
    }
  }
  return results;
}

async function npmScan(pkg, options = {}) {
  const metadataRes = await fetch(
    `https://registry.npmjs.org/${pkg}/${"latest"}`,
  );
  if (!metadataRes.ok) throw new Error(`NPM metadata fetch failed for ${pkg}`);
  const metadata = await metadataRes.json();

  const url = metadata.dist?.tarball;
  if (!url) throw new Error(`Could not find tarball URL for ${pkg}`);

  return runScan(url, options);
}

async function repoScan(repo, options = {}) {
  const { branch, ...rest } = options;
  const branches = branch ? [branch] : ["main", "master"];
  let lastErr;
  for (const b of branches) {
    try {
      const url = `https://github.com/${repo}/archive/${b}.tar.gz`;
      return await runScan(url, rest);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

const PHASE_REACT = { download: "⬇️", extract: "📦", scan: "🔎" };

const t = translate({
  en: {
    usage:
      "_Usage:_ {pref}sscan [flags] <url|text>\n_Flags:_ -s -obf -sec -sus -a\n_Examples:_\n  {pref}sscan https://github.com/user/repo\n  {pref}sscan -sec https://npmjs.com/package/pkg\n  {pref}sscan -obf -sus (reply to a message)",
    no_issues: "No suspicious patterns detected.",
    error: "Error: {msg}",
    header: "*Scan Results*\n",
    gh_header: "*Scan: GitHub* — _{name}_\n",
    npm_header: "*Scan: NPM* — _{name}_\n",
    file_entry: "\n*{path}* ({lines} lines)",
    file_url: "  {url}",
    scanner_header: "\n  _{type}_ : {count} match(es)",
    match: "\n`L{line}: {reason} ─ {text}`",
    match_more: "\n    ... +{n} more",
    file_clean: "\n  ✓ clean",
  },
  id: {
    usage:
      "_Penggunaan:_ {pref}sscan [flags] <url|teks>\n_Flag:_ -s -obf -sec -sus -a\n_Contoh:_\n  {pref}sscan https://github.com/user/repo\n  {pref}sscan -sec https://npmjs.com/package/pkg\n  {pref}sscan -obf -sus (balas pesan)",
    no_issues: "Tidak ada pola mencurigakan terdeteksi.",
    error: "Error: {msg}",
    header: "*Hasil Pemindaian*\n",
    gh_header: "*Pindai: GitHub* — {name}\n",
    npm_header: "*Pindai: NPM* — {name}\n",
    file_entry: "\n*{path}* ({lines} baris)",
    file_url: "  {url}",
    scanner_header: "\n  _{type}_ : {count} temu",
    match: "\n`B{line}: {reason} ─ {text}`",
    match_more: "\n    ... +{n} lagi",
    file_clean: "\n  ✓ bersih",
  },
});

const GH_RE =
  /github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+?)(?:\/tree\/([^/\s]+))?(?:\/|$|\s|\.git)/g;
const NPM_RE = /(?:npmjs\.com\/package\/|npm:\/\/)([@a-zA-Z0-9_./-]+)/g;

const FLAG_MAP = {
  s: ScannerType.SEARCH,
  search: ScannerType.SEARCH,
  obf: ScannerType.OBFUSCATION,
  obfuscation: ScannerType.OBFUSCATION,
  sec: ScannerType.SECRETS,
  secrets: ScannerType.SECRETS,
  sus: ScannerType.SUSPICIOUS,
  suspicious: ScannerType.SUSPICIOUS,
  all: "all",
  a: "all",
};

function parseMethods(argv) {
  const flags = Object.keys(argv).filter((k) => k !== "_" && FLAG_MAP[k]);
  if (!flags.length || flags.some((k) => FLAG_MAP[k] === "all")) return null;
  return flags.map((k) => FLAG_MAP[k]);
}

function extractTargets(text) {
  const repoMap = new Map();
  for (const m of text.matchAll(GH_RE)) {
    const name = m[1].replace(/\.git$/, "");
    if (!repoMap.has(name)) {
      repoMap.set(name, { name, branch: m[2] || null });
    }
  }
  const repos = [...repoMap.values()];
  const pkgs = [
    ...new Set([...text.matchAll(NPM_RE)].map((m) => m[1].replace(/\/$/, ""))),
  ];
  return { repos, pkgs };
}

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  name: "std-scanwa",
  cmd: ["sscan"],
  cat: "utility",
  desc: "Scan text/GitHub/NPM. Flags: -s(earch) -obf(uscation) -sec(rets) -sus(picious) -a(all)",
  events: [MESSAGES_UPSERT],
  roles: [Role.PREMIUM],
  timeout: 0,

  exec: async (c) => {
    const text = c.text || "";
    const quoted = c.quotedText || "";
    if (!text && !quoted)
      return c.reply({ text: t("usage", { pref: c.prefix }, c) });

    const hasFlags = Object.keys(c.argv).some((k) => k !== "_" && FLAG_MAP[k]);
    if (!hasFlags) return c.reply({ text: t("usage", { pref: c.prefix }, c) });

    const hasQuotedDoc =
      c.quotedMessage?.documentMessage ||
      c.quotedMessage?.documentWithCaptionMessage?.message?.documentMessage;
    if (!quoted && !hasQuotedDoc && !c.argv?._?.length)
      return c.reply({ text: t("usage", { pref: c.prefix }, c) });

    const key = c.key;
    const methods = parseMethods(c.argv);
    const allText = `${text}\n${quoted}`;
    const { repos, pkgs } = extractTargets(allText);

    if (repos.length > 0 || pkgs.length > 0) {
      await c.react("⌛", key);
      const repoResults = [];
      const errors = [];

      for (const { name, branch } of repos) {
        try {
          const r = await repoScan(name, {
            branch,
            methods,
            onPhase: (phase) => c.react(PHASE_REACT[phase], key),
          });
          repoResults.push({ source: "gh", name, results: r });
        } catch (err) {
          errors.push(`GitHub/${name}: ${err.message}`);
        }
      }

      for (const pkg of pkgs) {
        try {
          const r = await npmScan(pkg, {
            methods,
            onPhase: (phase) => c.react(PHASE_REACT[phase], key),
          });
          repoResults.push({ source: "npm", name: pkg, results: r });
        } catch (err) {
          errors.push(`NPM/${pkg}: ${err.message}`);
        }
      }

      await c.react("✅", key);

      const parts = [];
      for (let i = 0; i < repoResults.length; i++) {
        if (i > 0) parts.push("");
        const { source, name, results } = repoResults[i];
        parts.push(formatRepoResults(source, name, results, c));
      }
      for (const err of errors) {
        parts.push(t("error", { msg: err }, c));
      }
      if (!parts.length) return c.reply({ text: t("no_issues", {}, c) });
      return c.reply({ text: parts.join("\n") });
    }

    if (hasQuotedDoc) {
      await c.react("📄", key);
      try {
        const buf = await c.downloadQuoted();
        if (!buf)
          return c.reply({
            text: t("error", { msg: "Failed to download document" }, c),
          });

        const docMsg = hasQuotedDoc;
        const mime = docMsg.mimetype || "";
        const fileName = docMsg.fileName || "file";

        if (
          mime.includes("gzip") ||
          fileName.endsWith(".gz") ||
          fileName.endsWith(".tgz")
        ) {
          const decompressed = zlib.gunzipSync(buf);
          if (
            fileName.endsWith(".tar") ||
            fileName.endsWith(".tar.gz") ||
            fileName.endsWith(".tgz")
          ) {
            const results = scanTarFiles(decompressed, methods);
            return formatDocumentResults(results, fileName, c);
          }
          return scanTextContent(
            decompressed.toString("utf-8"),
            fileName,
            methods,
            c,
          );
        }

        if (mime.includes("zip") || fileName.endsWith(".zip")) {
          const entries = new AdmZip(buf)
            .getEntries()
            .filter((e) => !e.isDirectory)
            .map((e) => ({
              path: e.entryName,
              lines: e.getData().toString("utf-8").split("\n"),
            }));
          return formatDocumentResults(
            scanArchiveEntries(entries, methods),
            fileName,
            c,
          );
        }

        return scanTextContent(buf.toString("utf-8"), fileName, methods, c);
      } catch (err) {
        await c.react("❌", key);
        return c.reply({ text: t("error", { msg: err.message }, c) });
      }
    }

    const scanText = text && !c.argv?._?.length ? quoted : text || quoted;
    const lines = scanText.split("\n");
    const findings = {};
    const activeScanners = methods
      ? methods.map((m) => scanners.get(m)).filter(Boolean)
      : scanners.all();
    for (const scanner of activeScanners) {
      const hits = scanner.exec(lines);
      if (hits) findings[scanner.name] = hits;
    }

    if (!Object.keys(findings).length)
      return c.reply({ text: t("no_issues", {}, c) });

    const parts = [t("header", {}, c)];
    const sorted = Object.entries(findings).sort(
      (a, b) => b[1].length - a[1].length,
    );
    for (const [type, hits] of sorted) {
      parts.push(
        t(
          "scanner_header",
          { type: type.toUpperCase(), count: hits.length },
          c,
        ),
      );
      for (const h of hits.slice(0, 5))
        parts.push(
          t(
            "match",
            {
              line: h.line,
              reason: h.reason,
              text: h.text.slice(0, 60).replace(/`/g, "'"),
            },
            c,
          ),
        );
      if (hits.length > 5)
        parts.push(t("match_more", { n: hits.length - 5 }, c));
    }

    return c.reply({ text: parts.join("") });
  },
};

function formatRepoResults(source, name, results, c) {
  const key = source === "npm" ? "npm_header" : "gh_header";
  const parts = [t(key, { name }, c)];
  const baseUrl =
    source === "gh"
      ? `https://github.com/${name}/blob/main`
      : `https://unpkg.com/${name}`;

  for (const r of results.slice(0, 8)) {
    const entries = Object.entries(r.findings);
    if (!entries.length) {
      parts.push(t("file_clean", {}, c));
      continue;
    }
    parts.push(t("file_entry", { path: r.path, lines: r.lines }, c));
    const firstLine = entries[0]?.[1]?.[0]?.line;
    const lineAnchor = firstLine ? `#L${firstLine}` : "";
    parts.push(t("file_url", { url: `${baseUrl}/${r.path}${lineAnchor}` }, c));
    for (const [type, hits] of entries) {
      parts.push(
        t(
          "scanner_header",
          { type: type.toUpperCase(), count: hits.length },
          c,
        ),
      );
      for (const h of hits.slice(0, 3))
        parts.push(
          t(
            "match",
            {
              line: h.line,
              reason: h.reason,
              text: h.text.slice(0, 60).replace(/`/g, "'"),
            },
            c,
          ),
        );
      if (hits.length > 3)
        parts.push(t("match_more", { n: hits.length - 3 }, c));
    }
  }

  if (results.length > 8) parts.push(`\n... +${results.length - 8} more files`);

  return parts.join("");
}

function scanTextContent(content, fileName, methods, c) {
  const lines = content.split("\n");
  const findings = {};
  const activeScanners = methods
    ? methods.map((m) => scanners.get(m)).filter(Boolean)
    : scanners.all();
  for (const scanner of activeScanners) {
    const hits = scanner.exec(lines);
    if (hits) findings[scanner.name] = hits;
  }

  if (!Object.keys(findings).length)
    return c.reply({ text: t("no_issues", {}, c) });

  const parts = [`*Scan: document* — _${fileName}_ (${lines.length} lines)\n`];
  const sorted = Object.entries(findings).sort(
    (a, b) => b[1].length - a[1].length,
  );
  for (const [type, hits] of sorted) {
    parts.push(
      t("scanner_header", { type: type.toUpperCase(), count: hits.length }, c),
    );
    for (const h of hits.slice(0, 5))
      parts.push(
        t(
          "match",
          {
            line: h.line,
            reason: h.reason,
            text: h.text.slice(0, 60).replace(/`/g, "'"),
          },
          c,
        ),
      );
    if (hits.length > 5) parts.push(t("match_more", { n: hits.length - 5 }, c));
  }
  return c.reply({ text: parts.join("") });
}

function scanArchiveEntries(entries, methods) {
  const activeScanners = methods
    ? methods.map((m) => scanners.get(m)).filter(Boolean)
    : scanners.all();
  const includeRules = DEFAULT_INCLUDE.map(globToRegex);
  const excludeRules = DEFAULT_EXCLUDE.map(globToRegex);
  const results = [];
  for (const { path, lines } of entries) {
    if (!shouldScan(path, includeRules, excludeRules)) continue;
    const findings = {};
    for (const scanner of activeScanners) {
      const hits = scanner.exec(lines);
      if (hits) findings[scanner.name] = hits;
    }
    if (Object.keys(findings).length)
      results.push({ path, lines: lines.length, findings });
  }
  return results;
}

function scanTarFiles(buffer, methods) {
  const entries = [...parseTar(buffer)].map((f) => ({
    path: f.name,
    lines: f.content.split("\n"),
  }));
  return scanArchiveEntries(entries, methods);
}

function formatDocumentResults(results, fileName, c) {
  if (!results.length) return c.reply({ text: t("no_issues", {}, c) });
  const parts = [`*Scan: archive* — _${fileName}_\n`];
  for (const r of results.slice(0, 8)) {
    parts.push(t("file_entry", { path: r.path, lines: r.lines }, c));
    for (const [type, hits] of Object.entries(r.findings)) {
      parts.push(
        t(
          "scanner_header",
          { type: type.toUpperCase(), count: hits.length },
          c,
        ),
      );
      for (const h of hits.slice(0, 3))
        parts.push(
          t(
            "match",
            {
              line: h.line,
              reason: h.reason,
              text: h.text.slice(0, 60).replace(/`/g, "'"),
            },
            c,
          ),
        );
      if (hits.length > 3)
        parts.push(t("match_more", { n: hits.length - 3 }, c));
    }
  }
  if (results.length > 8) parts.push(`\n... +${results.length - 8} more files`);
  return c.reply({ text: parts.join("") });
}
