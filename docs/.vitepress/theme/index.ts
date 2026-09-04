import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { useData, useRouter } from 'vitepress'
import { defineComponent, h, nextTick, onMounted, watch } from 'vue'
import type { DareBayThemeConfig } from '../chrome'
import { DocsEvent, installDocsAnalytics, startDocsPage, trackDocsEvent } from './analytics'
import { flushEngagement, startPageEngagement } from './engagement'
import HubIndex from './HubIndex.vue'
import { CONTENT_SEGMENTS } from '../registry'
import LandingLayout from './landing/LandingLayout.vue'
import LCompare from './landing/LCompare.vue'
import LPlatforms from './landing/LPlatforms.vue'
import LMethod from './landing/LMethod.vue'
import LCalc from './landing/LCalc.vue'
import LFacts from './landing/LFacts.vue'
import LRelated from './landing/LRelated.vue'
import LCalcPro from './landing/LCalcPro.vue'
import LBudget from './landing/LBudget.vue'
import LGlossary from './landing/LGlossary.vue'
import './landing/landing.css'
import { installWebVitals } from './vitals'
import './custom.css'

// Every page ends with a way out of the docs and into the product. Readers arrive on a
// content page straight from search, read to the bottom, and used to find nothing there
// but links to more docs pages — the only exit was the header CTA they had already
// scrolled past (and which phones hid inside the hamburger entirely). Injected from the
// theme rather than written into Markdown so it also covers every page the content fleet
// ships next, without producers having to remember it. Copy and links come from the same
// locale themeConfig as the nav/footer, so SSR and client-side locale changes cannot drift.
const PlatformCta = defineComponent({
  name: 'DareBayPlatformCta',
  setup() {
    const { theme } = useData<DareBayThemeConfig>()

    return () => {
      const cta = theme.value.darebayCta

      return h('aside', { class: 'db-cta' }, [
        h('div', { class: 'db-cta-copy' }, [
          h('p', { class: 'db-cta-title' }, cta.title),
          h('p', { class: 'db-cta-lede' }, cta.lede),
        ]),
        h('div', { class: 'db-cta-actions' }, [
          h('a', { class: 'db-cta-btn db-cta-btn-primary', href: cta.productUrl, target: '_self' }, cta.productLabel),
          h(
            'a',
            {
              class: 'db-cta-btn db-cta-btn-ghost',
              href: cta.telegramUrl,
              target: '_blank',
              rel: 'noreferrer',
            },
            cta.telegramLabel,
          ),
        ]),
      ])
    }
  },
})

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
    const { page, frontmatter } = useData()
    const router = useRouter()

    const onPageReady = () => {
      startDocsPage()
      trackDocsEvent(DocsEvent.PageView)
      // A url that 404s is either a link the content fleet shipped broken or an
      // inbound link (or an indexed url) we retired without a redirect. Both are
      // fixable and neither is visible from the sitemap.
      if (page.value.isNotFound) {
        let referrerHost = ''
        try { referrerHost = document.referrer ? new URL(document.referrer).hostname : '' } catch { /* invalid referrer */ }
        trackDocsEvent(DocsEvent.NotFound, { referrerHost })
      }
      startPageEngagement()
    }

    // Client-only by construction: `onMounted` never runs during the SSR build.
    onMounted(() => {
      // Docs traffic used to reach the nginx log and nothing else — 3758 visits
      // against zero analytics rows. One delegated listener covers every exit
      // link, including the ones the content fleet ships next.
      installDocsAnalytics()
      onPageReady()
      // Once per document, never per route: see the note in vitals.ts. It is
      // installed after the first page context exists so late CLS/INP reports
      // cannot be attributed to whichever SPA route happens to be current.
      installWebVitals()
    })

    // VitePress swaps the DOM on route changes rather than reloading, so the
    // next article needs the same treatment as the one we landed on.
    watch(
      () => router.route.path,
      () => void nextTick(onPageReady),
    )

    // `doc-footer-before` sits between the article and the prev/next pager, so the last
    // thing a reader meets is the product — not another sideways link deeper into the docs.
    // Every page renders through the landing shell (founder directive
    // 2026-09-03: the old docs format is retired). `landing: false` keeps the
    // stock VitePress layout as an escape hatch. The instrumentation above is
    // the same for both, so analytics do not depend on which shell rendered.
    return () =>
      frontmatter.value.landing === false
        ? h(DefaultTheme.Layout, null, { 'doc-footer-before': () => h(PlatformCta) })
        : h(LandingLayout)
  },
})

export default {
  extends: DefaultTheme,
  Layout: DocsLayout,
  enhanceApp({ app, router }) {
    // Registered globally so a hub index is one tag in Markdown. Must happen on
    // the SERVER too — the list is prerendered (see the note in HubIndex.vue),
    // and the crawlers that read this site do not run JavaScript — so this sits
    // BEFORE the browser-only bail-out below.
    app.component('HubIndex', HubIndex)
    // Landing components, also prerendered on the server for the same reason.
    app.component('LCompare', LCompare)
    app.component('LPlatforms', LPlatforms)
    app.component('LMethod', LMethod)
    app.component('LCalc', LCalc)
    app.component('LFacts', LFacts)
    app.component('LRelated', LRelated)
    app.component('LCalcPro', LCalcPro)
    app.component('LBudget', LBudget)
    app.component('LGlossary', LGlossary)

    if (typeof window === 'undefined') return

    // VitePress intercepts EVERY same-origin `<a>` click without a `target`
    // attribute and routes it client-side. The product lives on the same
    // origin (`/`, `/en`, `/tasks`, …) but is not a page of this site, so such a
    // click used to render THIS site's 404 with the product's URL in the
    // address bar (seen by the founder on 2026-09-03 after clicking a landing
    // CTA to `/en`). Anything outside the hub prefixes the content container
    // owns is the application: leave the SPA and load it for real.
    const isContentPath = (to: string) => {
      let pathname: string
      try { pathname = new URL(to, window.location.origin).pathname } catch { return true }
      return CONTENT_SEGMENTS.some((segment) => pathname === `/${segment}` || pathname.startsWith(`/${segment}/`))
    }

    const originalBefore = router.onBeforeRouteChange
    router.onBeforeRouteChange = (to) => {
      if (!isContentPath(to)) {
        window.location.assign(to)
        return false
      }
      // BEFORE, so the reading time is still attributed to the page it was
      // spent on — by `onAfterRouteChange` the url has already changed and
      // every article would credit its dwell to whichever page came next.
      flushEngagement('route')
      return originalBefore?.(to)
    }
  },
} satisfies Theme
