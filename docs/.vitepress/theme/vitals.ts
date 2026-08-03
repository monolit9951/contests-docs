// Core Web Vitals for the docs.
//
// LCP, CLS and INP are a Google ranking signal, and the docs are the only
// pages of ours that rank — but page speed was measurable here only by running
// PageSpeed by hand on one URL at a time, on a synthetic connection, from a
// datacentre. These are FIELD numbers: what the actual readers, on their
// actual phones and networks, actually got.
//
// `web-vitals` is Google's own implementation. It is worth the ~2 KB rather
// than a hand-rolled PerformanceObserver: LCP has to survive being superseded
// by a later element, CLS is a windowed maximum rather than a sum, and INP
// needs the whole interaction-latency bookkeeping. Getting those subtly wrong
// produces numbers that look plausible and disagree with Search Console.

import type { Metric } from 'web-vitals'

import { DocsEvent, trackDocsEvent } from './analytics'

const report = (metric: Metric): void => {
    trackDocsEvent(
        DocsEvent.WebVitals,
        {
            metric: metric.name,
            // CLS is a unitless score in the 0..1 range where the whole
            // decision boundary sits at 0.1 — rounding it to an integer, as
            // the millisecond metrics are rounded, would turn every real
            // value into "0".
            value: metric.name === 'CLS' ? metric.value.toFixed(4) : String(Math.round(metric.value)),
            // Google's own good / needs-improvement / poor bucketing, so the
            // dashboard does not have to hardcode the thresholds.
            rating: metric.rating,
            // A back-forward-cache restore has different vitals than a cold
            // load; mixing them silently flatters the average.
            navigationType: metric.navigationType,
        },
        { dedupeKey: metric.name },
    )
}

/**
 * Call ONCE per page load, not per route change: these metrics are defined
 * over a document lifetime, and `web-vitals` already reports each one exactly
 * once, when its value is final. Registering again on an SPA navigation would
 * not measure the new route — it would re-report the first load.
 */
export const installWebVitals = (): void => {
    if (typeof window === 'undefined') return
    // Imported lazily so the library is never touched during the SSR build and
    // never sits in the critical path of a reader who is here for the article.
    void import('web-vitals')
        .then(({ onCLS, onINP, onLCP, onTTFB }) => {
            onLCP(report)
            onCLS(report)
            onINP(report)
            onTTFB(report)
        })
        .catch(() => {
            /* analytics must never break the page */
        })
}
