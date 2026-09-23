<script setup lang="ts">
// "How this comparison was built": the page's own methodology text plus the
// full list of source pages with the date each number was taken.
import { useData } from 'vitepress'
import { computed } from 'vue'
import { sourceAnchor, sourceLabel } from '../../links'
import { LANDING_COPY, localeOf } from './copy'
import { DEFAULT_COLUMNS, pick, sourcesOf, DATA } from './platforms'

const { frontmatter, lang } = useData()
const loc = computed(() => localeOf(lang.value))
const copy = computed(() => LANDING_COPY[loc.value])
const paragraphs = computed(() => (frontmatter.value.method ?? []) as string[])
const cfg = computed(() => (frontmatter.value.compare ?? {}) as { ids?: string[]; columns?: string[] })
const ids = computed(() => cfg.value.ids ?? [])
// Same columns the table above renders, so a per-country source is listed exactly on the pages
// that print the country column and nowhere else.
const columns = computed(() => cfg.value.columns ?? DEFAULT_COLUMNS)
// In the reader's language: two citations that open one address here are listed once, and the
// table's superscripts (`sourceIndex` with the same locale) count the same list.
const sources = computed(() => pick(ids.value).flatMap((p) => sourcesOf(p, columns.value, loc.value).map((s) => ({ name: p.name, ...s }))))
</script>

<template>
  <section class="lp-bleed lp-section" id="method">
    <div class="lp-section-head"><div><span class="lp-kicker">{{ copy.methodTitle }}</span></div></div>
    <div class="lp-method">
      <div>
        <p v-for="(t, i) in paragraphs" :key="i">{{ t }}</p>
        <p class="lp-muted" style="font-size:13px">{{ copy.snapshotNote }} {{ copy.updated }}: <time :datetime="DATA.snapshot">{{ DATA.snapshot }}</time>.</p>
      </div>
      <div>
        <span class="lp-kicker" style="display:block;margin-bottom:10px">{{ copy.sources }}</span>
        <ul>
          <li v-for="s in sources" :key="s.name + s.url"><span><b style="color:var(--lp-text)">{{ s.name }}</b> · <a v-bind="sourceAnchor(s.url, loc)">{{ sourceLabel(s.url, loc) }}</a></span><time :datetime="s.date">{{ s.date }}</time></li>
        </ul>
      </div>
    </div>
  </section>
</template>
