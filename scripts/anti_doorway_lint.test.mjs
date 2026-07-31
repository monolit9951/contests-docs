#!/usr/bin/env node
// Тесты anti_doorway_lint.mjs — без фреймворка, запуск: node scripts/anti_doorway_lint.test.mjs
//
// Зачем (2026-07-29): у гейта, который стоит на границе прода, не было ни одного теста. Две дыры
// прожили в нём всё время работы флота и нашлись только адверсариальным ревью:
//   1. «новизна» страницы выводилась из корпуса (urlMap), а корпус — само рабочее дерево, где
//      страница лежит по своему пути. Значит preexisting всегда false и ЛЮБАЯ правка считалась
//      новой страницей: 9 правок формулировок = «9 new seo pages > 8 per wave» = красный CI.
//   2. GATED_RE содержит `.*` и перескакивает слеш, а pathInfo требует ровно один сегмент зоны.
//      Путь docs/ru/blog/2026/x.md заявлялся гейтируемым, тихо выпадал из цикла правил и при этом
//      попадал в счётчик «checked» — дорвей во вложенном каталоге уезжал в прод «проверенным».
// Каждый тест ниже — мутация: он обязан покраснеть, если соответствующую починку откатить.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLint } from "./anti_doorway_lint.mjs";

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
  const zones = ["faq", "zarabotok", "platformy", "kak-rabotaet", "blog"];
  const changed = [];
  for (let i = 0; i < 9; i++) changed.push(f.page(`docs/ru/${zones[i % 5]}/p${i}.md`, { body: `текст страницы номер ${i} ` .repeat(20) }));

  // ПРАВКИ: ни один файл не добавлен относительно базы → квота волны не тратится
  const edits = runLint({ corpusDir: "docs/ru", changedFiles: changed, root: f.root, addedFiles: new Set() });
  check("9 правок существующих seo-страниц не жгут квоту волны",
    !edits.violations.some((v) => v.rule === "cap"),
    `получено: ${JSON.stringify(edits.violations.filter((v) => v.rule === "cap"))}`);

  // ДОБАВЛЕНИЯ: те же 9 файлов, но заявлены новыми → cap обязан сработать
  const adds = runLint({ corpusDir: "docs/ru", changedFiles: changed, root: f.root, addedFiles: new Set(changed) });
  check("9 ДОБАВЛЕННЫХ seo-страниц роняют cap (правило не разоружено)",
    adds.violations.some((v) => v.rule === "cap" && /9 new seo pages/.test(v.msg)),
    `cap не сработал: ${JSON.stringify(adds.violations)}`);
  f.cleanup();
}

console.log("anti_doorway_lint: гейтируемый путь, который не разбирается как страница");
{
  const f = fixture();
  f.page("docs/ru/faq/normal.md");
  const nested = f.page("docs/ru/blog/2026/dorway.md");
  const res = runLint({ corpusDir: "docs/ru", changedFiles: [nested], root: f.root, addedFiles: new Set([nested]) });
  check("вложенный путь в гейтируемой зоне = нарушение, а не тихий skip",
    res.violations.some((v) => v.rule === "path" && /does not parse/.test(v.msg)),
    `нарушения: ${JSON.stringify(res.violations)}`);
  check("он НЕ засчитан осмотренным",
    res.inspected === 0,
    `inspected=${res.inspected}, ожидался 0 — иначе гейт отчитается о странице, к которой не применил ни одного правила`);
  f.cleanup();
}

console.log("anti_doorway_lint: учёт осмотренного и пропущенного");
{
  const f = fixture();
  const a = f.page("docs/ru/faq/a.md", { body: "первый уникальный текст ".repeat(20) });
  const b = f.page("docs/ru/zarabotok/b.md", { body: "второй непохожий текст ".repeat(20) });
  const gone = "docs/ru/faq/deleted.md";           // в диффе есть, на диске нет
  const human = "docs/legal/terms.md";             // негейтируемая зона
  const res = runLint({ corpusDir: "docs/ru", changedFiles: [a, b, gone, human], root: f.root, addedFiles: new Set() });
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
  const red = f.page("docs/ru/faq/redirect.md", { body: '<meta http-equiv="refresh" content="0;url=/app">' });
  const noprov = f.page("docs/ru/faq/noprov.md", { prov: false, body: "текст без провенанса ".repeat(20) });
  const r1 = runLint({ corpusDir: "docs/ru", changedFiles: [red], root: f.root, addedFiles: new Set() });
  check("redirect по-прежнему нарушение", r1.violations.some((v) => v.rule === "redirect"), JSON.stringify(r1.violations));
  const r2 = runLint({ corpusDir: "docs/ru", changedFiles: [noprov], root: f.root, addedFiles: new Set() });
  check("provenance по-прежнему нарушение", r2.violations.some((v) => v.rule === "provenance"), JSON.stringify(r2.violations));
  f.cleanup();
}

console.log("");
if (failed === 0) { console.log("anti_doorway_lint.test: OK"); process.exit(0); }
console.log(`anti_doorway_lint.test: ${failed} проверок упало`);
process.exit(1);
