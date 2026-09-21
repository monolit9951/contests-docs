<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useLangs } from '../langs'
import type { DareBayThemeConfig } from '../../chrome'
import { localeOf } from './copy'
import { NAVIGATION_COPY, navigationCurrent } from './navigation'

const { theme, page, lang } = useData<DareBayThemeConfig>()
const { localeLinks, currentLang } = useLangs()
// The registry supplies the section URLs and keeps the product CTA last.
const links = computed(() => (theme.value.nav ?? []).slice(0, -1) as { text: string; link: string }[])
const cta = computed(() => (theme.value.nav ?? []).slice(-1)[0] as { text: string; link: string } | undefined)
const copy = computed(() => NAVIGATION_COPY[localeOf(lang.value)])
const header = ref<HTMLElement>()
const menu = ref<HTMLDetailsElement>()
const languages = ref<HTMLDetailsElement>()
const current = (link: string) => navigationCurrent(link, page.value.relativePath)

function closeMenus() {
  if (menu.value) menu.value.open = false
  if (languages.value) languages.value.open = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  const open = [menu.value, languages.value].find((element) => element?.open)
  if (!open) return
  open.open = false
  open.querySelector('summary')?.focus()
}

function onOutsideClick(event: MouseEvent) {
  if (event.target instanceof Node && !header.value?.contains(event.target)) closeMenus()
}

watch(() => page.value.relativePath, closeMenus)
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onOutsideClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onOutsideClick)
})
</script>

<template>
  <header ref="header" class="lp-header">
    <a class="lp-skip" href="#main-content">{{ theme.skipToContentLabel }}</a>
    <div class="lp-container lp-header-in">
      <a class="lp-logo" :href="theme.logoLink as string" :aria-current="current(theme.logoLink as string)">
        <span class="lp-logo-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 4h5.5a8 8 0 0 1 0 16H7V4Z" stroke="currentColor" stroke-width="3.5"/><path d="m5 12 5-3v6l-5-3Z" fill="currentColor"/></svg></span>
        DareBay
      </a>
      <nav class="lp-nav" :aria-label="theme.navLabel">
        <a v-for="link in links" :key="link.link" :href="link.link" :aria-current="current(link.link)">{{ link.text }}</a>
      </nav>
      <div class="lp-header-actions">
        <div class="lp-lang">
          <details ref="languages" class="lp-language-menu">
            <summary :aria-label="theme.langMenuLabel">
              <svg class="lp-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg>
              <span>{{ currentLang.label }}</span>
              <svg class="lp-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
            </summary>
            <nav class="lp-language-options" :aria-label="theme.languageLabel">
              <span class="lp-language-current" aria-current="true">{{ currentLang.label }}<span aria-hidden="true">✓</span></span>
              <a v-for="locale in localeLinks" :key="locale.link" :href="locale.link" @click="closeMenus">{{ locale.text }}</a>
            </nav>
          </details>
        </div>
        <a v-if="cta" class="lp-header-cta" :href="cta.link" target="_self">
          <span class="lp-cta-full">{{ cta.text }}</span>
          <span class="lp-cta-compact">{{ copy.site }}</span>
          <svg class="lp-cta-arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5"/></svg>
        </a>
        <details ref="menu" class="lp-mobile-menu">
          <summary :aria-label="theme.sidebarMenuLabel">
            <svg class="lp-menu-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>
            <svg class="lp-menu-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>
          </summary>
          <div class="lp-mobile-panel">
            <p class="lp-menu-label">{{ theme.navLabel }}</p>
            <nav class="lp-mobile-nav" :aria-label="theme.navLabel">
              <a v-for="link in links" :key="link.link" :href="link.link" :aria-current="current(link.link)" @click="closeMenus">{{ link.text }}<span aria-hidden="true">↗</span></a>
            </nav>
            <p class="lp-menu-label lp-menu-language-label">{{ theme.languageLabel }}</p>
            <nav class="lp-mobile-languages" :aria-label="theme.languageLabel">
              <span aria-current="true">{{ currentLang.label }}</span>
              <a v-for="locale in localeLinks" :key="locale.link" :href="locale.link" @click="closeMenus">{{ locale.text }}</a>
            </nav>
          </div>
        </details>
      </div>
    </div>
  </header>
</template>

<style scoped>
.lp-header { position: sticky; inset-block-start: 0; z-index: 50; background: rgba(9, 12, 17, .94); border-block-end: 1px solid var(--lp-line); backdrop-filter: blur(20px); }
.lp-header-in { display: flex; align-items: center; gap: 32px; min-height: 76px; }
.lp-logo { display: inline-flex; align-items: center; flex: none; gap: 9px; min-height: 44px; color: var(--lp-text); font-family: var(--lp-display); font-size: 17px; font-weight: 700; letter-spacing: -.05em; }
.lp-logo-mark { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--lp-accent); color: var(--lp-on-accent); }
.lp-logo-mark svg { width: 22px; height: 22px; }
.lp-nav { display: flex; align-items: center; gap: 22px; }
.lp-nav a { display: inline-flex; align-items: center; min-height: 44px; white-space: nowrap; font-size: 13px; font-weight: 650; color: var(--lp-muted); transition: color .16s; }
.lp-nav a:hover, .lp-nav a[aria-current] { color: var(--lp-text); }
.lp-nav a[aria-current] { box-shadow: 0 2px 0 var(--lp-accent); }
.lp-header-actions { display: flex; align-items: center; gap: 18px; margin-inline-start: auto; }
.lp-lang { position: relative; }
summary { list-style: none; cursor: pointer; }
summary::-webkit-details-marker { display: none; }
summary:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 4px; border-radius: 6px; }
.lp-language-menu summary { display: flex; align-items: center; gap: 7px; min-height: 44px; color: var(--lp-muted); font-size: 12px; font-weight: 650; }
.lp-header-icon { width: 17px; height: 17px; }
.lp-chevron { width: 14px; height: 14px; transition: transform .16s; }
details[open] .lp-chevron { transform: rotate(180deg); }
.lp-language-options { position: absolute; inset-block-start: calc(100% + 10px); inset-inline-end: 0; width: 176px; padding: 7px; border: 1px solid var(--lp-line-2); border-radius: 14px; background: var(--lp-panel); box-shadow: 0 18px 44px rgba(0, 0, 0, .35); }
.lp-language-options a, .lp-language-current { display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
.lp-language-options a:hover { background: var(--lp-panel-2); }
.lp-language-current { color: var(--lp-accent); }
.lp-header-cta { display: inline-flex; align-items: center; justify-content: center; flex: none; min-height: 42px; padding: 10px 17px; border-radius: 10px; background: var(--lp-accent); color: var(--lp-on-accent); font-size: 12px; font-weight: 800; white-space: nowrap; transition: background .16s, transform .16s; }
.lp-header-cta:hover { background: var(--lp-accent-deep); transform: translateY(-1px); }
.lp-cta-compact, .lp-cta-arrow, .lp-mobile-menu { display: none; }
.lp-skip { position: absolute; inset-block-start: -100px; inset-inline-start: 20px; padding: 12px 18px; background: var(--lp-accent); color: var(--lp-on-accent); border-radius: 8px; font-size: 14px; font-weight: 700; z-index: 5; }
.lp-skip:focus { inset-block-start: 10px; }

@media (max-width: 1119px) {
  .lp-header-in { min-height: 64px; gap: 16px; }
  .lp-nav, .lp-lang, .lp-cta-full { display: none; }
  .lp-header-actions { gap: 10px; }
  .lp-header-cta { min-height: 40px; padding: 9px 13px; gap: 7px; }
  .lp-cta-compact, .lp-cta-arrow { display: block; }
  .lp-cta-arrow { width: 16px; height: 16px; }
  .lp-mobile-menu { display: block; }
  .lp-mobile-menu > summary { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--lp-line-2); border-radius: 10px; color: var(--lp-text); }
  .lp-mobile-menu > summary svg { width: 22px; height: 22px; }
  .lp-menu-close, .lp-mobile-menu[open] .lp-menu-open { display: none; }
  .lp-mobile-menu[open] .lp-menu-close { display: block; }
  .lp-mobile-menu[open] > summary { background: var(--lp-panel-2); }
  .lp-mobile-panel { position: absolute; inset-block-start: 100%; inset-inline: 0; max-height: calc(100dvh - 64px); overflow-y: auto; overscroll-behavior: contain; padding: 22px max(20px, calc((100% - var(--lp-container)) / 2)) 26px; border-block-end: 1px solid var(--lp-line-2); background: var(--lp-bg); box-shadow: 0 24px 48px rgba(0, 0, 0, .3); }
  .lp-menu-label { margin: 0 0 10px; color: var(--lp-faint); font-size: 11px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
  .lp-mobile-nav { display: grid; gap: 4px; }
  .lp-mobile-nav a { display: flex; justify-content: space-between; align-items: center; gap: 16px; min-height: 48px; padding: 10px 12px; border-radius: 8px; color: var(--lp-text); font-size: 16px; font-weight: 650; }
  .lp-mobile-nav a span { color: var(--lp-faint); }
  .lp-mobile-nav a:hover, .lp-mobile-nav a[aria-current] { background: var(--lp-panel); }
  .lp-mobile-nav a[aria-current] { color: var(--lp-accent); }
  .lp-menu-language-label { margin-block-start: 22px; padding-block-start: 20px; border-block-start: 1px solid var(--lp-line); }
  .lp-mobile-languages { display: flex; flex-wrap: wrap; gap: 8px; }
  .lp-mobile-languages a, .lp-mobile-languages > span { display: flex; align-items: center; min-height: 44px; padding: 9px 13px; border: 1px solid var(--lp-line-2); border-radius: 8px; color: var(--lp-muted); font-size: 13px; }
  .lp-mobile-languages > span { background: var(--lp-panel-2); border-color: var(--lp-accent); color: var(--lp-accent); }
  .lp-mobile-languages a:hover { color: var(--lp-text); background: var(--lp-panel); }
}
@media (max-width: 380px) {
  .lp-header-in { gap: 8px; }
  .lp-logo { font-size: 15px; gap: 7px; }
  .lp-logo-mark { width: 27px; height: 27px; }
  .lp-header-actions { gap: 7px; }
  .lp-header-cta { padding-inline: 11px; font-size: 11px; gap: 5px; }
  .lp-cta-arrow { width: 14px; height: 14px; }
}
:global([dir='rtl'] .lp-cta-arrow) { transform: scaleX(-1); }
@media (prefers-reduced-motion: reduce) {
  .lp-header-cta, .lp-chevron, .lp-nav a { transition: none; }
}
</style>
