<script setup lang="ts">
// The site shell: our header and footer, the hero read from frontmatter, the
// page's Markdown, "more in this section" and the product CTA. Every page
// renders through it (the stock docs layout is retired); a 404 renders inside
// the same shell. Everything is server-rendered: the crawlers that matter here
// do not run JavaScript.
import { Content, useData } from 'vitepress'
import { computed } from 'vue'
import type { DareBayThemeConfig } from '../../chrome'
import LandingHeader from './LandingHeader.vue'
import LandingFooter from './LandingFooter.vue'
import LHero from './LHero.vue'
import LCta from './LCta.vue'
import LRelated from './LRelated.vue'
import LContents from './LContents.vue'
import HubIndex from '../HubIndex.vue'

const { frontmatter, page, theme } = useData<DareBayThemeConfig>()
const world = computed(() => (frontmatter.value.world === 'cyan' ? 'lp-world-cyan' : ''))
const notFound = computed(() => Boolean(page.value.isNotFound))
</script>

<template>
  <div class="lp" :class="world">
    <LandingHeader />
    <main v-if="notFound" id="main-content" tabindex="-1" class="lp-container lp-notfound">
      <span class="lp-kicker">{{ theme.notFound?.code ?? '404' }}</span>
      <h1>{{ theme.notFound?.title ?? 'Page not found' }}</h1>
      <p class="lp-lede">{{ theme.notFound?.quote }}</p>
      <a class="lp-btn lp-btn-primary" :href="theme.logoLink as string" :aria-label="theme.notFound?.linkLabel">{{ theme.notFound?.linkText ?? 'Home' }}</a>
    </main>
    <main v-else id="main-content" tabindex="-1">
      <template v-if="frontmatter.isHub">
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
  </div>
</template>
