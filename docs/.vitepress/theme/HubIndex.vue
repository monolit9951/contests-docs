<script setup lang="ts">
// The list of pages in a hub, rendered from `hubs.data.ts`.
//
// This is a Vue component and not a Markdown list on purpose, but the reason is
// not interactivity: VitePress is a static site generator, so the markup below
// is baked into the HTML at build time. That matters more here than usual —
// the crawlers that read this site most (ClaudeBot, GPTBot, OAI-SearchBot) do
// not run JavaScript, and a hub whose links only appeared after hydration would
// be a hub with no links at all as far as they are concerned.

import { data as hubs } from '../hubs.data'

const props = defineProps<{ hub: string }>()
const pages = hubs[props.hub] ?? []
</script>

<template>
    <ul class="db-hub-index">
        <li v-for="page in pages" :key="page.id">
            <a :href="page.path">{{ page.title }}</a>
            <span v-if="page.description"> — {{ page.description }}</span>
        </li>
    </ul>
</template>

<style scoped>
.db-hub-index {
    list-style: none;
    padding: 0;
    margin: 1.25rem 0 0;
}

.db-hub-index li {
    padding: 0.6rem 0;
    border-top: 1px solid var(--vp-c-divider);
    line-height: 1.55;
}

.db-hub-index li:last-child {
    border-bottom: 1px solid var(--vp-c-divider);
}

.db-hub-index a {
    font-weight: 600;
}

.db-hub-index span {
    color: var(--vp-c-text-2);
}
</style>
