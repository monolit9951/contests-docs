<script setup lang="ts">
// Answer-first hero. The H1 is rendered HERE from the frontmatter title; the
// Markdown H1 is stripped by the covered-heading rule (dist gate: one h1).
// One reading column keeps long titles readable; the directory gets a wider introduction.
import { useData } from 'vitepress'
import { computed } from 'vue'
import type { DareBayThemeConfig } from '../../chrome'
import { LANDING_COPY, localeOf } from './copy'
import { DATA } from './platforms'

const { frontmatter, theme, lang, page } = useData<DareBayThemeConfig>()
const copy = computed(() => LANDING_COPY[localeOf(lang.value)])
const hero = computed(() => (frontmatter.value.hero ?? {}) as {
  kicker?: string; lede?: string; takeaways?: string[]; updated?: string; primary?: string
  secondary?: string; secondaryHref?: string
})
const hub = computed(() => (frontmatter.value.sectionHub ?? null) as { id: string; title: string; path: string | null } | null)
const brands = computed(() => hub.value?.id === 'brands')
const primaryHref = computed(() => (brands.value ? theme.value.darebayCta.businessUrl : theme.value.darebayCta.tasksUrl))
const primaryLabel = computed(() => hero.value.primary ?? (brands.value ? copy.value.bizCtaPrimary : copy.value.ctaPrimary))
const isHub = computed(() => Boolean(frontmatter.value.isHub))
const kicker = computed(() => hero.value.kicker ?? hub.value?.title ?? '')
const crumbHref = computed(() => (!isHub.value && hub.value?.path ? hub.value.path : null))
const updated = computed(() => hero.value.updated ?? (frontmatter.value.compare ? DATA.snapshot : (frontmatter.value.updated as string | null) ?? null))
const title = computed(() => String(frontmatter.value.title ?? ''))
const lede = computed(() => hero.value.lede ?? String(frontmatter.value.description ?? ''))
// The ghost button jumps to the section the page actually has. It used to be hardcoded to
// `#compare`, which only exists where the page renders <LCompare />: on the three "at a glance"
// pages the button read "See the fields" and led nowhere, because their section is <LFacts />
// (`#facts`). The dist gate `anchor-target` now fails the build on any such dead jump.
const secondaryHref = computed(() => hero.value.secondaryHref ?? '#compare')
// The byline names who signs the corpus. Hubs are directories, legal texts carry the
// operator's name in their own body and no Article node, and the author page would
// only link to itself.
const currentPath = computed(() => `/${page.value.relativePath.replace(/\.md$/, '').replace(/(^|\/)index$/, '$1')}`)
const showByline = computed(
  () => Boolean(theme.value.authorLink) && !isHub.value && hub.value?.id !== 'legal' && currentPath.value !== theme.value.authorLink?.path
)
</script>

<template>
  <section class="lp-hero" :class="{ 'lp-hero--hub': isHub }">
    <div class="lp-container lp-hero-in">
      <div>
        <div class="lp-hero-meta">
          <a v-if="crumbHref" class="lp-breadcrumb" :href="crumbHref"><span aria-hidden="true">←</span> {{ hub?.title }}</a>
          <span v-else-if="kicker" class="lp-kicker">{{ kicker }}</span>
          <span v-if="crumbHref && hero.kicker" class="lp-kicker">{{ hero.kicker }}</span>
          <span v-if="updated" class="lp-updated">{{ copy.updated }} <b><time :datetime="updated">{{ updated }}</time></b></span>
          <a v-if="showByline && theme.authorLink" class="lp-updated lp-byline" :href="theme.authorLink.path" rel="author">{{ copy.byline }} <b>{{ theme.authorLink.name }}</b></a>
        </div>
        <h1>{{ title }}</h1>
        <p v-if="lede" class="lp-lede">{{ lede }}</p>
        <div v-if="!isHub" class="lp-hero-ctas">
          <a class="lp-hero-action" :href="primaryHref" target="_self">{{ primaryLabel }}</a>
          <a v-if="hero.secondary" class="lp-hero-action lp-hero-action--secondary" :href="secondaryHref">{{ hero.secondary }} <span aria-hidden="true">↓</span></a>
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
