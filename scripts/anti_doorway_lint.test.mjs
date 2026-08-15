#!/usr/bin/env node
// Тесты anti_doorway_lint.mjs — без фреймворка.
//
// Зачем (2026-07-29): у гейта, который стоит на границе прода, не было ни одного теста. Две дыры
// прожили в нём всё время работы флота и нашлись только адверсариальным ревью:
//   1. «новизна» страницы выводилась из корпуса (urlMap), а корпус — само рабочее дерево, где
//      страница лежит по своему пути. Значит preexisting всегда false и ЛЮБАЯ правка считалась
//      новой страницей: 9 правок формулировок = «9 new seo pages > 8 per wave» = красный CI.
//   2. Фильтр содержит префикс хаба, а pathInfo требует ровно один сегмент slug.
//      Путь docs/zarabotok/2026/x.md заявлялся гейтируемым, тихо выпадал из цикла правил и при этом
//      попадал в счётчик «checked» — дорвей во вложенном каталоге уезжал в прод «проверенным».
// Каждый тест ниже — мутация: он обязан покраснеть, если соответствующую починку откатить.

// Зачем (2026-08-15, issue #287): DUP_THRESHOLD стоял на 0.8 при потолке живого корпуса 0.161 -
// гейт не мог сработать ни при каком содержании раздела и выдавал разрешение вместо проверки.
// Пятисловные шинглы по построению слепы к пересказу: десять страниц /zarabotok/ отвечали на один
// интент разными словами при j5 <= 0.133. Ниже к калибровке и к каждому новому правилу приложен
// тест-мутант: он обязан покраснеть, если порог вернуть наверх или правило снять.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runLint,
  normalizeHeading,
  sectionHeadings,
  DUP_THRESHOLD,
  PARAPHRASE_THRESHOLD,
} from "./anti_doorway_lint.mjs";

let failed = 0;
const ok = (n) => console.log(`  ok   ${n}`);
const bad = (n, d) => { console.log(`  FAIL ${n}\n       ${d}`); failed++; };
const check = (n, cond, d) => (cond ? ok(n) : bad(n, d));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "adl-"));
  const page = (rel, { seo = true, prov = true, body = "уникальный текст " + rel } = {}) => {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    const fm = ["---", "title: t", seo ? "seo: true" : "seo: false",
      prov ? 'provenance: { snapshot_date: "2026-07-01" }' : "", "---"].filter(Boolean).join("\n");
    writeFileSync(abs, `${fm}\n\n${body}\n`);
    return rel;
  };
  return { root, page, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

console.log("anti_doorway_lint: правило «новизны» считается по базе, а не по корпусу");
{
  const f = fixture();
  const zones = ["zarabotok", "brendam", "pomoshch", "o-proekte"];
  const changed = [];
  for (let i = 0; i < 9; i++) changed.push(f.page(`docs/${zones[i % zones.length]}/p${i}.md`, { body: `текст страницы номер ${i} ` .repeat(20) }));

  // ПРАВКИ: ни один файл не добавлен относительно базы → квота волны не тратится
  const edits = runLint({ corpusDir: "docs", changedFiles: changed, root: f.root, addedFiles: new Set() });
  check("9 правок существующих seo-страниц не жгут квоту волны",
    !edits.violations.some((v) => v.rule === "cap"),
    `получено: ${JSON.stringify(edits.violations.filter((v) => v.rule === "cap"))}`);

  // ДОБАВЛЕНИЯ: те же 9 файлов, но заявлены новыми → cap обязан сработать
  const adds = runLint({ corpusDir: "docs", changedFiles: changed, root: f.root, addedFiles: new Set(changed) });
  check("9 ДОБАВЛЕННЫХ seo-страниц роняют cap (правило не разоружено)",
    adds.violations.some((v) => v.rule === "cap" && /9 new semantic SEO pages/.test(v.msg)),
    `cap не сработал: ${JSON.stringify(adds.violations)}`);
  f.cleanup();
}

console.log("anti_doorway_lint: гейтируемый путь, который не разбирается как страница");
{
  const f = fixture();
  f.page("docs/zarabotok/normal.md");
  const nested = f.page("docs/zarabotok/2026/dorway.md");
  const res = runLint({ corpusDir: "docs", changedFiles: [nested], root: f.root, addedFiles: new Set([nested]) });
  check("вложенный путь в гейтируемой зоне = нарушение, а не тихий skip",
    res.violations.some((v) => v.rule === "path" && /exactly one slug segment/.test(v.msg)),
    `нарушения: ${JSON.stringify(res.violations)}`);
  check("он НЕ засчитан осмотренным",
    res.inspected === 0,
    `inspected=${res.inspected}, ожидался 0 — иначе гейт отчитается о странице, к которой не применил ни одного правила`);
  f.cleanup();
}

console.log("anti_doorway_lint: учёт осмотренного и пропущенного");
{
  const f = fixture();
  const a = f.page("docs/pomoshch/a.md", { body: "первый уникальный текст ".repeat(20) });
  const b = f.page("docs/zarabotok/b.md", { body: "второй непохожий текст ".repeat(20) });
  const gone = "docs/pomoshch/deleted.md";          // в диффе есть, на диске нет
  const human = "docs/legal/terms.md";             // негейтируемая зона
  const res = runLint({ corpusDir: "docs", changedFiles: [a, b, gone, human], root: f.root, addedFiles: new Set() });
  check("inspected считает только страницы, прошедшие все правила", res.inspected === 2, `inspected=${res.inspected}, ожидалось 2`);
  check("удаление уходит в skipped.deleted", res.skipped.deleted === 1, `skipped=${JSON.stringify(res.skipped)}`);
  check("негейтируемая зона уходит в skipped, а не в нарушения",
    res.skipped.nonpage + res.skipped.otherzone === 1 && !res.violations.some((v) => v.file === human),
    `skipped=${JSON.stringify(res.skipped)}, violations=${JSON.stringify(res.violations)}`);
  check("inspected + skipped покрывают весь вход",
    res.inspected + res.skipped.deleted + res.skipped.nonpage + res.skipped.otherzone === 4,
    `${res.inspected} + ${JSON.stringify(res.skipped)} != 4`);
  f.cleanup();
}

console.log("anti_doorway_lint: страничные правила не ослабли");
{
  const f = fixture();
  const red = f.page("docs/pomoshch/redirect.md", { body: '<meta http-equiv="refresh" content="0;url=/app">' });
  const noprov = f.page("docs/pomoshch/noprov.md", { prov: false, body: "текст без провенанса ".repeat(20) });
  const r1 = runLint({ corpusDir: "docs", changedFiles: [red], root: f.root, addedFiles: new Set() });
  check("redirect по-прежнему нарушение", r1.violations.some((v) => v.rule === "redirect"), JSON.stringify(r1.violations));
  const r2 = runLint({ corpusDir: "docs", changedFiles: [noprov], root: f.root, addedFiles: new Set() });
  check("provenance по-прежнему нарушение", r2.violations.some((v) => v.rule === "provenance"), JSON.stringify(r2.violations));
  f.cleanup();
}

console.log("anti_doorway_lint: переводы считаются одной semantic page")
{
  const f = fixture()
  const translations = [
    f.page("docs/zarabotok/skolko-platyat-za-1000-prosmotrov.md"),
    f.page("docs/ua/zarobitok/skilky-platiat-za-1000-perehliadiv.md"),
    f.page("docs/en/earnings/pay-per-1000-views.md"),
  ]
  const result = runLint({
    corpusDir: "docs",
    changedFiles: translations,
    root: f.root,
    addedFiles: new Set(translations),
  })
  check(
    "RU/UK/EN одного id расходуют одну квоту",
    result.stats.semanticNew === 1 && result.stats.semanticTotal === 1,
    `stats=${JSON.stringify(result.stats)}`
  )
  f.cleanup()
}

// ---------------------------------------------------------------------------------------------
// Калибровка порогов и правила против смыслового дублирования (issue #287).
// ---------------------------------------------------------------------------------------------

/** Последовательность различимых слов: шинглы получаются уникальными, и доля пересечения
 * считается ровно тем, что задумано, а не схлопыванием повторов в один элемент. */
const seq = (prefix, count, from = 0) =>
  Array.from({ length: count }, (_, i) => `${prefix}${from + i}`).join(" ");

const rulesOf = (res, rule) => res.violations.filter((v) => v.rule === rule);

console.log("anti_doorway_lint: порог копипасты откалиброван по корпусу, а не задан априори");
{
  const f = fixture();
  // Две страницы с общим блоком в 300 слов из 400: j5 ~ 0.60. При старом пороге 0.8 это
  // проходило гейт, хотя три четверти текста дословно общие.
  const shared = seq("obshchee", 300);
  const a = f.page("docs/zarabotok/copy-a.md", { body: `${shared} ${seq("levo", 100)}` });
  const b = f.page("docs/zarabotok/copy-b.md", { body: `${shared} ${seq("pravo", 100)}` });
  const res = runLint({ corpusDir: "docs", changedFiles: [a, b], root: f.root, addedFiles: new Set() });
  const dup = rulesOf(res, "duplicate");
  check("дословное переиспользование 3/4 текста = duplicate",
    dup.length === 2 && dup.every((v) => /jaccard=/.test(v.msg)),
    `duplicate не сработал при j5~0.60: ${JSON.stringify(res.violations)}`);
  check("порог копипасты опущен ниже трети (мутант: возврат к 0.8 красит тест)",
    DUP_THRESHOLD <= 0.35,
    `DUP_THRESHOLD=${DUP_THRESHOLD}; при потолке живого корпуса 0.161 порог 0.8 недостижим`);
  f.cleanup();
}

console.log("anti_doorway_lint: пересказ виден трёхсловным шинглам и невидим пятисловным");
{
  const f = fixture();
  // Обе страницы собраны из одних и тех же четырёхсловных блоков, переставленных и сшитых
  // разными связками. Общих пятисловных шинглов нет вовсе (j5 = 0), общих трёхсловных - четверть.
  // Это и есть дорвей раздела /zarabotok/: те же тезисы, другие слова вокруг них.
  const blocks = Array.from({ length: 60 }, (_, i) => seq(`tezis${i}x`, 4));
  const weave = (parts, glue) => parts.map((p, i) => (i ? `${glue}${i} ${p}` : p)).join(" ");
  const a = f.page("docs/zarabotok/retell-a.md", { body: weave(blocks, "svyazka") });
  const b = f.page("docs/zarabotok/retell-b.md", { body: weave([...blocks].reverse(), "perehod") });
  const res = runLint({ corpusDir: "docs", changedFiles: [a, b], root: f.root, addedFiles: new Set() });
  check("пересказ = paraphrase",
    rulesOf(res, "paraphrase").length === 2,
    `paraphrase не сработал: ${JSON.stringify(res.violations)}`);
  check("пятисловные шинглы этого не видят - значит правило добавляет сигнал, а не дублирует старое",
    rulesOf(res, "duplicate").length === 0,
    `duplicate сработал там, где j5=0: ${JSON.stringify(rulesOf(res, "duplicate"))}`);
  check("порог пересказа лежит ниже потолка дорвейного кластера корпуса (0.188)",
    PARAPHRASE_THRESHOLD < 0.188,
    `PARAPHRASE_THRESHOLD=${PARAPHRASE_THRESHOLD}`);
  f.cleanup();
}

console.log("anti_doorway_lint: нормальные страницы одного хаба остаются зелёными");
{
  const f = fixture();
  // 75 общих слов из 400 - это j5~0.098 и j3~0.101, то есть уровень p90 живого корпуса:
  // две честные страницы одной темы. Гейт, который красит это, бесполезен.
  const shared = seq("obshchee", 75);
  const a = f.page("docs/zarabotok/norm-a.md", { body: `${shared} ${seq("levo", 325)}` });
  const b = f.page("docs/zarabotok/norm-b.md", { body: `${shared} ${seq("pravo", 325)}` });
  const res = runLint({ corpusDir: "docs", changedFiles: [a, b], root: f.root, addedFiles: new Set() });
  check("общий словарь на уровне p90 корпуса не считается дублированием",
    !res.violations.some((v) => v.rule === "duplicate" || v.rule === "paraphrase"),
    `ложное срабатывание: ${JSON.stringify(res.violations)}`);
  f.cleanup();
}

const faqPage = (f, path, questions, { h2 = [], lead = null } = {}) =>
  f.page(path, {
    body: [
      lead ?? seq(path.replace(/[^a-z]/g, ""), 140),
      ...h2.map((title) => `## ${title}\n\n${seq(`${title.replace(/[^a-zа-я]/gi, "")}tekst`, 40)}`),
      "## Часто задаваемые вопросы",
      ...questions.map((q) => `### ${q}\n\n${seq(`otvet${q.length}`, 30)}`),
      "## Куда дальше",
      "- [Заработок](/zarabotok/)",
    ].join("\n\n"),
  });

console.log("anti_doorway_lint: один и тот же вопрос FAQ на N страницах хаба");
{
  const f = fixture();
  const pages = [
    faqPage(f, "docs/zarabotok/faq-a.md", ["Нужны ли подписчики?", "Сколько стоит участие?"]),
    faqPage(f, "docs/zarabotok/faq-b.md", ["Нужна ли аудитория или подписчики?", "Какие видео подходят?"]),
    faqPage(f, "docs/zarabotok/faq-c.md", ["Нужны ли подписчики, чтобы начать?", "Когда приходят деньги?"]),
  ];
  const res = runLint({ corpusDir: "docs", changedFiles: pages, root: f.root, addedFiles: new Set() });
  check("вопрос, повторённый на трёх страницах хаба = faq-echo",
    rulesOf(res, "faq-echo").length === 3,
    `faq-echo: ${JSON.stringify(rulesOf(res, "faq-echo"))}`);
  check("переформулировка считается тем же вопросом (иначе правило обходится синонимом)",
    rulesOf(res, "faq-echo").every((v) => /3 pages/.test(v.msg)),
    `эхо посчитано не по трём страницам: ${JSON.stringify(rulesOf(res, "faq-echo"))}`);
  check("разные вопросы не склеиваются: «когда приходят деньги» не эхо для «какие видео подходят»",
    !rulesOf(res, "faq-echo").some((v) => /какие видео|когда приходят/.test(v.msg)),
    `склеены разные вопросы: ${JSON.stringify(rulesOf(res, "faq-echo"))}`);
  f.cleanup();
}

console.log("anti_doorway_lint: две страницы вправе делить вопрос, а хаб-соседство обязательно");
{
  const f = fixture();
  const pair = [
    faqPage(f, "docs/zarabotok/pair-a.md", ["Нужны ли подписчики?"]),
    faqPage(f, "docs/zarabotok/pair-b.md", ["Нужны ли подписчики?"]),
  ];
  const r1 = runLint({ corpusDir: "docs", changedFiles: pair, root: f.root, addedFiles: new Set() });
  check("двух страниц с общим вопросом мало для нарушения",
    rulesOf(r1, "faq-echo").length === 0,
    `порог эха занижен: ${JSON.stringify(rulesOf(r1, "faq-echo"))}`);

  const third = faqPage(f, "docs/pomoshch/other-hub.md", ["Нужны ли подписчики?"]);
  const r2 = runLint({ corpusDir: "docs", changedFiles: [...pair, third], root: f.root, addedFiles: new Set() });
  check("третья страница в ДРУГОМ хабе эхо не создаёт",
    rulesOf(r2, "faq-echo").length === 0,
    `эхо посчитано через границу хаба: ${JSON.stringify(rulesOf(r2, "faq-echo"))}`);
  f.cleanup();
}

console.log("anti_doorway_lint: переводы одной страницы не эхо друг другу");
{
  const f = fixture();
  const translations = [
    faqPage(f, "docs/zarabotok/skolko-platyat-za-1000-prosmotrov.md", ["Как считаются просмотры?"]),
    faqPage(f, "docs/ua/zarobitok/skilky-platiat-za-1000-perehliadiv.md", ["Как считаются просмотры?"]),
    faqPage(f, "docs/en/earnings/pay-per-1000-views.md", ["Как считаются просмотры?"]),
  ];
  const res = runLint({ corpusDir: "docs", changedFiles: translations, root: f.root, addedFiles: new Set() });
  check("RU/UK/EN одного semantic id не образуют эхо из трёх страниц",
    rulesOf(res, "faq-echo").length === 0,
    `перевод засчитан дублем: ${JSON.stringify(rulesOf(res, "faq-echo"))}`);
  f.cleanup();
}

console.log("anti_doorway_lint: H2 - содержательные секции против сквозной вёрстки");
{
  const f = fixture();
  // У всех трёх и «Пример расчёта», и «Куда дальше». Первое - повторённая секция, второе -
  // обязательный блок домашнего стиля: он стоит на 13 из 15 страниц живого /zarabotok/.
  const pages = ["h2-a", "h2-b", "h2-c"].map((name) =>
    faqPage(f, `docs/zarabotok/${name}.md`, [`Вопрос страницы ${name}`], { h2: ["Пример расчёта"] })
  );
  const res = runLint({ corpusDir: "docs", changedFiles: pages, root: f.root, addedFiles: new Set() });
  const echoes = rulesOf(res, "heading-echo");
  check("одинаковая содержательная секция на трёх страницах хаба = heading-echo",
    echoes.length === 3 && echoes.every((v) => /пример расчета/.test(v.msg)),
    `heading-echo: ${JSON.stringify(echoes)}`);
  check("сквозной навигационный блок нарушением не считается",
    !res.violations.some((v) => /куда дальше/i.test(v.msg)),
    `«Куда дальше» попал в нарушения - гейт зальёт шумом весь корпус: ${JSON.stringify(echoes)}`);
  f.cleanup();
}

console.log("anti_doorway_lint: вопросом считается только H3 внутри секции FAQ");
{
  const f = fixture();
  const outside = ["out-a", "out-b", "out-c"].map((name) =>
    f.page(`docs/zarabotok/${name}.md`, {
      body: [
        seq(`telo${name.replace(/-/g, "")}`, 160),
        "## Как всё устроено",
        "### Нужны ли подписчики?",
        seq(`podrobno${name.replace(/-/g, "")}`, 60),
      ].join("\n\n"),
    })
  );
  const res = runLint({ corpusDir: "docs", changedFiles: outside, root: f.root, addedFiles: new Set() });
  check("H3 вне блока FAQ вопросом не считается",
    rulesOf(res, "faq-echo").length === 0,
    `подзаголовок текста учтён как вопрос FAQ: ${JSON.stringify(rulesOf(res, "faq-echo"))}`);
  f.cleanup();
}

console.log("anti_doorway_lint: разбор заголовков");
{
  check("нормализация снимает регистр, пунктуацию, разметку и ё",
    normalizeHeading("**Когда придёт   выплата?**") === "когда придет выплата",
    `получено: "${normalizeHeading("**Когда придёт   выплата?**")}"`);
  const parsed = sectionHeadings([
    "# Заголовок страницы",
    "## Пример расчёта",
    "### Не вопрос",
    "## Часто задаваемые вопросы",
    "### Нужны ли подписчики?",
    "```",
    "## Не заголовок, а код",
    "```",
    "### Когда приходят деньги?",
    "## Куда дальше",
  ].join("\n"));
  check("FAQ отделён от прочих секций, вёрстка отброшена, код не разбирается",
    parsed.faq.length === 2 &&
      parsed.faq[0] === "нужны ли подписчики" &&
      parsed.h2.length === 1 &&
      parsed.h2[0] === "пример расчета",
    `разбор: ${JSON.stringify(parsed)}`);
}

console.log("anti_doorway_lint: контракт вывода нарушений не изменился");
{
  const f = fixture();
  const pages = [
    faqPage(f, "docs/zarabotok/shape-a.md", ["Нужны ли подписчики?"], { h2: ["Пример расчёта"] }),
    faqPage(f, "docs/zarabotok/shape-b.md", ["Нужны ли подписчики?"], { h2: ["Пример расчёта"] }),
    faqPage(f, "docs/zarabotok/shape-c.md", ["Нужны ли подписчики?"], { h2: ["Пример расчёта"] }),
  ];
  const res = runLint({ corpusDir: "docs", changedFiles: pages, root: f.root, addedFiles: new Set() });
  check("каждое нарушение - это {rule, file, msg} со строковыми полями",
    res.violations.length > 0 &&
      res.violations.every((v) =>
        typeof v.rule === "string" && typeof v.file === "string" && typeof v.msg === "string"),
    `форма нарушений изменилась: ${JSON.stringify(res.violations)}`);
  check("новые правила приходят под собственными значениями rule",
    ["faq-echo", "heading-echo"].every((rule) => res.violations.some((v) => v.rule === rule)),
    `правила: ${JSON.stringify([...new Set(res.violations.map((v) => v.rule))])}`);
  f.cleanup();
}

console.log("");
if (failed === 0) { console.log("anti_doorway_lint.test: OK"); process.exit(0); }
console.log(`anti_doorway_lint.test: ${failed} проверок упало`);
process.exit(1);
