<script setup lang="ts">
// Answer-first hero. The H1 is rendered HERE, so a landing page's Markdown
// must not carry a `#` heading (dist gate: exactly one h1 per page).
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
const updated = computed(() => hero.value.updated ?? DATA.snapshot)
const title = computed(() => String(frontmatter.value.title ?? ''))
</script>

<template>
  <section class="lp-hero">
    <div class="lp-container lp-hero-in">
      <div>
        <div class="lp-hero-meta">
          <span v-if="hero.kicker" class="lp-kicker">{{ hero.kicker }}</span>
          <span class="lp-updated">{{ copy.updated }} <b><time :datetime="updated">{{ updated }}</time></b></span>
        </div>
        <h1>{{ title }}</h1>
        <p v-if="hero.lede" class="lp-lede">{{ hero.lede }}</p>
        <div class="lp-hero-ctas">
          <a class="lp-btn lp-btn-primary" :href="theme.darebayCta.productUrl">{{ hero.primary ?? copy.ctaPrimary }}</a>
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
