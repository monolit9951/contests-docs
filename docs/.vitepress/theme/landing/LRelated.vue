<script setup lang="ts">
// "More in this section": every other page of the current hub, from the same
// build-time data the hub index uses. Server-rendered on purpose: this is the
// internal linking the old sidebar used to provide, and crawlers must see it.
import { useData } from 'vitepress'
import { computed } from 'vue'
import { data as hubs } from '../../hubs.data'
import { LANDING_COPY, localeOf } from './copy'

const { frontmatter, lang, page } = useData()
const loc = computed(() => localeOf(lang.value))
const copy = computed(() => LANDING_COPY[loc.value])
const hub = computed(() => (frontmatter.value.sectionHub ?? null) as { id: string; title: string; path: string | null } | null)
const norm = (p: string) => p.replace(/\/$/, '')
const current = computed(() => norm('/' + page.value.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')))
const pages = computed(() => (hub.value ? (hubs[hub.value.id]?.[loc.value] ?? []).filter((p) => norm(p.path) !== current.value) : []))
</script>

<template>
  <section v-if="pages.length" class="lp-bleed lp-section" id="related">
    <div class="lp-section-head">
      <div>
        <span class="lp-kicker">{{ copy.related }}</span>
        <p v-if="hub?.path"><a :href="hub.path">{{ copy.hubAll }}: {{ hub.title }}</a></p>
      </div>
    </div>
    <div class="lp-related">
      <a v-for="p in pages" :key="p.id" class="lp-card lp-card--link" :href="p.path">
        <h3>{{ p.title }}</h3>
        <p v-if="p.description">{{ p.description }}</p>
      </a>
    </div>
  </section>
</template>
