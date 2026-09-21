<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { localeOf } from './copy'
import { articleContents, NAVIGATION_COPY } from './navigation'

const { page, lang } = useData()
const items = computed(() => articleContents(page.value.headers ?? []))
const label = computed(() => NAVIGATION_COPY[localeOf(lang.value)].contents)
const active = ref('')
const mobile = ref<HTMLDetailsElement>()
let headings: { link: string; element: HTMLElement }[] = []
let mounted = false
let refresh = 0
let frame = 0

function headingFor(link: string) {
  const fragment = link.slice(1)
  const exact = document.getElementById(fragment)
  if (exact) return exact
  try { return document.getElementById(decodeURIComponent(fragment)) }
  catch { return null }
}

function updateActive() {
  let current = headings[0]?.link ?? ''
  for (const heading of headings) {
    if (heading.element.getBoundingClientRect().top > 130) break
    current = heading.link
  }
  active.value = current
}

function scheduleActive() {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    updateActive()
  })
}

async function refreshHeadings() {
  const run = ++refresh
  active.value = ''
  if (mobile.value) mobile.value.open = false
  await nextTick()
  if (!mounted || run !== refresh) return
  headings = items.value.flatMap((item) => {
    const element = headingFor(item.link)
    return element ? [{ link: item.link, element }] : []
  })
  updateActive()
}

function followSection(event: MouseEvent, link: string) {
  // Modified clicks keep the browser's normal new-tab behavior.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  const heading = headingFor(link)
  if (!heading) return
  if (mobile.value) mobile.value.open = false
  active.value = link
  // target="_self" keeps these same-document jumps native: VitePress calculates
  // its deferred scroll during window capture, before this disclosure collapses.
  // The browser resolves the real href after collapse and honors scroll-margin.
  // Move keyboard focus too, so the next Tab continues from the selected section.
  heading.setAttribute('tabindex', '-1')
  heading.focus({ preventScroll: true })
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !mobile.value?.open) return
  mobile.value.open = false
  mobile.value.querySelector('summary')?.focus()
}

watch(() => page.value.relativePath, () => {
  if (mounted) void refreshHeadings()
}, { flush: 'post' })
onMounted(() => {
  mounted = true
  void refreshHeadings()
  // A frame-aligned read also covers large scroll jumps over long sections,
  // where an IntersectionObserver may see no heading cross its reading band.
  window.addEventListener('scroll', scheduleActive, { passive: true })
  window.addEventListener('resize', scheduleActive, { passive: true })
})
onBeforeUnmount(() => {
  mounted = false
  window.removeEventListener('scroll', scheduleActive)
  window.removeEventListener('resize', scheduleActive)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <aside v-if="items.length" class="lp-outline" :aria-label="label">
    <nav class="lp-outline-desktop" :aria-label="label">
      <p class="lp-outline-title"><span aria-hidden="true"></span>{{ label }}</p>
      <ol class="lp-outline-list">
        <li v-for="item in items" :key="item.link">
          <a class="lp-outline-link" :href="item.link" target="_self" :aria-current="active === item.link ? 'location' : undefined" @click="followSection($event, item.link)">{{ item.title }}</a>
        </li>
      </ol>
    </nav>
    <details ref="mobile" class="lp-outline-mobile" @keydown="closeOnEscape">
      <summary>
        <span class="lp-outline-summary-title"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M7 5h10M7 10h10M7 15h10M3 5h.01M3 10h.01M3 15h.01"/></svg>{{ label }}<span class="lp-outline-count" aria-hidden="true">{{ items.length }}</span></span>
        <svg class="lp-outline-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
      </summary>
      <nav :aria-label="label">
        <ol class="lp-outline-list">
          <li v-for="item in items" :key="item.link">
            <a class="lp-outline-link" :href="item.link" target="_self" :aria-current="active === item.link ? 'location' : undefined" @click="followSection($event, item.link)">{{ item.title }}</a>
          </li>
        </ol>
      </nav>
    </details>
  </aside>
</template>

<style scoped>
.lp-outline { min-width: 0; align-self: stretch; }
.lp-outline-desktop { position: sticky; inset-block-start: 96px; max-height: calc(100dvh - 128px); overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--lp-line-2) transparent; padding-block: 8px 20px; }
.lp-outline-title { display: flex; align-items: center; gap: 9px; margin: 0 0 22px; color: var(--lp-text); font-size: 12px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }
.lp-outline-title > span { width: 5px; height: 5px; border-radius: 50%; background: var(--lp-accent); }
.lp-outline-list { list-style: none; margin: 0; padding: 0; }
.lp-outline-list li { margin: 0; padding: 0; }
.lp-outline-link { display: block; padding-block: 10px; padding-inline: 16px 3px; border-inline-start: 1px solid var(--lp-line-2); color: var(--lp-muted); font-size: 12px; line-height: 1.6; text-wrap: pretty; overflow-wrap: anywhere; transition: color .16s, border-color .16s; }
.lp-outline-link:hover { color: var(--lp-text); }
.lp-outline-link[aria-current] { color: var(--lp-accent); border-inline-start: 2px solid var(--lp-accent); padding-inline-start: 15px; }
.lp-outline-link:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: -2px; border-radius: 4px; }
.lp-outline-mobile { display: none; }
@media (max-width: 1119px) {
  .lp-outline-desktop { display: none; }
  .lp-outline-mobile { display: block; border: 1px solid var(--lp-line-2); border-radius: 12px; background: var(--lp-panel); }
  .lp-outline-mobile summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 56px; padding: 14px 18px; color: var(--lp-text); font-size: 13px; font-weight: 700; list-style: none; cursor: pointer; }
  .lp-outline-mobile summary::-webkit-details-marker { display: none; }
  .lp-outline-mobile summary:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 3px; border-radius: 10px; }
  .lp-outline-summary-title { display: flex; align-items: center; gap: 10px; }
  .lp-outline-summary-title > svg { width: 18px; height: 18px; color: var(--lp-muted); }
  .lp-outline-count { padding: 1px 7px; border-radius: 5px; background: var(--lp-panel-2); color: var(--lp-muted); font-size: 10px; font-weight: 650; }
  .lp-outline-chevron { width: 16px; height: 16px; flex: none; color: var(--lp-muted); transition: transform .16s; }
  .lp-outline-mobile[open] .lp-outline-chevron { transform: rotate(180deg); }
  .lp-outline-mobile nav { padding: 0 18px 16px; }
  .lp-outline-mobile .lp-outline-list { padding-block-start: 7px; border-block-start: 1px solid var(--lp-line); }
  .lp-outline-link { min-height: 44px; display: flex; align-items: center; border: 0; padding-block: 10px; padding-inline: 0; font-size: 13px; }
  .lp-outline-link[aria-current] { border: 0; padding-inline-start: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-outline-link, .lp-outline-chevron { transition: none; }
}
</style>
