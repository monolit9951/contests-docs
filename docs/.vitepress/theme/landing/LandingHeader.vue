<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import { useLangs } from '../langs'
import type { DareBayThemeConfig } from '../../chrome'

const { theme } = useData<DareBayThemeConfig>()
const { localeLinks, currentLang } = useLangs()
// theme.nav = hub links + the CTA last (see config.ts themeForLocale).
const links = computed(() => (theme.value.nav ?? []).slice(0, -1) as { text: string; link: string }[])
const cta = computed(() => (theme.value.nav ?? []).slice(-1)[0] as { text: string; link: string } | undefined)
</script>

<template>
  <header class="lp-header">
    <div class="lp-container lp-header-in">
      <a class="lp-logo" :href="theme.logoLink as string"><i aria-hidden="true"></i>DareBay</a>
      <nav class="lp-nav" aria-label="Sections">
        <a v-for="l in links" :key="l.link" :href="l.link">{{ l.text }}</a>
      </nav>
      <div class="lp-header-right">
        <div class="lp-lang" aria-label="Language">
          <span>{{ currentLang.label }}</span>
          <a v-for="l in localeLinks" :key="l.link" :href="l.link" :hreflang="undefined">{{ l.text }}</a>
        </div>
        <a v-if="cta" class="lp-btn lp-btn-primary lp-btn-sm" :href="cta.link" target="_self">{{ cta.text }}</a>
      </div>
    </div>
  </header>
</template>
