<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import type { DareBayThemeConfig } from '../../chrome'
import { LANDING_COPY, localeOf } from './copy'
import { bandButtons, type CtaSpec, type LinkButton } from './showcase'

const { theme, lang, frontmatter } = useData<DareBayThemeConfig>()
const loc = computed(() => localeOf(lang.value))
const copy = computed(() => LANDING_COPY[loc.value])
const cta = computed(() => (frontmatter.value.cta ?? {}) as { title?: string; lede?: string; primary?: CtaSpec; secondary?: CtaSpec })
// Which buttons the band shows. A page may name both by CTA key (`cta.primary`, `cta.secondary`);
// otherwise its section decides (`HUB_CTA`): the brands section is read by a business deciding
// whether to fund a task, so both of its buttons lead there, the business page and the founder's
// Telegram. A section without its own pair keeps the open-task catalogue and the community room the
// site's chrome names for the page's language (the Telegram channel or Discord).
const hub = computed(() => (frontmatter.value.sectionHub as { id?: string } | undefined)?.id ?? '')
const brands = computed(() => hub.value === 'brands')
const buttons = computed(() => bandButtons(hub.value, cta.value, loc.value, copy.value))
const primary = computed<LinkButton>(() => buttons.value[0])
const secondary = computed<LinkButton>(() => buttons.value[1] ?? {
  label: theme.value.darebayCta.communityLabel,
  anchor: { href: theme.value.darebayCta.communityUrl, rel: 'noreferrer', target: '_blank' },
})
const showcase = computed(() => Boolean(frontmatter.value.isHub) && frontmatter.value.showcase === true)
</script>

<template>
  <section class="lp-cta" :class="{ 'lp-cta--show': showcase }">
    <div class="lp-container lp-cta-in">
      <div>
        <h2>{{ cta.title ?? (brands ? copy.bizCtaTitle : copy.ctaTitle) }}</h2>
        <p>{{ cta.lede ?? (brands ? copy.bizCtaLede : copy.ctaLede) }}</p>
      </div>
      <div class="lp-cta-actions">
        <a class="lp-btn lp-btn-primary" v-bind="primary.anchor">{{ primary.label }}</a>
        <a class="lp-btn lp-btn-ghost" v-bind="secondary.anchor">{{ secondary.label }}</a>
      </div>
    </div>
  </section>
</template>
