// Check the date a reader sees in the hero, independently of historical source dates.
export function visiblePageDateFindings(markup, expectedDay) {
  const meta = markup.match(/<div\b[^>]*\bclass="[^"]*\blp-hero-meta\b[^"]*"[^>]*>([\s\S]*?)<\/div\s*>/i)?.[1]
  const times = [...(meta ?? '').matchAll(/<time\b[^>]*\bdatetime="([^"]*)"[^>]*>/gi)]
  if (times.length !== 1) return ['expected exactly one visible hero update date, found ' + times.length]
  if (times[0][1] !== expectedDay) return ['hero update ' + times[0][1] + ' != page modification ' + expectedDay]
  return []
}
