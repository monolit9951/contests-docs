---
title: How much you can earn from clips on DareBay
description: What you earn from clips depends on the rate, the views and the cap. The formula, the inputs, and an honest worked example on DareBay's real figures.
provenance: { snapshot_date: "2026-07-10", source: "darebay-prod" }
numbers_used: [ppv_cpm_min, ppv_cpm_median, ppv_cpm_max, ppv_min_views_threshold_live, ppv_max_per_work_typical]
seo: true
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"Article","headline":"How much you can earn from clips on DareBay","datePublished":"2026-07-10","dateModified":"2026-07-10","author":{"@type":"Organization","name":"DareBay"},"publisher":{"@type":"Organization","name":"DareBay"},"description":"What you earn from clips depends on the rate, the views and the cap. The formula, the inputs, and an honest worked example on DareBay real figures."}'
---

# How much you can earn from clips on DareBay

What a clipper earns on DareBay comes down to three offer parameters: the rate per 1000 views, the number of views the clip gets, and the cap per submission. Rates across live contests run from **$0.30 to $1.00 per 1000 views** (median **$0.50**). The threshold in a typical live contest is **2000 views**: that is what a submission has to reach to join the budget split. The cap per submission in typical contests is **$50**. These are offer parameters, not a promise of a particular income: the rate, threshold and cap are set by the buyer when the contest is created.

Every figure on this page comes from the platform's own data (snapshot: 2026-07-10).

## The inputs: what the payout depends on

| Parameter | Value | What it means |
|-----------|-------|---------------|
| Minimum rate | $0.30 per 1000 views | The low end of the rate across live contests |
| Median rate | $0.50 per 1000 views | The typical rate: half of contests pay this or more |
| Maximum rate | $1.00 per 1000 views | The high end of the rate across live contests |
| View threshold | 2000 views | Typical across live contests; the exact figure is on the card |
| Cap per submission | $50 | The most one submission can earn in a typical contest |

Every parameter is open on the contest card before you submit. The rate and the threshold are fixed at launch and do not change. The cap is set by the buyer (a streamer or a brand) at creation and can be adjusted later.

## The formula

The payout for one submission is worked out like this:

`payout = rate * views / 1000`, capped at the per-submission limit.

The threshold (2000 views) works as a gate: below it, nothing is credited at all. At or above it, all of the views go into the formula in full - the threshold is not subtracted.

## Worked examples

Take the median rate of **$0.50 per 1000 views**, a threshold of **2000 views** and a **$50** cap:

- **5,000 views:** $0.50 * 5,000 / 1000 = **$2.50**
- **20,000 views:** $0.50 * 20,000 / 1000 = **$10.00**
- **50,000 views:** $0.50 * 50,000 / 1000 = **$25.00**
- **120,000 views:** $0.50 * 120,000 / 1000 = $60, but the cap holds the payout at **$50**

At **$1.00 per 1000 views** (the high end) with the same cap:

- **5,000 views:** $1.00 * 5,000 / 1000 = **$5.00**
- **20,000 views:** $1.00 * 20,000 / 1000 = **$20.00**
- **52,000 views:** $1.00 * 52,000 / 1000 = $52, and the cap holds it at **$50**

This is arithmetic on the inputs, not a guarantee. Your actual figure depends on the rate and the cap of the contest you enter, and on your submission's views.

## How to raise your payout

A clipper does not control the rate or the cap, but does choose the contests and control the quality:

1. **Pick contests with a high rate.** The gap between $0.30 and $1.00 per 1000 views is more than threefold. The rate is on the card before you submit.
2. **Submit to several contests.** The cap limits what one submission earns, not how many contests you enter.
3. **Get past the threshold.** A submission below 2000 views takes no part in the payout. A well-made clip with a strong hook clears the threshold faster.

## Frequently asked questions

### What determines the final amount?

Three parameters: the rate per 1000 views, your submission's views, and the cap per submission. All three are set by the buyer at creation and stated on the card. The formula is `rate * views / 1000`, capped at the limit. The threshold works as a gate: below it nothing is credited, above it every view counts.

### Why is there a cap per submission?

The cap protects the way the budget is split. Without it a single viral clip could take the whole contest budget and leave every other clipper with nothing. With a $50 cap the budget is shared between several authors.

### Can I submit several clips to one contest?

Yes. In pay-per-view contests you can enter several different videos: each counts as its own submission and the cap applies to each separately. The same video cannot be submitted twice.

### What happens if a submission misses the view threshold?

If a submission gets fewer than 2000 views (the median threshold across live contests), it takes no part in the budget split and nothing is credited for it.

### How are views counted?

They are pulled automatically through the platform's API (today that is TikTok). It is an independent count: neither the buyer nor the clipper types figures in by hand or can nudge them. More in [how pay-per-view works](/en/earnings/how-pay-per-view-works).

### How does the money arrive?

DareBay supports several methods: wallet (USDT on TON), bank card, bank transfer, Telegram Stars and Telegram gifts.

### Is the budget locked in advance?

Yes. The buyer locks the budget when creating the contest. The platform acts as intermediary and guarantor: the money is locked until results are settled, so that neither side gets scammed. Whatever is left after the split goes back to the buyer.

## Where to next

- [How pay-per-view works](/en/earnings/how-pay-per-view-works) - the full mechanics of a PPV contest
- [What DareBay pays per 1000 views](/en/earnings/pay-per-1000-views) - a detailed look at the rates
- [What streamer clips pay](/en/earnings/streamer-clip-rates) - the payment parameters for clippers
- [Earning on DareBay](/en/earnings/) - an overview of the ways to earn
- [Does DareBay really pay?](/en/about/does-darebay-really-pay) - how the payout is secured
