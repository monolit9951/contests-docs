<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, onMounted, ref, watch } from 'vue'
import { data as hubs } from '../hubs.data'
import { localeOf } from './landing/copy'
import { CATALOG_COPY, TOPIC_LABELS, featuredPages, filterCatalog, groupCatalog, topicFor, type Topic } from './catalog'

const props = defineProps<{ hub: string }>()
const { lang } = useData()
const locale = computed(() => localeOf(lang.value))
const copy = computed(() => CATALOG_COPY[locale.value])
const labels = computed(() => TOPIC_LABELS[locale.value])
const pages = computed(() => hubs[props.hub]?.[locale.value] ?? [])
const query = ref('')
const activeTopic = ref<Topic | 'all'>('all')
const enhanced = ref(false)
onMounted(() => { enhanced.value = true })
const reset = () => { query.value = ''; activeTopic.value = 'all' }
watch([() => props.hub, locale], reset)
const filtered = computed(() => filterCatalog(pages.value, query.value, activeTopic.value, locale.value))
const groups = computed(() => groupCatalog(filtered.value))
const topics = computed(() => groupCatalog(pages.value))
const featured = computed(() => featuredPages(pages.value))
const isFiltered = computed(() => Boolean(query.value.trim()) || activeTopic.value !== 'all')
const arrow = computed(() => locale.value === 'ar' ? '←' : '→')
const number = (value: number) => new Intl.NumberFormat(locale.value, { minimumIntegerDigits: 2 }).format(value)
</script>

<template>
  <section v-if="pages.length" class="hub-directory" :aria-labelledby="`catalog-${hub}-title`">
    <div v-if="featured.length" class="hub-featured">
      <div class="hub-section-line"><h2>{{ copy.featured }}</h2><span aria-hidden="true">01 — 03</span></div>
      <div class="hub-feature-grid">
        <a v-for="(route, index) in featured" :key="route.page.id" :href="route.page.path" class="hub-feature" :class="`hub-feature--${route.kind}`">
          <div class="hub-feature-top"><span>{{ copy[route.kind] }}</span><span class="hub-feature-number" aria-hidden="true">{{ number(index + 1) }}</span></div>
          <div class="hub-feature-art" :class="`hub-feature-art--${route.kind}`" aria-hidden="true"><i></i><i></i><i></i></div>
          <h3>{{ route.page.title }}</h3>
          <p>{{ copy[`${route.kind}Note`] }}</p>
          <span class="hub-feature-link"><span>{{ copy.read }}</span><span aria-hidden="true">{{ arrow }}</span></span>
        </a>
      </div>
    </div>
    <div class="hub-catalog-heading">
      <div><span class="hub-eyebrow">{{ copy.kicker }}</span><h2 :id="`catalog-${hub}-title`">{{ copy.browse }}</h2></div>
      <span class="hub-total" aria-hidden="true">{{ number(pages.length) }}</span>
    </div>
    <!-- Controls reserve their final space in SSR; no-JS readers keep every link. -->
    <div class="hub-controls">
      <label class="hub-search" :for="`catalog-${hub}-search`">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
        <span class="hub-sr-only">{{ copy.search }}</span>
        <input :id="`catalog-${hub}-search`" v-model="query" type="search" :disabled="!enhanced" :placeholder="copy.placeholder" autocomplete="off" :aria-controls="`catalog-${hub}-results`" />
      </label>
      <div class="hub-filters" role="group" :aria-label="copy.topics">
        <button type="button" :disabled="!enhanced" :aria-pressed="activeTopic === 'all'" @click="activeTopic = 'all'">{{ copy.all }} <span>{{ pages.length }}</span></button>
        <button v-for="group in topics" :key="group.topic" type="button" :disabled="!enhanced" :aria-pressed="activeTopic === group.topic" @click="activeTopic = group.topic">{{ labels[group.topic] }} <span>{{ group.pages.length }}</span></button>
      </div>
    </div>
    <div class="hub-results-bar">
      <p role="status" aria-live="polite" aria-atomic="true">{{ copy.results }} <strong>{{ filtered.length }}</strong> {{ copy.of }} {{ pages.length }}</p>
      <button v-if="isFiltered" type="button" @click="reset">{{ copy.reset }} <span aria-hidden="true">×</span></button>
    </div>
    <div :id="`catalog-${hub}-results`" class="hub-results">
      <section v-for="group in groups" :key="group.topic" class="hub-topic" :aria-labelledby="`catalog-${hub}-${group.topic}`">
        <div class="hub-topic-heading"><h3 :id="`catalog-${hub}-${group.topic}`">{{ labels[group.topic] }}</h3><span>{{ number(group.pages.length) }}</span></div>
        <div class="hub-card-grid">
          <a v-for="(page, index) in group.pages" :key="page.id" class="hub-card" :href="page.path">
            <div class="hub-card-meta"><span>{{ labels[topicFor(page.id)] }}</span><span aria-hidden="true">{{ number(index + 1) }}</span></div>
            <h4>{{ page.title }}</h4>
            <p v-if="page.description">{{ page.description }}</p>
            <span class="hub-card-arrow" aria-hidden="true">{{ arrow }}</span>
          </a>
        </div>
      </section>
      <div v-if="!filtered.length" class="hub-empty"><h3>{{ copy.empty }}</h3><p>{{ copy.emptyNote }}</p><button type="button" @click="reset">{{ copy.reset }}</button></div>
    </div>
  </section>
</template>

<style scoped>
.hub-directory { padding-block: 12px 72px; min-width: 0; }
.hub-directory h2, .hub-directory h3, .hub-directory h4, .hub-directory p { margin: 0; }
.hub-directory button, .hub-directory input { font: inherit; }
.hub-directory a, .hub-directory button, .hub-directory input { -webkit-tap-highlight-color: transparent; }
.hub-directory a:focus-visible, .hub-directory button:focus-visible, .hub-directory input:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 5px; }
.hub-section-line { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-block-end: 18px; }
.hub-section-line h2 { font-size: 14px; font-weight: 650; color: var(--lp-muted); }
.hub-section-line > span { color: var(--lp-faint); font-size: 11px; letter-spacing: .12em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.hub-feature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.hub-featured { margin-block-end: 64px; }
.hub-feature { --feature-ink: #c8f542; display: flex; flex-direction: column; min-width: 0; position: relative; overflow: hidden; padding: 26px; border: 1px solid var(--lp-line-2); border-radius: 22px; background: linear-gradient(145deg, #172214 0%, var(--lp-panel) 70%); transition: border-color .18s, transform .18s; }
.hub-feature--calculate { --feature-ink: #75c9ff; background: linear-gradient(145deg, #132332 0%, var(--lp-panel) 70%); }
.hub-feature--choose { --feature-ink: #d6b6ff; background: linear-gradient(145deg, #251c34 0%, var(--lp-panel) 70%); }
.hub-feature:hover { border-color: var(--feature-ink); transform: translateY(-3px); }
.hub-feature-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; font-weight: 700; color: var(--feature-ink); }
.hub-feature-number { font-variant-numeric: tabular-nums; opacity: .75; }
.hub-feature-art { height: 52px; position: relative; margin-block: 20px; color: var(--feature-ink); }
.hub-feature-art i { display: block; position: absolute; border: 1px solid currentColor; }
.hub-feature-art--start i { width: 48px; height: 48px; border-radius: 50%; inset-inline-start: 0; top: 2px; opacity: .85; }
.hub-feature-art--start i:nth-child(2) { inset-inline-start: 22px; opacity: .5; }
.hub-feature-art--start i:nth-child(3) { inset-inline-start: 44px; opacity: .25; }
.hub-feature-art--calculate i { width: 20px; height: 20px; inset-inline-start: 0; bottom: 0; border-radius: 4px 4px 0 0; background: #75c9ff14; }
.hub-feature-art--calculate i:nth-child(2) { height: 36px; inset-inline-start: 29px; }
.hub-feature-art--calculate i:nth-child(3) { height: 52px; inset-inline-start: 58px; }
.hub-feature-art--choose i { width: 36px; height: 36px; inset-inline-start: 8px; top: 8px; transform: rotate(45deg); opacity: .85; border-radius: 4px; }
.hub-feature-art--choose i:nth-child(2) { inset-inline-start: 33px; opacity: .5; }
.hub-feature-art--choose i:nth-child(3) { inset-inline-start: 58px; opacity: .25; }
.hub-feature h3 { font-size: clamp(17px, 1.65vw, 21px); line-height: 1.4; font-weight: 700; letter-spacing: -.025em; overflow-wrap: anywhere; }
.hub-feature p { font-size: 13px; line-height: 1.6; color: var(--lp-muted); margin-block: 12px 24px; }
.hub-feature-link { margin-block-start: auto; display: flex; justify-content: space-between; gap: 10px; font-size: 12px; font-weight: 700; color: var(--feature-ink); }
.hub-feature-link > span:last-child { font-size: 20px; line-height: 1; }
.hub-catalog-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-block-end: 28px; }
.hub-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--lp-accent); }
.hub-catalog-heading h2 { font-size: clamp(23px, 3.2vw, 36px); line-height: 1.2; letter-spacing: -.045em; font-weight: 700; margin-block-start: 9px; text-wrap: balance; }
.hub-total { flex-shrink: 0; font-size: clamp(36px, 5.5vw, 64px); line-height: .95; font-weight: 500; letter-spacing: -.07em; color: var(--lp-faint); font-variant-numeric: tabular-nums; }
.hub-controls { padding: 20px; border: 1px solid var(--lp-line); border-radius: 18px; background: var(--lp-panel); }
.hub-search { display: flex; align-items: center; gap: 12px; max-width: 560px; padding: 12px 15px; background: var(--lp-bg); border: 1px solid var(--lp-line-2); border-radius: 10px; }
.hub-search:focus-within { border-color: var(--lp-accent); }
.hub-search svg { flex: 0 0 20px; width: 20px; height: 20px; color: var(--lp-faint); }
.hub-search input { background: transparent; border: 0; width: 100%; min-width: 0; color: var(--lp-text); font-size: 14px; line-height: 1.6; }
.hub-search input::placeholder { color: var(--lp-faint); opacity: 1; }
.hub-search input:focus-visible { outline: none; }
.hub-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-block-start: 16px; }
.hub-filters button { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--lp-line-2); border-radius: 999px; padding: 8px 12px; background: transparent; color: var(--lp-muted); font-size: 12px; line-height: 1.5; cursor: pointer; text-align: start; }
.hub-filters button span { font-size: 10px; opacity: .7; font-variant-numeric: tabular-nums; }
.hub-filters button:hover { border-color: var(--lp-faint); color: var(--lp-text); }
.hub-filters button[aria-pressed="true"] { background: var(--lp-accent); color: var(--lp-on-accent); border-color: var(--lp-accent); }
.hub-results-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 58px; font-size: 12px; color: var(--lp-faint); }
.hub-results-bar strong { font-weight: 650; color: var(--lp-text); }
.hub-results-bar button { padding: 8px 0; border: 0; background: transparent; color: var(--lp-accent); cursor: pointer; font-size: 12px; }
.hub-results-bar button span { margin-inline-start: 6px; }
.hub-topic + .hub-topic { margin-block-start: 36px; }
.hub-topic-heading { display: flex; align-items: center; gap: 12px; margin-block-end: 16px; }
.hub-topic-heading h3 { font-size: 16px; font-weight: 650; line-height: 1.4; }
.hub-topic-heading > span { font-size: 11px; color: var(--lp-faint); font-variant-numeric: tabular-nums; }
.hub-topic-heading::after { content: ''; flex: 1; height: 1px; background: var(--lp-line); margin-inline-start: 5px; }
.hub-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.hub-card { display: flex; flex-direction: column; align-items: flex-start; position: relative; min-width: 0; padding: 23px; border: 1px solid var(--lp-line); border-radius: 15px; background: var(--lp-panel); transition: border-color .18s, background .18s; }
.hub-card:hover { border-color: var(--lp-line-2); background: var(--lp-panel-2); }
.hub-card-meta { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; width: 100%; color: var(--lp-faint); font-size: 10px; line-height: 1.5; margin-block-end: 18px; }
.hub-card-meta > span:last-child { font-variant-numeric: tabular-nums; }
.hub-card h4 { font-size: 16px; font-weight: 700; line-height: 1.5; letter-spacing: -.018em; overflow-wrap: anywhere; }
.hub-card p { margin-block-start: 10px; color: var(--lp-muted); font-size: 12px; line-height: 1.75; overflow-wrap: anywhere; }
.hub-card-arrow { align-self: flex-end; margin-block-start: auto; padding-block-start: 20px; color: var(--lp-accent); font-size: 20px; line-height: 1; }
.hub-empty { border: 1px dashed var(--lp-line-2); border-radius: 16px; padding: 44px 24px; text-align: center; }
.hub-empty h3 { font-size: 20px; }.hub-empty p { color: var(--lp-muted); font-size: 14px; margin-block: 10px 20px; }
.hub-empty button { background: var(--lp-accent); color: var(--lp-on-accent); border: 0; border-radius: 999px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }
.hub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
@media (max-width: 960px) { .hub-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.hub-feature { padding: 22px; }.hub-feature-grid { gap: 12px; } }
@media (max-width: 640px) {
  .hub-directory { padding-block: 0 44px; }.hub-featured { margin-block-end: 42px; }.hub-feature-grid, .hub-card-grid { grid-template-columns: minmax(0, 1fr); }
  .hub-feature-grid { gap: 8px; }.hub-feature { padding: 15px 17px; padding-inline-end: 44px; min-height: 0; border-radius: 12px; }.hub-feature-art, .hub-feature-number, .hub-feature p, .hub-feature-link > span:first-child { display: none; }
  .hub-feature-top { font-size: 10px; }.hub-feature h3 { margin-block-start: 7px; font-size: 15px; line-height: 1.45; }.hub-feature-link { position: absolute; inset-inline-end: 16px; top: 50%; transform: translateY(-50%); }
  .hub-catalog-heading { gap: 16px; margin-block-end: 22px; }.hub-controls { padding: 14px; }.hub-search { max-width: none; }.hub-search input { font-size: 16px; }
  .hub-filters { gap: 7px; }.hub-filters button { padding: 8px 10px; font-size: 11px; }.hub-filters button span { display: none; }.hub-card { padding: 22px; }.hub-card-meta { margin-block-end: 13px; }.hub-card h4 { font-size: 17px; }.hub-card p { font-size: 13px; }.hub-card-arrow { padding-block-start: 16px; }.hub-topic + .hub-topic { margin-block-start: 29px; }
}
@media (prefers-reduced-motion: reduce) { .hub-feature, .hub-card { transition: none; }.hub-feature:hover { transform: none; } }
</style>
