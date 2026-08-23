---
title: How views are counted for the payout
description: "Who counts views in a DareBay PPV contest and why the threshold is not subtracted: clear it and the whole counter goes into the maths. Threshold, rate ceiling, moderation and holds."
provenance: { snapshot_date: "2026-08-23", source: "darebay-prod" }
numbers_used: [ppv_max_cpm_rate, ppv_min_views_threshold_live, ppv_default_min_views_threshold, ppv_cpm_median]
seo: true
---

# How views are counted for the payout

The main thing about counting: **the threshold is not subtracted**. In a typical live contest the threshold is **2000 views**, and the moment a submission clears it the whole counter goes into the maths, not the remainder above the bar. The first two thousand views do not burn - they are paid for like every other view. The figure itself is typed in by hand by neither the buyer nor the clipper: the platform reads the published counter of the site where the work is posted. A wallet-backed contest budget is frozen on the platform before you take the brief on.

## Where the view figure comes from

An independent counter reads the published view counter on the site, using the link you sent when you submitted. Both sides look at the same number: the buyer cannot understate it in their favour, the clipper cannot inflate it in theirs. There is no manual entry anywhere in that chain.

The site is set by the contest. Automatic stats collection currently works for TikTok, YouTube and Instagram - which site a particular contest needs is written in its terms. Inside the product this mechanism is called the view oracle, but in substance it is an independent read of a public counter, not a separate judge of traffic quality.

What honestly follows from that, and what does not:

- **It follows:** there is one figure for both sides, it is taken from a public source, and you can see it on the site itself.
- **It does not follow:** the platform does not recount the counter its own way and does not build its own estimate of "real" views on top of it. What runs on top of the counter is moderation and basic checks - more on those below.

## The threshold is not subtracted: the whole counter counts

The accounting mode on the platform is called `FULL_COUNTER_AFTER_THRESHOLD`. The wording is technical, the meaning is simple: **the threshold is an admission condition, not a deductible**. It does not cut the first thousands of views off your payout; it only decides whether the submission takes part in the budget split.

An example. A contest with a threshold of 2000 views and a rate of $1.00 per 1000 views; the submission reached 6000 views.

- **How DareBay counts it:** 6000 / 1000 * $1.00 = **$6.00**. All 6000 views go into the maths.
- **If the threshold were subtracted:** only the remainder of the counter would count. That would be 4000 / 1000 * $1.00 = **$4.00** instead of six.

On exactly the same views, the difference is half the payout again. A second example: a contest with the default threshold of 1000 views, and a submission that reached exactly 1000. The payout is worked out on the whole thousand: 1000 / 1000 * $1.00 = **$1.00**, not zero.

| Views on the submission | Contest threshold | What goes into the maths |
|---|---|---|
| 1800 | 2000 | nothing, the threshold was not cleared |
| 2000 | 2000 | 2000 views |
| 6000 | 2000 | 6000 views |

Hence a practical conclusion: the most valuable stretch in a contest is the last few hundred views before the threshold. They turn a zero into a payout on the whole counter at once.

## The view threshold: how much you have to reach

The threshold is set by the buyer at contest creation, in the "minimum views" field. Leave it empty and the system fills in its own default, **1000 views**. In practice buyers set it higher: the typical threshold across open contests is **2000 views**. The exact value stands on the contest card and does not move after launch, so you see the bar before you take the work on.

| Parameter | Value | What it means |
|---|---|---|
| System default | 1000 views | Filled in when the buyer did not state a value of their own |
| Median across live contests | 2000 views | The typical bar buyers set in practice |
| Who sets it | The buyer, at contest creation | Visible on the card before you submit and unchanged after launch |

The threshold is checked at contest finalization, when the system collects the final view data. Until that moment views keep accumulating, and a submission still has time to make up the minimum.

Why the threshold is useful to a clipper, not just to the buyer:

1. **It takes micro-fraud out of the competition for the budget.** Without a threshold, a dozen submissions with twenty views each would chip pieces off the budget. With one, that tactic does not pay, and the split is left to those with real reach.
2. **It keeps the budget on content people watch.** The buyer is paying for reach, not for the fact of publication. The less of the budget goes to dust, the more is left for those who cleared the bar.

The rate is bounded systemically from the other side: the validator refuses a contest with a rate above **$100 per 1000 views**. That is insurance against a stray zero at contest creation, not a guide to the market.

## Which views go into the maths

| Views | In the maths | Note |
|---|:-:|---|
| The video counter on the contest's site | Yes | The public value is taken from the link you submitted |
| Views gathered before the threshold was cleared | Yes | The threshold is not subtracted; the counter goes in whole |
| Views after the final data collection | No | The maths take the counter value as of contest finalization |
| A copy of the same video on another site or another account | No | A submission enters the contest through one link; copies are not added up |
| A video deleted or hidden before finalization | No | There is no counter left to read, so the views cannot be confirmed |
| A photo post instead of a video on Instagram | No | Instagram needs a video with views: a photo post has no such metric |
| A submission rejected by moderation | No | It takes no part in the budget split |

## What happens to a suspicious submission

This is the place not to overstate. A submission whose growth pattern looks suspicious is flagged and goes on hold: crediting for it is paused pending review. That is not an automatic verdict and not a bot detector, it is a pause followed by a moderation decision.

Such a submission has three possible outcomes:

1. **The submission goes through.** The whole counter goes into the maths under the usual rules.
2. **The submission stays on hold.** Crediting is paused pending review; once the review period runs out, a payout for it is possible.
3. **Moderation rejects the submission.** It takes no part in the budget split and there is no money for it.

So buying views is a bad bet not because punishment is inevitable, but because of the arithmetic of the risk: you pay for those views out of your own pocket up front, while a payout on that submission is guaranteed by nothing and can hang until the review is over. Swapping the link does not work either: a submission enters the contest through the URL you sent, and that is the one that is counted.

The site's own rules are worth remembering separately. A video blocked or hidden by the site stops giving out a counter, and there is nothing left to confirm, whatever caused the block.

## Frequently asked questions

### Are all views counted, or only unique ones?

The platform takes the number the site's public counter shows and does no deduplication of its own on top of it. Whatever the site counts as a view is what goes into the maths once the threshold is cleared.

### What happens if I inflate my views?

A submission with suspicious growth goes on hold, and crediting for it stops pending review. Moderation can reject the submission outright - then it takes no part in the budget split. There is no guaranteed outcome in either direction, and the money you spent on the inflation is already gone.

### What if I miss the threshold?

The submission takes no part in the budget split and there is no payout for it. It has no effect on your account at all: no penalties, no blocks, no restrictions on the next contests. The views still show up in your stats.

### What threshold can a buyer set?

Any, including one below the default 1000 views. An inflated bar hurts the buyer most: clippers see the terms before submitting and simply walk past a contest with an unrealistic minimum.

### What if the video is deleted or becomes unavailable?

There is no counter to read on a deleted or hidden video, so the views cannot be confirmed and the submission takes no part in the split. Keep the video published until the contest is over.

### Do views of a copy of the video on another site count?

No. One link goes into the maths - the one you submitted to the contest. Views of a copy of the same video on another site or another account are not added up.

## Where to next

- [How pay-per-view works](/en/earnings/how-pay-per-view-works) - the chain from the contest budget to money in your hands
- [How much you can earn from clips](/en/earnings/how-much-clipping-pays) - the payout formula and live reference points
- [What DareBay pays per 1000 views](/en/earnings/pay-per-1000-views) - the rate reference
- [Where to find clipping work](/en/earnings/where-to-find-clipping-work) - how to look for contests and source footage
- [Does DareBay really pay?](/en/about/does-darebay-really-pay) - what backs the payout
