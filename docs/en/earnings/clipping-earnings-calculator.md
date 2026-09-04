---
title: "Clipping earnings calculator: what you can make per month"
description: "Set views per clip, clips per week and a $1 to $2 rate per 1,000 views: you get a monthly figure with the threshold, the $100 cap and the 10% withdrawal fee."
provenance: { snapshot_date: "2026-08-23", source: "darebay-prod" }
numbers_used: [ppv_cpm_band_low, ppv_cpm_band_high, ppv_cpm_median, ppv_min_views_threshold_live, ppv_max_per_work_typical]
seo: true
landing: true
app: true
hero:
  kicker: "Calculator · 2026"
  lede: "Three sliders instead of back-of-the-envelope guesses: views per clip, clips per week and the rate. The calculator runs the formula the platform pays by and shows straight away what is left after the withdrawal fee."
  takeaways:
    - "<b>One formula:</b> views / 1,000 × rate, never above the cap per clip. Open tasks pay $1 to $2 per 1,000 views."
    - "<b>The 2,000-view threshold is a gate, not a deduction:</b> a clip below it earns nothing, a clip above it is paid from the first view."
    - "<b>The cap is $100 per clip,</b> so ten clips at 50,000 views bring more than one clip at a million."
    - "<b>You take home a tenth less:</b> withdrawal requests start at 10 USDT, the fee is 10%, processing is manual."
cta:
  title: "Done the maths? Now take a brief"
  lede: "Rate, threshold and cap are printed on every open task card. No followers, no application: post the clip, send the link, the platform counts the views."
---

<LCalcPro />

## How to read the result

The calculator runs the formula the platform pays by: views / 1,000 × rate, never more than the cap per clip. Three sliders set the input: views on one clip, clips per week, and the rate per 1,000 views. The rate slider stops where open tasks stop, between $1 and $2, in quarter-dollar steps.

The four figures on the right are the output. **Per clip** is the payout for one clip after the cap; if the clip hits $100, a badge says so. **Per week** multiplies that by the number of clips, and **per month** is four straight weeks. **On hand** is what remains after the 10% withdrawal fee, which comes out of the amount you request rather than being added on top; the minimum withdrawal request is 10 USDT.

The threshold is built in too: a clip under 2,000 views returns zero, a clip at 2,000 or more is paid for every view from the first one, which is why the total drops to zero when you drag the views slider down to 1,000. The exact rate, threshold and cap are printed on every task card; the calculator uses the typical values.

## Three scenarios

Three workloads through the formula with a $100 cap per clip: a start on one channel, a steady pace, and a small team's load, where the cap bites.

| Scenario | Per clip at $1 | Per clip at $2 | Per month at $1 | Per month at $2 |
|---|---:|---:|---:|---:|
| 5 clips a week at 10,000 views | $10.00 | $20.00 | $200.00 | $400.00 |
| 10 clips a week at 30,000 views | $30.00 | $60.00 | $1,200.00 | $2,400.00 |
| 20 clips a week at 100,000 views | $100.00 | $100.00, capped | $8,000.00 | $8,000.00, capped |

First scenario: 10,000 / 1,000 × $1.00 = **$10.00** per clip, five clips make $50.00 a week and $200.00 a month, $180.00 on hand after the 10% fee. Second: 30,000 / 1,000 × $1.00 = **$30.00**, ten clips make $300.00 a week and $1,200.00 a month, $1,080.00 on hand; at $2 everything doubles, to $2,400.00 and $2,160.00 on hand.

The third scenario is the cap at work. 100,000 / 1,000 × $1.00 = **$100.00**, exactly the cap, and twenty clips make $8,000.00 a month, $7,200.00 on hand. At $2 the formula gives $200.00 per clip, but the platform pays no more than $100 for one clip, so the $2 column repeats the $1 column: above 100,000 views at $1, or 50,000 at $2, every further view adds nothing.

This is the arithmetic of the formula, not a forecast: a real month is made of the tasks you took and the clips that cleared moderation and the threshold.

## What moves the number

**Views matter more than the rate.** The rate spread in open tasks is a factor of two; the spread between a 5,000-view clip and a 50,000-view clip is a factor of ten. The typical rate is $1, and chasing $2 only pays off where the subject is yours: someone else's niche at a high rate gets fewer views than your own at a low one.

**The cap is per clip, not per author.** $100 is the most one clip can earn, so the number grows with the count of clips, not with one viral hit: two clips at 60,000 views at $1 make $120.00, one clip at 120,000 makes $100.00.

**The 2,000-view threshold.** A clip below it does not enter the maths at all, so the first seconds decide more than the length or the edit. The threshold is not subtracted: reach 2,500 and you are paid for 2,500.

**Rejected clips are not paid.** A clip takes part in a task only after you send the link to the published video, and a moderator checks it against the conditions; inflated views are filtered out. A clip that does not meet the brief earns nothing, however many views it has, so read the task card before you edit.

## How to get paid

Accruals on approved clips build up in your DareBay wallet, and there are two steps between them and money in hand. First, the "Claim now" button on the task card: once a clip is approved, it locks in what has been credited so far, and the clip stops earning in that task; fresh accruals mature for 24 hours, then the button unlocks by itself. Second, a withdrawal request: the minimum request is 10 USDT, the fee is 10% of the requested amount, processing is manual, and a personal rate may apply, which the form shows before you confirm. The money arrives as USDT to a wallet on the TON network or as Telegram Stars.

The inputs are covered in [how much clipping pays](/en/earnings/how-much-clipping-pays); the charges in [what commission DareBay charges](/en/help/what-commission) and [DareBay withdrawals](/en/help/darebay-withdrawals). For other platforms' rate, threshold and cap, see [the best clipping platforms](/en/earnings/best-clipping-platforms) or the fact sheet [DareBay at a glance](/en/about/darebay-at-a-glance).

## Frequently asked questions

### Why does the calculator show two totals?

The big figure is the accrual by the formula over four weeks; the "on hand" line is the same sum after the 10% withdrawal fee. The fee is taken at withdrawal, not at accrual, so your balance shows the first figure and your wallet receives the second.

### How many clips does it take to reach the withdrawal minimum?

The minimum request is 10 USDT. At $1 one clip at 10,000 views gets you there, or two at 5,000; at $2 one clip at 5,000 is enough. Clips under the 2,000-view threshold do not count toward that sum.

### Can I calculate several tasks with different rates?

The calculator handles one task: one rate, one threshold, one cap. Run each separately and add them up; the cap applies inside each task, and each task prints its own three numbers on the card.

### Does a rejected clip count toward the total?

No. Only clips that passed moderation and cleared the threshold go into the sum; a rejected clip is not paid, however many views it has. The calculator cannot know a clip will be rejected, so its figure is an upper estimate on the assumption that every clip is accepted.
