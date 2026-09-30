<script setup lang="ts">
// The section's catalogue on a showcase hub index: a thin wrapper of HubIndex that takes the
// container width wherever it stands. The layout appends it after the page's Markdown; `<LCatalog />`
// in the Markdown places it there instead (the build notices the tag, `catalogInline` in
// config.ts), and the layout then renders none of its own. Anywhere but a showcase hub index it
// renders nothing: a hub without a showcase lists its catalogue itself, and an article has
// "more in this section". The dist gate `hub-directory` holds the result: one catalogue per hub.
import { useData } from 'vitepress'
import { computed } from 'vue'
import { data as hubs } from '../../hubs.data'
import HubIndex from '../HubIndex.vue'
import { localeOf } from './copy'
import { catalogPlacement } from './showcase'

const { frontmatter, lang } = useData()
const hub = computed(() => {
  const placement = catalogPlacement(frontmatter.value)
  return placement === 'inline' || placement === 'after' ? ((frontmatter.value.sectionHub as { id?: string } | undefined)?.id ?? '') : ''
})
const listed = computed(() => Boolean(hub.value && hubs[hub.value]?.[localeOf(lang.value)]?.length))
</script>

<template>
  <div v-if="listed" class="lp-bleed lp-catalog"><HubIndex :hub="hub" compact /></div>
</template>
