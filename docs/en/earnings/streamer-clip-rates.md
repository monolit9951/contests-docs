---
title: What streamer clips pay on DareBay
description: "Streamer-clip PPV rates: $0.08 to $1.00 per 1000 views and a typical $100 cap, with wallet-backed or manual-payout funding."
provenance: { snapshot_date: "2026-08-04", source: "darebay-prod" }
numbers_used: [ppv_cpm_min, ppv_cpm_median, ppv_cpm_max, ppv_max_per_work_typical]
seo: true
---

# What streamer clips pay on DareBay

Clippers on DareBay are paid for the views their submissions get in PPV contests. Rates across live contests run from **$0.08 to $1.00 per 1000 views**, and the typical (median) rate is **$0.50 per 1000 views**. The cap per submission in typical contests is **$100**. The buyer, a streamer or a brand, sets the rate and the cap when creating the contest and freezes the budget in the same step: the prize money sits on the platform before you cut a single frame. Every term is on the contest card before you submit.

Every figure on this page comes from the platform's own data (snapshot: 2026-08-04).

## The payment parameters for clips

| Parameter | Value | What it means |
|-----------|-------|---------------|
| Minimum rate | $0.08 per 1000 views | The low end of the rate across live contests |
| Median rate | $0.50 per 1000 views | The typical rate: half of contests pay this or more |
| Maximum rate | $1.00 per 1000 views | The high end of the rate across live contests |
| Cap per submission | $100 | The most one submission can earn in a typical contest |

The organizer, a streamer or a brand, picks the rate and the cap when creating the contest. Both sit on the contest card, so you know the terms you are competing under before you submit a clip.

## How clippers get paid

The buyer creates a contest, sets the rate per 1000 views and the cap per submission, and locks the budget on the platform. Clippers submit their work. When the contest closes, the platform takes the views from the published TikTok counter through the configured tikwm oracle (today that is TikTok) and computes the payout by formula:

`(your submission's views / 1000) * the contest rate`, capped at the per-submission limit.

For example, at a rate of $0.50 per 1000 views with a $100 cap:

- 10,000 views: 10,000 / 1000 * $0.50 = **$5.00**
- 50,000 views: 50,000 / 1000 * $0.50 = **$25.00**
- 200,000 views: 200,000 / 1000 * $0.50 = $100, but the cap holds the payout at **$100**

The cap exists so the contest budget is shared between several clippers instead of going to one author with a viral clip.

A wallet-backed budget is locked in advance: the platform acts as intermediary and guarantor, and the prize money is out of the buyer's reach the moment the contest opens. The full mechanics are in [how pay-per-view works](/en/earnings/how-pay-per-view-works).

## What a clipper sees on the contest card

Every term is open before you submit:

1. **The rate per 1000 views** - what the buyer pays for each thousand views
2. **The cap per submission** - the most one clip can earn
3. **The total contest budget** - how much the buyer has locked on the platform
4. **The contest deadline** - when the contest closes and counting begins

The rate does not change once the contest launches. The terms are fixed.

## Frequently asked questions

### Why is there a cap per submission?

The cap protects the way the budget is split. Without it a single viral clip would take the whole contest budget and leave every other clipper with nothing. With a $100 cap the budget is shared between several authors.

### Do all streamers pay the same?

No. Every buyer, streamer or brand, picks their own rate when creating the contest. The range across live contests is $0.08 to $1.00 per 1000 views, and both the rate and the cap are on the card before you submit.

### How do I choose a contest to clip for?

Look at three numbers: the rate per 1000 views, the cap per submission and the total budget. A high rate on a large budget is a good brief. All three are open on the contest card.

### Do I need an audience to take part?

No. There is no minimum follower requirement. Beginners compete on the same terms as veterans. To get paid you publish the clip by the contest rules and clear the view threshold that puts a submission into the budget split.

### How are views counted?

They are pulled automatically from the published TikTok counter through the configured tikwm oracle. The count is independent: neither the buyer nor the clipper types figures in by hand or can nudge them.

### How does the money arrive?

The contest defines its reward method. For balance withdrawal, the form offers USDT to an external wallet or Telegram Stars, and processing is manual.

### When does the payout arrive?

After result confirmation, the platform records a credit or payout obligation. Fulfilment and withdrawal can be manual; the product shows the available method and status.

## Where to next

- [How pay-per-view works](/en/earnings/how-pay-per-view-works) - the full mechanics of a PPV contest
- [What DareBay pays per 1000 views](/en/earnings/pay-per-1000-views) - a detailed look at the rates
- [What TikTok pays for views](/en/earnings/tiktok-view-payouts) - a comparison with the TikTok Creator Fund
- [Earning on DareBay](/en/earnings/) - an overview of the ways to earn
- [Does DareBay really pay?](/en/about/does-darebay-really-pay) - how the payout is secured
