<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import type { DareBayThemeConfig } from '../../chrome'
import { LANDING_COPY, localeOf } from './copy'

const { theme, lang, frontmatter } = useData<DareBayThemeConfig>()
const copy = computed(() => LANDING_COPY[localeOf(lang.value)])
const cta = computed(() => (frontmatter.value.cta ?? {}) as { title?: string; lede?: string })
// The brands section is read by a business deciding whether to fund a task, so both buttons lead
// there: the business page and the founder's Telegram. Every other section keeps the open-task
// catalogue and the channel.
const brands = computed(() => (frontmatter.value.sectionHub as { id?: string } | undefined)?.id === 'brands')
const actions = computed(() =>
  brands.value
    ? {
        title: copy.value.bizCtaTitle,
        lede: copy.value.bizCtaLede,
        primaryHref: theme.value.darebayCta.businessUrl,
        primary: copy.value.bizCtaPrimary,
        secondaryHref: theme.value.darebayCta.founderUrl,
        secondary: copy.value.bizCtaSecondary,
      }
    : {
        title: copy.value.ctaTitle,
        lede: copy.value.ctaLede,
        primaryHref: theme.value.darebayCta.tasksUrl,
        primary: copy.value.ctaPrimary,
        secondaryHref: theme.value.darebayCta.telegramUrl,
        secondary: copy.value.ctaSecondary,
      },
)
</script>

<template>
  <section class="lp-cta">
    <div class="lp-container lp-cta-in">
      <div>
        <h2>{{ cta.title ?? actions.title }}</h2>
        <p>{{ cta.lede ?? actions.lede }}</p>
      </div>
      <div class="lp-cta-actions">
        <a class="lp-btn lp-btn-primary" :href="actions.primaryHref" target="_self">{{ actions.primary }}</a>
        <a class="lp-btn lp-btn-ghost" :href="actions.secondaryHref" target="_blank" rel="noreferrer">{{ actions.secondary }}</a>
      </div>
    </div>
  </section>
</template>
