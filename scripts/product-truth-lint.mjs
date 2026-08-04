#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_TRUTH = join(DEFAULT_ROOT, "data/product-truth.json");

// Deliberate double-entry control. A real product-policy change must update the backend,
// the reviewed snapshot, this baseline and the public pages in one change. Editing only the
// JSON cannot silently redefine what the documentation gate considers true.
const REVIEWED_BASELINE = Object.freeze({
  contestCreationCommissionPercent: 0,
  contestTopUpCommissionPercent: 0,
  storeCommissionPercent: 8,
  withdrawalMinimumGrossAmount: 10,
  withdrawalCommissionPercent: 10,
  withdrawalProcessing: "manual",
  onChainEscrowLive: false,
  automaticBalanceWithdrawalRails: false,
});

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

const NO_FEE = /\b(?:no (?:fee|commission)|without (?:a )?(?:fee|commission))\b|без коміс(?:ії|си(?:и|й))|коміс(?:ія|ії) не (?:стягується|взимається)|комисс(?:ия|ии) не (?:взимается|бер[её]тся)/i;

const CLAIM_RULES = [
  {
    id: "free-withdrawal",
    patterns: [
      /\bwithdraw(?:al|ing)?s? (?:is|are|remains?|stays?) (?:completely )?free\b/i,
      /\bno (?:platform )?(?:withdrawal|payout) fee\b/i,
      /\bwithdraw(?:al|ing)?s?[^.\n]{0,30}without (?:a )?fee\b/i,
      /\bвывод(?: средств| денег| баланса)? (?:полностью )?бесплат(?:ен|ный|но)\b/i,
      /\bвывод[^.\n]{0,30}без комиссии\b/i,
      /\bкомисси(?:и|я) за вывод (?:нет|не взимается)\b/i,
      /\bвиведення(?: коштів| грошей| балансу)? (?:повністю )?безкоштовн(?:е|ий|о)\b/i,
      /\bвиведення[^.\n]{0,30}без комісії\b/i,
      /\bкомісі(?:ї|я) за виведення (?:немає|не стягується)\b/i,
    ],
  },
  {
    id: "no-withdrawal-minimum",
    patterns: [
      /\b(?:no|without a) minimum (?:withdrawal|payout)\b/i,
      /\bwithdraw[^.\n]{0,35}(?:any amount|from any amount)\b/i,
      /\bвывод[^.\n]{0,35}(?:без минимума|любую сумму|с любой суммы)\b/i,
      /\bвиведення[^.\n]{0,35}(?:без мінімуму|будь-яку суму|з будь-якої суми)\b/i,
    ],
  },
  {
    id: "automatic-payout",
    allowNegated: true,
    patterns: [
      /\b(?:payout|withdrawal|transfer|settlement)s? (?:is|are|runs?|happens?) automatic(?:ally)?\b/i,
      /\bautomatically (?:pay(?:s|ed)?|transfer(?:s|red)?|send(?:s|sent)?|withdraw(?:s|n)?|settles?)\b/i,
      /\b(?:paid|transferred|sent|withdrawn|settled) automatically\b/i,
      /\b(?:выплат[аы]|вывод|перевод|зачисление) (?:происходит |ид[её]т )?автоматическ(?:и|ий|ая)\b/i,
      /\bавтоматическ(?:и|ая|ий) (?:выплачивает|переводит|выводит|зачисляет|выплата|перевод)\b/i,
      /\b(?:виплат[аи]|виведення|переказ|зарахування) (?:відбувається |йде )?автоматичн(?:о|ий|а)\b/i,
      /\bавтоматичн(?:о|а|ий) (?:виплачує|переказує|виводить|зараховує|виплата|переказ)\b/i,
    ],
  },
  {
    id: "instant-payout-sla",
    allowNegated: true,
    patterns: [
      /\b(?:payout|withdrawal|transfer|settlement)[^.\n]{0,45}(?:arrives?|lands?|completes?|takes?|is processed)[^.\n]{0,20}(?:in|within) (?:a few |several )?minutes\b/i,
      /\b(?:money|funds)[^.\n]{0,30}(?:arrives?|lands?)[^.\n]{0,20}(?:in|within) (?:a few |several )?minutes\b/i,
      /\b(?:выплата|вывод|перевод|зачисление)[^.\n]{0,45}(?:приходит|занимает|проходит|обрабатывается)[^.\n]{0,20}(?:за|в течение) (?:нескольких |пары )?минут\b/i,
      /\b(?:виплата|виведення|переказ|зарахування)[^.\n]{0,45}(?:приходить|займає|відбувається|обробляється)[^.\n]{0,20}(?:за|протягом) (?:кількох |пари )?хвилин\b/i,
    ],
  },
  {
    id: "all-payout-methods",
    patterns: [
      /\ball (?:five|six|of these) (?:payout |withdrawal |reward )?(?:methods|options|ways) (?:work|are available|are supported)\b/i,
      /\b(?:card|bank|wallet|Stars|reward)[^.\n]{0,100}(?:all of these work|every one of them works)\b/i,
      /\bevery creator[^.\n]{0,50}(?:is paid|receives payment)[^.\n]{0,40}(?:way|method) (?:that )?(?:suits them|they choose|they prefer)\b/i,
      /\bвсе (?:пять|шесть|эти) (?:способа|способов|варианта|вариантов) (?:выплаты )?(?:работают|доступны|поддерживаются)\b/i,
      /\bработают все (?:способы|варианты)\b/i,
      /\bкаждый автор[^.\n]{0,60}(?:получает выплату|получает деньги)[^.\n]{0,40}(?:который выбрал|по своему выбору|как ему удобно)\b/i,
      /\bусі (?:п.?ять|шість|ці) (?:способи|варіанти) (?:виплати )?(?:працюють|доступні|підтримуються)\b/i,
      /\bпрацюють усі (?:способи|варіанти)\b/i,
      /\bкожен автор[^.\n]{0,60}(?:отримує виплату|отримує гроші)[^.\n]{0,40}(?:який обрав|за своїм вибором|як йому зручно)\b/i,
    ],
  },
  {
    id: "legacy-contest-commission-refund",
    patterns: [
      /\b(?:part|share) of the commission[^.\n]{0,80}(?:returns?|is returned)[^.\n]{0,80}(?:feed placement|promotion)[^.\n]{0,40}(?:does not|is not)\b/i,
      /\bчаст[ьи] комисси[^.\n]{0,80}возвращается[^.\n]{0,80}(?:лента|промо)[^.\n]{0,40}не возвращается\b/i,
      /\bчастина комісі[^.\n]{0,80}повертається[^.\n]{0,80}(?:стрічц|промо)[^.\n]{0,40}не повертається\b/i,
    ],
  },
  {
    id: "organizer-pays-creator-fee",
    patterns: [
      /\b(?:commission|fee) (?:is )?paid by the (?:buyer|organizer),? not the (?:creator|clipper)\b/i,
      /\bкомисси[юя] платит (?:заказчик|организатор),? не (?:автор|участник|нарезчик)\b/i,
      /\bкомісі[юя] платить (?:замовник|організатор),? а? ?не (?:автор|учасник|нарізальник)\b/i,
    ],
  },
  {
    id: "contest-close-auto-transfer",
    allowNegated: true,
    patterns: [
      /\b(?:at contest close|at the end of the contest|when the contest ends?)[^.\n]{0,80}(?:money|payout|prize)[^.\n]{0,35}(?:goes out|goes to|is sent|is transferred) (?:to )?(?:the )?winners?\b/i,
      /\b(?:в конце конкурса|при завершении конкурса|когда конкурс завершается)[^.\n]{0,80}(?:деньги|выплата|приз)[^.\n]{0,35}(?:уходит|переводится|отправляется) победител/i,
      /\b(?:наприкінці конкурсу|під час завершення конкурсу|коли конкурс завершується)[^.\n]{0,80}(?:гроші|виплата|приз)[^.\n]{0,35}(?:йде|переказується|надсилається) переможц/i,
    ],
  },
  {
    id: "live-on-chain-escrow",
    allowNegated: true,
    patterns: [
      /\b(?:funds|money|prize|budget) (?:is|are) (?:held|locked|released) (?:in|by|through) (?:an? )?(?:on[- ]chain )?(?:escrow|smart contract)\b/i,
      /\b(?:smart contract|on[- ]chain escrow) (?:holds|locks|releases|pays)\b/i,
      /\b(?:деньги|средства|приз|бюджет) (?:хранится|хранятся|заблокирован|удерживается|выплачивается) (?:в|через|смарт-контрактом) (?:он[- ]чейн )?(?:эскроу|смарт-контракт)\b/i,
      /\b(?:деньги|кошти|приз|бюджет) (?:зберігається|зберігаються|заблокований|утримується|виплачується) (?:в|через|смарт-контрактом) (?:он[- ]чейн )?(?:ескроу|смарт-контракт)\b/i,
    ],
  },
  {
    id: "legacy-method-rate",
    patterns: [
      /\b(?:fiat|bank card|card payment)[^.\n]{0,45}5\s*%/i,
      /\b(?:crypto|wallet|USDT)[^.\n]{0,45}8\s*%/i,
      /\b(?:фиат|банковская карта|оплата картой)[^.\n]{0,45}5\s*%/i,
      /\b(?:крипта|криптовалюта|кошел[её]к|USDT)[^.\n]{0,45}8\s*%/i,
      /\b(?:фіат|банківська картка|оплата карткою)[^.\n]{0,45}5\s*%/i,
      /\b(?:крипта|криптовалюта|гаманець|USDT)[^.\n]{0,45}8\s*%/i,
    ],
  },
];

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
  const prefix = `${previousLine} ${line.slice(Math.max(0, index - 180), index)}`.slice(-260).toLowerCase();
  return /(?:\b(?:not|never|cannot|can't|does not|doesn't|isn't|aren't|without|no promise of|no guarantee of)\b|(?:^|\s)(?:не|нет|без|немає|не обіцяє|не гарантується|не гарантируется)(?:\s|$))/.test(prefix);
}

function addViolation(out, rule, file, line, message) {
  out.push({ rule, file, line, message });
}

function numericPercentClaims(line, file, lineNumber, truth, out) {
  const facts = [
    ["contest-creation-fee", LANG.en.creation, truth.contest.creationCommissionPercent],
    ["contest-creation-fee", LANG.ru.creation, truth.contest.creationCommissionPercent],
    ["contest-creation-fee", LANG.ua.creation, truth.contest.creationCommissionPercent],
    ["contest-topup-fee", LANG.en.topUp, truth.contest.topUpCommissionPercent],
    ["contest-topup-fee", LANG.ru.topUp, truth.contest.topUpCommissionPercent],
    ["contest-topup-fee", LANG.ua.topUp, truth.contest.topUpCommissionPercent],
    ["store-fee", LANG.en.store, truth.store.commissionPercent],
    ["store-fee", LANG.ru.store, truth.store.commissionPercent],
    ["store-fee", LANG.ua.store, truth.store.commissionPercent],
    ["withdrawal-fee", LANG.en.withdrawal, truth.withdrawal.commissionPercent],
    ["withdrawal-fee", LANG.ru.withdrawal, truth.withdrawal.commissionPercent],
    ["withdrawal-fee", LANG.ua.withdrawal, truth.withdrawal.commissionPercent],
  ];

  for (const [rule, subject, expected] of facts) {
    const regex = new RegExp(`${subject}[^.%\\n]{0,100}?(\\d+(?:[.,]\\d+)?)\\s*%`, "ig");
    for (const match of line.matchAll(regex)) {
      if (expected === 0 && NO_FEE.test(match[0])) continue;
      const beforeSubject = line.slice(Math.max(0, match.index - 80), match.index);
      const expectedBefore = new RegExp(`${expected}\\s*%[^.%\\n]{0,75}$`, "i");
      if (expectedBefore.test(beforeSubject)) continue;
      const actual = Number(match[1].replace(",", "."));
      if (actual !== expected) {
        addViolation(out, rule, file, lineNumber,
          `claims ${actual}% but reviewed product truth is ${expected}%`);
      }
    }
  }
}

function numericMinimumClaims(line, file, lineNumber, truth, out) {
  const minimumSubjects = String.raw`(?:minimum (?:withdrawal )?(?:request|amount)|minimum withdrawal|минимальн(?:ая|ый) (?:заявка|сумма вывода)|мінімальн(?:а|ий) (?:заявка|сума виведення))`;
  const regex = new RegExp(`${minimumSubjects}[^.\\n]{0,60}?(\\d+(?:[.,]\\d+)?)\\s*USDT`, "ig");
  for (const match of line.matchAll(regex)) {
    const actual = Number(match[1].replace(",", "."));
    if (actual !== truth.withdrawal.minimumGrossAmount) {
      addViolation(out, "withdrawal-minimum", file, lineNumber,
        `claims ${actual} USDT but reviewed product truth is ${truth.withdrawal.minimumGrossAmount} USDT`);
    }
  }
}

export function lintText(text, file, truth) {
  const violations = [];
  const lines = stripFencedCode(text).split("\n");
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    numericPercentClaims(line, file, lineNumber, truth, violations);
    numericMinimumClaims(line, file, lineNumber, truth, violations);
    for (const rule of CLAIM_RULES) {
      for (const pattern of rule.patterns) {
        const match = pattern.exec(line);
        pattern.lastIndex = 0;
        if (!match || isQuestion(line)) continue;
        if (rule.allowNegated && isNegated(line, match.index, lines[index - 1] || "")) continue;
        addViolation(violations, rule.id, file, lineNumber,
          `contradicts reviewed product truth: ${match[0].trim()}`);
        break;
      }
    }
  });
  return violations;
}

export function validateTruthSnapshot(truth) {
  const errors = [];
  const check = (label, actual, expected) => {
    if (actual !== expected) errors.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  };
  check("schemaVersion", truth.schemaVersion, 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(truth.verifiedAt || "")) errors.push("verifiedAt must be YYYY-MM-DD");
  if (!/^[a-f0-9]{40}$/.test(truth.source?.verifiedCommit || "")) errors.push("source.verifiedCommit must be a full git SHA");
  check("contest.creationCommissionPercent", truth.contest?.creationCommissionPercent, REVIEWED_BASELINE.contestCreationCommissionPercent);
  check("contest.topUpCommissionPercent", truth.contest?.topUpCommissionPercent, REVIEWED_BASELINE.contestTopUpCommissionPercent);
  check("store.commissionPercent", truth.store?.commissionPercent, REVIEWED_BASELINE.storeCommissionPercent);
  check("withdrawal.minimumGrossAmount", truth.withdrawal?.minimumGrossAmount, REVIEWED_BASELINE.withdrawalMinimumGrossAmount);
  check("withdrawal.commissionPercent", truth.withdrawal?.commissionPercent, REVIEWED_BASELINE.withdrawalCommissionPercent);
  check("withdrawal.processing", truth.withdrawal?.processing, REVIEWED_BASELINE.withdrawalProcessing);
  check("withdrawal.fixedSettlementSla", truth.withdrawal?.fixedSettlementSla, null);
  check("onChainEscrow.live", truth.onChainEscrow?.live, REVIEWED_BASELINE.onChainEscrowLive);
  check("rewardMethods.automaticBalanceWithdrawalRails", truth.rewardMethods?.automaticBalanceWithdrawalRails, REVIEWED_BASELINE.automaticBalanceWithdrawalRails);
  for (const method of ["USDT_TON_EXTERNAL_WALLET", "TELEGRAM_STARS"]) {
    if (!truth.withdrawal?.wizardMethods?.includes(method)) errors.push(`withdrawal.wizardMethods must include ${method}`);
  }
  return errors;
}

function percentMarker(subject, value) {
  return new RegExp(`${subject}[^%\\n]{0,100}${value}\\s*%`, "i");
}

function canonicalSpecifications(truth) {
  const commission = (lang) => [
    ["contest creation fee", percentMarker(LANG[lang].creation, truth.contest.creationCommissionPercent)],
    ["contest top-up fee", percentMarker(LANG[lang].topUp, truth.contest.topUpCommissionPercent)],
    ["store fee", percentMarker(LANG[lang].store, truth.store.commissionPercent)],
    ["withdrawal fee", percentMarker(LANG[lang].withdrawal, truth.withdrawal.commissionPercent)],
    ["withdrawal minimum", new RegExp(`${truth.withdrawal.minimumGrossAmount}\\s*${truth.withdrawal.minimumCurrency}`, "i")],
    ["manual processing", LANG[lang].manual],
  ];
  const withdrawal = (lang) => [
    ["withdrawal fee", new RegExp(`${truth.withdrawal.commissionPercent}\\s*%`, "i")],
    ["withdrawal minimum", new RegExp(`${truth.withdrawal.minimumGrossAmount}\\s*${truth.withdrawal.minimumCurrency}`, "i")],
    ["manual processing", LANG[lang].manual],
    ["USDT withdrawal", /USDT/i],
    ["Telegram Stars withdrawal", /Telegram Stars/i],
  ];
  const legal = (lang) => [
    ["contest creation fee", percentMarker(LANG[lang].creation, truth.contest.creationCommissionPercent)],
    ["store fee", percentMarker(LANG[lang].store, truth.store.commissionPercent)],
    ["withdrawal fee", percentMarker(LANG[lang].withdrawal, truth.withdrawal.commissionPercent)],
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

export function checkCanonicalPages(root, truth) {
  const violations = [];
  for (const [file, , requirements, requireSnapshot] of canonicalSpecifications(truth)) {
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

export function lintRepository({ root = DEFAULT_ROOT, truthPath = join(root, "data/product-truth.json") } = {}) {
  const truth = JSON.parse(readFileSync(truthPath, "utf8"));
  const validation = validateTruthSnapshot(truth).map((message) => ({
    rule: "truth-snapshot", file: relative(root, truthPath), line: 1, message,
  }));
  const files = markdownFiles(join(root, "docs"));
  const content = files.flatMap((absolute) => {
    const file = relative(root, absolute).replaceAll("\\", "/");
    return lintText(readFileSync(absolute, "utf8"), file, truth);
  });
  const canonical = checkCanonicalPages(root, truth);
  return { truth, filesChecked: files.length, violations: [...validation, ...canonical, ...content] };
}

function runCli() {
  const rootArg = process.argv.indexOf("--root");
  const root = rootArg >= 0 ? resolve(process.argv[rootArg + 1]) : DEFAULT_ROOT;
  const truthArg = process.argv.indexOf("--truth");
  const truthPath = truthArg >= 0 ? resolve(process.argv[truthArg + 1]) : join(root, "data/product-truth.json");
  const result = lintRepository({ root, truthPath });
  if (result.violations.length) {
    console.error(`product_truth_lint: ${result.violations.length} violation(s)`);
    for (const violation of result.violations) {
      console.error(`${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
    }
    process.exit(1);
  }
  console.log(`product_truth_lint: OK (${result.filesChecked} markdown files; snapshot ${result.truth.verifiedAt})`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runCli();
