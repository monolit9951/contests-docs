<script setup lang="ts">
// The comparison table. Rows and columns come from frontmatter `compare`, the
// cells from data/platforms.json. Sorting is a client-side convenience; the
// server-rendered order is the page's editorial order.
import { useData } from 'vitepress'
import { computed, ref } from 'vue'
import { LANDING_COPY, localeOf } from './copy'
import { pick, sourceIndex, text, type Platform } from './platforms'

const DEFAULT_COLUMNS = ['rate', 'threshold', 'cap', 'fee', 'minPayout', 'payoutMethods', 'cis', 'followers', 'escrow']
const { frontmatter, lang } = useData()
const loc = computed(() => localeOf(lang.value))
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
const stateClass = (s?: string) => (s === 'yes' ? 'lp-chip lp-chip-good' : s === 'no' ? 'lp-chip lp-chip-bad' : s === 'partial' ? 'lp-chip lp-chip-warn' : 'lp-chip')
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
      <div class="lp-table-scroll">
        <table class="lp-table">
          <thead>
            <tr>
              <th scope="col">Platform</th>
              <th v-for="c in columns" :key="c" scope="col" :class="{ 'is-sorted': sortKey === c, desc: sortKey === c && desc }">
                <button type="button" @click="toggle(c)">{{ copy.columns[c] ?? c }}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in sorted" :key="p.id" :class="{ 'is-us': p.id === highlight }">
              <td class="lp-cell-name">
                <a v-if="p.id === highlight" :href="p.home?.[loc] ?? p.url">{{ p.name }}</a>
                <a v-else :href="p.url" target="_blank" rel="nofollow noopener">{{ p.name }}</a>
                <small v-if="p.bestFor?.[loc]">{{ p.bestFor[loc] }}</small>
              </td>
              <td v-for="c in columns" :key="c">
                <template v-if="p.fields[c]?.state && !text(p, c, loc)">
                  <span :class="stateClass(p.fields[c].state)">{{ copy.cis[p.fields[c].state!] }}</span>
                </template>
                <template v-else-if="text(p, c, loc)">
                  <span v-if="p.fields[c]?.state" :class="stateClass(p.fields[c].state)" style="margin-right:6px">{{ copy.cis[p.fields[c].state!] }}</span>
                  <span :class="{ 'lp-money': c === 'rate' || c === 'cap' || c === 'minPayout' }">{{ text(p, c, loc) }}</span>
                  <a v-if="p.fields[c]?.source?.url" class="lp-src" :href="p.fields[c].source!.url" target="_blank" rel="nofollow noopener" :title="p.fields[c].source!.date">{{ sourceIndex(p, p.fields[c].source!.url) }}</a>
                </template>
                <span v-else class="lp-na">{{ copy.notPublished }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="lp-table-note"><span>{{ copy.snapshotNote }}</span></div>
    </div>
  </section>
</template>
