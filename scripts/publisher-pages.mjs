// Publisher pages keep an app-discovery flow outside the creator task funnel.
export function publisherPageFindings(html, { mode, productHref, contact }) {
  const findings = []
  if (!/class="lp publisher(?:[ "])/.test(html)) findings.push('publisher shell missing')
  if (/class="[^"]*\blp-(?:cta|task-dock)\b/.test(html)) findings.push('creator task funnel rendered')
  const primary = html.match(/<a\b[^>]*class="lp-btn lp-btn-primary"[^>]*href="([^"]+)"/)
  if (primary?.[1] !== (mode === 'brolivo' ? '#how-it-works' : productHref)) findings.push('primary CTA leaves the product discovery flow')
  if (!html.includes('href="mailto:' + contact + '"')) findings.push('product contact missing')
  if (/href="https?:\/\/(?:brolivo\.com|(?:apps|itunes)\.apple\.com|play\.google\.com)/.test(html)) findings.push('prelaunch page advertises an unavailable destination')
  if (mode === 'brolivo' && !html.includes('id="how-it-works"')) findings.push('product detail anchor missing')
  return findings
}
