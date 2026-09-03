<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import type { DareBayThemeConfig } from '../../chrome'
import { LANDING_COPY, localeOf } from './copy'

const { theme, lang } = useData<DareBayThemeConfig>()
const copy = computed(() => LANDING_COPY[localeOf(lang.value)])
const links = computed(() => (theme.value.nav ?? []).slice(0, -1) as { text: string; link: string }[])
</script>

<template>
  <footer class="lp-footer">
    <div class="lp-container lp-footer-in">
      <div>© DareBay · <a :href="theme.darebayCta.productUrl" target="_self">{{ copy.footerHome }}</a> · <a :href="theme.darebayCta.telegramUrl" target="_blank" rel="noreferrer">{{ copy.footerTelegram }}</a></div>
      <nav aria-label="Sections"><a v-for="l in links" :key="l.link" :href="l.link" style="margin-left:16px">{{ l.text }}</a></nav>
    </div>
  </footer>
</template>
