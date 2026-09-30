<script setup lang="ts">
// The work as a line of steps (`flow` in the frontmatter): what each stage needs and, on its own
// line, what DareBay already gives for it. An ordered list with its text in the server's HTML; the
// connectors and the outlined step numbers are CSS only, in logical properties, so a right-to-left
// page runs the line the other way by itself.
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

interface Step { title: string; text: string; darebay?: string; to?: string; href?: string; label?: string }

const page = getCurrentInstance()?.proxy as { $frontmatter?: Record<string, unknown> } | null | undefined
const frontmatter = computed(() => page?.$frontmatter ?? {})
const loc = computed(() => localeOf(String(frontmatter.value.locale ?? '')))
const flow = computed(() => (frontmatter.value.flow ?? null) as { title: string; lede?: string; steps?: Step[] } | null)
const steps = computed(() => (flow.value?.steps ?? []).map((step) => ({ ...step, link: itemLink(step, loc.value, LANDING_COPY[loc.value]) })))
</script>

<template>
  <section v-if="flow && steps.length" id="flow" class="lp-bleed lp-section lp-flow" aria-labelledby="flow-title">
    <div class="lp-section-head">
      <div>
        <h2 id="flow-title" class="lp-h2">{{ flow.title }}</h2>
        <p v-if="flow.lede">{{ flow.lede }}</p>
      </div>
    </div>
    <ol>
      <li v-for="(step, index) in steps" :key="index">
        <h3>{{ step.title }}</h3>
        <p>{{ step.text }}</p>
        <p v-if="step.darebay" class="lp-flow-us"><b>DareBay:</b> {{ step.darebay }}</p>
        <a v-if="step.link" class="lp-flow-link" v-bind="step.link.anchor">{{ step.link.label }}</a>
      </li>
    </ol>
  </section>
</template>
