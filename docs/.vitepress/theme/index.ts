import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'

// The logo anchor in VitePress's NavBarTitle always points at the locale root.
// We want it to point to the main site instead — cheaper and more correct than
// replacing the whole component. Rewrite it on mount and on every route change.
const HOMEPAGE = 'https://darebay.com'

function rewriteLogoLink() {
  if (typeof document === 'undefined') return
  document.querySelectorAll<HTMLAnchorElement>('.VPNavBarTitle a.title').forEach((a) => {
    if (a.getAttribute('href') !== HOMEPAGE) {
      a.setAttribute('href', HOMEPAGE)
      a.removeAttribute('target')
    }
  })
}

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (typeof window === 'undefined') return
    // First paint
    queueMicrotask(rewriteLogoLink)
    // VitePress replaces DOM on route changes; re-apply
    const original = router.onAfterRouteChange
    router.onAfterRouteChange = (to) => {
      original?.(to)
      queueMicrotask(rewriteLogoLink)
    }
  },
} satisfies Theme
