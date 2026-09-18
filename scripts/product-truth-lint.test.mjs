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
  readProductIntent,
  validateProductIntent,
  validateTruthSnapshot,
  verifySourceProvenance, productIntentIndex } from "./product-truth-lint.mjs";

const root = resolve(import.meta.dirname, "..");
const truth = JSON.parse(readFileSync(join(root, "data/product-truth.json"), "utf8"));
const intent = readProductIntent(join(root, "data/product-intent.json"));
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

// The same lint, judged against a different decided target product: `null` is "no intent file at
// all", an object is the file as it would be after the edit under test.
function rulesWithIntent(value, decided) {
  return new Set(lintText(value, "fixture.md", truth, undefined, { intent: decided }).map((item) => item.rule));
}

function intentWithout(id) {
  const changed = structuredClone(intent);
  changed.claims = changed.claims.filter((claim) => claim.id !== id);
  return changed;
}

function intentRecord(changed, id) {
  return changed.claims.find((claim) => claim.id === id);
}

// 2026-09-18: the founder kept the 10% withdrawal fee, so the committed intent file no longer carries
// the `withdrawal-free` record. The mechanism that record exercised stays in the lint for the next
// decided change, and the tests below keep proving it on a fixture: the record exactly as it stood
// from 17.09 to 18.09, added back onto the committed file.
const WITHDRAWAL_FREE_RECORD = {
  "id": "withdrawal-free",
  "claim": {
    "ru": "Вывод на кошелёк - без комиссии.",
    "en": "Withdrawal to a wallet carries no commission.",
    "uk": "Виведення на гаманець - без комісії."
  },
  "liveTruth": "withdrawal.defaultCommissionPercent",
  "target": 0,
  "status": "pending-product-change",
  "decision": "founder-approved",
  "note": "Live product still charges 10% and processes withdrawals manually; the backend change is the product-side half of this decision.",
  "pages": [
    "docs/pomoshch/darebay-vyvod-deneg.md",
    "docs/en/help/darebay-withdrawals.md",
    "docs/ua/dopomoha/darebay-vyvedennia-hroshei.md",
    "docs/pomoshch/kakaya-komissiya.md",
    "docs/en/help/what-commission.md",
    "docs/ua/dopomoha/yaka-komisiia.md"
  ]
};

function intentWithFreeWithdrawal() {
  const changed = structuredClone(intent);
  changed.decidedAt = "2026-09-17";
  changed.claims = [structuredClone(WITHDRAWAL_FREE_RECORD), ...changed.claims];
  return changed;
}

const DECIDED_FREE = intentWithFreeWithdrawal();

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

console.log("product_truth_lint: the decided target product");

// From 2026-09-17 to 2026-09-18 the founder had decided that the wallet withdrawal fee goes to 0%
// and that the public pages describe that target before the backend ships it; on 2026-09-18 the
// decision was reversed and the fee stays 10%. These are the wordings such a decision licenses,
// judged against the fixture above; against the committed file they fail again.
const FREE_WITHDRAWAL_WORDINGS = [
  "Withdrawals are free and have no platform fee.",
  "Вывод баланса без комиссии.",
  "Виведення без комісії.",
];
const ZERO_FEE_WORDINGS = [
  "The balance withdrawal fee is 0%.",
  "Комиссия за вывод баланса - 0%.",
  "Комісія за виведення балансу - 0%.",
];

test("the decided free withdrawal passes in all three locales while the record stands", () => {
  for (const wording of [...FREE_WITHDRAWAL_WORDINGS, ...ZERO_FEE_WORDINGS]) {
    assert.deepEqual(lintText(wording, "fixture.md", truth, undefined, { intent: DECIDED_FREE }), [], wording);
  }
});

test("the committed file (founder kept 10% on 2026-09-18) licenses no free withdrawal", () => {
  for (const wording of FREE_WITHDRAWAL_WORDINGS) assert(rules(wording).has("free-withdrawal"), wording);
  for (const wording of ZERO_FEE_WORDINGS) assert(rules(wording).has("withdrawal-fee"), wording);
  assert.equal(intentRecord(intent, "withdrawal-free"), undefined);
});

test("the licence names the record that granted it", () => {
  const allowed = [];
  lintText("Withdrawals are free and have no platform fee.", "fixture.md", truth, undefined,
    { intent: DECIDED_FREE, onAllowed: (allowance) => allowed.push(allowance) });
  assert.equal(allowed.length, 1);
  assert.equal(allowed[0].rule, "free-withdrawal");
  assert.equal(allowed[0].intentId, "withdrawal-free");
  assert.equal(allowed[0].message,
    "claim allowed by product-intent: withdrawal-free (pending product change, decided 2026-09-17)");

  const numeric = [];
  lintText("The balance withdrawal fee is 0%.", "fixture.md", truth, undefined,
    { intent: DECIDED_FREE, onAllowed: (allowance) => numeric.push(allowance) });
  assert.deepEqual(numeric.map((allowance) => allowance.rule), ["withdrawal-fee"]);
  assert.equal(numeric[0].intentId, "withdrawal-free");
});

test("the same claims fail again without the record, and without the file", () => {
  const dropped = structuredClone(DECIDED_FREE);
  dropped.claims = dropped.claims.filter((claim) => claim.id !== "withdrawal-free");
  for (const wording of FREE_WITHDRAWAL_WORDINGS) {
    assert(rulesWithIntent(wording, dropped).has("free-withdrawal"), wording);
    assert(rulesWithIntent(wording, null).has("free-withdrawal"), wording);
  }
  for (const wording of ZERO_FEE_WORDINGS) {
    assert(rulesWithIntent(wording, dropped).has("withdrawal-fee"), wording);
    assert(rulesWithIntent(wording, null).has("withdrawal-fee"), wording);
  }
});

// The money rules that were left hard on purpose: nothing in the intent file names them, so a
// page that promises automation, a minute-level SLA or every payout rail still fails.
test("a fee-free withdrawal wording is not read as automation, an SLA or a rail promise", () => {
  for (const wording of [...FREE_WITHDRAWAL_WORDINGS, ...ZERO_FEE_WORDINGS]) {
    const found = rulesWithIntent(wording, null);
    for (const rule of ["automatic-payout", "instant-payout-sla", "all-payout-methods"]) {
      assert(!found.has(rule), `${rule} fired on ${wording}`);
    }
  }
});

test("the recorded 10 USDT minimum licenses nothing: no-minimum claims still fail", () => {
  assert(rules("Withdraw any amount, no minimum withdrawal.").has("no-withdrawal-minimum"));
  assert(rules("Выводите любую сумму без минимума.").has("no-withdrawal-minimum"));
  assert(rules("Виведення без мінімуму: виводьте будь-яку суму.").has("no-withdrawal-minimum"));
  assert(rules("The minimum withdrawal request is 2 USDT.").has("withdrawal-minimum"));
});

test("a decided target relaxes its own field only", () => {
  assert(rules("Store purchase: 0%.").has("store-fee"));
  assert(rules("Комиссия за вывод баланса - 3%.").has("withdrawal-fee"));
});

test("the committed intent file agrees with the reviewed snapshot", () => {
  assert.deepEqual(validateProductIntent(intent, truth, { root }), []);
  assert.equal(intent.decidedAt, "2026-09-18");
  assert.deepEqual(intent.supersedes, ["2026-09-17 withdrawal-free"]);
  assert.deepEqual(validateProductIntent(DECIDED_FREE, truth, { root }), []);
});

test("an intent record that misstates the live product fails", () => {
  const pretendsLive = structuredClone(DECIDED_FREE);
  intentRecord(pretendsLive, "withdrawal-free").status = "matches-live";
  assert.match(validateProductIntent(pretendsLive, truth).join("\n"),
    /withdrawal\.defaultCommissionPercent is 10 and the target is 0/);

  const pretendsPending = structuredClone(intent);
  intentRecord(pretendsPending, "withdrawal-minimum").status = "pending-product-change";
  assert.match(validateProductIntent(pretendsPending, truth).join("\n"), /already equals the target 10/);

  const unknownPath = structuredClone(DECIDED_FREE);
  intentRecord(unknownPath, "withdrawal-free").liveTruth = "withdrawal.noSuchField";
  assert.match(validateProductIntent(unknownPath, truth).join("\n"), /does not exist in the reviewed product truth/);

  const unanchored = structuredClone(intent);
  intentRecord(unanchored, "cap-raise-only").status = "pending-product-change";
  assert.match(validateProductIntent(unanchored, truth).join("\n"), /liveTruth must name the value that has to move/);

  const duplicate = structuredClone(intent);
  duplicate.claims.push(structuredClone(intentRecord(duplicate, "rate-band")));
  assert.match(validateProductIntent(duplicate, truth).join("\n"), /is declared twice/);

  const missingPage = structuredClone(intent);
  intentRecord(missingPage, "rate-band").pages.push("docs/zarabotok/net-takoy-stranicy.md");
  assert.match(validateProductIntent(missingPage, truth, { root }).join("\n"), /lists a missing page/);
});

test("an unrecognised status fails the gate and licenses nothing", () => {
  const changed = structuredClone(DECIDED_FREE);
  intentRecord(changed, "withdrawal-free").status = "founder-approved";
  assert.match(validateProductIntent(changed, truth).join("\n"), /status must be one of/);
  assert(rulesWithIntent("Withdrawals are free and have no platform fee.", changed).has("free-withdrawal"));
});

test("a missing intent file is not an error and leaves every rule hard", () => {
  assert.deepEqual(validateProductIntent(null, truth), []);
  assert.equal(readProductIntent(join(root, "data/no-such-intent.json")), null);
  assert(rulesWithIntent("Withdrawals are free and have no platform fee.", null).has("free-withdrawal"));
});

console.log("product_truth_lint: contradictory claims");
test("free withdrawal claims fail against the live snapshot alone", () => {
  assert(rulesWithIntent("Withdrawals are free and have no platform fee.", null).has("free-withdrawal"));
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

test("the founder's Latin name is Ruslan Bei, across a line wrap and in a question", () => {
  assert(rules("The project was founded by **Ruslan Bey**.").has("founder-name-latin"));
  assert(rules("signed by its founder, Ruslan\nBey, who is answerable for it.").has("founder-name-latin"));
  assert(rules("### Who is Ruslan Bey?").has("founder-name-latin"));
  assert.deepEqual(lintText("Founded by **Ruslan Bei** (Руслан Бей).\nBeyond the byline, nothing changes.", "fixture.md", truth), []);
});

console.log("product_truth_lint: Russian and Ukrainian wordings");

// `\b` never matched beside a Cyrillic letter, so until 2026-09-17 every Russian and Ukrainian
// pattern written with it was a dead letter and these rules only ever judged English pages.
// Each rule is fed the smallest sentence in both languages it must cut, plus wording it must
// let through.
test("automatic payout promises fail in Russian and Ukrainian", () => {
  assert(rules("Выплата происходит автоматически.").has("automatic-payout"));
  assert(rules("Платформа автоматически переводит деньги.").has("automatic-payout"));
  assert(rules("Виплата відбувається автоматично.").has("automatic-payout"));
  assert(rules("Платформа автоматично переказує гроші.").has("automatic-payout"));
  assert.deepEqual(lintText("Мы не обещаем, что выплата происходит автоматически.", "fixture.md", truth), []);
  assert.deepEqual(lintText("Ми не обіцяємо, що виплата відбувається автоматично.", "fixture.md", truth), []);
});

test("minute-level settlement promises fail in Russian and Ukrainian", () => {
  assert(rules("Вывод обрабатывается в течение нескольких минут.").has("instant-payout-sla"));
  assert(rules("Виведення обробляється протягом кількох хвилин.").has("instant-payout-sla"));
  assert.deepEqual(lintText("Никто не обещает, что вывод проходит в течение нескольких минут.", "fixture.md", truth), []);
  assert.deepEqual(lintText("Ніхто не обіцяє, що виведення відбувається протягом кількох хвилин.", "fixture.md", truth), []);
});

test("promising every payout rail works fails in Russian and Ukrainian", () => {
  assert(rules("Работают все способы выплаты.").has("all-payout-methods"));
  assert(rules("Все пять способов выплаты доступны.").has("all-payout-methods"));
  assert(rules("Працюють усі способи виплати.").has("all-payout-methods"));
  assert(rules("Усі ці способи виплати працюють.").has("all-payout-methods"));
  assert.deepEqual(lintText("Способы выплаты зависят от задания.", "fixture.md", truth), []);
  assert.deepEqual(lintText("Способи виплати залежать від завдання.", "fixture.md", truth), []);
});

test("the retired commission refund fails in Russian and Ukrainian", () => {
  assert(rules("Часть комиссии возвращается, но лента не возвращается.").has("legacy-contest-commission-refund"));
  assert(rules("Частина комісії повертається, але промо не повертається.").has("legacy-contest-commission-refund"));
  assert.deepEqual(lintText("Комиссия за создание конкурса не взимается.", "fixture.md", truth), []);
  assert.deepEqual(lintText("Комісія за створення конкурсу не стягується.", "fixture.md", truth), []);
});

test("saying the organizer pays the creator fee fails in Russian and Ukrainian", () => {
  assert(rules("Комиссию платит заказчик, не автор.").has("organizer-pays-creator-fee"));
  assert(rules("Комісію платить замовник, а не автор.").has("organizer-pays-creator-fee"));
  assert.deepEqual(lintText("Комиссию за вывод платит автор, а не заказчик.", "fixture.md", truth), []);
  assert.deepEqual(lintText("Комісію за виведення платить автор, а не замовник.", "fixture.md", truth), []);
});

test("a transfer promised at contest close fails in Russian and Ukrainian", () => {
  assert(rules("В конце конкурса приз отправляется победителю.").has("contest-close-auto-transfer"));
  assert(rules("Наприкінці конкурсу приз надсилається переможцю.").has("contest-close-auto-transfer"));
  assert.deepEqual(lintText("Мы не обещаем, что в конце конкурса приз отправляется победителю в тот же день.", "fixture.md", truth), []);
  assert.deepEqual(lintText("Ми не обіцяємо, що наприкінці конкурсу приз надсилається переможцю того ж дня.", "fixture.md", truth), []);
});

test("live escrow claims fail in Russian and Ukrainian", () => {
  assert(rules("Деньги хранятся в эскроу.").has("live-on-chain-escrow"));
  assert(rules("Бюджет удерживается через смарт-контракт.").has("live-on-chain-escrow"));
  assert(rules("Кошти зберігаються в ескроу.").has("live-on-chain-escrow"));
  assert(rules("Бюджет утримується через смарт-контракт.").has("live-on-chain-escrow"));
  assert.deepEqual(lintText("Пока эскроу не запущен, никто не обещает, что деньги хранятся в эскроу.", "fixture.md", truth), []);
  assert.deepEqual(lintText("Поки ескроу не запущено, ніхто не обіцяє, що кошти зберігаються в ескроу.", "fixture.md", truth), []);
});

test("the retired 5% and 8% funding-method rates fail in Russian and Ukrainian", () => {
  assert(rules("Фиат: 5 %.").has("legacy-method-rate"));
  assert(rules("Криптовалюта и кошелёк: 8 %.").has("legacy-method-rate"));
  assert(rules("Фіат: 5 %.").has("legacy-method-rate"));
  assert(rules("Криптовалюта та гаманець: 8 %.").has("legacy-method-rate"));
  assert.deepEqual(lintText("Покупка в магазине: 8 %.", "fixture.md", truth), []);
  assert.deepEqual(lintText("Покупка в магазині: 8 %.", "fixture.md", truth), []);
});

test("a line-wrapped Russian or Ukrainian negation still suppresses a false positive", () => {
  assert.deepEqual(lintText("Это не значит, что после проверки будет\nавтоматическая выплата на кошелёк.", "fixture.md", truth), []);
  assert.deepEqual(lintText("Це не означає, що після перевірки буде\nавтоматична виплата на гаманець.", "fixture.md", truth), []);
  // A previous line that merely ends with the verb, without a negation, hides nothing.
  assert(rules("После проверки будет\nавтоматическая выплата на кошелёк.").has("automatic-payout"));
});

test("a Russian or Ukrainian wallet qualifier licenses a prize-lock sentence", () => {
  assert(rules("Приз заблокирован на платформе.").has("unqualified-prize-lock"));
  assert(rules("Приз заблокований на платформі.").has("unqualified-prize-lock"));
  assert.deepEqual(lintText("Только для кошелька: приз заблокирован на платформе.", "fixture.md", truth), []);
  assert.deepEqual(lintText("Лише для гаманця: приз заблокований на платформі.", "fixture.md", truth), []);
});

test("a Russian 'no fee' beside another operation's rate is not read as that rate", () => {
  assert.deepEqual(lintText("Создание конкурса без комиссии, а покупка в магазине — 8 %.", "fixture.md", truth), []);
  assert.deepEqual(lintText("Створення конкурсу без комісії, а покупка в магазині — 8 %.", "fixture.md", truth), []);
  assert(rules("Создание конкурса — 8 %.").has("contest-creation-fee"));
});

test("the Unicode boundary is a boundary: a stem inside a longer word does not fire", () => {
  assert.deepEqual(lintText("Заработают все способы продвижения.", "fixture.md", truth), []);
});

test("no pattern in the linter puts an ASCII \\b beside Cyrillic or a \\p{..} outside the u flag", () => {
  const source = readFileSync(join(root, "scripts/product-truth-lint.mjs"), "utf8").split("\n");
  const offenders = [];
  source.forEach((line, index) => {
    if (/^\s*\/\//.test(line)) return;
    if (/[Ѐ-ӿ]/.test(line) && line.includes("\\b")) offenders.push(`${index + 1}: ASCII \\b beside Cyrillic`);
    if (line.includes("\\p{") && !/\/[dgimsy]*u[dgimsy]*(?![\w$])/.test(line)) offenders.push(`${index + 1}: \\p{..} without the u flag`);
  });
  assert.deepEqual(offenders, []);
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

test("a help page stating no withdrawal fee passes only under the pending intent", () => {
  const fixture = mkdtempSync(join(tmpdir(), "product-truth-intent-canon-"));
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
    const intentIndex = productIntentIndex({
      schemaVersion: 1, decidedAt: "2026-09-17", source: "test", supersedes: [],
      claims: [{ id: "withdrawal-free", status: "pending-product-change", liveTruth: "withdrawal.defaultCommissionPercent", target: 0 }],
    });
    const en = "docs/en/help/darebay-withdrawals.md";
    const withIntent = checkCanonicalPages(fixture, truth, intentIndex).filter((item) => item.file === en);
    assert(!withIntent.some((item) => /withdrawal fee|per-user withdrawal override/.test(item.message)),
      `unexpected: ${JSON.stringify(withIntent)}`);
    const without = checkCanonicalPages(fixture, truth).filter((item) => item.file === en);
    assert(without.some((item) => /withdrawal fee/.test(item.message)));
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
