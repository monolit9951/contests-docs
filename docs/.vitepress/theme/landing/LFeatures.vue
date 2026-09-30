<script setup lang="ts">
// "What is already there" (`features` in the frontmatter): a grid of tiles, one capability each,
// each with the link that proves it, a CTA key or a page of this site. `features.phones` adds the
// CSS picture of one clip in several versions, a phone per account; it is decoration and hidden
// from assistive technology, the tiles say it in words. A tile's icon is page data
// (`frontmatter.art.icons`, put there by the build from `art.ts`).
//
// No `vitepress` import, on purpose: the two landings that show this block import it in their own
// `<script setup>` (as they import LTools), so it rides in their chunks, not in the theme chunk every
// page downloads, and a page chunk that imports `vitepress` splits VitePress's client module from
// its `Content` component (see LTools.vue). The page's data comes through the `$frontmatter`
// VitePress gives every component, its language as `frontmatter.locale` (config.ts, set for a page
// that shows a landing block); `showcase.test.ts` holds the file to that.
import { computed, getCurrentInstance } from 'vue'
import { LANDING_COPY, localeOf } from './copy'
import { itemLink } from './showcase'

interface Item { icon?: string; title: string; text: string; to?: string; href?: string; label?: string }

const page = getCurrentInstance()?.proxy as { $frontmatter?: Record<string, unknown> } | null | undefined
const frontmatter = computed(() => page?.$frontmatter ?? {})
const loc = computed(() => localeOf(String(frontmatter.value.locale ?? '')))
const features = computed(() => (frontmatter.value.features ?? null) as {
  title: string; lede?: string; phones?: { labels: string[]; tag?: string }; items?: Item[]
} | null)
const items = computed(() => (features.value?.items ?? []).map((item) => ({ ...item, link: itemLink(item, loc.value, LANDING_COPY[loc.value]) })))
const phones = computed(() => features.value?.phones ?? null)
const icons = computed(() => (frontmatter.value.art as { icons?: Record<string, string> } | undefined)?.icons ?? {})
</script>

<template>
  <section v-if="features && items.length" id="features" class="lp-bleed lp-section lp-features" aria-labelledby="features-title">
    <div class="lp-section-head">
      <div>
        <h2 id="features-title" class="lp-h2">{{ features.title }}</h2>
        <p v-if="features.lede">{{ features.lede }}</p>
      </div>
    </div>
    <div class="lp-feat" :class="{ 'lp-feat--phones': phones }">
      <div v-if="phones" class="lp-phones" aria-hidden="true">
        <div v-for="(label, index) in phones.labels" :key="index" class="lp-phone">
          <i></i>
          <b>{{ label }}</b>{{ ' ' }}<span v-if="phones.tag">{{ phones.tag }}</span>
        </div>
      </div>
      <ul class="lp-tiles">
        <li v-for="(item, index) in items" :key="index">
          <span v-if="item.icon && icons[item.icon]" class="lp-tile-icon" aria-hidden="true" v-html="icons[item.icon]"></span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.text }}</p>
          <a v-if="item.link" v-bind="item.link.anchor">{{ item.link.label }}</a>
        </li>
      </ul>
    </div>
  </section>
</template>
