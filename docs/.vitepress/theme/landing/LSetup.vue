<script setup lang="ts">
// «Поможем настроить» (`setup` in the frontmatter): what the help covers, what to prepare, and the
// one button that starts it, named by CTA key (usually `founder`). A glass panel; the lists are
// real lists, the button a real link, all in the server's HTML.
//
// No `vitepress` import, on purpose: the two landings that show this block import it in their own
// `<script setup>` (as they import LTools), so it rides in their chunks, not in the theme chunk every
// page downloads, and a page chunk that imports `vitepress` splits VitePress's client module from
// its `Content` component (see LTools.vue). The page's data comes through the `$frontmatter`
// VitePress gives every component, its language as `frontmatter.locale` (config.ts, set for a page
// that shows a landing block); `showcase.test.ts` holds the file to that.
import { computed, getCurrentInstance } from 'vue'
import { LANDING_COPY, localeOf } from './copy'
import { ctaButton, type CtaSpec } from './showcase'

const page = getCurrentInstance()?.proxy as { $frontmatter?: Record<string, unknown> } | null | undefined
const frontmatter = computed(() => page?.$frontmatter ?? {})
const loc = computed(() => localeOf(String(frontmatter.value.locale ?? '')))
const copy = computed(() => LANDING_COPY[loc.value])
const setup = computed(() => (frontmatter.value.setup ?? null) as {
  title: string; lede?: string; items?: string[]; itemsTitle?: string; prepare?: string[]; prepareTitle?: string; action?: CtaSpec; note?: string
} | null)
const action = computed(() => (setup.value?.action ? ctaButton(setup.value.action, loc.value, copy.value) : null))
</script>

<template>
  <section v-if="setup" id="setup" class="lp-bleed lp-section lp-setup" aria-labelledby="setup-title">
    <div class="lp-setup-in">
      <div class="lp-setup-head">
        <h2 id="setup-title" class="lp-h2">{{ setup.title }}</h2>
        <p v-if="setup.lede">{{ setup.lede }}</p>
        <a v-if="action" class="lp-btn lp-btn-primary" v-bind="action.anchor">{{ action.label }}</a>
        <p v-if="setup.note" class="lp-setup-note">{{ setup.note }}</p>
      </div>
      <div class="lp-setup-lists">
        <div v-if="setup.items?.length">
          <h3>{{ setup.itemsTitle ?? copy.setupItems }}</h3>
          <ul>
            <li v-for="(item, index) in setup.items" :key="index">{{ item }}</li>
          </ul>
        </div>
        <div v-if="setup.prepare?.length">
          <h3>{{ setup.prepareTitle ?? copy.setupPrepare }}</h3>
          <ol>
            <li v-for="(item, index) in setup.prepare" :key="index">{{ item }}</li>
          </ol>
        </div>
      </div>
    </div>
  </section>
</template>
