#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  checkCanonicalPages,
  lintText,
  validateTruthSnapshot,
  verifySourceProvenance,
} from "./product-truth-lint.mjs";

const root = resolve(import.meta.dirname, "..");
const truth = JSON.parse(readFileSync(join(root, "data/product-truth.json"), "utf8"));
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${error.message}`);
    process.exitCode = 1;
  }
}

function rules(value) {
  return new Set(lintText(value, "fixture.md", truth).map((item) => item.rule));
}

console.log("product_truth_lint: reviewed snapshot and provenance");
test("the committed snapshot matches the reviewed baseline", () => {
  assert.deepEqual(validateTruthSnapshot(truth), []);
});

test("changing a reviewed rate in JSON alone fails", () => {
  const changed = structuredClone(truth);
  changed.withdrawal.defaultCommissionPercent = 0;
  assert.match(validateTruthSnapshot(changed).join("\n"), /withdrawal\.defaultCommissionPercent/);
});

test("the pinned local backend and truth-pack are verified", () => {
  const result = verifySourceProvenance(truth, { requireLocal: true });
  assert.equal(result.checked, 2);
  assert.deepEqual(result.errors, []);
});

test("a fabricated backend SHA fails provenance", () => {
  const changed = structuredClone(truth);
  changed.source.backend.verifiedCommit = "0".repeat(40);
  assert.match(verifySourceProvenance(changed, { requireLocal: true }).errors.join("\n"), /does not exist/);
});

console.log("product_truth_lint: contradictory claims");
test("free withdrawal claims fail", () => {
  assert(rules("Withdrawals are free and have no platform fee.").has("free-withdrawal"));
});

test("old payment-method rate matrix fails", () => {
  assert(rules("Wallet and USDT funding: 8% commission.").has("legacy-method-rate"));
});

test("wrong operation-specific percentages fail", () => {
  const found = rules("Contest creation fee: 5%. Store purchase: 7%. Balance withdrawal: 3%.");
  assert(found.has("contest-creation-fee"));
  assert(found.has("store-fee"));
  assert(found.has("withdrawal-fee"));
});

test("wrong withdrawal minimum and paraphrase fail", () => {
  assert(rules("The minimum withdrawal request is 2 USDT.").has("withdrawal-minimum"));
  assert(rules("You can withdraw once your balance reaches 2 USDT.").has("withdrawal-minimum"));
});

test("automatic and minute-SLA promises fail", () => {
  const found = rules("The payout is automatic. Withdrawal arrives within a few minutes.");
  assert(found.has("automatic-payout"));
  assert(found.has("instant-payout-sla"));
});

test("unrelated negation cannot hide an automatic payout claim", () => {
  assert(rules("Withdrawal is not free.\nThe payout is automatic.").has("automatic-payout"));
});

test("instant, straight-away and localized payout paraphrases fail", () => {
  assert(rules("Winners receive instant payouts.").has("automatic-payout"));
  assert(rules("When the contest ends, winners get paid straight away.").has("automatic-payout"));
  assert(rules("После окончания конкурса победителю сразу отправляют деньги.").has("automatic-payout"));
});

test("live smart-contract escrow claims and paraphrases fail", () => {
  assert(rules("The budget is held in an on-chain escrow.").has("live-on-chain-escrow"));
  assert(rules("The prize is secured by a blockchain smart contract.").has("live-on-chain-escrow"));
});

test("unqualified platform-lock claims fail while wallet qualification passes", () => {
  assert(rules("The budget is locked on the platform before publication.").has("unqualified-prize-lock"));
  assert.deepEqual(lintText("In a wallet-backed contest, the budget is locked on the platform.", "fixture.md", truth), []);
});

test("official-platform API claims fail while the tikwm wording passes", () => {
  assert(rules("Views are pulled straight through the TikTok API.").has("official-api-view-oracle"));
  assert.deepEqual(lintText(
    "The configured tikwm oracle reads the published TikTok counter; tikwm is not the official TikTok API.",
    "fixture.md", truth), []);
});

test("the retired three-type and most-liked RANDOM models fail", () => {
  assert(rules("One of three selection types:").has("stale-selection-model"));
  assert(rules("In RANDOM contests, winners come from the most-liked entries.").has("stale-selection-model"));
});

test("stale live PPV range and cap fail", () => {
  const found = rules("Rates across live contests run from $0.30 to $1.00 per 1000 views. The typical cap per submission is $50.");
  assert(found.has("ppv-live-rate-range"));
  assert(found.has("ppv-typical-cap"));
});

test("promising every creator their preferred rail fails", () => {
  assert(rules("Every creator is paid by the method they choose.").has("all-payout-methods"));
});

test("claiming that every listed reward rail works fails", () => {
  assert(rules("Card, bank, wallet and Stars: every one of them works.").has("all-payout-methods"));
});

test("the retired partial contest-commission refund fails", () => {
  assert(rules("Part of the commission is returned, but feed placement is not.").has("legacy-contest-commission-refund"));
});

test("saying the organizer pays the creator fee fails", () => {
  assert(rules("The commission is paid by the buyer, not the clipper.").has("organizer-pays-creator-fee"));
});

test("a transfer promised at contest close fails", () => {
  assert(rules("At the end of the contest, the money goes to the winner.").has("contest-close-auto-transfer"));
});

console.log("product_truth_lint: safe corrections and parser boundaries");
test("current facts and explicit corrections pass", () => {
  const value = [
    "Contest creation: 0%. Contest budget top-up: 0%. Store purchase: 8%.",
    "Balance withdrawal: 10%. The minimum withdrawal request is 10 USDT.",
    "Withdrawal is not free and is not an automatic transfer.",
    "There is no promise that settlement arrives within minutes.",
    "No on-chain escrow is live; fulfilment is manual.",
  ].join("\n");
  assert.deepEqual(lintText(value, "fixture.md", truth), []);
});

test("a question heading is not treated as a product promise", () => {
  assert.deepEqual(lintText("### Is withdrawal free?\n\nNo. It has a fee.", "fixture.md", truth), []);
});

test("line-wrapped negation still suppresses a false positive", () => {
  const value = "This does not mean that a credited balance can be\nwithdrawn automatically.";
  assert.deepEqual(lintText(value, "fixture.md", truth), []);
});

test("claims inside fenced examples are ignored", () => {
  const value = "```text\nWithdrawals are free.\nThe payout is automatic.\n```";
  assert.deepEqual(lintText(value, "fixture.md", truth), []);
});

console.log("product_truth_lint: canonical truth pages");
test("missing canonical pages fail loud", () => {
  const fixture = mkdtempSync(join(tmpdir(), "product-truth-lint-"));
  try {
    const violations = checkCanonicalPages(fixture, truth);
    assert.equal(violations.length, 9);
    assert(violations.every((item) => item.rule === "canonical-page"));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("mutating a canonical withdrawal rate fails", () => {
  const fixture = mkdtempSync(join(tmpdir(), "product-truth-canonical-"));
  const canonicalFiles = [
    "docs/pomoshch/kakaya-komissiya.md", "docs/en/help/what-commission.md", "docs/ua/dopomoha/yaka-komisiia.md",
    "docs/pomoshch/darebay-vyvod-deneg.md", "docs/en/help/darebay-withdrawals.md", "docs/ua/dopomoha/darebay-vyvedennia-hroshei.md",
    "docs/legal/terms.md", "docs/en/legal/terms.md", "docs/ua/legal/terms.md",
  ];
  try {
    for (const file of canonicalFiles) {
      const target = join(fixture, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(join(root, file), "utf8"));
    }
    const target = join(fixture, "docs/en/help/darebay-withdrawals.md");
    writeFileSync(target, readFileSync(target, "utf8").replaceAll("10%", "9%"));
    assert(checkCanonicalPages(fixture, truth).some((item) =>
      item.file === "docs/en/help/darebay-withdrawals.md" && /withdrawal fee/.test(item.message)));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("removing the personal withdrawal override from a canonical page fails", () => {
  const fixture = mkdtempSync(join(tmpdir(), "product-truth-override-"));
  const canonicalFiles = [
    "docs/pomoshch/kakaya-komissiya.md", "docs/en/help/what-commission.md", "docs/ua/dopomoha/yaka-komisiia.md",
    "docs/pomoshch/darebay-vyvod-deneg.md", "docs/en/help/darebay-withdrawals.md", "docs/ua/dopomoha/darebay-vyvedennia-hroshei.md",
    "docs/legal/terms.md", "docs/en/legal/terms.md", "docs/ua/legal/terms.md",
  ];
  try {
    for (const file of canonicalFiles) {
      const target = join(fixture, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(join(root, file), "utf8"));
    }
    const target = join(fixture, "docs/en/help/darebay-withdrawals.md");
    writeFileSync(target, readFileSync(target, "utf8").replaceAll("A personal fee override may apply; ", ""));
    assert(checkCanonicalPages(fixture, truth).some((item) =>
      item.file === "docs/en/help/darebay-withdrawals.md" && /per-user withdrawal override/.test(item.message)));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

if (process.exitCode) {
  console.error(`product_truth_lint.test: FAILED (${passed} passed before failures)`);
} else {
  console.log(`product_truth_lint.test: OK (${passed} checks)`);
}
