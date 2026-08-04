---
title: How views are counted for the payout
description: The DareBay view oracle reads figures straight from the platform API. Which views drive a payout, how inflated views are cut out, cap and threshold.
provenance: { snapshot_date: "2026-07-10", source: "darebay-prod" }
numbers_used: [ppv_max_cpm_rate, ppv_min_views_threshold_live]
seo: true
---

# How views are counted for the payout

The views behind a payout are counted neither by the organizer nor by the author, but by the oracle: an independent counter that reads the figures straight from the platform's API (today that is TikTok). Neither side can nudge it, and both see the same number. Inflated views do not get through it, because a submission with bot dynamics is pulled from the contest outright. Buying views adds nothing to the payout and costs you the whole submission.

## What the view oracle is

The oracle is the platform component that acts as an independent counter. It:

1. Connects to the platform's API (today that is TikTok) and pulls the real view figures for each submission.
2. Reads how the views accumulate and compares that against organic patterns.
3. Catches anomalies, such as a sharp spike within minutes or views without engagement, and sends that submission for review.
4. Feeds the figures into the maths: for confirmed submissions the payout is computed from the platform's counter.

Neither the organizer nor the participant influences the figure the oracle records. The platform acts as intermediary and guarantor: the money is frozen in advance and the payout follows the oracle's data strictly.

## Counted and uncounted views

"Counted views" are the views of a submission that the oracle and moderation have confirmed. These are what go into the payout formula.

"Uncounted views" are the views of a submission that failed review: inflation was confirmed, the submission was pulled outright, and nothing is credited for it.

Put simply: a clip has 50,000 views but the oracle sees signs of inflation, so the submission goes for review. Two outcomes exist and no others. Either the submission is confirmed and every view on the counter goes into the maths, or it is pulled outright. There is no "we will pay for part of the views", which is exactly why buying views never adds up.

## What counts and what does not

| Type of views | Counted? | Why |
|---------------|:-:|-------------|
| Organic views from real users | Yes | The basis of the payout |
| Views from the platform's recommendations | Yes | The platform's algorithm confirmed the interest |
| Views from the author's own followers | Yes | The author's real audience |
| Bot inflation | No | The oracle records the anomalous pattern, the submission goes for review and is pulled outright |
| Purchased views (view-selling services) | No | The pattern differs from organic, so the submission goes for review |
| A suspicious spike with no engagement | No | A jump in views with no likes is a marker of inflation |

## The rate cap and the view threshold

Two limits protect the organizer and the clippers alike:

**The rate cap (CPM limit).** The validator refuses any rate above **$100 per 1000 views**. It is a hard system limit: set a higher rate and the contest simply is not created. That closes off both a misplaced zero and a deliberate abuse.

**The view threshold.** The organizer sets the threshold in each contest. Across live contests the typical (median) threshold right now is **2000 views**. Submissions below their contest's threshold are not paid. The threshold sends the budget to content people actually watch and stops it being spread across dozens of clips with a handful of views each. More in [the view threshold](/en/earnings/view-threshold).

## How inflated views are cut out

The oracle does not just read a view count, it reads how that count grew:

1. **Speed of accumulation.** A clip that gains 100,000 views in 5 minutes after no activity at all is an anomaly.
2. **Engagement.** The system checks views against engagement, likes above all. Views climbing while likes stay flat is a marker of inflation.
3. **A dropping or unavailable counter.** If the platform suddenly reports noticeably fewer views than before, or the video goes unavailable, crediting for that submission stops until it is reviewed.

Suspicious submissions get reviewed separately. Once inflation is confirmed, the submission is pulled outright and takes no part in the split, and its share of the budget stays with the honest authors.

## Frequently asked questions

### How does the platform verify views?

The oracle connects to the platform's API (today TikTok) and pulls the data directly. Nobody types figures in by hand, not the organizer and not the participant. The count is independent and automated.

### What happens if I inflate my views?

A submission showing signs of inflation is flagged and sent for review. Once the inflation is confirmed, the submission is pulled outright and nothing is paid for it. You lose both the money you spent on the inflation and the whole submission.

### Can I dispute the count?

Yes. Contact support if you believe the oracle got it wrong. The platform pulls the data up and corrects the result if the error checks out.

### How quickly are views counted?

The oracle pulls data automatically for as long as the contest runs. The final count happens when the contest closes. After entries close there is a selection and confirmation window, and then the payout goes out by your chosen method.

### Do views from other platforms count?

Views count from the platform named in the contest, currently TikTok. If the contest is for TikTok, views of a copy of the same clip elsewhere stay out of the maths.

### What if the clip is deleted before the contest ends?

The oracle cannot confirm a submission that has been removed from the platform, so it takes no part in the split. Keep the clip published until the contest closes.

### Is there a limit on the maximum rate?

Yes. The validator refuses any rate above $100 per 1000 views. It is a technical limit that catches mistakes at contest creation.

## Where to next

- [How pay-per-view works](/en/earnings/how-pay-per-view-works) - the full chain from budget to payout
- [The view threshold](/en/earnings/view-threshold) - default, median, and how organizers set it
- [How it works](/en/how-it-works) - an overview of the DareBay mechanic
- [Does DareBay really pay?](/en/about/does-darebay-really-pay) - how the payout guarantee works
- [The payout guarantee](/en/about/payout-guarantee) - more on how the budget is locked
