<script setup lang="ts">
// Answer-first hero. The H1 is rendered HERE from the frontmatter title; the
// Markdown H1 is stripped by the covered-heading rule (dist gate: one h1).
// Two shapes: comparison pages carry `hero.takeaways` and get the two-column
// hero; every other page gets the compact one: section breadcrumb, title,
// the description as lede, the product CTA.
import { useData } from 'vitepress'
import { computed } from 'vue'
import type { DareBayThemeConfig } from '../../chrome'
import { LANDING_COPY, localeOf } from './copy'
import { DATA } from './platforms'

const { frontmatter, theme, lang } = useData<DareBayThemeConfig>()
const copy = computed(() => LANDING_COPY[localeOf(lang.value)])
const hero = computed(() => (frontmatter.value.hero ?? {}) as {
  kicker?: string; lede?: string; takeaways?: string[]; updated?: string; primary?: string; secondary?: string
})
const hub = computed(() => (frontmatter.value.sectionHub ?? null) as { id: string; title: string; path: string | null } | null)
const isHub = computed(() => Boolean(frontmatter.value.isHub))
const compact = computed(() => !hero.value.takeaways?.length)
const kicker = computed(() => hero.value.kicker ?? hub.value?.title ?? '')
const crumbHref = computed(() => (!isHub.value && !hero.value.kicker && hub.value?.path ? hub.value.path : null))
const updated = computed(() => hero.value.updated ?? (frontmatter.value.compare ? DATA.snapshot : (frontmatter.value.updated as string | null) ?? null))
const title = computed(() => String(frontmatter.value.title ?? ''))
const lede = computed(() => hero.value.lede ?? String(frontmatter.value.description ?? ''))
</script>

<template>
  <section class="lp-hero" :class="{ 'lp-hero--compact': compact, 'lp-hero--hub': isHub }">
    <div class="lp-container lp-hero-in">
      <div>
        <div class="lp-hero-meta">
          <a v-if="crumbHref" class="lp-kicker" :href="crumbHref">{{ kicker }}</a>
          <span v-else-if="kicker" class="lp-kicker">{{ kicker }}</span>
          <span v-if="updated" class="lp-updated">{{ copy.updated }} <b><time :datetime="updated">{{ updated }}</time></b></span>
        </div>
        <h1>{{ title }}</h1>
        <p v-if="lede" class="lp-lede">{{ lede }}</p>
        <div class="lp-hero-ctas">
          <a class="lp-btn lp-btn-primary" :href="theme.darebayCta.productUrl" target="_self">{{ hero.primary ?? copy.ctaPrimary }}</a>
          <a v-if="hero.secondary" class="lp-btn lp-btn-ghost" href="#compare">{{ hero.secondary }}</a>
        </div>
      </div>
      <aside v-if="hero.takeaways?.length" class="lp-takeaways" :aria-label="copy.keyTakeaways">
        <span class="lp-kicker">{{ copy.keyTakeaways }}</span>
        <ol>
          <li v-for="(t, i) in hero.takeaways" :key="i"><span v-html="t"></span></li>
        </ol>
      </aside>
    </div>
  </section>
</template>
