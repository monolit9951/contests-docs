<script setup lang="ts">
// Answer-first hero. The H1 is rendered HERE from the frontmatter title; the
// Markdown H1 is stripped by the covered-heading rule (dist gate: one h1).
// One reading column keeps long titles readable; the directory gets a wider introduction.
//
// A showcase hub index (`showcase: true`) gets a landing hero: up to two real buttons, each named by
// CTA key or a jump to a block of the page (`hero.actions`), a line of microcopy under them
// (`hero.note`), short proof chips (`hero.proof`), an optional side door (`hero.fork`) and the
// section's own drawing. All of it is server-rendered and works without JavaScript; the drawing is
// page data (`frontmatter.art.hero`, put there by the build from `art.ts`), so no other page and
// not the theme chunk carries it.
import { useData } from 'vitepress'
import { computed } from 'vue'
import type { DareBayThemeConfig } from '../../chrome'
import { LANDING_COPY, formatDay, headingHtml, localeOf } from './copy'
import { DATA } from './platforms'
import { ctaButton, heroAction, isCreatorSection, type CtaSpec, type LinkButton } from './showcase'

const { frontmatter, theme, lang, page } = useData<DareBayThemeConfig>()
const loc = computed(() => localeOf(lang.value))
const copy = computed(() => LANDING_COPY[loc.value])
const hero = computed(() => (frontmatter.value.hero ?? {}) as {
  kicker?: string; lede?: string; takeaways?: string[]; updated?: string; primary?: string
  secondary?: string; secondaryHref?: string
  actions?: { to?: string; href?: string; label?: string }[]; proof?: string[]; note?: string; fork?: CtaSpec & { text: string }
})
const hub = computed(() => (frontmatter.value.sectionHub ?? null) as { id: string; title: string; path: string | null } | null)
const brands = computed(() => hub.value?.id === 'brands')
const creator = computed(() => isCreatorSection(hub.value?.id ?? ''))
const primaryHref = computed(() => (brands.value ? theme.value.darebayCta.businessUrl : theme.value.darebayCta.tasksUrl))
const primaryLabel = computed(() => creator.value ? copy.value.ctaPrimary : hero.value.primary ?? (brands.value ? copy.value.bizCtaPrimary : copy.value.ctaPrimary))
const isHub = computed(() => Boolean(frontmatter.value.isHub))
const showcase = computed(() => isHub.value && frontmatter.value.showcase === true)
const actions = computed(() =>
  showcase.value ? (hero.value.actions ?? []).slice(0, 2).flatMap((action) => heroAction(action, loc.value, copy.value) ?? []) : ([] as LinkButton[]),
)
const proof = computed(() => (showcase.value ? hero.value.proof ?? [] : []))
const fork = computed(() => (showcase.value && hero.value.fork ? { text: hero.value.fork.text, ...ctaButton(hero.value.fork, loc.value, copy.value) } : null))
const art = computed(() => (showcase.value ? (frontmatter.value.art as { hero?: string } | undefined)?.hero ?? null : null))
const kicker = computed(() => hero.value.kicker ?? hub.value?.title ?? '')
const crumbHref = computed(() => (!isHub.value && hub.value?.path ? hub.value.path : null))
// A showcase states its own day where it matters (the tools landing's kicker: «проверено 29.09.2026»);
// the git day beside it would be a second date in the same line. Elsewhere the page's last change.
const updated = computed(() =>
  hero.value.updated ?? (showcase.value ? null : frontmatter.value.compare ? DATA.snapshot : (frontmatter.value.updated as string | null) ?? null))
const title = computed(() => String(frontmatter.value.title ?? ''))
const lede = computed(() => hero.value.lede ?? String(frontmatter.value.description ?? ''))
// The ghost button jumps to the section the page actually has. It used to be hardcoded to
// `#compare`, which only exists where the page renders <LCompare />: on the three "at a glance"
// pages the button read "See the fields" and led nowhere, because their section was a fact grid
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
  <section class="lp-hero" :class="{ 'lp-hero--hub': isHub, 'lp-hero--show': showcase }">
    <div class="lp-container lp-hero-in">
      <div class="lp-hero-main">
        <div class="lp-hero-meta">
          <a v-if="crumbHref" class="lp-breadcrumb" :href="crumbHref"><span aria-hidden="true">←</span> {{ hub?.title }}</a>
          <span v-else-if="kicker" class="lp-kicker">{{ kicker }}</span>
          <span v-if="crumbHref && hero.kicker" class="lp-kicker">{{ hero.kicker }}</span>
          <span v-if="updated" class="lp-updated">{{ copy.updated }} <b><time :datetime="updated">{{ formatDay(updated, loc) }}</time></b></span>
          <a v-if="showByline && theme.authorLink" class="lp-updated lp-byline" :href="theme.authorLink.path" rel="author">{{ copy.byline }} <b>{{ theme.authorLink.name }}</b></a>
        </div>
        <!-- Russian headings keep their short words and compounds on one line (headingHtml, copy.ts). -->
        <h1 v-html="headingHtml(title, loc)"></h1>
        <p v-if="lede" class="lp-lede">{{ lede }}</p>
        <template v-if="showcase">
          <div v-if="actions.length" class="lp-hero-btns">
            <a v-for="(action, index) in actions" :key="index" class="lp-btn" :class="index ? 'lp-btn-ghost' : 'lp-btn-primary'" v-bind="action.anchor" :data-analytics-cta-id="creator && action.anchor.href === primaryHref ? 'article_tasks' : undefined" :data-analytics-cta-placement="creator && action.anchor.href === primaryHref ? 'hero' : undefined">{{ action.label }}</a>
          </div>
          <p v-if="hero.note" class="lp-hero-note">{{ hero.note }}</p>
          <ul v-if="proof.length" class="lp-proof">
            <li v-for="(item, index) in proof" :key="index">{{ item }}</li>
          </ul>
          <p v-if="fork" class="lp-hero-fork">{{ fork.text }} <a v-bind="fork.anchor">{{ fork.label }}</a></p>
        </template>
        <div v-else-if="!isHub || creator" class="lp-hero-ctas">
          <a :class="creator ? 'lp-btn lp-btn-primary' : 'lp-hero-action'" :href="primaryHref" target="_self" :data-analytics-cta-id="creator ? 'article_tasks' : undefined" :data-analytics-cta-placement="creator ? 'hero' : undefined">{{ primaryLabel }}</a>
          <a v-if="hero.secondary" class="lp-hero-action lp-hero-action--secondary" :href="secondaryHref">{{ hero.secondary }} <span aria-hidden="true">↓</span></a>
        </div>
      </div>
      <span v-if="art" class="lp-hero-art" aria-hidden="true" v-html="art"></span>
      <aside v-if="hero.takeaways?.length" class="lp-takeaways" :aria-label="copy.keyTakeaways">
        <span class="lp-kicker">{{ copy.keyTakeaways }}</span>
        <ol>
          <li v-for="(t, i) in hero.takeaways" :key="i"><span v-html="t"></span></li>
        </ol>
      </aside>
    </div>
  </section>
</template>
