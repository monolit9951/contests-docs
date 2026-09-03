<script setup lang="ts">
// The list of pages in a hub, rendered from `hubs.data.ts`.
//
// This is a Vue component and not a Markdown list on purpose, but the reason is
// not interactivity: VitePress is a static site generator, so the markup below
// is baked into the HTML at build time. That matters more here than usual —
// the crawlers that read this site most (ClaudeBot, GPTBot, OAI-SearchBot) do
// not run JavaScript, and a hub whose links only appeared after hydration would
// be a hub with no links at all as far as they are concerned.

import { useData } from 'vitepress'
import { computed } from 'vue'
import { data as hubs } from '../hubs.data'

const props = defineProps<{ hub: string }>()

// The language of the page being rendered, not a fixed one: a hub lists what
// exists in ITS OWN tree. Before this the Ukrainian hub listed the Russian
// articles, so the page whose job is to keep a reader inside their language was
// the one that threw them out of it.
const { lang } = useData()
const pages = computed(() => hubs[props.hub]?.[lang.value] ?? [])
</script>

<template>
    <div class="lp-bleed lp-related lp-related--hub">
        <a v-for="page in pages" :key="page.id" class="lp-card lp-card--link" :href="page.path">
            <h3>{{ page.title }}</h3>
            <p v-if="page.description">{{ page.description }}</p>
        </a>
    </div>
</template>
