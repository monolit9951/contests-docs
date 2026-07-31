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
export function runLint({ corpusDir, changedFiles, root = process.cwd(), addedFiles = null }) {
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
  //
  // Учёт осмотренного (2026-07-29): раньше строка OK печатала длину СПИСКА ПУТЕЙ, а не число
  // страниц, к которым реально применились правила. Путь мог сматчить зонную регулярку и при этом
  // тихо выпасть из цикла (`continue`) — гейт отчитывался «OK (1 changed page checked)», проверив
  // ноль правил. Теперь считаем отдельно: inspected (правила применены) и skipped по причинам.
  let newSeo = 0;
  let inspected = 0;
  const skipped = { deleted: 0, nonpage: 0, otherzone: 0 };
  for (const cf of changedFiles) {
    const info = pathInfo(cf);
    // GATED_RE содержит `.*` и перескакивает слеш, а pathInfo требует РОВНО один сегмент зоны.
    // Путь вида docs/ru/blog/2026/x.md проходил первую проверку и проваливался во вторую — молча.
    // Если путь ЗАЯВЛЕН как гейтируемый, но не разбирается как страница, это нарушение, а не skip:
    // иначе дорвей во вложенном каталоге уезжает в прод, посчитанный как «проверенный».
    const gated = GATED_RE.test(cf);
    if (!info.isPage) {
      if (gated) fail("path", cf, `gated path does not parse as docs/ru/<zone>/<slug>.md — every rule would silently skip it`);
      else skipped.nonpage++;
      continue;
    }
    if (!info.validZone) {
      if (gated) fail("path", cf, `zone "${info.zone}" matches the gated pattern but is not a valid content zone`);
      else skipped.otherzone++; // human/legacy зоны (getting-started, legal, …) — НЕ флотские, законно
      continue;
    }
    const abs = resolve(root, cf);
    if (!existsSync(abs)) { skipped.deleted++; continue; } // удаление — правила применять не к чему
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
    // 4. count new seo pages — an EDIT to an already-existing corpus page is NOT "new".
    // Раньше «новизна» выводилась из urlMap: искали ДРУГОЙ путь с тем же URL. Но корпус строится
    // из рабочего дерева, где страница лежит ровно по своему пути, поэтому others всегда пуст и
    // preexisting всегда false — ЛЮБАЯ правка считалась новой страницей и жгла квоту волны
    // (проверено: 9 правок существующих страниц → «9 new seo pages > 8 per wave»).
    // Истина о новизне живёт в git, а не в корпусе: новая = добавленная относительно базы.
    // addedFiles === null (режим --changed без базы) — фолбэк на прежнее поведение, там вызывающий
    // сам задаёт набор (продюсер пишет одну страницу, тесты передают явный список).
    const isNew = addedFiles ? addedFiles.has(cf) : true;
    if (parsed.seo && isNew) newSeo++;
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
    inspected++; // все правила применены к этой странице — только теперь она «проверена»
  }

  // 4. caps
  if (newSeo > CAP_NEW_PER_WAVE) fail("cap", "(branch)", `${newSeo} new seo pages > ${CAP_NEW_PER_WAVE} per wave`);
  // totalSeo already counts existing corpus; new pages under corpusDir are included if corpus==changed root.
  if (totalSeo > CAP_TOTAL) fail("cap", "(corpus)", `${totalSeo} total seo pages > ${CAP_TOTAL}`);

  return { fatal: null, violations, inspected, skipped };
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
// База разрешается ОДИН раз и возвращается наружу: набор изменённых и набор ДОБАВЛЕННЫХ обязаны
// считаться от одной и той же базы, иначе «новизна» страницы поедет относительно её же диффа.
function resolveBase(a, root) {
  if (a.changed != null) return null; // явный список — базы нет по построению
  let base = a.base || "origin/develop";
  const reachable = (ref) => {
    try { execSync(`git cat-file -e ${ref}^{commit}`, { cwd: root, stdio: "ignore" }); return true; }
    catch { return false; }
  };
  if (!reachable(base)) {
    if (reachable("origin/develop")) base = "origin/develop";
    else throw new Error(`base ref unreachable: ${a.base || "origin/develop"} (and origin/develop). Fetch the base or pass --base <sha>.`);
  }
  return base;
}
function resolveChanged(a, root, base) {
  if (a.changed != null) return a.changed.split(",").map((s) => s.trim()).filter(Boolean);
  const out = execSync(`git diff --name-only ${base}...HEAD`, { cwd: root, encoding: "utf8" });
  // CLI/CI mode gates ONLY the 5 content zones; human zones (legal, getting-started) pass untouched.
  return out.split("\n").map((s) => s.trim()).filter((p) => GATED_RE.test(p));
}
// Добавленные относительно базы — единственный честный источник «новизны» страницы (см. правило 4).
function resolveAdded(root, base) {
  if (!base) return null;
  const out = execSync(`git diff --name-only --diff-filter=A ${base}...HEAD`, { cwd: root, encoding: "utf8" });
  return new Set(out.split("\n").map((s) => s.trim()).filter(Boolean));
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const root = a.root ? resolve(a.root) : process.cwd();
  if (!a.corpus) { console.error("FATAL: --corpus <dir> is required (fail-loud)"); process.exit(2); }
  let changed, added;
  try {
    const base = resolveBase(a, root);
    changed = resolveChanged(a, root, base);
    added = resolveAdded(root, base);
  }
  catch (e) { console.error(`FATAL: cannot resolve changed files: ${e.message}`); process.exit(2); }
  const res = runLint({ corpusDir: a.corpus, changedFiles: changed, root, addedFiles: added });
  if (res.fatal) { console.error(`FATAL: ${res.fatal}`); process.exit(2); }
  if (res.violations.length === 0) {
    // inspected = страницы, к которым РЕАЛЬНО применились правила; skipped — с причинами.
    // Потребитель (промоут) сверяет inspected+skipped со своим независимым счётом путей: без этого
    // «OK (N changed page(s) checked)» означало лишь «N путей сматчили регулярку».
    const sk = res.skipped;
    const skTotal = sk.deleted + sk.nonpage + sk.otherzone;
    console.log(`anti-doorway-lint: OK (${changed.length} changed page(s) checked; inspected=${res.inspected} skipped=${skTotal} [deleted=${sk.deleted} nonpage=${sk.nonpage} otherzone=${sk.otherzone}])`);
    process.exit(0);
  }
  console.error(`anti-doorway-lint: ${res.violations.length} violation(s):`);
  for (const v of res.violations) console.error(`  [${v.rule}] ${v.file}: ${v.msg}`);
  process.exit(1);
}

// run main only as CLI (not when imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) main();
