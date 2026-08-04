#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  checkCanonicalPages,
  lintText,
  validateTruthSnapshot,
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

function rules(text) {
  return new Set(lintText(text, "fixture.md", truth).map((item) => item.rule));
}

console.log("product_truth_lint: reviewed snapshot");
test("the committed snapshot matches the double-entry baseline", () => {
  assert.deepEqual(validateTruthSnapshot(truth), []);
});

test("changing a reviewed rate in JSON alone fails", () => {
  const changed = structuredClone(truth);
  changed.withdrawal.commissionPercent = 0;
  assert.match(validateTruthSnapshot(changed).join("\n"), /withdrawal\.commissionPercent/);
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

test("wrong withdrawal minimum fails", () => {
  assert(rules("The minimum withdrawal request is 2 USDT.").has("withdrawal-minimum"));
});

test("automatic and minute-SLA promises fail", () => {
  const found = rules("The payout is automatic. Withdrawal arrives within a few minutes.");
  assert(found.has("automatic-payout"));
  assert(found.has("instant-payout-sla"));
});

test("live smart-contract escrow claims fail", () => {
  assert(rules("The budget is held in an on-chain escrow.").has("live-on-chain-escrow"));
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
  const text = [
    "Contest creation: 0%. Contest budget top-up: 0%. Store purchase: 8%.",
    "Balance withdrawal: 10%. The minimum withdrawal request is 10 USDT.",
    "Withdrawal is not free and is not an automatic transfer.",
    "There is no promise that settlement arrives within minutes.",
    "No on-chain escrow is live; fulfilment is manual.",
  ].join("\n");
  assert.deepEqual(lintText(text, "fixture.md", truth), []);
});

test("a question heading is not treated as a product promise", () => {
  assert.deepEqual(lintText("### Is withdrawal free?\n\nNo. It has a fee.", "fixture.md", truth), []);
});

test("line-wrapped negation still suppresses a false positive", () => {
  const text = "This does not mean that a credited balance can be\nwithdrawn automatically.";
  assert.deepEqual(lintText(text, "fixture.md", truth), []);
});

test("claims inside fenced examples are ignored", () => {
  const text = "```text\nWithdrawals are free.\nThe payout is automatic.\n```";
  assert.deepEqual(lintText(text, "fixture.md", truth), []);
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

if (process.exitCode) {
  console.error(`product_truth_lint.test: FAILED (${passed} passed before failures)`);
} else {
  console.log(`product_truth_lint.test: OK (${passed} checks)`);
}
