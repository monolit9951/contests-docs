---
title: "Clipping earnings calculator: what you can make per month"
description: "Set views per clip, clips per week and a $1 to $10 rate per 1,000 views: a monthly figure with the threshold, a $500 cap per clip and the sum on hand."
provenance: { snapshot_date: "2026-08-23", source: "darebay-prod" }
numbers_used: [ppv_cpm_band_low, ppv_cpm_band_high, ppv_cpm_median, ppv_min_views_threshold_live, ppv_max_per_work_typical]
seo: true
landing: true
app: true
hero:
  kicker: "Calculator · 2026"
  lede: "Three sliders instead of back-of-the-envelope guesses: views per clip, clips per week and the rate. From there the calculator runs the same formula the platform pays by, applies the threshold and the cap, and shows what reaches your wallet after the 10% withdrawal fee. Not a range off somebody else's screenshot. Your numbers."
  takeaways:
    - "<b>One formula, and you can run it before you edit:</b> views / 1,000 × rate, never above the cap per clip. Open tasks pay $1 to $10 per 1,000 views."
    - "<b>The threshold is a gate, not a deduction:</b> the task sets it, a clip below it earns nothing, and a clip that clears it is paid for every view from the first."
    - "<b>The cap runs up to $500 per clip,</b> so ten steady clips beat one viral hit: the number grows with the count of clips, not with luck."
    - "<b>Nothing is taken until you withdraw:</b> every accrual lands on your balance in full, a withdrawal request from 10 USDT carries a 10% fee inside it, and the team checks the details and sends it."
cta:
  title: "Like the number? Go and earn it"
  lede: "The figures you just dragged into place exist on live task cards, visible before you open the editor, and nobody checks your follower count at the door. Cut the clip, publish it, send the link, and the platform does the counting from there."
---

<LCalcPro />

## How to read the result

The calculator runs the formula the platform pays by: views / 1,000 × rate, never more than the cap per clip. Three sliders set the input: views on one clip, clips per week, and the rate per 1,000 views. The rate slider stops where open tasks stop, between $1 and $10, in quarter-dollar steps.

The four figures on the right are the output. **Per clip** is the payout for one clip after the cap; if the clip hits the cap, a badge says so. **Per week** multiplies that by the number of clips, and **per month** is four straight weeks. **On hand** is 10% less than the accrual: it is what reaches your wallet after the withdrawal fee, which comes out of the amount you request rather than being added on top, and the minimum request is 10 USDT.

The threshold is built in too: a clip under the threshold returns zero, and a clip that clears it is paid for every view from the first one. The exact rate, threshold and cap are printed on every task card - check the card in the catalog; the calculator starts from the system default threshold of 1,000 views and a cap of $500 per clip.

## Three scenarios

Three workloads through the formula with a $500 cap per clip: a start on one channel, a steady pace, and a small team's load.

| Scenario | Per clip at $1 | Per clip at $10 | Per month at $1 | Per month at $10 |
|---|---:|---:|---:|---:|
| 5 clips a week at 10,000 views | $10.00 | $100.00 | $200.00 | $2,000.00 |
| 10 clips a week at 30,000 views | $30.00 | $300.00 | $1,200.00 | $12,000.00 |
| 20 clips a week at 100,000 views | $100.00 | $500.00, capped | $8,000.00 | $40,000.00 |

First scenario: 10,000 / 1,000 × $1.00 = **$10.00** per clip, five clips make $50.00 a week and $200.00 a month, and $180.00 of it reaches your wallet after the 10% withdrawal fee. Second: 30,000 / 1,000 × $1.00 = **$30.00**, ten clips make $300.00 a week and $1,200.00 a month, $1,080.00 on hand; at $10 everything is ten times over, to $12,000.00 and $10,800.00 on hand.

The third scenario shows where the cap sits. 100,000 / 1,000 × $1.00 = **$100.00**, a fifth of a $500 cap, and twenty clips make $8,000.00 a month, $7,200.00 on hand; at $10 the formula gives $1,000.00 for the same clip, the cap holds it at $500.00, and the month is $40,000.00, $36,000.00 on hand. A $500 cap only starts to bite above 500,000 views at $1, or 50,000 at $10, and the next clip starts its own count from scratch.

This is the arithmetic of the formula, not a forecast: a real month is made of the tasks you took and the clips that cleared moderation and the threshold.

## What moves the number

**Views and the rate both move the number.** The rate spread in open tasks is a factor of ten, and so is the spread between a 5,000-view clip and a 50,000-view clip. The typical rate is $1, and chasing $10 only pays off where the subject is yours: someone else's niche at a high rate gets fewer views than your own at a low one.

**The cap is per clip, not per author.** Up to $500 is the most one clip can earn, so the number grows with the count of clips, not with one viral hit: two clips at 600,000 views at $1 make $1,000.00, one clip at 1,200,000 makes $500.00.

**The view threshold.** A clip below the threshold on the task card does not enter the maths at all, so the first seconds decide more than the length or the edit. The threshold is not subtracted: clear it and you are paid for every view from the first.

**Rejected clips are not paid.** A clip takes part in a task only after you send the link to the published video, and a moderator checks it against the conditions; inflated views are filtered out. A clip that does not meet the brief earns nothing, however many views it has, so read the task card before you edit.

## How to get paid

Accruals on approved clips build up in your DareBay wallet, and there are two steps between them and money in hand. First, the "Claim now" button on the task card: once a clip is approved, it locks in what has been credited so far, and the clip stops earning in that task; fresh accruals mature for 24 hours, then the button unlocks by itself. Second, a withdrawal request: the minimum request is 10 USDT, the fee is 10% of the requested amount (a personal rate may apply), and the team checks the details and sends it; the form shows the exact rate and the amount to receive before you confirm. The money arrives as USDT to a wallet on the TON network or as Telegram Stars.

The inputs are covered in [how much clipping pays](/en/earnings/how-much-clipping-pays); the charges in [what commission DareBay charges](/en/help/what-commission) and [DareBay withdrawals](/en/help/darebay-withdrawals). For other platforms' rate, threshold and cap, see [the best clipping platforms](/en/earnings/best-clipping-platforms) or the fact sheet [DareBay at a glance](/en/about/darebay-at-a-glance).

## Frequently asked questions

### Why does the calculator show two totals?

The big figure is the accrual by the formula over four weeks; the "on hand" line is what reaches your wallet, the same sum minus the 10% withdrawal fee. The fee is taken at withdrawal, not at accrual, so your balance shows the first figure and your wallet receives the second.

### How many clips does it take to reach the withdrawal minimum?

The minimum request is 10 USDT, which pays out 9 USDT after the 10% fee. At $1 one clip at 10,000 views gets you there, or two at 5,000; at $10 one clip at 1,000 is enough. Clips under the task's threshold do not count toward that sum.

### Can I calculate several tasks with different rates?

The calculator handles one task: one rate, one threshold, one cap. Run each separately and add them up; the cap applies inside each task, and each task prints its own three numbers on the card.

### Does a rejected clip count toward the total?

No. Only clips that passed moderation and cleared the threshold go into the sum; a rejected clip is not paid, however many views it has. The calculator cannot know a clip will be rejected, so its figure is an upper estimate on the assumption that every clip is accepted.
