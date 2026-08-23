#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  checkCanonicalPages,
  corpusDeclaration,
  lintText,
  pageDeclaration,
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

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
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

test("changing a source repository or branch in JSON alone fails", () => {
  const changedRepository = structuredClone(truth);
  changedRepository.source.backend.repository = "attacker/Contests";
  assert.match(validateTruthSnapshot(changedRepository).join("\n"), /source\.backend\.repository/);

  const changedBranch = structuredClone(truth);
  changedBranch.source.truthPack.branch = "release";
  assert.match(validateTruthSnapshot(changedBranch).join("\n"), /source\.truthPack\.branch/);
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

test("a GitHub-looking but non-GitHub origin fails before counting the source", () => {
  const fixture = mkdtempSync(join(tmpdir(), "product-truth-origin-"));
  try {
    git(fixture, "init", "--initial-branch=release");
    git(fixture, "remote", "add", "origin", "https://evilgithub.com/monolit9951/Contests.git");
    const result = verifySourceProvenance(truth, {
      backendRepo: fixture,
      truthPackRepo: "",
      requireLocal: false,
    });
    assert.equal(result.checked, 0);
    assert.match(result.errors.join("\n"), /backend origin must be monolit9951\/Contests, got <unverifiable>/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("a local shadow branch cannot replace the remote-tracking source branch", () => {
  const fixture = mkdtempSync(join(tmpdir(), "product-truth-shadow-"));
  try {
    git(fixture, "init", "--initial-branch=release");
    git(fixture, "config", "user.name", "Product Truth Test");
    git(fixture, "config", "user.email", "product-truth-test@invalid.example");
    writeFileSync(join(fixture, "README.md"), "shadow branch fixture\n");
    git(fixture, "add", "README.md");
    git(fixture, "commit", "-m", "fixture");
    git(fixture, "remote", "add", "origin", "git@github.com:monolit9951/Contests.git");

    const changed = structuredClone(truth);
    changed.source.backend.verifiedCommit = git(fixture, "rev-parse", "HEAD");
    const result = verifySourceProvenance(changed, {
      backendRepo: fixture,
      truthPackRepo: "",
      requireLocal: false,
    });
    assert.equal(result.checked, 1);
    assert.match(result.errors.join("\n"), /remote branch refs\/remotes\/origin\/release is unavailable/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
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
  // Both stale numbers now sit BELOW their reviewed bands, so the cap is caught as out-of-band
  // rather than as an undated live median. Either verdict stops the stale figure from shipping;
  // the undated-median path is covered by the declaration tests below.
  assert(found.has("ppv-cap-outside-band"));
});

console.log("product_truth_lint: stable and volatile value classes");

// The front matter the fleet already stamps on a page that publishes a live aggregate.
const DECLARED = [
  "---",
  "title: fixture",
  'provenance: { snapshot_date: "2026-08-15", source: "darebay-prod" }',
  "numbers_used: [ppv_cpm_min, ppv_cpm_median, ppv_cpm_max, ppv_max_per_work_typical]",
  "---",
  "",
].join("\n");

test("a stable band edit in JSON alone fails the double-entry baseline", () => {
  const changed = structuredClone(truth);
  changed.ppv.stable.bands.maxPerWork.high = 120;
  assert.match(validateTruthSnapshot(changed).join("\n"), /ppv\.stable\.bands\.maxPerWork\.high/);

  const rate = structuredClone(truth);
  rate.ppv.stable.validatorMaxCpmRate.value = 90;
  assert.match(validateTruthSnapshot(rate).join("\n"), /ppv\.stable\.validatorMaxCpmRate\.value/);
});

// The reported defect, stated as a contract: ppv_max_per_work_typical moved 97 -> 98.5 in one
// day. A live aggregate that stays inside its band must never require a reviewed code edit.
test("a live aggregate may move inside its band without a reviewed code edit", () => {
  for (const median of [100, 150, 250, 500]) {
    const changed = structuredClone(truth);
    changed.ppv.volatile.maxPerWorkTypical.value = median;
    assert.deepEqual(validateTruthSnapshot(changed), [], `median ${median} should need no baseline edit`);
  }
});

test("a live aggregate that escapes its stable band fails", () => {
  const changed = structuredClone(truth);
  changed.ppv.volatile.maxPerWorkTypical.value = 900;
  assert.match(validateTruthSnapshot(changed).join("\n"), /ppv\.volatile\.maxPerWorkTypical\.value 900 escaped its stable band/);
});

test("a live aggregate without a truth-pack key or with a bogus band fails", () => {
  const missingKey = structuredClone(truth);
  delete missingKey.ppv.volatile.cpmMedian.packKey;
  assert.match(validateTruthSnapshot(missingKey).join("\n"), /ppv\.volatile\.cpmMedian\.packKey/);

  const bogusBand = structuredClone(truth);
  bogusBand.ppv.volatile.cpmMedian.band = "nonexistent";
  assert.match(validateTruthSnapshot(bogusBand).join("\n"), /unknown stable band/);

  const dropped = structuredClone(truth);
  delete dropped.ppv.volatile.maxPerWorkTypical;
  assert.match(validateTruthSnapshot(dropped).join("\n"), /ppv\.volatile\.maxPerWorkTypical is required/);
});

test("stable band values are verified against the pinned truth-pack", () => {
  const changed = structuredClone(truth);
  changed.ppv.stable.bands.maxPerWork.high = 120;
  assert.match(verifySourceProvenance(changed, { requireLocal: true }).errors.join("\n"),
    /ppv_max_per_work_band_high = 120 usd/);
});

// Volatile values are released from the code baseline, not from provenance: the JSON still has
// to match the truth-pack commit it is pinned to, which is a data edit rather than a code review.
test("live aggregates are still pinned to the reviewed truth-pack commit", () => {
  const changed = structuredClone(truth);
  changed.ppv.volatile.maxPerWorkTypical.value = 97;
  assert.match(verifySourceProvenance(changed, { requireLocal: true }).errors.join("\n"),
    /ppv_max_per_work_typical = 97 usd/);
});

console.log("product_truth_lint: publishable cap values");
test("the stable cap band is publishable with no live declaration", () => {
  assert.deepEqual(lintText("Типичный потолок на одну работу - **$100**.", "fixture.md", truth), []);
  assert.deepEqual(lintText("The typical cap per submission is $500.", "fixture.md", truth), []);
  assert.deepEqual(lintText("The typical cap per submission runs from $100 to $500.", "fixture.md", truth), []);
});

test("a cap explained without a number passes", () => {
  assert.deepEqual(lintText(
    "Потолок на одну работу задаёт заказчик, и он виден в карточке до подачи.", "fixture.md", truth), []);
});

test("the volatile median may be published only as a declared dated reading", () => {
  assert(rules("The typical cap per submission is $250.").has("ppv-typical-cap"));
  assert.deepEqual(lintText(`${DECLARED}The typical cap per submission is $250.`, "fixture.md", truth), []);
});

test("half a declaration does not license a volatile number", () => {
  const noDate = "---\ntitle: fixture\nnumbers_used: [ppv_max_per_work_typical]\n---\n";
  assert(rules(`${noDate}The typical cap per submission is $250.`).has("ppv-typical-cap"));

  const noKey = "---\ntitle: fixture\nprovenance: { snapshot_date: \"2026-08-15\" }\nnumbers_used: [ppv_cpm_median]\n---\n";
  assert(rules(`${noKey}The typical cap per submission is $250.`).has("ppv-typical-cap"));
});

test("a cap outside the stable band fails even on a declared page", () => {
  assert(rules(`${DECLARED}The typical cap per submission is $900.`).has("ppv-cap-outside-band"));
  assert(rules(`${DECLARED}The typical cap per submission is $5.`).has("ppv-cap-outside-band"));
});

// The greedy quantifier read the LAST amount it could reach after the trigger, so a line that
// quoted the band alongside the median was judged on the band edge.
test("every amount after a cap trigger is judged, not the last one a quantifier reaches", () => {
  assert.deepEqual(lintText("| Потолок на одну работу | $100 до $500 |", "fixture.md", truth), []);

  const mixed = lintText("| Потолок на одну работу | $250 (живой разброс от $100 до $500) |", "fixture.md", truth);
  assert.equal(mixed.length, 1);
  assert.equal(mixed[0].rule, "ppv-typical-cap");
  assert.match(mixed[0].message, /volatile live median \$250/);

  const reversed = lintText("| Потолок на одну работу | от $100 до $500, сейчас $250 |", "fixture.md", truth);
  assert.equal(reversed.length, 1);
  assert.match(reversed[0].message, /volatile live median \$250/);
});

// The point of the whole change: the verdict must not depend on today's median.
test("the cap rule no longer requires the current live median", () => {
  for (const median of [100, 250, 500]) {
    const changed = structuredClone(truth);
    changed.ppv.volatile.maxPerWorkTypical.value = median;
    assert.deepEqual(lintText("The typical cap per submission runs from $100 to $500.", "fixture.md", changed), []);
    assert.deepEqual(lintText(`${DECLARED}The typical cap per submission is $250.`, "fixture.md", changed), []);
  }
});

test("the cap window ends at the sentence, not at a decimal point", () => {
  // An amount in the next sentence is not part of the cap claim...
  assert.deepEqual(lintText(
    "The typical cap per submission runs from $100 to $500. A budget of $50 buys several clips.",
    "fixture.md", truth), []);

  // ...while the decimal point inside an amount must not cut the window short and hide the rest.
  const spread = lintText("| Потолок на одну работу | $250 (живой разброс от $100 до $500) |", "fixture.md", truth);
  assert.equal(spread.length, 1);
  assert.match(spread[0].message, /volatile live median \$250/);
});

test("a per-1000-views rate beside the word cap is not read as a cap", () => {
  assert.deepEqual(lintText(
    "The cap per submission matters: the maximum rate is $2.00 per 1000 views.", "fixture.md", truth), []);
});

console.log("product_truth_lint: publishable rate spreads");
test("the stable rate band is publishable while the live spread needs a declaration", () => {
  assert.deepEqual(lintText("Rates across live contests run from $1.00 to $2.00 per 1000 views.", "fixture.md", truth), []);
  assert(rules("Rates across live contests run from $1.00 to $1.50 per 1000 views.").has("ppv-live-rate-range"));
  assert.deepEqual(lintText(
    `${DECLARED}Rates across live contests run from $1.00 to $1.50 per 1000 views.`, "fixture.md", truth), []);
});

test("a rate spread outside the stable band fails even on a declared page", () => {
  const found = lintText(
    `${DECLARED}Rates across live contests run from $0.01 to $2.00 per 1000 views.`, "fixture.md", truth);
  assert.equal(found.length, 1);
  assert.match(found[0].message, /outside the reviewed stable band 1-2/);
});

test("declarations are read from front matter and merged for generated aggregates", () => {
  const declaration = pageDeclaration(DECLARED);
  assert.equal(declaration.snapshotDate, "2026-08-15");
  assert(declaration.keys.has("ppv_max_per_work_typical"));
  assert.deepEqual(pageDeclaration("no front matter here"), { keys: new Set(), snapshotDate: null });

  // `docs/public/llms.txt` has no front matter of its own; it inherits the corpus declarations.
  const merged = corpusDeclaration([
    pageDeclaration(DECLARED),
    { keys: new Set(["ppv_contests"]), snapshotDate: "2026-08-14" },
  ]);
  assert.equal(merged.snapshotDate, "2026-08-15");
  assert(merged.keys.has("ppv_max_per_work_typical") && merged.keys.has("ppv_contests"));
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
