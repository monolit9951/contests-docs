<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import type { DareBayThemeConfig } from '../../chrome'
import { LANDING_COPY, localeOf } from './copy'

const { theme, lang, frontmatter } = useData<DareBayThemeConfig>()
const copy = computed(() => LANDING_COPY[localeOf(lang.value)])
const cta = computed(() => (frontmatter.value.cta ?? {}) as { title?: string; lede?: string })
</script>

<template>
  <section class="lp-cta">
    <div class="lp-container lp-cta-in">
      <div>
        <h2>{{ cta.title ?? copy.ctaTitle }}</h2>
        <p>{{ cta.lede ?? copy.ctaLede }}</p>
      </div>
      <div class="lp-cta-actions">
        <a class="lp-btn lp-btn-primary" :href="theme.darebayCta.productUrl" target="_self">{{ copy.ctaPrimary }}</a>
        <a class="lp-btn lp-btn-ghost" :href="theme.darebayCta.telegramUrl" target="_blank" rel="noreferrer">{{ copy.ctaSecondary }}</a>
      </div>
    </div>
  </section>
</template>
