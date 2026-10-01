<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ctaAnchor } from '../../links'
import { LANDING_COPY, localeOf } from './copy'

const { lang, page } = useData()
const locale = computed(() => localeOf(lang.value))
const anchor = computed(() => ctaAnchor('tasks', locale.value))
const label = computed(() => LANDING_COPY[locale.value].ctaPrimary)
const dock = ref<HTMLElement>()
const visible = ref(false)
let observer: IntersectionObserver | undefined
let mounted = false
let refresh = 0

// The first screen already has a catalogue button. On a phone, keep a thumb-reachable path
// while reading a long article, then give way to its closing CTA. Without JS the header,
// hero and closing links remain ordinary server-rendered anchors.
async function observePage() {
  const run = ++refresh
  visible.value = false
  observer?.disconnect()
  await nextTick()
  if (!mounted || run !== refresh || typeof IntersectionObserver === 'undefined') return
  const shell = dock.value?.closest('.lp')
  const hero = shell?.querySelector<HTMLElement>('.lp-hero')
  const closing = shell?.querySelector<HTMLElement>('.lp-cta')
  if (!hero || !closing) return
  const update = () => {
    const end = closing.getBoundingClientRect()
    visible.value = hero.getBoundingClientRect().bottom <= 80 && end.top >= window.innerHeight
  }
  observer = new IntersectionObserver(update, { rootMargin: '-80px 0px 0px', threshold: 0 })
  observer.observe(hero)
  observer.observe(closing)
  update()
}

watch(() => page.value.relativePath, () => {
  if (mounted) void observePage()
}, { flush: 'post' })
onMounted(() => {
  mounted = true
  void observePage()
})
onBeforeUnmount(() => {
  mounted = false
  observer?.disconnect()
})
</script>

<template>
  <aside ref="dock" v-show="visible" class="lp-task-dock">
    <a class="lp-btn lp-btn-primary" v-bind="anchor" data-analytics-cta-id="article_tasks" data-analytics-cta-placement="sticky">{{ label }}</a>
  </aside>
</template>

<style scoped>
.lp-task-dock { display: none; }
@media (max-width: 640px) {
  .lp-task-dock { display: block; position: fixed; inset-inline: 0; inset-block-end: 0; z-index: 40; padding: 10px 20px calc(10px + env(safe-area-inset-bottom, 0px)); border-block-start: 1px solid var(--lp-line); background: var(--lp-bg); }
  .lp-task-dock .lp-btn { width: 100%; min-height: 48px; white-space: normal; text-align: center; }
  :global(.lp:has(.lp-mobile-menu[open]) .lp-task-dock) { display: none; }
}
</style>
