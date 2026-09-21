<script setup lang="ts">
// A small, relevant next step. The complete SSR directory remains on the hub.
import { useData } from 'vitepress'
import { computed } from 'vue'
import { data as hubs } from '../../hubs.data'
import { LANDING_COPY, localeOf } from './copy'
import { rankedRelated, topicFor, TOPIC_LABELS } from '../catalog'

const { frontmatter, lang, page } = useData()
const loc = computed(() => localeOf(lang.value))
const copy = computed(() => LANDING_COPY[loc.value])
const hub = computed(() => (frontmatter.value.sectionHub ?? null) as { id: string; title: string; path: string | null } | null)
const norm = (p: string) => p.replace(/\/$/, '')
const current = computed(() => norm('/' + page.value.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')))
const allPages = computed(() => hub.value ? hubs[hub.value.id]?.[loc.value] ?? [] : [])
const currentId = computed(() => allPages.value.find(p => norm(p.path) === current.value)?.id ?? '')
const pages = computed(() => rankedRelated(allPages.value, currentId.value, 3))
</script>

<template>
  <section v-if="pages.length" class="lp-container lp-section lp-recommendations" id="related">
    <div class="lp-section-head">
      <div>
        <h2 class="lp-h2">{{ copy.related }}</h2>
      </div>
      <a v-if="hub?.path" class="lp-more-link" :href="hub.path">{{ copy.hubAll }} <span aria-hidden="true">↗</span></a>
    </div>
    <div class="lp-related">
      <a v-for="p in pages" :key="p.id" class="lp-card lp-card--link" :href="p.path">
        <span class="lp-card-topic">{{ TOPIC_LABELS[loc][topicFor(p.id)] }}</span>
        <h3>{{ p.title }}</h3>
        <p v-if="p.description">{{ p.description }}</p>
      </a>
    </div>
  </section>
</template>
