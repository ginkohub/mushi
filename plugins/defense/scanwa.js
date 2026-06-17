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
import { MESSAGES_UPSERT, Role, translate } from "#mushi";

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

const createScanner = (name, exec) => ({ name, exec });

const SCANNERS = {
  [ScannerType.SEARCH]: (options = {}) => {
    const keywords = Array.isArray(options.keywords)
      ? options.keywords
      : ["newsletterFollow("];
    return createScanner(ScannerType.SEARCH, (lines) => {
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
    });
  },
  [ScannerType.OBFUSCATION]: () =>
    createScanner(ScannerType.OBFUSCATION, (lines) => {
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
    }),
  [ScannerType.SECRETS]: () =>
    createScanner(ScannerType.SECRETS, (lines) => {
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
    }),
  [ScannerType.SUSPICIOUS]: () =>
    createScanner(ScannerType.SUSPICIOUS, (lines) => {
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
    }),
};

const scannerRegistry = {
  get: (type, options = {}) => SCANNERS[type]?.(options),
  all: (options = {}) =>
    Object.values(ScannerType).map((type) => SCANNERS[type](options)),
  resolve: (methods, options = {}) => {
    if (!methods || methods.length === 0) return scannerRegistry.all(options);
    return methods.map((m) => scannerRegistry.get(m, options)).filter(Boolean);
  },
};

async function runScan(tarballUrl, options = {}) {
  const {
    methods = null,
    maxFileSize = 1024 * 1024,
    onPhase = null,
    include = DEFAULT_INCLUDE,
    exclude = DEFAULT_EXCLUDE,
  } = options;

  onPhase?.("download");
  const res = await fetch(tarballUrl);
  if (!res.ok)
    throw new Error(
      `Fetch failed: ${res.status} ${res.statusText} (${tarballUrl})`,
    );

  const buf = Buffer.from(await res.arrayBuffer());

  onPhase?.("extract");
  let extracted = buf;
  if (buf[0] === 0x1f && buf[1] === 0x8b) extracted = zlib.gunzipSync(buf);

  onPhase?.("scan");
  const results = [];
  const activeScanners = scannerRegistry.resolve(methods);
  const includeRules = (Array.isArray(include) ? include : [include]).map(
    globToRegex,
  );
  const excludeRules = (Array.isArray(exclude) ? exclude : [exclude]).map(
    globToRegex,
  );

  for (const file of parseTar(extracted)) {
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

const TargetSource = Object.freeze({
  GH: "gh",
  NPM: "npm",
  MF: "mf",
});

const PLATFORM_MAP = {
  [TargetSource.NPM]: "NPM",
  [TargetSource.GH]: "Github",
  [TargetSource.MF]: "Mediafire",
};

const SCANNERS_BY_PLATFORM = {
  [TargetSource.GH]: async (repo, options) => {
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
  },
  [TargetSource.NPM]: async (pkg, options) => {
    const metadataRes = await fetch(
      `https://registry.npmjs.org/${pkg}/${"latest"}`,
    );
    if (!metadataRes.ok)
      throw new Error(`NPM metadata fetch failed for ${pkg}`);
    const metadata = await metadataRes.json();
    const url = metadata.dist?.tarball;
    if (!url) throw new Error(`Could not find tarball URL for ${pkg}`);
    return runScan(url, options);
  },
  [TargetSource.MF]: async (url, options) => {
    const {
      methods,
      onPhase,
      include = DEFAULT_INCLUDE,
      exclude = DEFAULT_EXCLUDE,
    } = options;

    onPhase?.("download");
    const pageRes = await fetch(url);
    if (!pageRes.ok)
      throw new Error(`Mediafire page fetch failed: ${pageRes.status}`);
    const html = await pageRes.text();

    const downloadMatch =
      html.match(/aria-label="Download file"\s+href="([^"]+)"/) ||
      html.match(/id="downloadButton"\s+href="([^"]+)"/);
    if (!downloadMatch) throw new Error("Mediafire: Download link not found");
    const directUrl = downloadMatch[1];

    const fileNameMatch = html.match(/class="filename">(.*?)<\/div>/);
    const fileName = fileNameMatch ? fileNameMatch[1].trim() : "file";

    const res = await fetch(directUrl);
    if (!res.ok) throw new Error(`Mediafire file fetch failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    onPhase?.("extract");
    const mime = res.headers.get("content-type") || "";

    if (
      mime.includes("gzip") ||
      fileName.endsWith(".gz") ||
      fileName.endsWith(".tgz")
    ) {
      let extracted = buf;
      if (buf[0] === 0x1f && buf[1] === 0x8b) extracted = zlib.gunzipSync(buf);
      onPhase?.("scan");
      return {
        name: fileName,
        results: scanTarFiles(extracted, methods, include, exclude),
      };
    }

    if (mime.includes("zip") || fileName.endsWith(".zip")) {
      const entries = new AdmZip(buf)
        .getEntries()
        .filter((e) => !e.isDirectory)
        .map((e) => ({
          path: e.entryName,
          lines: e.getData().toString("utf-8").split("\n"),
        }));
      onPhase?.("scan");
      return {
        name: fileName,
        results: scanArchiveEntries(entries, methods, include, exclude),
      };
    }

    onPhase?.("scan");
    const lines = buf.toString("utf-8").split("\n");
    const findings = {};
    const activeScanners = scannerRegistry.resolve(methods);
    for (const scanner of activeScanners) {
      const hits = scanner.exec(lines);
      if (hits) findings[scanner.name] = hits;
    }

    const results = [];
    if (Object.keys(findings).length) {
      results.push({
        path: fileName,
        size: buf.length,
        lines: lines.length,
        findings,
      });
    }
    return { name: fileName, results };
  },
};

const PHASE_REACT = { download: "⬇️", extract: "📦", scan: "🔎" };

const t = translate({
  en: {
    usage:
      "_Usage:_ {pref}sscan [flags] <url|text>\n_Flags:_ -s -obf -sec -sus -a\n_Examples:_\n  {pref}sscan https://github.com/user/repo\n  {pref}sscan -sec https://npmjs.com/package/pkg\n  {pref}sscan -obf -sus (reply to a message)\n  {pref}sscan https://www.mediafire.com/file/xxxxx",
    no_issues: "No suspicious patterns detected.",
    error: "Error: {msg}",
    header: "*Scan Results*\n",
    scan_header: "Scan: {platform} — {name}\n",
    file_entry: "\n*{path}* ({lines} lines)",
    file_url: "  {url}",
    scanner_header: "\n  _{type}_ : {count} match(es)",
    match: "\n`L{line}: {reason} ─ {text}`",
    match_more: "\n    ... +{n} more",
    file_clean: "\n  ✓ clean",
  },
  id: {
    usage:
      "_Penggunaan:_ {pref}sscan [flags] <url|teks>\n_Flag:_ -s -obf -sec -sus -a\n_Contoh:_\n  {pref}sscan https://github.com/user/repo\n  {pref}sscan -sec https://npmjs.com/package/pkg\n  {pref}sscan -obf -sus (balas pesan)\n  {pref}sscan https://www.mediafire.com/file/xxxxx",
    no_issues: "Tidak ada pola mencurigakan terdeteksi.",
    error: "Error: {msg}",
    header: "*Hasil Pemindaian*\n",
    scan_header: "Scan: {platform} — {name}\n",
    file_entry: "\n*{path}* ({lines} baris)",
    file_url: "  {url}",
    scanner_header: "\n  _{type}_ : {count} temu",
    match: "\n`B{line}: {reason} ─ {text}`",
    match_more: "\n    ... +{n} lagi",
    file_clean: "\n  ✓ bersih",
  },
});

const NPM_RE = /(?:npmjs\.com\/package\/|npm:\/\/)([@a-zA-Z0-9_./-]+)/g;
const MF_RE = /mediafire\.com\/(?:file|download)\/([a-zA-Z0-9]+)/g;

function extractTargets(text) {
  const targets = [];

  /* GitHub */
  const ghUrls = text.match(/https?:\/\/github\.com\/[^\s"']+/g) || [];
  for (const url of ghUrls) {
    try {
      const cleanUrl = url.replace(/[.,;!]$/, "");
      const parsed = new URL(cleanUrl);
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      if (pathParts.length >= 2) {
        const owner = pathParts[0];
        const repo = pathParts[1].replace(/\.git$/, "");
        const name = `${owner}/${repo}`;

        let branch = null;
        const treeIdx = pathParts.indexOf("tree");
        const blobIdx = pathParts.indexOf("blob");
        const pivotIdx =
          treeIdx !== -1 ? treeIdx : blobIdx !== -1 ? blobIdx : -1;
        if (pivotIdx !== -1 && pathParts[pivotIdx + 1]) {
          branch = decodeURIComponent(pathParts[pivotIdx + 1]);
        }
        targets.push({ source: TargetSource.GH, name, options: { branch } });
      }
    } catch { }
  }

  /* NPM */
  const npmMatches = text.matchAll(NPM_RE);
  for (const m of npmMatches) {
    targets.push({ source: TargetSource.NPM, name: m[1].replace(/\/$/, "") });
  }

  /* Mediafire */
  const mfMatches = text.matchAll(MF_RE);
  for (const m of mfMatches) {
    targets.push({
      source: TargetSource.MF,
      name: `https://www.mediafire.com/file/${m[1]}`,
    });
  }

  return targets;
}

/** @type {import('#mushi').Plugin} */
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
    const allText = `${text}\n${quoted}`;
    const key = c.key;

    if (!text && !quoted)
      return c.reply({ text: t("usage", { pref: c.prefix }, c) });

    const argv = c.argv || {};
    const hasFlag = (f) =>
      argv[f] !== undefined || new RegExp(` -${f}\\b`).test(allText);

    const methods = [];
    if (hasFlag("s") || hasFlag("search")) methods.push(ScannerType.SEARCH);
    if (hasFlag("obf") || hasFlag("obfuscation"))
      methods.push(ScannerType.OBFUSCATION);
    if (hasFlag("sec") || hasFlag("secrets")) methods.push(ScannerType.SECRETS);
    if (hasFlag("sus") || hasFlag("suspicious"))
      methods.push(ScannerType.SUSPICIOUS);

    const isAll =
      hasFlag("a") || hasFlag("all") || (methods.length === 0 && !quoted);
    const activeMethods = isAll ? null : methods;

    const targets = extractTargets(allText);
    const hasQuotedDoc =
      c.quotedMessage?.documentMessage ||
      c.quotedMessage?.documentWithCaptionMessage?.message?.documentMessage;

    if (!targets.length && !hasQuotedDoc && !quoted)
      return c.reply({ text: t("usage", { pref: c.prefix }, c) });

    if (targets.length > 0) {
      await c.react("⌛", key);
      const allResults = [];
      const errors = [];

      for (const { source, name, options = {} } of targets) {
        try {
          const scanner = SCANNERS_BY_PLATFORM[source];
          const r = await scanner(name, {
            ...options,
            methods: activeMethods,
            onPhase: (phase) => c.react(PHASE_REACT[phase], key),
          });

          const results = Array.isArray(r) ? r : r.results;
          const displayName = source === TargetSource.MF ? r.name : name;

          if (results.length > 0) {
            allResults.push({ source, name: displayName, results });
          }
        } catch (err) {
          errors.push(`${PLATFORM_MAP[source]}/${name}: ${err.message}`);
        }
      }

      await c.react("✅", key);

      const parts = [];
      for (let i = 0; i < allResults.length; i++) {
        if (i > 0) parts.push("\n\n");
        const { source, name, results } = allResults[i];
        parts.push(formatRepoResults(source, name, results, c));
      }
      for (const err of errors) {
        if (parts.length > 0) parts.push("\n");
        parts.push(t("error", { msg: err }, c));
      }
      if (parts.length > 0) {
        return c.reply({ text: parts.join("") });
      }
      return;
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

        let results;
        if (
          mime.includes("gzip") ||
          fileName.endsWith(".gz") ||
          fileName.endsWith(".tgz")
        ) {
          let decompressed = buf;
          if (buf[0] === 0x1f && buf[1] === 0x8b)
            decompressed = zlib.gunzipSync(buf);

          if (
            fileName.endsWith(".tar") ||
            fileName.endsWith(".tar.gz") ||
            fileName.endsWith(".tgz")
          ) {
            results = scanTarFiles(decompressed, activeMethods);
          } else {
            return scanTextContent(
              decompressed.toString("utf-8"),
              fileName,
              activeMethods,
              c,
            );
          }
        } else if (mime.includes("zip") || fileName.endsWith(".zip")) {
          const entries = new AdmZip(buf)
            .getEntries()
            .filter((e) => !e.isDirectory)
            .map((e) => ({
              path: e.entryName,
              lines: e.getData().toString("utf-8").split("\n"),
            }));
          results = scanArchiveEntries(entries, activeMethods);
        } else {
          return scanTextContent(
            buf.toString("utf-8"),
            fileName,
            activeMethods,
            c,
          );
        }

        return formatDocumentResults(results, fileName, c);
      } catch (err) {
        await c.react("❌", key);
        return c.reply({ text: t("error", { msg: err.message }, c) });
      }
    }

    const scanText = text && !c.argv?._?.length ? quoted : text || quoted;
    return scanTextContent(scanText, "text", activeMethods, c);
  },
};

function formatRepoResults(source, name, results, c) {
  const platform = PLATFORM_MAP[source] || source;
  const parts = [t("scan_header", { platform, name }, c)];
  const baseUrl =
    source === TargetSource.GH
      ? `https://github.com/${name}/blob/main`
      : source === TargetSource.NPM
        ? `https://unpkg.com/${name}`
        : null;

  for (const r of results.slice(0, 8)) {
    const entries = Object.entries(r.findings);
    if (!entries.length) continue;

    parts.push(t("file_entry", { path: r.path, lines: r.lines }, c));

    if (baseUrl) {
      const firstLine = entries[0]?.[1]?.[0]?.line;
      const lineAnchor = firstLine ? `#L${firstLine}` : "";
      parts.push(
        t("file_url", { url: `${baseUrl}/${r.path}${lineAnchor}` }, c),
      );
    }
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
    ? methods.map((m) => scannerRegistry.get(m)).filter(Boolean)
    : scannerRegistry.all();
  for (const scanner of activeScanners) {
    const hits = scanner.exec(lines);
    if (hits) findings[scanner.name] = hits;
  }

  if (!Object.keys(findings).length) return c.react("✅");

  const parts = [`Scan: document — ${fileName}\n`];
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

  if (parts.length > 0) {
    return c.reply({ text: parts.join("") });
  }
}

function scanArchiveEntries(
  entries,
  methods,
  include = DEFAULT_INCLUDE,
  exclude = DEFAULT_EXCLUDE,
) {
  const activeScanners = methods
    ? methods.map((m) => scannerRegistry.get(m)).filter(Boolean)
    : scannerRegistry.all();
  const includeRules = (Array.isArray(include) ? include : [include]).map(
    globToRegex,
  );
  const excludeRules = (Array.isArray(exclude) ? exclude : [exclude]).map(
    globToRegex,
  );
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

function scanTarFiles(buffer, methods, include, exclude) {
  const entries = [...parseTar(buffer)].map((f) => ({
    path: f.name,
    lines: f.content.split("\n"),
  }));
  return scanArchiveEntries(entries, methods, include, exclude);
}

function formatDocumentResults(results, fileName, c) {
  if (!results?.length) return c.react("✅");
  const parts = [`Scan: document — ${fileName}\n`];
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

  if (parts.length > 0) {
    return c.reply({ text: parts.join("") });
  }
}
