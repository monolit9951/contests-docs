<script setup lang="ts">
// The landing shell: our own header and footer, the hero read from
// frontmatter, then the page's Markdown. Chosen per page by `landing: true`
// in frontmatter (see theme/index.ts). Everything is server-rendered — the
// crawlers that matter here do not run JavaScript.
import { Content, useData } from 'vitepress'
import { computed } from 'vue'
import LandingHeader from './LandingHeader.vue'
import LandingFooter from './LandingFooter.vue'
import LHero from './LHero.vue'
import LCta from './LCta.vue'

const { frontmatter } = useData()
const world = computed(() => (frontmatter.value.world === 'cyan' ? 'lp-world-cyan' : ''))
</script>

<template>
  <div class="lp" :class="world">
    <LandingHeader />
    <main>
      <LHero />
      <Content class="lp-content" />
    </main>
    <LCta />
    <LandingFooter />
  </div>
</template>
