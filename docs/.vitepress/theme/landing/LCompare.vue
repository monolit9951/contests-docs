<script setup lang="ts">
// The comparison table. Rows and columns come from frontmatter `compare`, the
// cells from data/platforms.json. Sorting is a client-side convenience; the
// server-rendered order is the page's editorial order.
import { useData } from 'vitepress'
import { computed, ref } from 'vue'
import { sourceAnchor, sourceLabel } from '../../links'
import { appLocaleOf } from '../../registry'
import { LANDING_COPY, localeOf } from './copy'
import { DEFAULT_COLUMNS, bidiAttrs, pick, sourceIndex, text, textLang, type Platform } from './platforms'

const { frontmatter, lang } = useData()
const loc = computed(() => localeOf(lang.value))
// DareBay's own row links into the product, in the application tree this reader is sent to.
const appLoc = computed(() => appLocaleOf(loc.value))
const copy = computed(() => LANDING_COPY[loc.value])
const cfg = computed(() => (frontmatter.value.compare ?? {}) as { ids?: string[]; columns?: string[]; highlight?: string; title?: string; note?: string })
const columns = computed(() => cfg.value.columns ?? DEFAULT_COLUMNS)
const rows = computed(() => pick(cfg.value.ids ?? []))
const highlight = computed(() => cfg.value.highlight ?? 'darebay')

const sortKey = ref<string | null>(null)
const desc = ref(false)
const sorted = computed<Platform[]>(() => {
  const list = [...rows.value]
  const key = sortKey.value
  if (!key) return list
  const num = (p: Platform) => p.fields[key]?.value
  const has = list.some((p) => typeof num(p) === 'number')
  list.sort((a, b) => {
    if (has) {
      const x = num(a), y = num(b)
      if (typeof x !== 'number') return 1
      if (typeof y !== 'number') return -1
      return desc.value ? y - x : x - y
    }
    const x = text(a, key, loc.value), y = text(b, key, loc.value)
    return desc.value ? y.localeCompare(x) : x.localeCompare(y)
  })
  return list
})
const toggle = (key: string) => {
  if (sortKey.value === key) desc.value = !desc.value
  else { sortKey.value = key; desc.value = false }
}
// A chip's colour says whether its state helps the clipper. In most columns "yes" does (it pays
// here, it holds the budget), but in "Followers required" a "yes" is the barrier: without this
// the one board that demands followers read green and every board that needs none, red.
const INVERTED = new Set(['followers'])
const stateClass = (s?: string, c?: string) => {
  const good = INVERTED.has(c ?? '') ? 'no' : 'yes'
  const bad = INVERTED.has(c ?? '') ? 'yes' : 'no'
  return s === good ? 'lp-chip lp-chip-good' : s === bad ? 'lp-chip lp-chip-bad' : s === 'partial' ? 'lp-chip lp-chip-warn' : 'lp-chip'
}
// A cell's source marker is `<sup class="lp-ref">` holding a hair space (&#8202;) and a bracketed
// number, the same shape as the article markers (`sourceRefHtml` in sources.ts): the cell's text
// reads "$1–$10 [1]" when copied or extracted, never "$1–$101". The number is the platform's own
// source number, the one "How this comparison was built" prints after its name (`methodSources`);
// its title names the address and the date, for a pointer and for assistive tech.
//
// Every cell whose field has a source carries the marker, whatever the cell prints: a figure, a
// chip alone, or "not published". "Not published" is a claim about a competitor too, and the page
// it was checked on is its source; before 2026-09-24 those cells were the table's only unsourced
// claims, while "How this comparison was built" listed their pages all the same.
//
// The `{{ ' ' }}` below are text, not spacing. Vue drops the whitespace between two elements on
// separate lines, so the chip ran into the value ("yesyes: the budget is held…") and the name into
// its "best for" line ("Whop Content RewardsUS/EU clippers…") for anyone reading the page as text.
// `check:dist` (extracted-text gate) fails the build if a pair like that comes back.
</script>

<template>
  <section id="compare" class="lp-bleed lp-section">
    <div class="lp-section-head">
      <div>
        <span class="lp-kicker">{{ cfg.title ?? copy.compareTitle }}</span>
        <p>{{ cfg.note ?? copy.compareNote }}</p>
      </div>
    </div>
    <div class="lp-table-wrap">
      <div class="lp-table-scroll" role="region" :aria-label="cfg.title ?? copy.compareTitle" tabindex="0">
        <table class="lp-table">
          <thead>
            <tr>
              <th scope="col">{{ copy.platform }}</th>
              <th v-for="c in columns" :key="c" scope="col" :aria-sort="sortKey === c ? (desc ? 'descending' : 'ascending') : 'none'" :class="{ 'is-sorted': sortKey === c, desc: sortKey === c && desc }">
                <button type="button" @click="toggle(c)">{{ copy.columns[c] ?? c }}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in sorted" :key="p.id" :class="{ 'is-us': p.id === highlight }">
              <td class="lp-cell-name">
                <a v-if="p.id === highlight" :href="p.home?.[appLoc] ?? p.url" target="_self">{{ p.name }}</a>
                <a v-else v-bind="sourceAnchor(p.url, loc)">{{ p.name }}</a>
                <template v-if="p.bestFor?.[loc]">{{ ' ' }}<small>{{ p.bestFor[loc] }}</small></template>
              </td>
              <td v-for="c in columns" :key="c">
                <span v-if="p.fields[c]?.state && !text(p, c, loc)" :class="stateClass(p.fields[c].state, c)">{{ copy.cis[p.fields[c].state!] }}</span>
                <template v-else-if="text(p, c, loc)">
                  <template v-if="p.fields[c]?.state"><span :class="stateClass(p.fields[c].state, c)" style="margin-inline-end:2px">{{ copy.cis[p.fields[c].state!] }}</span>{{ ' ' }}</template>
                  <span v-bind="bidiAttrs(textLang(p, c, loc), loc)" :class="{ 'lp-money': c === 'cpm' || c === 'rate' || c === 'cap' || c === 'minPayout' }">{{ text(p, c, loc) }}</span>
                </template>
                <span v-else class="lp-na">{{ copy.notPublished }}</span>
                <sup v-if="p.fields[c]?.source?.url" class="lp-ref">&#8202;<a class="lp-src" v-bind="sourceAnchor(p.fields[c].source!.url, loc)" :title="`${sourceLabel(p.fields[c].source!.url, loc)} · ${p.fields[c].source!.date}`">[{{ sourceIndex(p, p.fields[c].source!.url, columns, loc) }}]</a></sup>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="lp-table-note"><span>{{ copy.snapshotNote }}</span></div>
    </div>
  </section>
</template>
