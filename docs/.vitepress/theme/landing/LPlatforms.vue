<script setup lang="ts">
// One card per platform, same fields in the same order on every card, so a
// reader (or a model) can compare without re-reading prose.
import { useData } from 'vitepress'
import { computed } from 'vue'
import { LANDING_COPY, localeOf } from './copy'
import { pick, sourcesOf, text } from './platforms'

const CARD_FIELDS = ['rate', 'threshold', 'cap', 'fee', 'minPayout', 'payoutMethods', 'cis', 'escrow']
const { frontmatter, lang } = useData()
const loc = computed(() => localeOf(lang.value))
const copy = computed(() => LANDING_COPY[loc.value])
const cfg = computed(() => (frontmatter.value.cards ?? frontmatter.value.compare ?? {}) as { ids?: string[]; highlight?: string; fields?: string[] })
const rows = computed(() => pick(cfg.value.ids ?? []))
const fields = computed(() => cfg.value.fields ?? CARD_FIELDS)
const highlight = computed(() => cfg.value.highlight ?? 'darebay')
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }
// One link per source host: a platform documented across ten pages of one site is one source to the reader.
const hostSources = (p: Parameters<typeof sourcesOf>[0]) => {
  const seen = new Map<string, { url: string; date: string }>()
  for (const s of sourcesOf(p)) { const h = host(s.url); if (!seen.has(h)) seen.set(h, s) }
  return [...seen.entries()].map(([h, s]) => ({ host: h, ...s }))
}
</script>

<template>
  <section class="lp-bleed lp-section">
    <div class="lp-cards">
      <article v-for="(p, i) in rows" :key="p.id" class="lp-card" :class="{ 'is-us': p.id === highlight }" :id="'platform-' + p.id">
        <div class="lp-card-head">
          <div>
            <span class="lp-rank">{{ String(i + 1).padStart(2, '0') }}</span>
            <h3>
              <a v-if="p.id === highlight" :href="p.home?.[loc] ?? p.url" target="_self">{{ p.name }}</a>
              <a v-else :href="p.url" target="_blank" rel="nofollow noopener">{{ p.name }}</a>
            </h3>
          </div>
          <span v-if="p.bestFor?.[loc]" class="lp-chip" :class="{ 'lp-chip-accent': p.id === highlight }">{{ copy.bestFor }}: {{ p.bestFor[loc] }}</span>
        </div>
        <p v-if="p.summary?.[loc]" class="lp-card-sum">{{ p.summary[loc] }}</p>
        <dl class="lp-card-grid">
          <div v-for="f in fields" :key="f">
            <dt>{{ copy.columns[f] ?? f }}</dt>
            <dd>
              <template v-if="text(p, f, loc)">
                <span v-if="p.fields[f]?.state" :class="p.fields[f].state === 'yes' ? 'lp-chip lp-chip-good' : p.fields[f].state === 'no' ? 'lp-chip lp-chip-bad' : 'lp-chip lp-chip-warn'" style="margin-right:6px">{{ copy.cis[p.fields[f].state!] }}</span>
                <span :class="{ 'lp-money': f === 'rate' }">{{ text(p, f, loc) }}</span>
              </template>
              <span v-else-if="p.fields[f]?.state" :class="p.fields[f].state === 'yes' ? 'lp-chip lp-chip-good' : p.fields[f].state === 'no' ? 'lp-chip lp-chip-bad' : 'lp-chip'">{{ copy.cis[p.fields[f].state!] }}</span>
              <span v-else class="lp-na lp-muted">{{ copy.notPublished }}</span>
            </dd>
          </div>
        </dl>
        <div v-if="p.pros?.[loc]?.length || p.cons?.[loc]?.length" class="lp-card-pc">
          <div><div class="lp-kicker" style="margin-bottom:6px">{{ copy.pros }}</div><ul class="lp-pros"><li v-for="(x, k) in p.pros?.[loc] ?? []" :key="k">{{ x }}</li></ul></div>
          <div><div class="lp-kicker" style="margin-bottom:6px;color:var(--lp-bad)">{{ copy.cons }}</div><ul class="lp-cons"><li v-for="(x, k) in p.cons?.[loc] ?? []" :key="k">{{ x }}</li></ul></div>
        </div>
        <div class="lp-card-foot">
          <span class="lp-srcs">{{ copy.sources }}: <template v-for="(s, k) in hostSources(p)" :key="s.url"><a :href="s.url" target="_blank" rel="nofollow noopener" :title="s.date">{{ s.host }}</a><span v-if="k < hostSources(p).length - 1">, </span></template> · {{ copy.updated }} {{ hostSources(p)[0]?.date }}</span>
          <a v-if="p.id === highlight" class="lp-btn lp-btn-primary lp-btn-sm" :href="p.home?.[loc] ?? p.url" target="_self">{{ copy.ctaPrimary }}</a>
        </div>
      </article>
    </div>
  </section>
</template>
