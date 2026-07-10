#!/usr/bin/env node
// anti_doorway_lint.mjs — content gate for the DareBay SEO/GEO fleet (version 1).
//
// Lints CHANGED markdown pages under docs/ru/ for the failure modes that turn a content
// fleet into a doorway/scaled-content farm:
//   1. redirects (301 / JS-location / meta-refresh)        — doorway
//   2. missing provenance on a seo page                     — unverifiable numbers
//   3. invalid path/slug or duplicate URL                   — junk / collision
//   4. volume cap (<=8 new per branch, <=60 total)          — scaled-content
//   5. near-duplication vs the whole corpus                 — template spam
//
// Usage:
//   node anti_doorway_lint.mjs --corpus <dir> [--base <ref>] [--changed a.md,b.md] [--root <dir>]
//
// --corpus : directory of ALL existing pages to dedup/cap against (e.g. docs/ru). REQUIRED.
//            Fails loud (exit 2) if missing, absent, or empty.
// --changed: explicit comma-list of changed page paths (used by tests / producer). If omitted,
//            resolved via `git diff --name-only <base>...HEAD` filtered to docs/ru/**.md.
// --base   : git base ref for change detection (default origin/develop).
// --root   : repo root for resolving relative paths (default cwd).
//
// Exit: 0 = clean, 1 = violations found, 2 = usage/infra error.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execSync } from "node:child_process";

export const ZONES = ["faq", "zarabotok", "platformy", "kak-rabotaet", "blog"];
export const CAP_NEW_PER_WAVE = 8;
export const CAP_TOTAL = 60;
export const DUP_THRESHOLD = 0.8; // Jaccard over 5-word shingles. Calibrate on wave 1.

const REDIRECT_PATTERNS = [
  /http-equiv\s*=\s*["']?\s*refresh/i,
  /<meta[^>]+refresh/i,
  /window\.location/i,
  /location\.(href|replace|assign)/i,
  /(^|\n)\s*redirect\s*:\s*[\/"']/i, // frontmatter redirect key
  /(^|\n)\s*Redirect\s+30[12]\b/i,   // server-style redirect directive
];

// ---- helpers ----
function listMarkdown(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (e.endsWith(".md")) out.push(p);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

function parseFront(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const fm = m ? m[1] : "";
  const body = m ? text.slice(m[0].length) : text;
  const seo = /(^|\n)\s*seo:\s*true\b/.test(fm);
  const provMatch = fm.match(/provenance\s*:\s*\{[^}]*snapshot_date\s*:\s*["']?(\d{4}-\d{2}-\d{2})/);
  const hasProvenance = !!provMatch;
  return { fm, body, seo, hasProvenance, snapshot_date: provMatch ? provMatch[1] : null };
}

export function pathInfo(p) {
  const norm = p.replace(/\\/g, "/");
  const m = norm.match(/docs\/ru\/([^/]+)\/([^/]+)\.md$/);
  if (!m) return { isPage: false, norm };
  const [, zone, slug] = m;
  return {
    isPage: true,
    norm,
    zone,
    slug,
    validZone: ZONES.includes(zone),
    validSlug: slug === "index" || /^[a-z0-9-]+$/.test(slug),
    url: `/docs/ru/${zone}/${slug}`,
  };
}

function shingles(body) {
  const words = body.toLowerCase().replace(/[^a-zа-яё0-9\s]/gi, " ").split(/\s+/).filter(Boolean);
  const k = 5, set = new Set();
  for (let i = 0; i + k <= words.length; i++) set.add(words.slice(i, i + k).join(" "));
  return set;
}
function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const s of a) if (b.has(s)) inter++;
  return inter / (a.size + b.size - inter);
}

// ---- core (pure, testable) ----
export function runLint({ corpusDir, changedFiles, root = process.cwd() }) {
  const violations = [];
  const fail = (rule, file, msg) => violations.push({ rule, file, msg });

  // fail-loud on corpus
  if (!corpusDir) return { fatal: "missing --corpus", violations };
  const corpusAbs = resolve(root, corpusDir);
  if (!existsSync(corpusAbs)) return { fatal: `--corpus not found: ${corpusDir}`, violations };
  const corpusFiles = listMarkdown(corpusAbs);
  if (corpusFiles.length === 0) return { fatal: `--corpus empty: ${corpusDir}`, violations };

  // index corpus: url -> [paths], shingles, seo count
  const urlMap = new Map();
  const corpusPages = [];
  let totalSeo = 0;
  for (const f of corpusFiles) {
    const rel = relative(root, f);
    const info = pathInfo(rel);
    const parsed = parseFront(readFileSync(f, "utf8"));
    if (info.isPage) {
      if (!urlMap.has(info.url)) urlMap.set(info.url, []);
      urlMap.get(info.url).push(rel);
    }
    if (parsed.seo) totalSeo++;
    corpusPages.push({ rel, info, sh: shingles(parsed.body), seo: parsed.seo });
  }

  // per-changed-file rules
  let newSeo = 0;
  for (const cf of changedFiles) {
    const info = pathInfo(cf);
    if (!info.isPage) continue; // only docs/ru/<zone>/<slug>.md pages are gated
    if (!info.validZone) continue; // human/legacy zones (getting-started, legal, …) are NOT fleet-gated
    const abs = resolve(root, cf);
    if (!existsSync(abs)) continue; // deletion — skip
    const text = readFileSync(abs, "utf8");
    const parsed = parseFront(text);
    const selfAbs = resolve(root, cf);

    // 1. redirect
    for (const re of REDIRECT_PATTERNS) {
      if (re.test(text)) { fail("redirect", cf, `doorway redirect pattern matched: ${re}`); break; }
    }
    // 3a. slug validity (zone already validated above; non-content zones are skipped, not failed)
    if (!info.validSlug) fail("path", cf, `slug "${info.slug}" must match ^[a-z0-9-]+$`);
    // 3b. URL uniqueness across whole corpus (self excluded by ABSOLUTE path, not string form)
    const others = (urlMap.get(info.url) || []).filter((p) => resolve(root, p) !== selfAbs);
    if (others.length) fail("uniqueness", cf, `URL ${info.url} collides with ${others.join(", ")}`);
    // 2. provenance (index pages exempt; real pages must carry it)
    if (info.slug !== "index" && !parsed.hasProvenance) {
      fail("provenance", cf, `missing frontmatter provenance.snapshot_date (every content page needs it)`);
    }
    // 4. count new seo pages — an EDIT to an already-existing corpus page is NOT "new"
    const preexisting = (urlMap.get(info.url) || []).some((p) => resolve(root, p) !== selfAbs);
    if (parsed.seo && !preexisting) newSeo++;
    // 5. near-duplication vs corpus
    const sh = shingles(parsed.body);
    let worst = { url: null, sim: 0 };
    for (const cp of corpusPages) {
      if (cp.rel === cf || cp.info.url === info.url) continue;
      const sim = jaccard(sh, cp.sh);
      if (sim > worst.sim) worst = { url: cp.rel, sim };
    }
    if (worst.sim > DUP_THRESHOLD) {
      fail("duplicate", cf, `near-duplicate of ${worst.url} (jaccard=${worst.sim.toFixed(2)} > ${DUP_THRESHOLD})`);
    }
  }

  // 4. caps
  if (newSeo > CAP_NEW_PER_WAVE) fail("cap", "(branch)", `${newSeo} new seo pages > ${CAP_NEW_PER_WAVE} per wave`);
  // totalSeo already counts existing corpus; new pages under corpusDir are included if corpus==changed root.
  if (totalSeo > CAP_TOTAL) fail("cap", "(corpus)", `${totalSeo} total seo pages > ${CAP_TOTAL}`);

  return { fatal: null, violations };
}

// ---- CLI ----
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--corpus") a.corpus = argv[++i];
    else if (argv[i] === "--base") a.base = argv[++i];
    else if (argv[i] === "--changed") a.changed = argv[++i];
    else if (argv[i] === "--root") a.root = argv[++i];
  }
  return a;
}
const GATED_RE = /docs\/ru\/(faq|zarabotok|platformy|kak-rabotaet|blog)\/.*\.md$/;
function resolveChanged(a, root) {
  if (a.changed != null) return a.changed.split(",").map((s) => s.trim()).filter(Boolean);
  let base = a.base || "origin/develop";
  const reachable = (ref) => {
    try { execSync(`git cat-file -e ${ref}^{commit}`, { cwd: root, stdio: "ignore" }); return true; }
    catch { return false; }
  };
  if (!reachable(base)) {
    if (reachable("origin/develop")) base = "origin/develop";
    else throw new Error(`base ref unreachable: ${a.base || "origin/develop"} (and origin/develop). Fetch the base or pass --base <sha>.`);
  }
  const out = execSync(`git diff --name-only ${base}...HEAD`, { cwd: root, encoding: "utf8" });
  // CLI/CI mode gates ONLY the 5 content zones; human zones (legal, getting-started) pass untouched.
  return out.split("\n").map((s) => s.trim()).filter((p) => GATED_RE.test(p));
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const root = a.root ? resolve(a.root) : process.cwd();
  if (!a.corpus) { console.error("FATAL: --corpus <dir> is required (fail-loud)"); process.exit(2); }
  let changed;
  try { changed = resolveChanged(a, root); }
  catch (e) { console.error(`FATAL: cannot resolve changed files: ${e.message}`); process.exit(2); }
  const res = runLint({ corpusDir: a.corpus, changedFiles: changed, root });
  if (res.fatal) { console.error(`FATAL: ${res.fatal}`); process.exit(2); }
  if (res.violations.length === 0) {
    console.log(`anti-doorway-lint: OK (${changed.length} changed page(s) checked)`);
    process.exit(0);
  }
  console.error(`anti-doorway-lint: ${res.violations.length} violation(s):`);
  for (const v of res.violations) console.error(`  [${v.rule}] ${v.file}: ${v.msg}`);
  process.exit(1);
}

// run main only as CLI (not when imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) main();
