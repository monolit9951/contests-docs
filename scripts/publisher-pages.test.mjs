import { describe, expect, it } from 'vitest'
import { publisherPageFindings } from './publisher-pages.mjs'

const context = { mode: 'products', productHref: '/en/about/brolivo', contact: 'support@darebay.com' }
const publisher = `<div class="lp publisher"><main><a class="lp-btn lp-btn-primary" href="/en/about/brolivo">Meet Brolivo</a><a href="mailto:support@darebay.com">Contact</a></main></div>`
describe('publisher page delivery contract', () => {
  it('keeps the publisher CTA inside the localized app discovery flow', () => {
    expect(publisherPageFindings(publisher, context)).toEqual([])
    expect(publisherPageFindings(publisher.replace('/en/about/brolivo', '/tasks'), context)).toContain('primary CTA leaves the product discovery flow')
  })
  it('rejects the creator CTA and an unavailable prelaunch destination', () => {
    expect(publisherPageFindings(publisher + '<div class="lp-cta"></div>', context)).toContain('creator task funnel rendered')
    expect(publisherPageFindings(publisher + '<a href="https://brolivo.com/">Open app</a>', context)).toContain('prelaunch page advertises an unavailable destination')
  })
  it('requires an app detail target and its own contact', () => {
    const detail = publisher.replace('/en/about/brolivo', '#how-it-works').replaceAll('support@', 'brolivo@') + '<h2 id="how-it-works">Reply</h2>'
    const app = { ...context, mode: 'brolivo', contact: 'brolivo@darebay.com' }
    expect(publisherPageFindings(detail, app)).toEqual([])
    expect(publisherPageFindings(detail.replace('id="how-it-works"', ''), app)).toContain('product detail anchor missing')
    expect(publisherPageFindings(publisher.replace('mailto:', 'missing:'), context)).toContain('product contact missing')
  })
})
