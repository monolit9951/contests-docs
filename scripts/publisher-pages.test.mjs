import { describe, expect, it } from 'vitest'
import { PAGES, pagePath } from '../docs/.vitepress/registry.ts'
import { BROLIVO_WEB_URLS, PUBLISHER_COPY } from '../docs/.vitepress/theme/products/copy.ts'
import { publisherPageFindings } from './publisher-pages.mjs'

const brolivo = PAGES.find((entry) => entry.id === 'about-brolivo')
const contextFor = (locale = 'en', mode = 'products') => ({
  mode,
  productHref: pagePath(brolivo, locale),
  webHref: BROLIVO_WEB_URLS[locale],
  availability: PUBLISHER_COPY[locale].status,
  contact: mode === 'brolivo' ? 'brolivo@darebay.com' : 'support@darebay.com',
})
const fixture = (context) => `<div class="lp publisher"><main>
  <a class="lp-btn lp-btn-primary" href="${context.webHref}">Open Brolivo</a>
  <a class="publisher-secondary" href="${context.mode === 'brolivo' ? '#how-it-works' : context.productHref}">Learn more</a>
  <p class="publisher-availability"><span aria-hidden="true"></span>${context.availability}</p>
  ${context.mode === 'products' ? `<a class="publisher-product-link" href="${context.webHref}">Open Brolivo</a>` : '<h2 id="how-it-works">Reply</h2>'}
  <a href="mailto:${context.contact}">Contact</a>
</main></div>`

describe('publisher page delivery contract', () => {
  it.each(Object.keys(BROLIVO_WEB_URLS))('opens the %s web test build and preserves product discovery', (locale) => {
    for (const mode of ['products', 'brolivo']) {
      const context = contextFor(locale, mode)
      const html = fixture(context)
      expect(publisherPageFindings(html, context)).toEqual([])
      expect(publisherPageFindings(html.replace(context.webHref, 'https://brolivo.com/wrong-locale'), context))
        .toContain('primary CTA does not open the localized web app')
      expect(publisherPageFindings(html.replace('class="publisher-secondary"', 'class="missing"'), context))
        .toContain('product discovery link missing')
    }
  })
  it('keeps the card actionable and the test status visible near the primary CTA', () => {
    const context = contextFor()
    const html = fixture(context)
    expect(publisherPageFindings(html.replace('class="publisher-product-link"', 'class="missing"'), context))
      .toContain('product card does not open the localized web app')
    expect(publisherPageFindings(html.replace(context.availability, 'Available now'), context))
      .toContain('web test availability missing')
  })
  it('rejects the creator funnel, unpublished store links and the old QA port', () => {
    const context = contextFor()
    const html = fixture(context)
    expect(publisherPageFindings(html + '<div class="lp-cta"></div>', context)).toContain('creator task funnel rendered')
    for (const destination of ['https://apps.apple.com/app/brolivo', 'https://play.google.com/store/apps/details?id=brolivo']) {
      expect(publisherPageFindings(html + `<a href="${destination}">Get app</a>`, context)).toContain('unpublished mobile app advertised')
    }
    expect(publisherPageFindings(html + '<a href="https://qa.example:8443/">Open app</a>', context)).toContain('old QA port advertised')
  })
  it('requires an app detail target and its own contact', () => {
    const context = contextFor('en', 'brolivo')
    const html = fixture(context)
    expect(publisherPageFindings(html.replace('id="how-it-works"', ''), context)).toContain('product detail anchor missing')
    expect(publisherPageFindings(html.replace('mailto:', 'missing:'), context)).toContain('product contact missing')
  })
})
