import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { useData, useRouter } from 'vitepress'
import { defineComponent, h, onMounted, watch } from 'vue'
import { HOMEPAGE, TELEGRAM } from '../links'
import { DocsEvent, installDocsAnalytics, trackDocsEvent } from './analytics'
import { flushEngagement, startPageEngagement } from './engagement'
import { installWebVitals } from './vitals'
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

/**
 * The layout is where the per-page instrumentation lives, because it is the
 * first place the page data is real.
 *
 * `enhanceApp` runs while the app is being created, BEFORE the router resolves
 * the first route — and VitePress seeds `router.route.data` with
 * `notFoundPageData` as its placeholder (client/app/router.js). Reading
 * `isNotFound` there therefore reports "404" on every page including the ones
 * that exist, so the 404 signal was pure noise. `useData()` inside a component
 * is the documented place, and it is resolved by the time it renders.
 */
const DocsLayout = defineComponent({
  name: 'DareBayDocsLayout',
  setup() {
    const { page } = useData()
    const router = useRouter()

    const onPageReady = () => {
      rewriteLogoLink()
      trackDocsEvent(DocsEvent.PageView)
      // A url that 404s is either a link the content fleet shipped broken or an
      // inbound link (or an indexed url) we retired without a redirect. Both are
      // fixable and neither is visible from the sitemap.
      if (page.value.isNotFound) {
        trackDocsEvent(DocsEvent.NotFound, { referrer: document.referrer.slice(0, 512) })
      }
      startPageEngagement()
    }

    // Client-only by construction: `onMounted` never runs during the SSR build.
    onMounted(() => {
      // Docs traffic used to reach the nginx log and nothing else — 3758 visits
      // against zero analytics rows. One delegated listener covers every exit
      // link, including the ones the content fleet ships next.
      installDocsAnalytics()
      // Once per document, never per route: see the note in vitals.ts.
      installWebVitals()
      onPageReady()
    })

    // VitePress swaps the DOM on route changes rather than reloading, so the
    // next article needs the same treatment as the one we landed on.
    watch(
      () => router.route.path,
      () => queueMicrotask(onPageReady),
    )

    // `doc-footer-before` sits between the article and the prev/next pager, so the last
    // thing a reader meets is the product — not another sideways link deeper into the docs.
    return () => h(DefaultTheme.Layout, null, { 'doc-footer-before': () => h(PlatformCta) })
  },
})

export default {
  extends: DefaultTheme,
  Layout: DocsLayout,
  enhanceApp({ router }) {
    if (typeof window === 'undefined') return

    const originalBefore = router.onBeforeRouteChange
    router.onBeforeRouteChange = (to) => {
      // BEFORE, so the reading time is still attributed to the page it was
      // spent on — by `onAfterRouteChange` the url has already changed and
      // every article would credit its dwell to whichever page came next.
      flushEngagement('route')
      return originalBefore?.(to)
    }
  },
} satisfies Theme
