#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

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
  withdrawalDefaultCommissionPercent: 10,
  withdrawalProcessing: "manual",
  withdrawalPerUserOverrideSupported: true,
  manualPayoutPrizeFundsLocked: false,
  manualPayoutPlatformWalletInvolved: false,
  ppvLiveCpmMinimum: 0.08,
  ppvLiveCpmMedian: 0.5,
  ppvLiveCpmMaximum: 1,
  ppvTypicalMaxPerWork: 100,
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
      /\b(?:instant|immediate) payouts?\b/i,
      /\b(?:winner|creator)s? (?:is|are|get|gets|will be) paid (?:instantly|immediately|straight away)\b/i,
      /\b(?:money|funds|the prize) (?:goes|is sent|is transferred) (?:straight|directly) to (?:the )?(?:winner|creator)s?\b/i,
      /(?:победител|автор|участник)[а-яё]*[^.\n]{0,40}(?:сразу|мгновенно) (?:получает|получит|выплачивается|отправляют|переводят)/i,
      /(?:после окончания|когда заканчивается|при завершении) конкурса[^.\n]{0,80}(?:сразу |мгновенно )?(?:отправляют|переводят|выплачивают) (?:деньги|приз|выплату)/i,
      /(?:переможц|автор|учасник)[а-яіїєґ]*[^.\n]{0,40}(?:одразу|миттєво) (?:отримує|отримає|виплачується|надсилають|переказують)/i,
      /(?:після завершення|коли завершується|під час завершення) конкурсу[^.\n]{0,80}(?:одразу |миттєво )?(?:надсилають|переказують|виплачують) (?:гроші|приз|виплату)/i,
    ],
  },
  {
    id: "instant-payout-sla",
    allowNegated: true,
    patterns: [
      /\b(?:payout|withdrawal|transfer|settlement)[^.\n]{0,45}(?:arrives?|lands?|completes?|takes?|is processed)[^.\n]{0,20}(?:in|within) (?:a few |several )?minutes\b/i,
      /\b(?:money|funds)[^.\n]{0,30}(?:arrives?|lands?)[^.\n]{0,20}(?:in|within) (?:a few |several )?minutes\b/i,
      /\b(?:instant|immediate) (?:payout|withdrawal|settlement|transfer)s?\b/i,
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
      /\b(?:prize|funds|money|budget) (?:is|are) (?:secured|protected|guaranteed|safeguarded) by (?:a )?(?:blockchain |on[- ]chain )?(?:smart |escrow )?contract\b/i,
      /\b(?:blockchain|smart|escrow) contract (?:secures|protects|guarantees|safeguards) (?:the )?(?:prize|funds|money|budget)\b/i,
      /\b(?:деньги|средства|приз|бюджет) (?:хранится|хранятся|заблокирован|удерживается|выплачивается) (?:в|через|смарт-контрактом) (?:он[- ]чейн )?(?:эскроу|смарт-контракт)\b/i,
      /\b(?:деньги|кошти|приз|бюджет) (?:зберігається|зберігаються|заблокований|утримується|виплачується) (?:в|через|смарт-контрактом) (?:он[- ]чейн )?(?:ескроу|смарт-контракт)\b/i,
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
  const negation = /(?:\b(?:not|never|cannot|can't|does not|doesn't|isn't|aren't|without|no promise (?:of|that)|no guarantee (?:of|that))\b|(?:^|\s)(?:не|нет|без|немає|не обіцяє|не гарантується|не гарантируется)(?:\s|$))/;
  if (negation.test(clause) || /\bno (?:fixed )?(?:or )?$/i.test(clause)) return true;

  // Preserve a genuine line-wrapped clause, but do not let an unrelated sentence on
  // the previous line suppress a claim on this one.
  if (!currentPrefix.trim() && /(?:\b(?:can|cannot|can't|is|are|be|being|будет|буде|может|може)\s*)$/i.test(previousLine)) {
    return negation.test(previousLine.toLowerCase());
  }
  return false;
}

function isWalletQualified(line, previousLine = "") {
  const context = `${previousLine} ${line}`.toLowerCase();
  return /\bwallet[- ]backed\b|\bfunded (?:wallet )?(?:flow|contest|mode)\b|кошельков|кошелёчн|гаманцев|\b(?:only|только|лишь|лише) (?:for |для )?(?:wallet|кошел|гаман)/.test(context);
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
    ["withdrawal-fee", LANG.en.withdrawal, truth.withdrawal.defaultCommissionPercent],
    ["withdrawal-fee", LANG.ru.withdrawal, truth.withdrawal.defaultCommissionPercent],
    ["withdrawal-fee", LANG.ua.withdrawal, truth.withdrawal.defaultCommissionPercent],
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

  const paraphrases = [
    /(?:withdraw|withdrawal)[^.\n]{0,65}(?:once|when|from)[^.\n]{0,35}?(\d+(?:[.,]\d+)?)\s*USDT/ig,
    /(?:вывод|вывести)[^.\n]{0,65}(?:когда|после|от|с)[^.\n]{0,35}?(\d+(?:[.,]\d+)?)\s*USDT/ig,
    /(?:виведення|вивести)[^.\n]{0,65}(?:коли|після|від|з)[^.\n]{0,35}?(\d+(?:[.,]\d+)?)\s*USDT/ig,
  ];
  for (const pattern of paraphrases) {
    for (const match of line.matchAll(pattern)) {
      const actual = Number(match[1].replace(",", "."));
      if (actual !== truth.withdrawal.minimumGrossAmount) {
        addViolation(out, "withdrawal-minimum", file, lineNumber,
          `claims ${actual} USDT but reviewed product truth is ${truth.withdrawal.minimumGrossAmount} USDT`);
      }
    }
  }
}

function numericPpvClaims(line, file, lineNumber, truth, out) {
  // Marker presence is useful provenance, but the prose between a value and a marker can
  // itself contain numbers ("$1 per 1000 views"). Semantic range/cap checks below are
  // deliberately used instead of guessing which preceding number the marker annotates.
  const rangePatterns = [
    /(?:rates?[^.\n]{0,45}(?:run|range)|pay[^.\n]{0,20}from)\s*(?:from\s*)?\*?\*?\$?(\d+(?:[.,]\d+)?)\b[^.\n]{0,25}\bto\s*\*?\*?\$?(\d+(?:[.,]\d+)?)[^.\n]{0,35}(?:1000|1,000) views/ig,
    /(?:ставк[аи]|платят)[^.\n]{0,45}(?:от|від)\s*\*?\*?\$?(\d+(?:[.,]\d+)?)[^.\n]{0,25}(?:до)\s*\*?\*?\$?(\d+(?:[.,]\d+)?)[^.\n]{0,35}(?:1000|1 000) (?:просмотров|переглядів)/ig,
  ];
  for (const pattern of rangePatterns) {
    for (const match of line.matchAll(pattern)) {
      const low = Number(match[1].replace(",", "."));
      const high = Number(match[2].replace(",", "."));
      if (low !== truth.ppv.liveCpm.minimum || high !== truth.ppv.liveCpm.maximum) {
        addViolation(out, "ppv-live-rate-range", file, lineNumber,
          `claims ${low}-${high}; truth-pack live range is ${truth.ppv.liveCpm.minimum}-${truth.ppv.liveCpm.maximum}`);
      }
    }
  }

  const cap = /(?:(?:typical|current|типичн\w*|поточн\w*|типов\w*)[^.\n]{0,55}(?:cap|потолок|стеля)|(?:cap per (?:submission|work)|потолок на (?:одну )?работу|стеля на (?:одну )?роботу)[^.\n]{0,35}(?:typical|current|типичн\w*|поточн\w*|типов\w*)?)[^.\n]{0,55}\$\s*(\d+(?:[.,]\d+)?)/ig;
  for (const match of line.matchAll(cap)) {
    if (Number(match[1].replace(",", ".")) !== truth.ppv.typicalMaxPerWork) {
      addViolation(out, "ppv-typical-cap", file, lineNumber,
        `claims $${match[1]} typical cap; truth-pack value is $${truth.ppv.typicalMaxPerWork}`);
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
    numericPpvClaims(line, file, lineNumber, truth, violations);
    for (const rule of CLAIM_RULES) {
      for (const pattern of rule.patterns) {
        const match = pattern.exec(line);
        pattern.lastIndex = 0;
        if (!match || isQuestion(line)) continue;
        if (rule.allowNegated && isNegated(line, match.index, lines[index - 1] || "")) continue;
        if (rule.allowWalletQualified && isWalletQualified(line, lines[index - 1] || "")) continue;
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
  check("ppv.liveCpm.minimum", truth.ppv?.liveCpm?.minimum, REVIEWED_BASELINE.ppvLiveCpmMinimum);
  check("ppv.liveCpm.median", truth.ppv?.liveCpm?.median, REVIEWED_BASELINE.ppvLiveCpmMedian);
  check("ppv.liveCpm.maximum", truth.ppv?.liveCpm?.maximum, REVIEWED_BASELINE.ppvLiveCpmMaximum);
  check("ppv.typicalMaxPerWork", truth.ppv?.typicalMaxPerWork, REVIEWED_BASELINE.ppvTypicalMaxPerWork);
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

function canonicalSpecifications(truth) {
  const override = {
    en: /personal (?:fee |commission )?(?:rate |override)|per-user (?:fee |commission )?override/i,
    ru: /персональн(?:ая|ой) ставк|индивидуальн(?:ая|ой) комисси/i,
    ua: /персональн(?:а|ої) ставк|індивідуальн(?:а|ої) комісі/i,
  };
  const commission = (lang) => [
    ["contest creation fee", percentMarker(LANG[lang].creation, truth.contest.creationCommissionPercent)],
    ["contest top-up fee", percentMarker(LANG[lang].topUp, truth.contest.topUpCommissionPercent)],
    ["store fee", percentMarker(LANG[lang].store, truth.store.commissionPercent)],
    ["withdrawal fee", percentMarker(LANG[lang].withdrawal, truth.withdrawal.defaultCommissionPercent)],
    ["per-user withdrawal override", override[lang]],
    ["withdrawal minimum", new RegExp(`${truth.withdrawal.minimumGrossAmount}\\s*${truth.withdrawal.minimumCurrency}`, "i")],
    ["manual processing", LANG[lang].manual],
  ];
  const withdrawal = (lang) => [
    ["withdrawal fee", new RegExp(`${truth.withdrawal.defaultCommissionPercent}\\s*%`, "i")],
    ["per-user withdrawal override", override[lang]],
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
      [new RegExp(`живой диапазон: \\*\\*${truth.ppv.liveCpm.minimum} usd_per_1000_views – ${truth.ppv.liveCpm.maximum} usd_per_1000_views\\*\\* \\(медиана ${truth.ppv.liveCpm.median} usd_per_1000_views\\)`), "PPV live CPM range"],
      [new RegExp(`Потолок на работу \\(maxPerWork\\), типичный: \\*\\*${truth.ppv.typicalMaxPerWork} usd\\*\\*`), "PPV typical cap"],
      [/SelectionType: RANDOM, VIEWER_VOTING, CREATOR_DECISION, ORACLE_ATTESTED_POOL/, "selection types"],
    ];
    for (const [pattern, label] of requirements) {
      if (!pattern.test(facts)) errors.push(`truth-pack no longer matches ${label}`);
    }
  }

  return { checked, errors };
}

export function lintRepository({ root = DEFAULT_ROOT, truthPath = join(root, "data/product-truth.json") } = {}) {
  const truth = JSON.parse(readFileSync(truthPath, "utf8"));
  const validation = validateTruthSnapshot(truth).map((message) => ({
    rule: "truth-snapshot", file: relative(root, truthPath), line: 1, message,
  }));
  const provenance = verifySourceProvenance(truth);
  const sourceValidation = provenance.errors.map((message) => ({
    rule: "source-provenance", file: relative(root, truthPath), line: 1, message,
  }));
  const files = publicClaimFiles(root);
  const content = files.flatMap((absolute) => {
    const file = relative(root, absolute).replaceAll("\\", "/");
    return lintText(readFileSync(absolute, "utf8"), file, truth);
  });
  const canonical = checkCanonicalPages(root, truth);
  return { truth, filesChecked: files.length, sourcesChecked: provenance.checked,
    violations: [...validation, ...sourceValidation, ...canonical, ...content] };
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
  console.log(`product_truth_lint: OK (${result.filesChecked} public claim files; ${result.sourcesChecked} source repos; snapshot ${result.truth.verifiedAt})`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runCli();
