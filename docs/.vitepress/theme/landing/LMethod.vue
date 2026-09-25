<script setup lang="ts">
// "How this comparison was built": the page's own methodology text plus the
// full list of source pages with the date each number was taken.
import { useData } from 'vitepress'
import { computed } from 'vue'
import { sourceAnchor, sourceLabel } from '../../links'
import { LANDING_COPY, localeOf } from './copy'
import { DEFAULT_COLUMNS, comparisonUpdated, methodSources, pick } from './platforms'

const { frontmatter, lang } = useData()
const loc = computed(() => localeOf(lang.value))
const copy = computed(() => LANDING_COPY[loc.value])
const paragraphs = computed(() => (frontmatter.value.method ?? []) as string[])
// The same date the hero prints: a page whose figures were re-read (`hero.updated`) says so here too.
const updated = computed(() => comparisonUpdated(frontmatter.value))
const cfg = computed(() => (frontmatter.value.compare ?? {}) as { ids?: string[]; columns?: string[] })
const ids = computed(() => cfg.value.ids ?? [])
// Same columns the table above renders, so a per-country or page-only source (`payoutSpeed`) is
// listed exactly on the pages that print that column and nowhere else.
const columns = computed(() => cfg.value.columns ?? DEFAULT_COLUMNS)
// In the reader's language: two citations that open one address here are listed once. Each entry
// carries its number within its platform, the "[n]" the table prints in that platform's row
// (`methodSources` explains why the count restarts per platform).
const sources = computed(() => methodSources(pick(ids.value), columns.value, loc.value))
</script>

<template>
  <section class="lp-bleed lp-section" id="method">
    <div class="lp-section-head"><div><span class="lp-kicker">{{ copy.methodTitle }}</span></div></div>
    <div class="lp-method">
      <div>
        <p v-for="(t, i) in paragraphs" :key="i">{{ t }}</p>
        <p class="lp-muted" style="font-size:13px">{{ copy.snapshotNote }} {{ copy.updated }}: <time :datetime="updated">{{ updated }}</time>.</p>
      </div>
      <div>
        <span class="lp-kicker" style="display:block;margin-bottom:10px">{{ copy.sources }}</span>
        <!-- The space before <time> is text, not layout (the grid ignores it): without it a copied or
             extracted entry ran its address into its date, "…/campaign-9052026-09-18". -->
        <ul>
          <li v-for="s in sources" :key="s.name + s.url"><span><b style="color:var(--lp-text)">{{ s.name }}</b> <span class="src-n">[{{ s.n }}]</span> · <a v-bind="sourceAnchor(s.url, loc)">{{ sourceLabel(s.url, loc) }}</a></span>{{ ' ' }}<time :datetime="s.date">{{ s.date }}</time></li>
        </ul>
      </div>
    </div>
  </section>
</template>
