#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_TRUTH = join(DEFAULT_ROOT, "data/product-truth.json");
const DEFAULT_INTENT = join(DEFAULT_ROOT, "data/product-intent.json");

// Two classes of product number, and they need opposite handling.
//
// STABLE values are invariants: commissions and defaults read out of backend configuration or
// code, system limits enforced by a validator, and ladder-rounded bands over the live
// distribution. They only move when the product moves, so they are safe to print on a public
// page and are checked for exact equality against the double-entry baseline below.
//
// VOLATILE values are live aggregates recomputed from production Mongo on every truth-pack run:
// medians, live minima/maxima and counts. `ppv_max_per_work_typical` moved 97 -> 98.5 inside a
// single day over ten PPV contests, which is what the median of a ten-item sample does. Pinning
// such a value in this baseline would force a reviewed code edit on every cron run, and gating
// public copy on exact equality with it forces the whole section to be rewritten daily. So
// volatile values are NOT double-entered here: `validateTruthSnapshot` only checks their shape
// and that they still fall inside the stable band that bounds them, and the content rules never
// require a page to print them.
//
// A real product-policy change must update the backend, the reviewed snapshot, this baseline and
// the public pages in one change. Editing only the JSON cannot silently redefine what the
// documentation gate considers true for a stable value.
const REVIEWED_BASELINE = Object.freeze({
  contestCreationCommissionPercent: 0,
  contestTopUpCommissionPercent: 0,
  storeCommissionPercent: 8,
  withdrawalMinimumGrossAmount: 10,
  withdrawalDefaultCommissionPercent: 10,
  withdrawalProcessing: "manual",
  withdrawalPerUserOverrideSupported: true,
  manualPayoutPrizeFundsLocked: false,
  manualPayoutPlatformWalletInvolved: false,
  ppvDefaultMinimumViews: 1000,
  ppvValidatorMaxCpmRate: 100,
  ppvCpmBandLow: 1,
  ppvCpmBandHigh: 2,
  ppvMaxPerWorkBandLow: 100,
  ppvMaxPerWorkBandHigh: 500,
  ppvMinViewsThresholdBandLow: 1,
  ppvMinViewsThresholdBandHigh: 2000,
  onChainEscrowLive: false,
  automaticBalanceWithdrawalRails: false,
});

// A page that prints a volatile aggregate must say so in its own front matter: the fleet already
// stamps `numbers_used:` with the truth-pack key and `provenance.snapshot_date` with the reading
// date. That declaration is what turns "the typical cap is $98.50" from an undated product claim
// into a dated observation, and it is the only thing the gate can honestly demand — the gate
// cannot know today's median without becoming the very daily-churn machine this replaced.
const VOLATILE_DECLARATION_HINT =
  "declare its truth-pack key in `numbers_used` with a `provenance.snapshot_date`, print the stable band instead, or drop the number";

// The target product, decided by the founder on 2026-09-17, is the second axis of this gate.
// `data/product-truth.json` stays what it always was: what the live backend does today, generated
// and pinned, never edited to make a page pass. `data/product-intent.json` records the claims the
// founder has decided the product will be changed to match. A claim that matches a recorded
// intent is publishable ahead of the backend change; every other claim is still judged against
// the live snapshot, so the file relaxes exactly what it names and nothing else.
//
// Two statuses license a claim. `pending-product-change` means the live value still contradicts
// the page and the backend owes the change. `matches-live` means the target and the live product
// already agree, so the record documents the decision without moving any gate at all - the
// numeric rules below only widen when the recorded target actually differs from the live value.
//
// A record is not a free pass for a whole topic: `validateProductIntent` resolves every
// `liveTruth` path against the reviewed snapshot and fails when a `matches-live` target does not
// equal the live value, or when a `pending-product-change` target does equal it. An intent file
// that lies about the live product cannot silently turn a rule off.
const PRODUCT_INTENT_STATUSES = new Set(["pending-product-change", "matches-live"]);
const INTENT_PHRASE = {
  "pending-product-change": "pending product change",
  "matches-live": "matches live product",
};

export function readProductIntent(path = DEFAULT_INTENT) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

let defaultIntentCache;
function defaultProductIntent() {
  if (defaultIntentCache === undefined) defaultIntentCache = readProductIntent();
  return defaultIntentCache;
}

function truthPathValue(truth, path) {
  let value = truth;
  for (const key of String(path).split(".")) {
    if (value === null || typeof value !== "object" || !(key in value)) return undefined;
    value = value[key];
  }
  return value;
}

function sameValue(first, second) {
  return JSON.stringify(first ?? null) === JSON.stringify(second ?? null);
}

function intentPaths(claim) {
  if (claim.liveTruth == null) return [];
  return Array.isArray(claim.liveTruth) ? claim.liveTruth : [claim.liveTruth];
}

function intentTargets(claim) {
  if (claim.liveTruth == null) return [];
  return Array.isArray(claim.liveTruth) ? (Array.isArray(claim.target) ? claim.target : []) : [claim.target];
}

// The runtime view of the file: one lookup by claim id (for the regex rules, which name an
// `intentId`) and one by product-truth path (for the numeric rules, which compare a printed
// number against the live value and may now also accept the decided target).
export function productIntentIndex(intent) {
  const byId = new Map();
  const byPath = new Map();
  const decidedAt = typeof intent?.decidedAt === "string" ? intent.decidedAt : null;
  if (!intent || !Array.isArray(intent.claims)) return { byId, byPath, decidedAt };
  for (const claim of intent.claims) {
    if (!claim || typeof claim.id !== "string" || !PRODUCT_INTENT_STATUSES.has(claim.status)) continue;
    const record = { id: claim.id, status: claim.status, decidedAt };
    byId.set(claim.id, record);
    const paths = intentPaths(claim);
    const targets = intentTargets(claim);
    if (paths.length !== targets.length) continue;
    paths.forEach((path, index) => byPath.set(path, { ...record, target: targets[index] }));
  }
  return { byId, byPath, decidedAt };
}

const EMPTY_INTENT_INDEX = productIntentIndex(null);

function intentMessage(record) {
  return `claim allowed by product-intent: ${record.id} (${INTENT_PHRASE[record.status]}, decided ${record.decidedAt})`;
}

export function validateProductIntent(intent, truth, { root = null } = {}) {
  const errors = [];
  // An absent file is not an error: the gate then judges every claim against the live snapshot,
  // which is the safe direction. A present but malformed file is an error, because a half-read
  // record must never be the reason a rule stopped firing.
  if (intent == null) return errors;
  if (intent.schemaVersion !== 1) errors.push(`schemaVersion: expected 1, got ${JSON.stringify(intent.schemaVersion)}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(intent.decidedAt || "")) errors.push("decidedAt must be YYYY-MM-DD");
  if (typeof intent.source !== "string" || !intent.source.trim()) {
    errors.push("source must name the founder decision record this file was written from");
  }
  if (!Array.isArray(intent.supersedes) || intent.supersedes.some((item) => typeof item !== "string")) {
    errors.push("supersedes must be a list of strings");
  }
  if (!Array.isArray(intent.claims) || intent.claims.length === 0) {
    errors.push("claims must list at least one decided claim");
    return errors;
  }

  const seen = new Set();
  intent.claims.forEach((claim, index) => {
    const label = typeof claim?.id === "string" && claim.id ? `claims.${claim.id}` : `claims[${index}]`;
    if (!claim || typeof claim !== "object") {
      errors.push(`${label} must be an object`);
      return;
    }
    if (typeof claim.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(claim.id)) {
      errors.push(`${label}.id must be a kebab-case identifier`);
    } else if (seen.has(claim.id)) {
      errors.push(`${label}.id is declared twice`);
    } else {
      seen.add(claim.id);
    }
    for (const locale of ["ru", "en", "uk"]) {
      const text = claim.claim?.[locale];
      if (typeof text !== "string" || !text.trim()) errors.push(`${label}.claim.${locale} must be a non-empty string`);
    }
    if (!PRODUCT_INTENT_STATUSES.has(claim.status)) {
      errors.push(`${label}.status must be one of ${[...PRODUCT_INTENT_STATUSES].join(", ")}, got ${JSON.stringify(claim.status)}`);
    }
    if (claim.target === undefined) errors.push(`${label}.target must state the decided value`);

    const paths = intentPaths(claim);
    if (claim.liveTruth != null && paths.some((path) => typeof path !== "string" || !path.trim())) {
      errors.push(`${label}.liveTruth must be a product-truth path or a list of them`);
    } else if (claim.liveTruth == null) {
      if (typeof claim.liveTruthNote !== "string" || !claim.liveTruthNote.trim()) {
        errors.push(`${label}.liveTruthNote must say where the live behaviour is verified when liveTruth is null`);
      }
      if (claim.status === "pending-product-change") {
        errors.push(`${label} is pending a product change, so liveTruth must name the value that has to move`);
      }
    } else {
      const targets = intentTargets(claim);
      if (paths.length !== targets.length) {
        errors.push(`${label}.target must list one value per liveTruth path (${paths.length})`);
      } else {
        paths.forEach((path, position) => {
          const live = truthPathValue(truth, path);
          if (live === undefined) {
            errors.push(`${label}.liveTruth path ${path} does not exist in the reviewed product truth`);
            return;
          }
          const target = targets[position];
          if (claim.status === "matches-live" && !sameValue(target, live)) {
            errors.push(`${label} claims to match the live product, but ${path} is ${JSON.stringify(live)} and the target is ${JSON.stringify(target)}`);
          }
          if (claim.status === "pending-product-change" && sameValue(target, live)) {
            errors.push(`${label} is pending a product change, but ${path} already equals the target ${JSON.stringify(target)}; use matches-live`);
          }
        });
      }
    }

    if (claim.pages !== undefined) {
      if (!Array.isArray(claim.pages) || claim.pages.some((page) => typeof page !== "string" || !page.trim())) {
        errors.push(`${label}.pages must be a list of repository paths`);
      } else if (root) {
        for (const page of claim.pages) {
          if (!existsSync(join(root, page))) errors.push(`${label}.pages lists a missing page ${page}`);
        }
      }
    }
  });
  return errors;
}

const LANG = {
  en: {
    creation: String.raw`(?:contest[- ]creation|creat(?:e|ing) (?:a )?contest)`,
    topUp: String.raw`(?:contest (?:budget )?top[- ]?up|top(?:ping)? up (?:a |the )?contest(?: budget)?)`,
    store: String.raw`(?:store purchase|purchase in (?:the )?store)`,
    withdrawal: String.raw`(?:withdraw(?:ing|al of)? (?:an? )?(?:available |credited )?balance|balance withdrawal|withdrawal fee)`,
    manual: /\bmanual(?:ly)?\b/i,
  },
  ru: {
    creation: String.raw`(?:создани(?:е|я) конкурса)`,
    topUp: String.raw`(?:пополнени(?:е|я) (?:его )?(?:бюджета конкурса|конкурсного бюджета))`,
    store: String.raw`(?:покупк[аи] в магазине|магазинн(?:ая|ой) покупк[аи])`,
    withdrawal: String.raw`(?:вывод(?:а)? (?:доступного |начисленного )?баланса|комисси[яи] за вывод)`,
    manual: /в?ручн(?:ая|ой|ую|ые|ых|о)/i,
  },
  ua: {
    creation: String.raw`(?:створенн(?:я|і) конкурсу)`,
    topUp: String.raw`(?:поповненн(?:я|і) (?:його )?(?:бюджету конкурсу|конкурсного бюджету))`,
    store: String.raw`(?:покупк[аи] в магазині|магазинн(?:а|ої) покупк[аи])`,
    withdrawal: String.raw`(?:виведенн(?:я|і) (?:доступного |зарахованого )?балансу|комісі[яї] за виведення)`,
    manual: /в?ручн(?:а|ої|у|і|их|о)/i,
  },
};

// `\b` is an ASCII word boundary: it takes every Cyrillic letter for a non-word character, so
// `\bвывод` can only match where the word is glued to a Latin letter or a digit and never at the
// start of a Russian or Ukrainian word. Until 2026-09-17 that made every Russian and Ukrainian
// pattern written with `\b` a dead letter. A pattern that contains Cyrillic therefore spells its
// boundary as `(?<![\p{L}\p{N}])` / `(?![\p{L}\p{N}])` under the `u` flag (without `u`, `\p{L}`
// is the literal text "p{L}"), and the test suite scans this file so that neither an ASCII `\b`
// beside Cyrillic nor a `\p{..}` without `u` can come back.
//
// The Russian and Ukrainian stems differ in one letter (комисс- / коміс-), so they are spelled
// separately: a shared stem matched neither language's "no fee".
const NO_FEE = /(?<![\p{L}\p{N}])(?:no (?:fee|commission)|without (?:a )?(?:fee|commission))(?![\p{L}\p{N}])|без (?:комисси[ий]|комісії)|коміс(?:ія|ії) не (?:стягується|взимається)|комисс(?:ия|ии) не (?:взимается|бер[её]тся)/iu;

// `intentId` names the record in `data/product-intent.json` that licenses the claim this rule
// cuts. The rule keeps firing until that record exists with a licensing status, so wiring one is
// free: it is what makes a founder decision a one-record data edit instead of a code change.
const CLAIM_RULES = [
  {
    id: "free-withdrawal",
    // Licensed by the 2026-09-17 decision: the wallet withdrawal fee goes to 0%.
    intentId: "withdrawal-free",
    patterns: [
      /\bwithdraw(?:al|ing)?s? (?:is|are|remains?|stays?) (?:completely )?free\b/i,
      /\bno (?:platform )?(?:withdrawal|payout) fee\b/i,
      /\bwithdraw(?:al|ing)?s?[^.\n]{0,30}without (?:a )?fee\b/i,
      // Unicode boundaries, not `\b`: see the note above NO_FEE.
      /(?<![\p{L}\p{N}])вывод(?: средств| денег| баланса)? (?:полностью )?бесплат(?:ен|ный|но)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])вывод[^.\n]{0,30}без комиссии(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])комисси(?:и|я) за вывод (?:нет|не взимается)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])виведення(?: коштів| грошей| балансу)? (?:повністю )?безкоштовн(?:е|ий|о)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])виведення[^.\n]{0,30}без комісії(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])комісі(?:ї|я) за виведення (?:немає|не стягується)(?![\p{L}\p{N}])/iu,
      // Arabic (locale ar, 2026-09-20). Unicode boundaries, no ; each pattern carries its own negation and
      // question guards because Arabic negators sit before the noun. Cases: product-truth-lint.ar-cases.json.
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<!(?:لا|لم|لن|ليس|ليست|غير)\s)(?<!(?:لا|لم|لن|ليس|ليست|غير)\s(?:[\p{L}\p{M}]{1,14}\s){1,2})(?<![\p{L}\p{N}])(?:[وف]?(?:لل|بال|كال|ال|[بكل])?)(?:سحب|صرف|تحويل)(?:\s+(?:ال)?(?:رصيد|[أا]رباح|مال|[أا]موال)(?:ك|كم)?)?(?:(?!\s*(?:ليس|ليست|غير|لا|لم|لن)(?![\p{L}\p{N}]))[^.،؛\n]){0,14}\s[وف]?(?:(?:هو|هي|يكون|تكون)\s+)?(?:ال)?مج[\u064B-\u0652]?ان(?:ي(?:ة|[\u064B-\u0652]?ا[\u064B-\u0652]?)?|[\u064B-\u0652]?ا[\u064B-\u0652]?)(?![\p{L}\p{N}])(?!\s+(?:غير|ليس))/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<!(?:لا|لم|لن|ليس|ليست|غير)\s)(?<!(?:لا|لم|لن|ليس|ليست|غير)\s(?:[\p{L}\p{M}]{1,14}\s){1,2})(?<![\p{L}\p{N}])(?:[وف]?(?:لل|بال|كال|ال|[بكل])?)(?:سحب|صرف|تحويل)(?:[^.،؛\n]{0,14}\s)?(?:بدون|بلا|بغير|من\s+دون|من\s+غير|دون)\s+(?:[أا]ي(?:ة)?\s+)?(?:عمول(?:ة|ات)|رسوم|رسم|خصم|اقتطاع|مصاريف|مصروفات|تكلف(?:ة|ات)|تكاليف|مقابل)(?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])[وف]?(?:لا\s+(?:(?:هناك|ثمة)\s+)?|ليس(?:ت)?\s+(?:هناك|ثمة)\s+|ما\s+في(?:ه)?\s+|بلا\s+|بدون\s+|دون\s+)(?:(?![أا]ي(?:ة)?\s|عمول|رسم|رسوم|خصم|اقتطاع)[\p{L}\p{M}]{2,12}\s+){0,2}(?:[أا]ي(?:ة)?\s+)?(?:عمول(?:ة|ات)|رسوم|رسم|خصم|اقتطاع|مصاريف|مصروفات)(?:[\u064B-\u0652]|[\u064B-\u0652]?ا[\u064B-\u0652]?)?\s*(?:على|عند|في|مقابل)?\s*(?:[وف]?(?:لل|بال|كال|ال|[بكل])?)(?:سحب|صرف)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])عمول(?:ة|ات)\s+(?:ال)?(?:سحب|صرف)(?:\s+(?:ال)?(?:رصيد|[أا]رباح)(?:ك|كم)?)?[^.\n\p{L}]{0,6}(?:(?<![\p{N}])(?:0|٠)\s*[%٪]|صفر|معفاة|ملغاة)(?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])[وف]?[اتين]سحب[^.،؛\n]{0,16}\s[وف]?(?:(?:ال)?مج[\u064B-\u0652]?ان(?:ي(?:ة|[\u064B-\u0652]?ا[\u064B-\u0652]?)?|[\u064B-\u0652]?ا[\u064B-\u0652]?)|بالمجان|(?:بلا|بدون|دون)\s+(?:[أا]ي\s+)?(?:عمول(?:ة|ات)|رسوم|تكاليف))(?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])(?:(?<![\p{N}])(?:0|٠)\s*[%٪]\s+(?:عمول(?:ة|ات)|رسوم)|عمول(?:ة|ات)\s+(?<![\p{N}])(?:0|٠)\s*[%٪])\s*(?:على|عند|في|مقابل)\s*(?:[وف]?(?:لل|بال|كال|ال|[بكل])?)(?:سحب|صرف)(?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])(?:[وف]?(?:لل|بال|كال|ال|[بكل])?)(?:سحب|صرف)(?:\s+(?:ال)?(?:رصيد|[أا]رباح)(?:ك|كم)?)?\s+لا\s+[يت][\u064B-\u0652]*كلف[\u064B-\u0652]*(?:ك|كم|نا)?\s+(?:[أا]ي\s+)?(?:شيئ|مليم|قرش|عمول(?:ة|ات)|رسوم|رسم|خصم|اقتطاع|مصاريف|مصروفات)/iu,
    ],
  },
  {
    id: "no-withdrawal-minimum",
    // Deliberately NOT wired to the `withdrawal-minimum` record. That record keeps the floor at
    // 10 USDT (`matches-live`, founder-to-confirm), so "withdraw any amount" contradicts the
    // target product as much as the live one and must keep failing. The day the founder drops
    // the minimum, the licence is one `withdrawal-no-minimum` record in product-intent.json.
    intentId: "withdrawal-no-minimum",
    patterns: [
      /\b(?:no|without a) minimum (?:withdrawal|payout)\b/i,
      /\bwithdraw[^.\n]{0,35}(?:any amount|from any amount)\b/i,
      // Unicode boundaries again, and these two must keep matching - the target product keeps
      // the 10 USDT floor.
      /(?<![\p{L}\p{N}])вывод[^.\n]{0,35}(?:без минимума|любую сумму|с любой суммы)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])виведення[^.\n]{0,35}(?:без мінімуму|будь-яку суму|з будь-якої суми)(?![\p{L}\p{N}])/iu,
      // Arabic (locale ar, 2026-09-20). Unicode boundaries, no ; each pattern carries its own negation and
      // question guards because Arabic negators sit before the noun. Cases: product-truth-lint.ar-cases.json.
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])[وف]?(?:لا\s+(?:(?!حد|[أا]ي\s)[\p{L}\p{M}]{2,12}\s+){0,2}|ليس(?:ت)?\s+(?:هناك|ثمة)\s+|ما\s+في(?:ه)?\s+|بلا\s+|بدون\s+|دون\s+|من\s+دون\s+)(?:[أا]ي\s+)?حد\u0651?(?:[\u064B-\u0652]?ا[\u064B-\u0652]?)?\s+[أا]دن[ىي]\s+(?:للسحب|لسحب|للصرف|لصرف|لطلب\s+السحب|لعملية\s+السحب|للتحويل|لتحويل|على\s+السحب|عند\s+السحب)(?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])(?:[وف]?(?:لل|بال|كال|ال|[بكل])?)[اتين]?سحب[^.،؛\n]{0,14}(?:[أا]ي|كامل)\s+(?:مبلغ|رصيد|قيمة|كمية)(?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])(?:[وف]?(?:لل|بال|كال|ال|[بكل])?)[اتين]?(?:سحب|صرف)[^.،؛\n]{0,20}من\s+(?:(?:[أا]ول|[أا]ي)\s+(?:دولار|سنت|قرش|مبلغ|USDT)|دولار\s+واحد)(?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<!(?:لا|لم|لن|ليس|ليست|غير)\s)(?<!(?:لا|لم|لن|ليس|ليست|غير)\s(?:[\p{L}\p{M}]{1,14}\s){1,2})(?<![\p{L}\p{N}])(?:[وف]?(?:لل|بال|كال|ال|[بكل])?)(?:سحب|صرف)(?:\s+(?:ال)?(?:رصيد|[أا]رباح|مال)(?:ك|كم)?)?\s+(?:بلا|بدون|من\s+دون|دون|لا\s+(?:يوجد|توجد|ي[\u064B-\u0652]*وجد|ت[\u064B-\u0652]*وجد))\s+(?:[أا]ي\s+)?حد\u0651?\s+[أا]دن[ىي](?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])[وف]?الحد\u0651?\s+ال[أا]دن[ىي]\s+(?:للسحب|لسحب|لطلب\s+السحب|للصرف)(?:\s+(?:ال)?(?:رصيد|[أا]رباح)(?:ك|كم)?)?[^.\n]{0,8}(?:(?<![\p{N}])(?:0|٠)(?![\p{N},.٫])|صفر|لا\s+شيء|غير\s+موجود|لا\s+يوجد)(?![\p{L}\p{N}])/iu,
    ],
  },
  {
    id: "automatic-payout",
    allowNegated: true,
    patterns: [
      /\b(?:payout|withdrawal|transfer|settlement)s? (?:is|are|runs?|happens?) automatic(?:ally)?\b/i,
      /\bautomatically (?:pay(?:s|ed)?|transfer(?:s|red)?|send(?:s|sent)?|withdraw(?:s|n)?|settles?)\b/i,
      /\b(?:paid|transferred|sent|withdrawn|settled) automatically\b/i,
      /(?<![\p{L}\p{N}])(?:выплат[аы]|вывод|перевод|зачисление) (?:происходит |ид[её]т )?автоматическ(?:и|ий|ая)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])автоматическ(?:и|ая|ий) (?:выплачивает|переводит|выводит|зачисляет|выплата|перевод)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])(?:виплат[аи]|виведення|переказ|зарахування) (?:відбувається |йде )?автоматичн(?:о|ий|а)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])автоматичн(?:о|а|ий) (?:виплачує|переказує|виводить|зараховує|виплата|переказ)(?![\p{L}\p{N}])/iu,
      /\b(?:instant|immediate) payouts?\b/i,
      /\b(?:winner|creator)s? (?:is|are|get|gets|will be) paid (?:instantly|immediately|straight away)\b/i,
      /\b(?:money|funds|the prize) (?:goes|is sent|is transferred) (?:straight|directly) to (?:the )?(?:winner|creator)s?\b/i,
      /(?:победител|автор|участник)[а-яё]*[^.\n]{0,40}(?:сразу|мгновенно) (?:получает|получит|выплачивается|отправляют|переводят)/i,
      /(?:после окончания|когда заканчивается|при завершении) конкурса[^.\n]{0,80}(?:сразу |мгновенно )?(?:отправляют|переводят|выплачивают) (?:деньги|приз|выплату)/i,
      /(?:переможц|автор|учасник)[а-яіїєґ]*[^.\n]{0,40}(?:одразу|миттєво) (?:отримує|отримає|виплачується|надсилають|переказують)/i,
      /(?:після завершення|коли завершується|під час завершення) конкурсу[^.\n]{0,80}(?:одразу |миттєво )?(?:надсилають|переказують|виплачують) (?:гроші|приз|виплату)/i,
      // Arabic (locale ar, 2026-09-20). Unicode boundaries, no ; each pattern carries its own negation and
      // question guards because Arabic negators sit before the noun. Cases: product-truth-lint.ar-cases.json.
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])(?:[وف]?(?:لل|بال|كال|ال|[بكل])?)(?:عملية\s+السحب|سحب|صرف|تحويل|دفع(?:ة|ات)?|مدفوعات)(?:\s+(?:ال)?(?:رصيد|[أا]رباح|مال|[أا]موال|جائزة|مكافأة)(?:ك|كم|ه|ها)?)?\s+(?:(?:يتم|تتم|ي[\u064B-\u0652]*جري|ت[\u064B-\u0652]*جري|يكون|تكون|هو|هي)\s+)?(?:(?:بشكل|بصورة|بطريقة)\s+)?(?:ال)?(?:تلقائ[يى]|[أا]و?توماتيك[يى]?|آل[يى])(?:[\u064B-\u0652]?ا[\u064B-\u0652]?|ة)?(?![\p{L}\p{N}])(?!\s+(?:غير|ليس))/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])(?:يتم|تتم|ي[\u064B-\u0652]*جري|ت[\u064B-\u0652]*جري|ي[\u064B-\u0652]*نفذ|ت[\u064B-\u0652]*نفذ)\s+(?:عملية\s+)?(?:[وف]?(?:لل|بال|كال|ال|[بكل])?)(?:سحب|صرف|تحويل|دفع(?:ة|ات)?|[إا]رسال)[^.،؛\n]{0,22}(?:تلقائ[يى]|[أا]و?توماتيك[يى]?|آل[يى])(?:[\u064B-\u0652]?ا[\u064B-\u0652]?|ة)?(?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])[وف]?[تي][\u064B-\u0652]*(?:ن[\u064B-\u0652]*)?(?:دفع|رسل|صرف|سحب|ح[\u064B-\u0652]*و[\u064B-\u0652]*ل)(?=[^.،؛\n]{0,30}(?:[أا]رباح|رصيد|مال|[أا]موال|مبلغ|جائز|مكاف[أا]|دفع[ةت]|مستحق|USDT|نجوم))(?![^.،؛\n]{0,26}(?:ميزانية|المتبقي|غير\s+المصروف|غير\s+المستخدم))[^.،؛\n]{0,26}(?:تلقائ[يى]|[أا]و?توماتيك[يى]?|آل[يى])(?:[\u064B-\u0652]?ا[\u064B-\u0652]?|ة)?(?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<!(?:شبكة|شبكات|نظام|[أا]نظمة|خدمة|خدمات)\s)(?<![\p{L}\p{N}])(?:[وف]?(?:لل|ال)?)(?:سحب|صرف|دفع(?:ة|ات)?|مدفوعات|تحويلات)(?:\s+(?:ال)?(?:رصيد|[أا]رباح)(?:ك|كم)?)?\s+(?:(?:ال)?فور(?:ي(?:ة)?|[\u064B-\u0652]?ا[\u064B-\u0652]?)|لحظي(?:ة)?)(?![\p{L}\p{N}])(?!\s+(?:غير|ليس))/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])(?:تصلك|يصلك|تصل|يصل|ت[\u064B-\u0652]*ستلم|ت[\u064B-\u0652]*حصل|ي[\u064B-\u0652]*حصل|[وف]?(?:اسحب|استلم|احصل|اقبض))[^.،؛\n]{0,26}(?:ال)?(?:[أا]رباح|مال|[أا]موال|مبلغ|جائز[ةت]|مكاف[أا][ةت]|دفع[ةت]|رصيد)(?:ك|كم|ه|ها|هم)?[^.،؛\n]{0,16}(?:فور(?:[\u064B-\u0652]?ا[\u064B-\u0652]?|ي(?:ة)?)|في\s+الحال|لحظي(?:[\u064B-\u0652]?ا[\u064B-\u0652]?)?|مباشرة\s+بعد)(?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])[وف]?[تي][\u064B-\u0652]*(?:ن[\u064B-\u0652]*)?(?:دفع|رسل|صرف|سحب|ح[\u064B-\u0652]*و[\u064B-\u0652]*ل)(?=[^.،؛\n]{0,30}(?:[أا]رباح|رصيد|مال|[أا]موال|مبلغ|جائز|مكاف[أا]|دفع[ةت]|مستحق|USDT|نجوم))(?![^.،؛\n]{0,26}(?:ميزانية|المتبقي|غير\s+المصروف|غير\s+المستخدم))[^.،؛\n]{0,26}(?:فور(?:[\u064B-\u0652]?ا[\u064B-\u0652]?|ي(?:ة)?)|في\s+الحال|لحظي(?:[\u064B-\u0652]?ا[\u064B-\u0652]?)?)(?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])[وف]?[تي][\u064B-\u0652]*(?:دفع|رسل|صرف|سحب|ح[\u064B-\u0652]*و[\u064B-\u0652]*ل)[^.،؛\n]{0,26}فور\s+(?:ال)?(?:[إا]نتهاء|انتهاء|[إا]غلاق|انقضاء|نهاية|صدور|اعتماد|قبول|تأكيد|طلب)(?![\p{L}\p{N}])/iu,
      /(?<!هل\s)(?<!هل\s(?:[\p{L}\p{M}]{1,16}\s){1,3})(?<![\p{L}\p{N}])(?:[وف]?(?:لل|بال|كال|ال|[بكل])?)(?:عملية\s+السحب|سحب|صرف|دفع(?:ة|ات)?|مدفوعات)(?:\s+(?:ال)?(?:رصيد|[أا]رباح|مال|[أا]موال)(?:ك|كم)?)?[^.،؛\n]{0,26}(?:بدون|بلا|من\s+دون|دون)\s+(?:[أا]ي\s+)?(?:تدخل|مراجعة|موافقة|تحقق)(?:\s+(?:بشري|يدوي|بشرية|يدوية|من\s+[أا]حد))?(?![\p{L}\p{N}])/iu,
    ],
  },
  {
    id: "instant-payout-sla",
    allowNegated: true,
    patterns: [
      /\b(?:payout|withdrawal|transfer|settlement)[^.\n]{0,45}(?:arrives?|lands?|completes?|takes?|is processed)[^.\n]{0,20}(?:in|within) (?:a few |several )?minutes\b/i,
      /\b(?:money|funds)[^.\n]{0,30}(?:arrives?|lands?)[^.\n]{0,20}(?:in|within) (?:a few |several )?minutes\b/i,
      /\b(?:instant|immediate) (?:payout|withdrawal|settlement|transfer)s?\b/i,
      /(?<![\p{L}\p{N}])(?:выплата|вывод|перевод|зачисление)[^.\n]{0,45}(?:приходит|занимает|проходит|обрабатывается)[^.\n]{0,20}(?:за|в течение) (?:нескольких |пары )?минут(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])(?:виплата|виведення|переказ|зарахування)[^.\n]{0,45}(?:приходить|займає|відбувається|обробляється)[^.\n]{0,20}(?:за|протягом) (?:кількох |пари )?хвилин(?![\p{L}\p{N}])/iu,
    ],
  },
  {
    id: "all-payout-methods",
    patterns: [
      /\ball (?:five|six|of these) (?:payout |withdrawal |reward )?(?:methods|options|ways) (?:work|are available|are supported)\b/i,
      /\b(?:card|bank|wallet|Stars|reward)[^.\n]{0,100}(?:all of these work|every one of them works)\b/i,
      /\bevery creator[^.\n]{0,50}(?:is paid|receives payment)[^.\n]{0,40}(?:way|method) (?:that )?(?:suits them|they choose|they prefer)\b/i,
      /(?<![\p{L}\p{N}])все (?:пять|шесть|эти) (?:способа|способов|варианта|вариантов) (?:выплаты )?(?:работают|доступны|поддерживаются)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])работают все (?:способы|варианты)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])каждый автор[^.\n]{0,60}(?:получает выплату|получает деньги)[^.\n]{0,40}(?:который выбрал|по своему выбору|как ему удобно)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])усі (?:п.?ять|шість|ці) (?:способи|варіанти) (?:виплати )?(?:працюють|доступні|підтримуються)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])працюють усі (?:способи|варіанти)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])кожен автор[^.\n]{0,60}(?:отримує виплату|отримує гроші)[^.\n]{0,40}(?:який обрав|за своїм вибором|як йому зручно)(?![\p{L}\p{N}])/iu,
    ],
  },
  {
    id: "legacy-contest-commission-refund",
    patterns: [
      /\b(?:part|share) of the commission[^.\n]{0,80}(?:returns?|is returned)[^.\n]{0,80}(?:feed placement|promotion)[^.\n]{0,40}(?:does not|is not)\b/i,
      /(?<![\p{L}\p{N}])част[ьи] комисси[^.\n]{0,80}возвращается[^.\n]{0,80}(?:лента|промо)[^.\n]{0,40}не возвращается(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])частина комісі[^.\n]{0,80}повертається[^.\n]{0,80}(?:стрічц|промо)[^.\n]{0,40}не повертається(?![\p{L}\p{N}])/iu,
    ],
  },
  {
    id: "organizer-pays-creator-fee",
    patterns: [
      /\b(?:commission|fee) (?:is )?paid by the (?:buyer|organizer),? not the (?:creator|clipper)\b/i,
      /(?<![\p{L}\p{N}])комисси[юя] платит (?:заказчик|организатор),? не (?:автор|участник|нарезчик)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])комісі[юя] платить (?:замовник|організатор),? а? ?не (?:автор|учасник|нарізальник)(?![\p{L}\p{N}])/iu,
    ],
  },
  {
    id: "contest-close-auto-transfer",
    allowNegated: true,
    patterns: [
      /\b(?:at contest close|at the end of the contest|when the contest ends?)[^.\n]{0,80}(?:money|payout|prize)[^.\n]{0,35}(?:goes out|goes to|is sent|is transferred) (?:to )?(?:the )?winners?\b/i,
      /(?<![\p{L}\p{N}])(?:в конце конкурса|при завершении конкурса|когда конкурс завершается)[^.\n]{0,80}(?:деньги|выплата|приз)[^.\n]{0,35}(?:уходит|переводится|отправляется) победител/iu,
      /(?<![\p{L}\p{N}])(?:наприкінці конкурсу|під час завершення конкурсу|коли конкурс завершується)[^.\n]{0,80}(?:гроші|виплата|приз)[^.\n]{0,35}(?:йде|переказується|надсилається) переможц/iu,
    ],
  },
  {
    id: "live-on-chain-escrow",
    allowNegated: true,
    patterns: [
      /\b(?:funds|money|prize|budget) (?:is|are) (?:held|locked|released) (?:in|by|through) (?:an? )?(?:on[- ]chain )?(?:escrow|smart contract)\b/i,
      /\b(?:smart contract|on[- ]chain escrow) (?:holds|locks|releases|pays)\b/i,
      /\b(?:prize|funds|money|budget) (?:is|are) (?:secured|protected|guaranteed|safeguarded) by (?:a )?(?:blockchain |on[- ]chain )?(?:smart |escrow )?contract\b/i,
      /\b(?:blockchain|smart|escrow) contract (?:secures|protects|guarantees|safeguards) (?:the )?(?:prize|funds|money|budget)\b/i,
      /(?<![\p{L}\p{N}])(?:деньги|средства|приз|бюджет) (?:хранится|хранятся|заблокирован|удерживается|выплачивается) (?:в|через|смарт-контрактом) (?:он[- ]чейн )?(?:эскроу|смарт-контракт)(?![\p{L}\p{N}])/iu,
      /(?<![\p{L}\p{N}])(?:деньги|кошти|приз|бюджет) (?:зберігається|зберігаються|заблокований|утримується|виплачується) (?:в|через|смарт-контрактом) (?:он[- ]чейн )?(?:ескроу|смарт-контракт)(?![\p{L}\p{N}])/iu,
    ],
  },
  {
    id: "unqualified-prize-lock",
    allowWalletQualified: true,
    patterns: [
      /\b(?:prize|funds|money|budget) (?:is|are|gets?|was|were) (?:fully )?(?:locked|frozen|held) (?:on|by|with|in) (?:the )?(?:platform|DareBay|wallet)\b/i,
      /\b(?:prize|funds|money|budget) (?:is|are|gets?|was|were|stays?|remains?) (?:already |fully )?(?:locked|frozen|held)(?:\b| up front| before)/i,
      /\b(?:platform|DareBay) (?:locks|freezes|holds) (?:the )?(?:prize|funds|money|budget)\b/i,
      /\b(?:buyer|organizer) (?:locks|freezes) (?:the )?(?:prize|funds|money|budget)\b/i,
      /\bthe organizer (?:has )?already paid\b/i,
      /\bthe organizer (?:takes|has) no part in (?:the )?payout\b/i,
      /(?:приз|деньги|средства|бюджет) (?:заблокирован[аы]?|заморожен[аы]?|блокируется|замораживается|удерживается) (?:на|в) (?:платформе|DareBay|кошельке)/i,
      /(?:приз|деньги|средства|бюджет) (?:уже )?(?:заблокирован\w*|заморожен\w*|блокируется|замораживается|удерживается)/i,
      /(?:платформа|DareBay) (?:блокирует|замораживает|держит) (?:приз|деньги|средства|бюджет)/i,
      /(?:заказчик|организатор) (?:блокирует|замораживает) (?:приз|деньги|средства|бюджет)/i,
      /организатор уже заплатил/i,
      /организатор (?:в выплате не участвует|не участвует в выплате)/i,
      /(?:приз|гроші|кошти|бюджет) (?:заблокован[аі]?|заморожен[аі]?|блокується|заморожується|утримується) (?:на|у|в) (?:платформі|DareBay|гаманці)/i,
      /(?:приз|гроші|кошти|бюджет) (?:вже )?(?:заблокован\w*|заморожен\w*|блокується|заморожується|утримується)/i,
      /(?:платформа|DareBay) (?:блокує|заморожує|тримає) (?:приз|гроші|кошти|бюджет)/i,
      /(?:замовник|організатор) (?:блокує|заморожує) (?:приз|гроші|кошти|бюджет)/i,
      /організатор уже заплатив/i,
      /організатор (?:у виплаті не бере участі|не бере участі у виплаті)/i,
    ],
  },
  {
    id: "official-api-view-oracle",
    allowNegated: true,
    patterns: [
      /(?:views?|view counts?)[^.\n]{0,90}(?:through|from|via|straight through) (?:the )?(?:TikTok|platform|source-platform) APIs?/i,
      /(?:просмотр\w*)[^.\n]{0,90}(?:через|из|напрямую из) API (?:TikTok|площад\w*)/i,
      /(?:перегляд\w*)[^.\n]{0,90}(?:через|з|напряму з) API (?:TikTok|майданчик\w*)/i,
    ],
  },
  {
    id: "stale-selection-model",
    patterns: [
      /one of three selection types/i,
      /один из тр[её]х типов отбора/i,
      /один із трьох типів відбору/i,
      /(?:RANDOM|random contests?)[^.\n]{0,90}(?:most[- ]liked|top[^.\n]{0,20}likes)/i,
      /(?:RANDOM|конкурс\w* типа RANDOM)[^.\n]{0,90}(?:топ[^.\n]{0,20}лайк|самых залайкан)/i,
      /(?:RANDOM|конкурс\w* типу RANDOM)[^.\n]{0,90}(?:топ[^.\n]{0,20}лайк|найбільш залайкан)/i,
    ],
  },
  {
    id: "legacy-method-rate",
    patterns: [
      /\b(?:fiat|bank card|card payment)[^.\n]{0,45}5\s*%/i,
      /\b(?:crypto|wallet|USDT)[^.\n]{0,45}8\s*%/i,
      /(?<![\p{L}\p{N}])(?:фиат|банковская карта|оплата картой)[^.\n]{0,45}5\s*%/iu,
      /(?<![\p{L}\p{N}])(?:крипта|криптовалюта|кошел[её]к|USDT)[^.\n]{0,45}8\s*%/iu,
      /(?<![\p{L}\p{N}])(?:фіат|банківська картка|оплата карткою)[^.\n]{0,45}5\s*%/iu,
      /(?<![\p{L}\p{N}])(?:крипта|криптовалюта|гаманець|USDT)[^.\n]{0,45}8\s*%/iu,
    ],
  },
];

// The founder is named by first name only on every public page: Ruslan, Руслан (founder,
// 2026-09-25). This repository is public, so the rule keeps no plain-text copy of the surname: it
// hashes the word written right after the first name and compares digests, one per spelling and
// case form. The whole text is searched rather than line by line, because a Markdown wrap can
// split the name, and FAQ questions are searched too; emphasis marks between the two words do not
// hide the surname.
const FOUNDER_FIRST_NAME_THEN_WORD =
  /(?<![\p{L}\p{N}])(?:Ruslan|Руслан\p{Ll}{0,3})[*_]*(?:[^\S\n]+|[^\S\n]*\n[^\S\n]*)[*_]*(\p{L}+)/giu;
const FOUNDER_SURNAME_SHA256 = new Set([
  "98970d1a1b801acf6d91f9edbd010914a577dfd71a00527d08f765eae0436304",
  "16125286d427ff5bc259e9a610f655ed842751d305a248ed17d6bbdde188b32d",
  "83252e838016af8a4fb1b0b235814de292fcbdcfecc3d99c5887b001507c0cac",
  "6fb39f7d6e1772a2e129b879ef2e84543ec02e0aff38bbe01e1c497eacd62302",
  "47070c841000b57db6b01b7cda08ee0723ba4c5ab0b81ec6abc22441712f0289",
  "6a68950e51e7f635889dd920b7e1883b50a27d20196b51f4df729d9b5103065c",
  "83b0c6c5691fb82ddb647f44661485b24afd97468e5cdddf047f247b125ed36b",
  "9746861acfcafe8d3ad2ed47ec5c8d477e55c511621e19048dede4850747b032",
  "19291a28f22c62f606b298828e566753f20ce118cb770fd59079a53aa11a1bbf",
  "95d0d20a795c2a78bef996ed0ff955fb5f112acc6b63a1305a77ba98e9727f50",
]);

function founderSurnameClaims(text, file, out) {
  for (const match of text.matchAll(FOUNDER_FIRST_NAME_THEN_WORD)) {
    const digest = createHash("sha256").update(match[1].toLowerCase()).digest("hex");
    if (!FOUNDER_SURNAME_SHA256.has(digest)) continue;
    addViolation(out, "founder-surname", file, text.slice(0, match.index).split("\n").length,
      "names the founder by surname; public pages use the first name only");
  }
}

function markdownFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...markdownFiles(path));
    else if (entry.endsWith(".md")) files.push(path);
  }
  return files;
}

function publicClaimFiles(root) {
  const files = markdownFiles(join(root, "docs"));
  const llms = join(root, "docs/public/llms.txt");
  if (existsSync(llms)) files.push(llms);
  return files;
}

export function stripFencedCode(text) {
  let fenced = false;
  return text.split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return "";
    }
    return fenced ? "" : line;
  }).join("\n");
}

function isQuestion(line) {
  return /^\s{0,3}#{1,6}\s+.*\?\s*$/.test(line) || /^\s*[^|]+\?\s*$/.test(line);
}

function isNegated(line, index, previousLine = "") {
  const currentPrefix = line.slice(0, index);
  const clause = currentPrefix.slice(Math.max(
    currentPrefix.lastIndexOf("."), currentPrefix.lastIndexOf("!"),
    currentPrefix.lastIndexOf("?"), currentPrefix.lastIndexOf(";")) + 1).toLowerCase();
  const negation = /(?:(?<![\p{L}\p{N}])(?:not|never|cannot|can't|does not|doesn't|isn't|aren't|without|no promise (?:of|that)|no guarantee (?:of|that))(?![\p{L}\p{N}])|(?:^|\s)(?:не|нет|без|немає|не обіцяє|не гарантується|не гарантируется)(?:\s|$))/u;
  if (negation.test(clause) || /\bno (?:fixed )?(?:or )?$/i.test(clause)) return true;

  // Preserve a genuine line-wrapped clause, but do not let an unrelated sentence on
  // the previous line suppress a claim on this one.
  if (!currentPrefix.trim() && /(?:(?<![\p{L}\p{N}])(?:can|cannot|can't|is|are|be|being|будет|буде|может|може)\s*)$/iu.test(previousLine)) {
    return negation.test(previousLine.toLowerCase());
  }
  return false;
}

function isWalletQualified(line, previousLine = "") {
  const context = `${previousLine} ${line}`.toLowerCase();
  return /(?<![\p{L}\p{N}])wallet[- ]backed(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])funded (?:wallet )?(?:flow|contest|mode)(?![\p{L}\p{N}])|кошельков|кошелёчн|гаманцев|(?<![\p{L}\p{N}])(?:only|только|лишь|лише) (?:for |для )?(?:wallet|кошел|гаман)/u.test(context);
}

function addViolation(out, rule, file, line, message) {
  out.push({ rule, file, line, message });
}

// A numeric rule is widened only by a record whose decided target actually differs from the live
// value; a `matches-live` record changes nothing, and a target of 3% still rejects "3%" for any
// other field. Returns the licensing record or null.
function intentForPath(intent, path, expected) {
  const record = intent.byPath.get(path);
  if (!record || typeof record.target !== "number" || record.target === expected) return null;
  return record;
}

function numericPercentClaims(line, file, lineNumber, truth, intent, out, allow) {
  const facts = [
    ["contest-creation-fee", LANG.en.creation, truth.contest.creationCommissionPercent, "contest.creationCommissionPercent"],
    ["contest-creation-fee", LANG.ru.creation, truth.contest.creationCommissionPercent, "contest.creationCommissionPercent"],
    ["contest-creation-fee", LANG.ua.creation, truth.contest.creationCommissionPercent, "contest.creationCommissionPercent"],
    ["contest-topup-fee", LANG.en.topUp, truth.contest.topUpCommissionPercent, "contest.topUpCommissionPercent"],
    ["contest-topup-fee", LANG.ru.topUp, truth.contest.topUpCommissionPercent, "contest.topUpCommissionPercent"],
    ["contest-topup-fee", LANG.ua.topUp, truth.contest.topUpCommissionPercent, "contest.topUpCommissionPercent"],
    ["store-fee", LANG.en.store, truth.store.commissionPercent, "store.commissionPercent"],
    ["store-fee", LANG.ru.store, truth.store.commissionPercent, "store.commissionPercent"],
    ["store-fee", LANG.ua.store, truth.store.commissionPercent, "store.commissionPercent"],
    ["withdrawal-fee", LANG.en.withdrawal, truth.withdrawal.defaultCommissionPercent, "withdrawal.defaultCommissionPercent"],
    ["withdrawal-fee", LANG.ru.withdrawal, truth.withdrawal.defaultCommissionPercent, "withdrawal.defaultCommissionPercent"],
    ["withdrawal-fee", LANG.ua.withdrawal, truth.withdrawal.defaultCommissionPercent, "withdrawal.defaultCommissionPercent"],
  ];

  for (const [rule, subject, expected, path] of facts) {
    const intended = intentForPath(intent, path, expected);
    const regex = new RegExp(`${subject}[^.%\\n]{0,100}?(\\d+(?:[.,]\\d+)?)\\s*%`, "ig");
    for (const match of line.matchAll(regex)) {
      if (NO_FEE.test(match[0])) {
        if (expected === 0) continue;
        if (intended?.target === 0) {
          allow(intended, rule, file, lineNumber, match[0].trim());
          continue;
        }
      }
      const beforeSubject = line.slice(Math.max(0, match.index - 80), match.index);
      const expectedBefore = new RegExp(`${expected}\\s*%[^.%\\n]{0,75}$`, "i");
      if (expectedBefore.test(beforeSubject)) continue;
      const actual = Number(match[1].replace(",", "."));
      if (actual === expected) continue;
      if (intended && actual === intended.target) {
        allow(intended, rule, file, lineNumber, match[0].trim());
        continue;
      }
      addViolation(out, rule, file, lineNumber,
        `claims ${actual}% but reviewed product truth is ${expected}%`);
    }
  }
}

function numericMinimumClaims(line, file, lineNumber, truth, intent, out, allow) {
  const expected = truth.withdrawal.minimumGrossAmount;
  const intended = intentForPath(intent, "withdrawal.minimumGrossAmount", expected);
  const minimumSubjects = String.raw`(?:minimum (?:withdrawal )?(?:request|amount)|minimum withdrawal|минимальн(?:ая|ый) (?:заявка|сумма вывода)|мінімальн(?:а|ий) (?:заявка|сума виведення))`;
  const regex = new RegExp(`${minimumSubjects}[^.\\n]{0,60}?(\\d+(?:[.,]\\d+)?)\\s*USDT`, "ig");
  for (const match of line.matchAll(regex)) {
    const actual = Number(match[1].replace(",", "."));
    if (actual === expected) continue;
    if (intended && actual === intended.target) {
      allow(intended, "withdrawal-minimum", file, lineNumber, match[0].trim());
      continue;
    }
    addViolation(out, "withdrawal-minimum", file, lineNumber,
      `claims ${actual} USDT but reviewed product truth is ${expected} USDT`);
  }

  const paraphrases = [
    /(?:withdraw|withdrawal)[^.\n]{0,65}(?:once|when|from)[^.\n]{0,35}?(\d+(?:[.,]\d+)?)\s*USDT/ig,
    /(?:вывод|вывести)[^.\n]{0,65}(?:когда|после|от|с)[^.\n]{0,35}?(\d+(?:[.,]\d+)?)\s*USDT/ig,
    /(?:виведення|вивести)[^.\n]{0,65}(?:коли|після|від|з)[^.\n]{0,35}?(\d+(?:[.,]\d+)?)\s*USDT/ig,
  ];
  for (const pattern of paraphrases) {
    for (const match of line.matchAll(pattern)) {
      const actual = Number(match[1].replace(",", "."));
      if (actual === expected) continue;
      if (intended && actual === intended.target) {
        allow(intended, "withdrawal-minimum", file, lineNumber, match[0].trim());
        continue;
      }
      addViolation(out, "withdrawal-minimum", file, lineNumber,
        `claims ${actual} USDT but reviewed product truth is ${expected} USDT`);
    }
  }
}

export function pageDeclaration(text) {
  const keys = new Set();
  const matter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!matter) return { keys, snapshotDate: null };
  const used = /^numbers_used:\s*\[([^\]]*)\]/m.exec(matter[1]);
  if (used) for (const raw of used[1].split(",")) {
    const key = raw.trim();
    if (key) keys.add(key);
  }
  const snapshot = /snapshot_date:\s*["']?(\d{4}-\d{2}-\d{2})["']?/.exec(matter[1]);
  return { keys, snapshotDate: snapshot ? snapshot[1] : null };
}

export function corpusDeclaration(declarations) {
  const keys = new Set();
  let snapshotDate = null;
  for (const declaration of declarations) {
    for (const key of declaration.keys) keys.add(key);
    if (declaration.snapshotDate && (!snapshotDate || declaration.snapshotDate > snapshotDate)) {
      snapshotDate = declaration.snapshotDate;
    }
  }
  return { keys, snapshotDate };
}

function stableBand(truth, name) {
  return truth.ppv.stable.bands[name];
}

function volatileFact(truth, name) {
  return truth.ppv.volatile[name];
}

// A dated live reading is declared, not guessed: the page must name the truth-pack key it
// published and carry the snapshot date it was read on.
function declaresLiveReading(declaration, ...facts) {
  return Boolean(declaration.snapshotDate) && facts.every((fact) => declaration.keys.has(fact.packKey));
}

const CPM_RANGE_PATTERNS = [
  /(?:rates?[^.\n]{0,45}(?:run|range)|pay[^.\n]{0,20}from)\s*(?:from\s*)?\*?\*?\$?(\d+(?:[.,]\d+)?)\b[^.\n]{0,25}\bto\s*\*?\*?\$?(\d+(?:[.,]\d+)?)[^.\n]{0,35}(?:1000|1,000) views/ig,
  /(?:ставк[аи]|платят)[^.\n]{0,45}(?:от|від)\s*\*?\*?\$?(\d+(?:[.,]\d+)?)[^.\n]{0,25}(?:до)\s*\*?\*?\$?(\d+(?:[.,]\d+)?)[^.\n]{0,35}(?:1000|1 000) (?:просмотров|переглядів)/ig,
];

// The subject phrase only. The old rule glued `[^.\n]{0,55}\$(\d+)` onto the subject and let it
// run greedily, so a line was judged by the LAST amount the quantifier could reach: on
// "Потолок на одну работу | $98.50 (живой разброс от $30 до $100)" it read the band edge $100 as
// the claimed typical cap. Locating the subject and then scanning every amount in the window
// removes the ordering dependency entirely.
const CAP_SUBJECT = /(?:typical|current|типичн\w*|поточн\w*|типов\w*)[^.\n]{0,55}?(?:cap|потолок|стеля)|cap per (?:submission|work)|потолок на (?:одну )?работу|стеля на (?:одну )?роботу/ig;
const CAP_WINDOW = 55;
const AMOUNT = /\$\s*(\d+(?:[.,]\d+)?)/g;
// "$2.00 per 1000 views" next to the word "cap" is a rate, not a per-submission ceiling.
const PER_THOUSAND_VIEWS = /^\s*(?:\*\*)?\s*(?:per|за|\/)\s*(?:1000|1,000|1 000)\s*(?:views|просмотр|перегляд)/i;

// `[^.\n]` cannot express "up to the end of the sentence": it also stops dead on the decimal
// point of "$98.50". Cut the window on real sentence punctuation instead.
function claimWindow(line, start, length) {
  const window = line.slice(start, start + length);
  const sentenceEnd = window.search(/[.!?;](?=\s|$)/);
  return sentenceEnd === -1 ? window : window.slice(0, sentenceEnd);
}

function amountsIn(window, offset) {
  const found = [];
  for (const match of window.matchAll(AMOUNT)) {
    if (PER_THOUSAND_VIEWS.test(window.slice(match.index + match[0].length))) continue;
    found.push({ value: Number(match[1].replace(",", ".")), text: match[1], at: offset + match.index });
  }
  return found;
}

function ppvCapClaims(line, file, lineNumber, truth, declaration, out, intent = EMPTY_INTENT_INDEX) {
  const typical = volatileFact(truth, "maxPerWorkTypical");
  const bounds = effectiveBand(truth, intent, typical.band);
  const amounts = new Map();
  CAP_SUBJECT.lastIndex = 0;
  for (const match of line.matchAll(CAP_SUBJECT)) {
    const window = claimWindow(line, match.index, match[0].length + CAP_WINDOW);
    for (const amount of amountsIn(window, match.index)) amounts.set(amount.at, amount);
  }

  for (const amount of [...amounts.values()].sort((first, second) => first.at - second.at)) {
    // Ladder-rounded band edges are stable product facts and are always publishable, including
    // the $100 ceiling that the previous rule rejected for not being today's median.
    if (amount.value === bounds.low || amount.value === bounds.high) continue;
    if (amount.value < bounds.low || amount.value > bounds.high) {
      addViolation(out, "ppv-cap-outside-band", file, lineNumber,
        `claims a $${amount.text} cap per submission, outside the reviewed stable band $${bounds.low}-$${bounds.high}`);
      continue;
    }
    if (!declaresLiveReading(declaration, typical)) {
      addViolation(out, "ppv-typical-cap", file, lineNumber,
        `states the volatile live median $${amount.text} as an undated product fact; ${VOLATILE_DECLARATION_HINT} ($${bounds.low}-$${bounds.high})`);
    }
  }
}

// The PPV bands may be widened by a founder-decided target the same way a percentage may
// (2026-09-20: «привлекательность важнее точности — платформу подведём под цифры»). A
// `pending-product-change` record on `ppv.stable.bands.<band>.low|high` replaces that edge of the
// reviewed band for every page; a `matches-live` record changes nothing. The live snapshot in
// `product-truth.json` stays what the backend does today and is never edited to make a page pass.
function effectiveBand(truth, intent, name) {
  const base = stableBand(truth, name);
  const band = { low: base.low, high: base.high, records: [] };
  for (const edge of ["low", "high"]) {
    const record = intent?.byPath?.get(`ppv.stable.bands.${name}.${edge}`);
    if (record && record.status === "pending-product-change" && typeof record.target === "number" && record.target !== base[edge]) {
      band[edge] = record.target;
      band.records.push(record);
    }
  }
  return band;
}

function ppvRateRangeClaims(line, file, lineNumber, truth, declaration, out, intent = EMPTY_INTENT_INDEX, allow = () => {}) {
  const minimum = volatileFact(truth, "cpmMinimum");
  const maximum = volatileFact(truth, "cpmMaximum");
  const bounds = effectiveBand(truth, intent, minimum.band);
  for (const pattern of CPM_RANGE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of line.matchAll(pattern)) {
      const low = Number(match[1].replace(",", "."));
      const high = Number(match[2].replace(",", "."));
      if (low === bounds.low && high === bounds.high) {
        for (const record of bounds.records) allow(record, "ppv-live-rate-range", file, lineNumber, match[0].trim());
        continue;
      }
      if (low < bounds.low || high > bounds.high || low > high) {
        addViolation(out, "ppv-live-rate-range", file, lineNumber,
          `claims ${low}-${high} per 1000 views, outside the reviewed stable band ${bounds.low}-${bounds.high}`);
        continue;
      }
      if (!declaresLiveReading(declaration, minimum, maximum)) {
        addViolation(out, "ppv-live-rate-range", file, lineNumber,
          `states the volatile live spread ${low}-${high} as an undated product fact; ${VOLATILE_DECLARATION_HINT} (${bounds.low}-${bounds.high})`);
      }
    }
  }
}

function numericPpvClaims(line, file, lineNumber, truth, declaration, out, intent = EMPTY_INTENT_INDEX, allow = () => {}) {
  ppvRateRangeClaims(line, file, lineNumber, truth, declaration, out, intent, allow);
  ppvCapClaims(line, file, lineNumber, truth, declaration, out, intent);
}

// `options.intent` is the parsed `data/product-intent.json` (or `null` to judge the text against
// the live snapshot alone); it defaults to the committed file. `options.onAllowed` receives every
// claim a record licensed, which is what the CLI prints and what a caller can assert on.
export function lintText(text, file, truth, declaration = pageDeclaration(text), options = {}) {
  const violations = [];
  const intentSource = options.intent === undefined ? defaultProductIntent() : options.intent;
  const intent = intentSource && intentSource.byId instanceof Map
    ? intentSource
    : (intentSource ? productIntentIndex(intentSource) : EMPTY_INTENT_INDEX);
  const allow = (record, rule, allowedFile, line, claim) => {
    options.onAllowed?.({
      rule, intentId: record.id, status: record.status, decidedAt: record.decidedAt,
      file: allowedFile, line, claim, message: intentMessage(record),
    });
  };
  const body = stripFencedCode(text);
  const lines = body.split("\n");
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    numericPercentClaims(line, file, lineNumber, truth, intent, violations, allow);
    numericMinimumClaims(line, file, lineNumber, truth, intent, violations, allow);
    numericPpvClaims(line, file, lineNumber, truth, declaration, violations, intent, allow);
    for (const rule of CLAIM_RULES) {
      for (const pattern of rule.patterns) {
        const match = pattern.exec(line);
        pattern.lastIndex = 0;
        if (!match || isQuestion(line)) continue;
        if (rule.allowNegated && isNegated(line, match.index, lines[index - 1] || "")) continue;
        if (rule.allowWalletQualified && isWalletQualified(line, lines[index - 1] || "")) continue;
        const intended = intent.byId.get(rule.intentId);
        if (intended) {
          allow(intended, rule.id, file, lineNumber, match[0].trim());
          break;
        }
        addViolation(violations, rule.id, file, lineNumber,
          `contradicts reviewed product truth: ${match[0].trim()}`);
        break;
      }
    }
  });
  founderSurnameClaims(body, file, violations);
  return violations;
}

export function validateTruthSnapshot(truth) {
  const errors = [];
  const check = (label, actual, expected) => {
    if (actual !== expected) errors.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  };
  check("schemaVersion", truth.schemaVersion, 2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(truth.verifiedAt || "")) errors.push("verifiedAt must be YYYY-MM-DD");
  for (const source of ["backend", "truthPack"]) {
    if (!/^[a-f0-9]{40}$/.test(truth.source?.[source]?.verifiedCommit || "")) {
      errors.push(`source.${source}.verifiedCommit must be a full git SHA`);
    }
  }
  check("source.backend.repository", truth.source?.backend?.repository, "monolit9951/Contests");
  check("source.backend.branch", truth.source?.backend?.branch, "release");
  check("source.truthPack.repository", truth.source?.truthPack?.repository, "monolit9951/darebay-seo-fleet");
  check("source.truthPack.branch", truth.source?.truthPack?.branch, "master");
  check("contest.creationCommissionPercent", truth.contest?.creationCommissionPercent, REVIEWED_BASELINE.contestCreationCommissionPercent);
  check("contest.topUpCommissionPercent", truth.contest?.topUpCommissionPercent, REVIEWED_BASELINE.contestTopUpCommissionPercent);
  check("store.commissionPercent", truth.store?.commissionPercent, REVIEWED_BASELINE.storeCommissionPercent);
  check("withdrawal.minimumGrossAmount", truth.withdrawal?.minimumGrossAmount, REVIEWED_BASELINE.withdrawalMinimumGrossAmount);
  check("withdrawal.defaultCommissionPercent", truth.withdrawal?.defaultCommissionPercent, REVIEWED_BASELINE.withdrawalDefaultCommissionPercent);
  check("withdrawal.perUserOverrideSupported", truth.withdrawal?.perUserOverrideSupported, REVIEWED_BASELINE.withdrawalPerUserOverrideSupported);
  check("withdrawal.processing", truth.withdrawal?.processing, REVIEWED_BASELINE.withdrawalProcessing);
  check("withdrawal.fixedSettlementSla", truth.withdrawal?.fixedSettlementSla, null);
  check("onChainEscrow.live", truth.onChainEscrow?.live, REVIEWED_BASELINE.onChainEscrowLive);
  check("rewardMethods.automaticBalanceWithdrawalRails", truth.rewardMethods?.automaticBalanceWithdrawalRails, REVIEWED_BASELINE.automaticBalanceWithdrawalRails);
  check("contest.fundingModes.manualPayout.prizeFundsLocked", truth.contest?.fundingModes?.manualPayout?.prizeFundsLocked, REVIEWED_BASELINE.manualPayoutPrizeFundsLocked);
  check("contest.fundingModes.manualPayout.platformWalletInvolved", truth.contest?.fundingModes?.manualPayout?.platformWalletInvolved, REVIEWED_BASELINE.manualPayoutPlatformWalletInvolved);
  // Stable PPV values are double-entered exactly, like every other reviewed invariant.
  check("ppv.stable.defaultMinimumViews.value", truth.ppv?.stable?.defaultMinimumViews?.value, REVIEWED_BASELINE.ppvDefaultMinimumViews);
  check("ppv.stable.validatorMaxCpmRate.value", truth.ppv?.stable?.validatorMaxCpmRate?.value, REVIEWED_BASELINE.ppvValidatorMaxCpmRate);
  check("ppv.stable.bands.cpm.low", truth.ppv?.stable?.bands?.cpm?.low, REVIEWED_BASELINE.ppvCpmBandLow);
  check("ppv.stable.bands.cpm.high", truth.ppv?.stable?.bands?.cpm?.high, REVIEWED_BASELINE.ppvCpmBandHigh);
  check("ppv.stable.bands.maxPerWork.low", truth.ppv?.stable?.bands?.maxPerWork?.low, REVIEWED_BASELINE.ppvMaxPerWorkBandLow);
  check("ppv.stable.bands.maxPerWork.high", truth.ppv?.stable?.bands?.maxPerWork?.high, REVIEWED_BASELINE.ppvMaxPerWorkBandHigh);
  check("ppv.stable.bands.minViewsThreshold.low", truth.ppv?.stable?.bands?.minViewsThreshold?.low, REVIEWED_BASELINE.ppvMinViewsThresholdBandLow);
  check("ppv.stable.bands.minViewsThreshold.high", truth.ppv?.stable?.bands?.minViewsThreshold?.high, REVIEWED_BASELINE.ppvMinViewsThresholdBandHigh);

  // Volatile values are deliberately NOT pinned to a reviewed constant: a live median that moves
  // every cron run would otherwise turn each refresh into a code review. What must hold is that
  // they are still readings of the quantity they claim to be, so they are checked for shape,
  // for a truth-pack key, and for containment in the stable band that bounds them.
  const volatileFacts = truth.ppv?.volatile;
  if (!volatileFacts || typeof volatileFacts !== "object") {
    errors.push("ppv.volatile must list the live aggregates that pages may only publish as dated readings");
  } else {
    for (const [name, fact] of Object.entries(volatileFacts)) {
      const label = `ppv.volatile.${name}`;
      if (!Number.isFinite(fact?.value)) {
        errors.push(`${label}.value must be a finite number, got ${JSON.stringify(fact?.value)}`);
        continue;
      }
      if (!fact.packKey) {
        errors.push(`${label}.packKey must name the truth-pack key a page has to declare in numbers_used`);
      }
      if (fact.band == null) continue;
      const bounds = truth.ppv?.stable?.bands?.[fact.band];
      if (!bounds) {
        errors.push(`${label}.band refers to unknown stable band ${JSON.stringify(fact.band)}`);
      } else if (fact.value < bounds.low || fact.value > bounds.high) {
        errors.push(`${label}.value ${fact.value} escaped its stable band ${bounds.low}-${bounds.high}`);
      }
    }
    for (const required of ["cpmMinimum", "cpmMaximum", "maxPerWorkTypical"]) {
      if (!volatileFacts[required]) errors.push(`ppv.volatile.${required} is required by the PPV content rules`);
    }
  }
  check("selection.random.likesFilter", truth.selection?.random?.likesFilter, false);
  check("submissionAttribution.channel", truth.submissionAttribution?.channel, "URL_SUBMIT_ONLY");
  check("tiktokOracle.provider", truth.tiktokOracle?.provider, "tikwm");
  for (const method of ["USDT_TON_EXTERNAL_WALLET", "TELEGRAM_STARS"]) {
    if (!truth.withdrawal?.wizardMethods?.includes(method)) errors.push(`withdrawal.wizardMethods must include ${method}`);
  }
  return errors;
}

function percentMarker(subject, value) {
  return new RegExp(`${subject}[^%\\n]{0,100}${value}\\s*%`, "i");
}

// The help pages that carry the money terms may state the decided target of a pending
// product change instead of the live value (founder, 2026-09-17): a withdrawal fee of 0 is
// written as "no fee" / «без комиссии», and a per-user override cannot exist without a fee.
// The legal terms keep describing the live contract until the product itself changes.
const HELP_NO_FEE = {
  en: /withdraw[^.\n]{0,80}(?:no (?:withdrawal )?fee|0\s*%|free of (?:commission|charge)|carries no fee)|no (?:withdrawal )?fee[^.\n]{0,40}withdraw/i,
  ru: /вывод[^.\n]{0,80}(?:без комиссии|0\s*%)|без комиссии[^.\n]{0,40}вывод/i,
  ua: /(?:вивед|виві)[^.\n]{0,80}(?:без комісії|0\s*%)|без комісії[^.\n]{0,40}(?:вивед|виві)/i,
};

function effectiveWithdrawalFee(truth, intentIndex) {
  const record = intentIndex?.byPath?.get("withdrawal.defaultCommissionPercent");
  if (record && record.status === "pending-product-change" && typeof record.target === "number") return record.target;
  return truth.withdrawal.defaultCommissionPercent;
}

function canonicalSpecifications(truth, intentIndex = EMPTY_INTENT_INDEX) {
  const helpFee = effectiveWithdrawalFee(truth, intentIndex);
  const feeFree = helpFee === 0 && helpFee !== truth.withdrawal.defaultCommissionPercent;
  const helpFeeRequirement = (lang) => feeFree
    ? [["withdrawal fee", HELP_NO_FEE[lang]]]
    : [["withdrawal fee", percentMarker(LANG[lang].withdrawal, helpFee)], ["per-user withdrawal override", override[lang]]];
  const helpFeeBare = (lang) => feeFree
    ? [["withdrawal fee", HELP_NO_FEE[lang]]]
    : [["withdrawal fee", new RegExp(`${helpFee}\\s*%`, "i")], ["per-user withdrawal override", override[lang]]];
  const override = {
    en: /personal (?:fee |commission )?(?:rate |override)|per-user (?:fee |commission )?override/i,
    ru: /персональн(?:ая|ой) ставк|индивидуальн(?:ая|ой) комисси/i,
    ua: /персональн(?:а|ої) ставк|індивідуальн(?:а|ої) комісі/i,
  };
  const commission = (lang) => [
    ["contest creation fee", percentMarker(LANG[lang].creation, truth.contest.creationCommissionPercent)],
    ["contest top-up fee", percentMarker(LANG[lang].topUp, truth.contest.topUpCommissionPercent)],
    ["store fee", percentMarker(LANG[lang].store, truth.store.commissionPercent)],
    ...helpFeeRequirement(lang),
    ["withdrawal minimum", new RegExp(`${truth.withdrawal.minimumGrossAmount}\\s*${truth.withdrawal.minimumCurrency}`, "i")],
    ["manual processing", LANG[lang].manual],
  ];
  const withdrawal = (lang) => [
    ...helpFeeBare(lang),
    ["withdrawal minimum", new RegExp(`${truth.withdrawal.minimumGrossAmount}\\s*${truth.withdrawal.minimumCurrency}`, "i")],
    ["manual processing", LANG[lang].manual],
    ["USDT withdrawal", /USDT/i],
    ["Telegram Stars withdrawal", /Telegram Stars/i],
  ];
  const legal = (lang) => [
    ["contest creation fee", percentMarker(LANG[lang].creation, truth.contest.creationCommissionPercent)],
    ["store fee", percentMarker(LANG[lang].store, truth.store.commissionPercent)],
    ["withdrawal fee", percentMarker(LANG[lang].withdrawal, truth.withdrawal.defaultCommissionPercent)],
    ["per-user withdrawal override", override[lang]],
    ["withdrawal minimum", new RegExp(`${truth.withdrawal.minimumGrossAmount}\\s*${truth.withdrawal.minimumCurrency}`, "i")],
    ["manual processing", LANG[lang].manual],
  ];
  return [
    ["docs/pomoshch/kakaya-komissiya.md", "ru", commission("ru"), true],
    ["docs/en/help/what-commission.md", "en", commission("en"), true],
    ["docs/ua/dopomoha/yaka-komisiia.md", "ua", commission("ua"), true],
    ["docs/pomoshch/darebay-vyvod-deneg.md", "ru", withdrawal("ru"), true],
    ["docs/en/help/darebay-withdrawals.md", "en", withdrawal("en"), true],
    ["docs/ua/dopomoha/darebay-vyvedennia-hroshei.md", "ua", withdrawal("ua"), true],
    ["docs/legal/terms.md", "ru", legal("ru"), false],
    ["docs/en/legal/terms.md", "en", legal("en"), false],
    ["docs/ua/legal/terms.md", "ua", legal("ua"), false],
  ];
}

export function checkCanonicalPages(root, truth, intentIndex = EMPTY_INTENT_INDEX) {
  const violations = [];
  for (const [file, , requirements, requireSnapshot] of canonicalSpecifications(truth, intentIndex)) {
    const absolute = join(root, file);
    if (!existsSync(absolute)) {
      addViolation(violations, "canonical-page", file, 1, "required truth page is missing");
      continue;
    }
    const text = readFileSync(absolute, "utf8");
    for (const [label, pattern] of requirements) {
      pattern.lastIndex = 0;
      if (!pattern.test(text)) addViolation(violations, "canonical-page", file, 1, `missing current ${label}`);
    }
    if (requireSnapshot) {
      const snapshot = new RegExp(`snapshot_date:\\s*["']${truth.verifiedAt}["']`);
      if (!snapshot.test(text)) addViolation(violations, "canonical-page", file, 1,
        `provenance.snapshot_date must equal truth snapshot ${truth.verifiedAt}`);
    }
  }
  return violations;
}

function git(repo, args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  return { ok: result.status === 0, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function githubRepositorySlug(remoteUrl) {
  const normalized = (remoteUrl || "").trim().replace(/\.git\/?$/i, "").replace(/\/$/, "");
  const match = normalized.match(/^(?:https:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([a-z0-9_.-]+\/[a-z0-9_.-]+)$/i);
  return match ? match[1] : null;
}

function propertyMap(text) {
  const properties = new Map();
  for (const line of text.split("\n")) {
    if (!line || /^\s*[#!]/.test(line)) continue;
    const separator = line.indexOf("=");
    if (separator > 0) properties.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return properties;
}

export function verifySourceProvenance(truth, {
  backendRepo = process.env.PRODUCT_TRUTH_BACKEND_REPO || truth.source?.backend?.localPath,
  truthPackRepo = process.env.PRODUCT_TRUTH_PACK_REPO || truth.source?.truthPack?.localPath,
  requireLocal = process.env.PRODUCT_TRUTH_REQUIRE_LOCAL_SOURCES === "1",
} = {}) {
  const errors = [];
  let checked = 0;
  const checkRepo = (label, repo, source) => {
    if (!repo || !existsSync(repo)) {
      if (requireLocal || process.env[`PRODUCT_TRUTH_${label.toUpperCase()}_REPO`]) {
        errors.push(`${label} source repository is unavailable at ${repo || "<unset>"}`);
      }
      return null;
    }
    const origin = git(repo, ["remote", "get-url", "origin"]);
    const originSlug = origin.ok ? githubRepositorySlug(origin.stdout) : null;
    if (!originSlug || originSlug.toLowerCase() !== source.repository.toLowerCase()) {
      errors.push(`${label} origin must be ${source.repository}, got ${originSlug || "<unverifiable>"}`);
      return null;
    }
    checked++;
    const object = git(repo, ["cat-file", "-e", `${source.verifiedCommit}^{commit}`]);
    if (!object.ok) {
      errors.push(`${label} verified commit ${source.verifiedCommit} does not exist in ${repo}`);
      return null;
    }
    const remoteBranch = `refs/remotes/origin/${source.branch}`;
    const remote = git(repo, ["rev-parse", "--verify", remoteBranch]);
    if (!remote.ok) {
      errors.push(`${label} remote branch ${remoteBranch} is unavailable`);
    } else if (!git(repo, ["merge-base", "--is-ancestor", source.verifiedCommit, remoteBranch]).ok) {
      errors.push(`${label} verified commit ${source.verifiedCommit} is not on ${remoteBranch}`);
    }
    return (file) => {
      const shown = git(repo, ["show", `${source.verifiedCommit}:${file}`]);
      if (!shown.ok) errors.push(`${label} cannot read ${file} at ${source.verifiedCommit}`);
      return shown.ok ? shown.stdout : "";
    };
  };

  const backend = checkRepo("backend", backendRepo, truth.source.backend);
  if (backend) {
    const config = propertyMap(backend(truth.source.backend.configFile));
    const expectedProperties = new Map([
      [truth.source.properties.contestCreationFiatPercent, truth.contest.creationCommissionPercent],
      [truth.source.properties.contestCreationCryptoPercent, truth.contest.creationCommissionPercent],
      [truth.source.properties.contestCreationPlatformPercent, truth.contest.creationCommissionPercent],
      [truth.source.properties.storeCommissionPercent, truth.store.commissionPercent],
      [truth.source.properties.withdrawalMinimum, truth.withdrawal.minimumGrossAmount],
      [truth.source.properties.withdrawalCommissionPercent, truth.withdrawal.defaultCommissionPercent],
      [truth.source.properties.manualPayoutsEnabled, truth.contest.fundingModes.manualPayout.enabled],
      [truth.source.properties.tiktokTikwmEnabled, true],
    ]);
    for (const [name, expected] of expectedProperties) {
      const raw = config.get(name);
      const actual = typeof expected === "boolean" ? raw === "true" : Number(raw);
      if (actual !== expected) errors.push(`backend property ${name}: expected ${expected}, got ${raw ?? "<missing>"}`);
    }

    const runbook = backend(truth.source.backend.manualPayoutRunbook);
    if (!/organizer pays\s+creators directly/i.test(runbook) || !/wallet service\s+is never involved/i.test(runbook)) {
      errors.push("manual payout runbook no longer proves organizer-direct fulfilment without the wallet");
    }
    const lifecycle = backend("src/main/java/com/neptune/core/contest/domain/service/ContestLifecycleManager.java");
    if (!/Manual payouts: no money enters the platform[\s\S]{0,180}no balance check, no\s+\/\/ lock, no charge outbox/.test(lifecycle)) {
      errors.push("ContestLifecycleManager no longer proves that manual payouts have no platform lock");
    }
    const withdrawal = backend("src/main/java/com/neptune/core/withdrawal/service/WithdrawalService.java");
    if (!/getWithdrawalCommissionPercentage\(\)/.test(withdrawal)) {
      errors.push("WithdrawalService no longer proves per-user commission overrides");
    }
    const random = backend("src/main/java/com/neptune/core/winners/domain/service/RandomWinnerSelector.java");
    if (!/findByContestIdAndVisibilityStatus[\s\S]{0,160}WorkVisibilityStatus\.ACTIVE/.test(random)
        || !/new Random\(seed/.test(random) || /most[- ]liked|top[- ]N/i.test(random)) {
      errors.push("RandomWinnerSelector no longer proves seeded selection over eligible ACTIVE works without a likes filter");
    }
  }

  const truthPack = checkRepo("truthPack", truthPackRepo, truth.source.truthPack);
  if (truthPack) {
    const facts = truthPack(truth.source.truthPack.file);
    const escapedDate = truth.verifiedAt.replaceAll("-", "\\-");
    const requirements = [
      [new RegExp(`snapshot ${escapedDate}`), "truth-pack snapshot date"],
      [/SelectionType: RANDOM, VIEWER_VOTING, CREATOR_DECISION, ORACLE_ATTESTED_POOL/, "selection types"],
    ];
    // Every PPV value is verified against the keyed provenance list rather than the prose
    // summary, and the stable bands are verified too: the content rules now judge public copy
    // against those bands, so an unverified band would be a gate with no floor under it.
    for (const [key, value, unit] of packSourceKeys(truth)) {
      requirements.push([packSourceLine(key, value, unit), `truth-pack key ${key} = ${value} ${unit}`]);
    }
    for (const [pattern, label] of requirements) {
      if (!pattern.test(facts)) errors.push(`truth-pack no longer matches ${label}`);
    }
  }

  return { checked, errors };
}

export function packSourceKeys(truth) {
  const keys = [];
  for (const fact of Object.values(truth.ppv?.stable ?? {})) {
    if (fact?.packKey) keys.push([fact.packKey, fact.value, fact.unit]);
  }
  for (const bounds of Object.values(truth.ppv?.stable?.bands ?? {})) {
    keys.push([bounds.packKeys.low, bounds.low, bounds.unit]);
    keys.push([bounds.packKeys.high, bounds.high, bounds.unit]);
  }
  for (const fact of Object.values(truth.ppv?.volatile ?? {})) {
    if (fact?.packKey) keys.push([fact.packKey, fact.value, fact.unit]);
  }
  return keys;
}

function packSourceLine(key, value, unit) {
  const escape = (text) => String(text).replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\`${escape(key)}\` = ${escape(value)} ${escape(unit)}`);
}

export function lintRepository({
  root = DEFAULT_ROOT,
  truthPath = join(root, "data/product-truth.json"),
  intentPath = join(root, "data/product-intent.json"),
} = {}) {
  const truth = JSON.parse(readFileSync(truthPath, "utf8"));
  const intent = readProductIntent(intentPath);
  const validation = validateTruthSnapshot(truth).map((message) => ({
    rule: "truth-snapshot", file: relative(root, truthPath), line: 1, message,
  }));
  const intentValidation = validateProductIntent(intent, truth, { root }).map((message) => ({
    rule: "product-intent", file: relative(root, intentPath), line: 1, message,
  }));
  const provenance = verifySourceProvenance(truth);
  const sourceValidation = provenance.errors.map((message) => ({
    rule: "source-provenance", file: relative(root, truthPath), line: 1, message,
  }));
  const sources = publicClaimFiles(root).map((absolute) => ({
    file: relative(root, absolute).replaceAll("\\", "/"),
    text: readFileSync(absolute, "utf8"),
  }));
  const pages = sources.filter((source) => source.file.endsWith(".md"));
  for (const page of pages) page.declaration = pageDeclaration(page.text);
  // `docs/public/llms.txt` is generated by `gen:llms` from exactly the front matter above, so it
  // carries the pages' declarations rather than its own; demanding a separate one would only ask
  // the generator to restate what it copied. The stable-band bound still applies to it, and it
  // cannot contain a number that no page description already published.
  const generated = corpusDeclaration(pages.map((page) => page.declaration));
  const intentIndex = productIntentIndex(intent);
  const allowances = [];
  const options = { intent: intentIndex, onAllowed: (allowance) => allowances.push(allowance) };
  const content = sources.flatMap((source) =>
    lintText(source.text, source.file, truth, source.declaration ?? generated, options));
  const canonical = checkCanonicalPages(root, truth, intentIndex);
  return { truth, intent, filesChecked: sources.length, sourcesChecked: provenance.checked, allowances,
    relaxedRules: relaxedByIntent(truth, intentIndex),
    violations: [...validation, ...intentValidation, ...sourceValidation, ...canonical, ...content] };
}

// Which rules the intent file currently holds open, printed on every green run so a relaxed gate
// is never invisible. A `matches-live` record holds nothing open: the target is the live value.
function relaxedByIntent(truth, intent) {
  const relaxed = [];
  for (const rule of CLAIM_RULES) {
    const record = intent.byId.get(rule.intentId);
    if (record) relaxed.push(`${rule.id} <- ${record.id}`);
  }
  for (const [path, record] of intent.byPath) {
    const live = truthPathValue(truth, path);
    if (!sameValue(record.target, live)) relaxed.push(`${path} ${JSON.stringify(live)} -> ${JSON.stringify(record.target)} <- ${record.id}`);
  }
  return relaxed;
}

function runCli() {
  const rootArg = process.argv.indexOf("--root");
  const root = rootArg >= 0 ? resolve(process.argv[rootArg + 1]) : DEFAULT_ROOT;
  const truthArg = process.argv.indexOf("--truth");
  const truthPath = truthArg >= 0 ? resolve(process.argv[truthArg + 1]) : join(root, "data/product-truth.json");
  const intentArg = process.argv.indexOf("--intent");
  const intentPath = intentArg >= 0 ? resolve(process.argv[intentArg + 1]) : join(root, "data/product-intent.json");
  const result = lintRepository({ root, truthPath, intentPath });
  for (const allowance of result.allowances) {
    console.log(`${allowance.message} - ${allowance.file}:${allowance.line} [${allowance.rule}] ${allowance.claim}`);
  }
  if (result.violations.length) {
    console.error(`product_truth_lint: ${result.violations.length} violation(s)`);
    for (const violation of result.violations) {
      console.error(`${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
    }
    process.exit(1);
  }
  const intentSummary = result.intent
    ? `; product-intent ${result.intent.decidedAt} (${result.relaxedRules.length ? result.relaxedRules.join(", ") : "no rule relaxed"}; ${result.allowances.length} claim(s) allowed)`
    : "";
  console.log(`product_truth_lint: OK (${result.filesChecked} public claim files; ${result.sourcesChecked} source repos; snapshot ${result.truth.verifiedAt}${intentSummary})`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runCli();
