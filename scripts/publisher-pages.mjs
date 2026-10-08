// Publisher pages open the localized web test build without implying a store launch.
export function publisherPageFindings(html, { mode, productHref, webHref, availability, contact }) {
  const findings = []
  if (!/class="lp publisher(?:[ "])/.test(html)) findings.push('publisher shell missing')
  if (/class="[^"]*\blp-(?:cta|task-dock)\b/.test(html)) findings.push('creator task funnel rendered')
  const primary = html.match(/<a\b[^>]*class="lp-btn lp-btn-primary"[^>]*href="([^"]+)"/)
  if (primary?.[1] !== webHref) findings.push('primary CTA does not open the localized web app')
  const secondary = html.match(/<a\b[^>]*class="publisher-secondary"[^>]*href="([^"]+)"/)
  if (secondary?.[1] !== (mode === 'brolivo' ? '#how-it-works' : productHref)) findings.push('product discovery link missing')
  if (mode === 'products') {
    const card = html.match(/<a\b[^>]*class="publisher-product-link"[^>]*href="([^"]+)"/)
    if (card?.[1] !== webHref) findings.push('product card does not open the localized web app')
  }
  const status = html.match(/<p\b[^>]*class="publisher-availability"[^>]*>[\s\S]*?<\/p>/)?.[0]
  if (!availability || !status?.includes(availability)) findings.push('web test availability missing')
  if (!html.includes('href="mailto:' + contact + '"')) findings.push('product contact missing')
  if (/href="https?:\/\/(?:(?:apps|itunes)\.apple\.com|play\.google\.com)(?:[\/:"])/.test(html)) findings.push('unpublished mobile app advertised')
  if (/href="https?:\/\/[^"/]+:8443(?:[\/"?])/.test(html)) findings.push('old QA port advertised')
  if (mode === 'brolivo' && !html.includes('id="how-it-works"')) findings.push('product detail anchor missing')
  return findings
}
