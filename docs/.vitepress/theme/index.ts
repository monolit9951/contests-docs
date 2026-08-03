import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import { HOMEPAGE, TELEGRAM } from '../links'
import { DocsEvent, installDocsAnalytics, trackDocsEvent } from './analytics'
import './custom.css'

// The logo anchor in VitePress's NavBarTitle always points at the locale root.
// We want it to point to the main site instead — cheaper and more correct than
// replacing the whole component. Rewrite it on mount and on every route change.

function rewriteLogoLink() {
  if (typeof document === 'undefined') return
  document.querySelectorAll<HTMLAnchorElement>('.VPNavBarTitle a.title').forEach((a) => {
    if (a.getAttribute('href') !== HOMEPAGE) {
      a.setAttribute('href', HOMEPAGE)
      a.removeAttribute('target')
    }
  })
}

// Every page ends with a way out of the docs and into the product. Readers arrive on a
// content page straight from search, read to the bottom, and used to find nothing there
// but links to more docs pages — the only exit was the header CTA they had already
// scrolled past (and which phones hid inside the hamburger entirely). Injected from the
// theme rather than written into Markdown so it also covers every page the content fleet
// ships next, without producers having to remember it.
function PlatformCta() {
  return h('aside', { class: 'db-cta' }, [
    h('div', { class: 'db-cta-copy' }, [
      h('p', { class: 'db-cta-title' }, 'Открыть DareBay'),
      h(
        'p',
        { class: 'db-cta-lede' },
        'Задания и конкурсы живут на сайте и в Telegram — это две равные двери в один продукт.',
      ),
    ]),
    h('div', { class: 'db-cta-actions' }, [
      h('a', { class: 'db-cta-btn db-cta-btn-primary', href: HOMEPAGE }, 'Перейти на darebay.com →'),
      h(
        'a',
        { class: 'db-cta-btn db-cta-btn-ghost', href: TELEGRAM, target: '_blank', rel: 'noreferrer' },
        'Telegram-канал',
      ),
    ]),
  ])
}

export default {
  extends: DefaultTheme,
  // `doc-footer-before` sits between the article and the prev/next pager, so the last
  // thing a reader meets is the product — not another sideways link deeper into the docs.
  Layout: () => h(DefaultTheme.Layout, null, { 'doc-footer-before': () => h(PlatformCta) }),
  enhanceApp({ router }) {
    if (typeof window === 'undefined') return
    // First paint
    queueMicrotask(rewriteLogoLink)
    // Docs traffic used to reach the nginx log and nothing else — 3758 visits
    // against zero analytics rows. One delegated listener covers every exit
    // link, including the ones the content fleet ships next.
    installDocsAnalytics()
    trackDocsEvent(DocsEvent.PageView)
    // VitePress replaces DOM on route changes; re-apply
    const original = router.onAfterRouteChange
    router.onAfterRouteChange = (to) => {
      original?.(to)
      queueMicrotask(rewriteLogoLink)
      trackDocsEvent(DocsEvent.PageView)
    }
  },
} satisfies Theme
