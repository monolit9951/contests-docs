---
title: How views are counted for the payout
description: The DareBay view oracle - which views count towards a payout, how validation and fraud protection work, and the rate cap and threshold.
provenance: { snapshot_date: "2026-07-10", source: "darebay-prod" }
numbers_used: [ppv_max_cpm_rate, ppv_min_views_threshold_live]
seo: true
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"Article","headline":"How views are counted for the payout","datePublished":"2026-07-10","dateModified":"2026-07-10","author":{"@type":"Organization","name":"DareBay"},"publisher":{"@type":"Organization","name":"DareBay"},"description":"The DareBay view oracle - which views count towards a payout, how validation and fraud protection work, and the rate cap and threshold."}'
---

# How views are counted for the payout

On DareBay the views that drive a payout are counted neither by the organizer nor by the author, but by the oracle - an automated system that pulls the data straight from the platform's API (today that is TikTok). The oracle watches for signs of inflated views: a submission with suspicious dynamics goes to manual review, where it is either confirmed or rejected outright. Inflating views adds nothing to the payout and puts the whole submission at risk.

## What the view oracle is

The oracle is the platform component that acts as an independent counter. It:

1. Connects to the platform's API (today that is TikTok) and pulls the real view figures for each submission.
2. Checks how the views accumulate and compares that against typical patterns.
3. Flags suspicious anomalies (a sharp spike within minutes, views without engagement) - such a submission goes to manual review.
4. Passes the figures into the system: for confirmed submissions the payout is computed from the platform's counter.

Neither the organizer nor the participant can influence the figure the oracle records. The platform acts as intermediary and guarantor: the money is frozen in advance and the payout follows the oracle's data strictly.

## Counted and uncounted views

"Counted views" are the views of a submission that the oracle and moderation have confirmed. These are what go into the payout formula.

"Uncounted views" are the views of a submission that failed review: if inflation is confirmed, the submission is rejected outright and nothing is credited for it.

Put simply: if a clip has 50,000 views but the oracle sees signs of inflation, the submission goes to manual review. The moderator either confirms it - in which case every view on the counter goes into the maths - or rejects it outright. Inflating views adds nothing to the payout and puts the whole submission at risk.

## What counts and what does not

| Type of views | Counted? | Why |
|---------------|:-:|-------------|
| Organic views from real users | Yes | The basis of the payout |
| Views from the platform's recommendations | Yes | The platform's algorithm confirmed the interest |
| Views from the author's own followers | Yes | The author's real audience |
| Bot inflation | No | The oracle records the anomalous pattern: the submission goes to review and can be rejected outright |
| Purchased views (view-selling services) | No | The pattern differs from organic: the submission goes to review |
| A suspicious spike with no engagement | No | No likes alongside a jump in views is a marker of inflation |

## The rate cap and the view threshold

Two key limits protect both the organizer and the clippers:

**The rate cap (CPM limit).** The validator does not allow a rate above **$100 per 1000 views**. This is a technical system limit: if an organizer tries to set a higher rate, the contest is not created. The limit guards against mistakes and abuse.

**The view threshold.** The threshold is set by the organizer in each contest. Across live contests the typical (median) threshold right now is **2000 views**. Submissions below their contest's threshold are not paid. The threshold rewards content people actually watch and keeps the budget from being spread across dozens of clips with a handful of views each. More in [the view threshold](/en/earnings/view-threshold).

## How fraud protection works

The oracle does not just read a view count, it analyses how the count grows:

1. **Speed of accumulation.** A clip that gains 100,000 views in 5 minutes after no activity at all is an anomaly.
2. **Engagement.** The system compares views against engagement (likes above all). Views climbing with no engagement is a marker of inflation.
3. **A dropping or unavailable counter.** If the platform suddenly reports noticeably fewer views than before, or the video becomes unavailable, crediting is paused until manual review.

Suspicious submissions are reviewed by hand. If inflation is confirmed, the submission is rejected outright and takes no part in the split.

## Frequently asked questions

### How does the platform verify views?

The oracle connects to the platform's API (today TikTok) and pulls the data directly. No figures are typed in by hand, by the organizer or by the participant. It is an independent, automated count.

### What happens if I inflate my views?

A submission showing signs of inflation is flagged and sent to manual review. If the inflation is confirmed, the submission is rejected outright and nothing is paid for it. You will have spent money on the inflation and put the whole submission at risk.

### Can I dispute the count?

Yes. If you believe the oracle got it wrong, you can contact support. The platform will check the data manually and correct the result if the error is confirmed.

### How quickly are views counted?

The oracle pulls the data automatically while the contest runs. The final count happens when the contest ends. After entries close there is a selection and confirmation window, and then the payout runs automatically.

### Do views from other platforms count?

Views count from the platform named in the contest (currently TikTok). If the contest is for TikTok, views of a copy of the same clip on another platform are not counted.

### What if the clip is deleted before the contest ends?

If the submission is removed from the platform, the oracle cannot confirm its views. Such a submission takes no part in the split.

### Is there a limit on the maximum rate?

Yes. The validator does not allow a rate above $100 per 1000 views. It is a technical limit that guards against mistakes when a contest is created.

## Where to next

- [How pay-per-view works](/en/earnings/how-pay-per-view-works) - the full chain from budget to payout
- [The view threshold](/en/earnings/view-threshold) - default, median, and how organizers set it
- [How it works](/en/how-it-works) - an overview of the DareBay mechanic
- [Does DareBay really pay?](/en/about/does-darebay-really-pay) - how the payout guarantee works
- [The payout guarantee](/en/about/payout-guarantee) - more on how the budget is locked
