<script setup lang="ts">
// The site shell: our header and footer, the hero read from frontmatter, the
// page's Markdown, "more in this section" and the product CTA. Every page
// renders through it (the stock docs layout is retired); a 404 renders inside
// the same shell. Everything is server-rendered: the crawlers that matter here
// do not run JavaScript.
//
// A hub index lists its section with the catalogue first and its Markdown below. A showcase hub
// index (`showcase: true`) is a landing instead: hero with buttons, then the page's own Markdown
// with its blocks, then the catalogue (`LCatalog`, where the Markdown places it or after it), then
// the CTA band. Either way the section's catalogue renders exactly once (dist gate `hub-directory`).
import { Content, useData } from 'vitepress'
import { computed, onMounted } from 'vue'
import type { DareBayThemeConfig } from '../../chrome'
import LandingHeader from './LandingHeader.vue'
import LandingFooter from './LandingFooter.vue'
import LHero from './LHero.vue'
import LCta from './LCta.vue'
import LRelated from './LRelated.vue'
import LContents from './LContents.vue'
import LCatalog from './LCatalog.vue'
import LTaskDock from './LTaskDock.vue'
import HubIndex from '../HubIndex.vue'
import { catalogPlacement, installReturningVisitorLinks, isCreatorSection } from './showcase'

const { frontmatter, page, theme } = useData<DareBayThemeConfig>()
const world = computed(() => (frontmatter.value.world === 'cyan' ? 'lp-world-cyan' : ''))
const notFound = computed(() => Boolean(page.value.isNotFound))
const catalog = computed(() => catalogPlacement(frontmatter.value))
const creator = computed(() => !notFound.value && isCreatorSection(frontmatter.value.sectionHub?.id ?? ''))
onMounted(installReturningVisitorLinks)
</script>

<template>
  <div class="lp" :class="[world, { 'lp--catalogue': creator }]">
    <LandingHeader />
    <main v-if="notFound" id="main-content" tabindex="-1" class="lp-container lp-notfound">
      <span class="lp-kicker">{{ theme.notFound?.code ?? '404' }}</span>
      <h1>{{ theme.notFound?.title ?? 'Page not found' }}</h1>
      <p class="lp-lede">{{ theme.notFound?.quote }}</p>
      <a class="lp-btn lp-btn-primary" :href="theme.logoLink as string" :aria-label="theme.notFound?.linkLabel">{{ theme.notFound?.linkText ?? 'Home' }}</a>
    </main>
    <main v-else id="main-content" tabindex="-1">
      <template v-if="catalog === 'inline' || catalog === 'after'">
        <LHero />
        <Content class="lp-content lp-showcase" />
        <LCatalog v-if="catalog === 'after'" />
      </template>
      <template v-else-if="catalog === 'top'">
        <LHero />
        <div class="lp-container"><HubIndex :hub="frontmatter.sectionHub.id" /></div>
        <Content class="lp-content lp-hub-context" />
      </template>
      <div v-else class="lp-container lp-reader" :class="{ 'lp-reader--no-outline': !page.headers?.length }">
        <LHero class="lp-reader-hero" />
        <LContents class="lp-reader-outline" />
        <Content class="lp-content lp-reader-content" />
      </div>
      <LRelated v-if="!frontmatter.isHub" />
    </main>
    <LCta v-if="!notFound" />
    <LandingFooter />
    <LTaskDock v-if="creator" />
  </div>
</template>
