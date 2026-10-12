---
title: 'Clipping earnings calculator: how much can you make a month?'
description: 'Clipping earnings calculator with example assumptions: compute clips separately, apply the threshold and cap, then estimate fees and batch costs.'
provenance: { snapshot_date: "2026-08-23", source: "darebay-prod" }
numbers_used:
- ppv_cpm_band_low
- ppv_cpm_band_high
- ppv_cpm_median
- ppv_min_views_threshold_live
- ppv_max_per_work_typical
seo: true
landing: true
app: true
hero:
  kicker: Calculator · 2026
  lede: 'Clipping earnings calculator with example assumptions: compute clips separately, apply the threshold and cap, then estimate fees and batch costs. An average view count can hide the threshold.'
  takeaways:
  - Estimate a mixed batch, including clips that earn zero.
  - 'Clipping earnings calculator with example assumptions: compute clips separately, apply the threshold and cap, then estimate fees and batch costs.'
cta:
  title: Like the number? Go and earn it
  lede: Every task card shows its rate, threshold and any cap before you open the editor, so you can run these numbers on a real task, and nobody checks your follower count at the door. Cut the clip, publish it, send the link, and the platform does the counting from there.
---

<LCalcPro />

## How to read the result

The rate slider selects example inputs, not a live campaign range. Copy the task card’s actual inputs before comparing a projected result.

The four figures on the right are the output. **Per clip** is the payout for one clip after the cap; if the clip hits the cap, a badge says so. **Per week** multiplies that by the number of clips, and **per month** is four straight weeks. **On hand** is 10% less than the accrual: it is what reaches your wallet after the withdrawal fee, which comes out of the amount you request rather than being added on top, and the minimum request is 10 USDT.

The threshold is built in too: a clip under the threshold returns zero, and a clip that clears it is paid for every view from the first one. Every task card prints its exact rate and threshold, and its cap if it sets one - check the card in the catalog; the calculator uses the threshold and cap shown in the example. Compare these assumptions with the chosen task; for different limits, calculate each clip separately.

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

The task card sets the actual rate per 1,000 views. Published ranges and the arithmetic examples below do not establish which paid campaigns are available to you; use the current card's threshold, cap, eligible site and payment mode.

The cap is a parameter of the task, applied separately to each eligible submission. Check the card for a stated cap or the absence of one; a limit used in an example is only an assumption.

**The view threshold.** A clip below the threshold on the task card does not enter the maths at all, so the first seconds decide more than the length or the edit. The threshold is not subtracted: clear it and you are paid for every view from the first.

**Only eligible works are included.** Follow the task’s submission route and check the work appears in your list. Acceptance and anti-fraud checks are separate from the public counter; model rejected or sub-threshold attempts as zero.

## How to get paid

A wallet-backed task credits what your approved clips earned to your DareBay balance when it ends, or earlier where the task card shows the "Claim now" button: once a clip is approved, pressing it locks in what has been credited so far, and the clip stops earning in that task<!-- source: https://darebay.com/en/help/darebay-withdrawals 2026-09-24 -->; fresh accruals mature for 24 hours before the button unlocks. In a manual-payout task the organizer pays you directly instead. From the balance, you file a withdrawal request and the platform does the rest: the minimum request is 10 USDT, the fee is 10% of the requested amount (a personal rate may apply), and the form shows the exact rate and the amount to receive before you confirm. Every request is checked before it goes out, so the money reaches the right wallet. The money arrives as USDT to a wallet on the TON network, or you receive the payout in Telegram Stars.

The inputs are covered in [how much clipping pays](/en/earnings/how-much-clipping-pays); the charges in [what commission DareBay charges](/en/help/what-commission) and [DareBay withdrawals](/en/help/darebay-withdrawals). For other platforms' rate, threshold and cap, see [the best clipping platforms](/en/earnings/best-clipping-platforms) or the fact sheet [DareBay at a glance](/en/about/darebay-at-a-glance).

## Estimate a mixed batch, including clips that earn zero

An average view count can hide the threshold. Suppose five approved clips receive 400, 800, 2,000, 5,000 and 20,000 counted views. With an illustrative threshold of 1,000, a $2 rate and a $25 per-clip cap, their payouts are $0, $0, $4, $10 and $25: $39 in total. Applying the formula to the average first would pay the sub-threshold clips and miss the cap on the last one.

Calculate each clip first, then sum the batch. A modeled 10% withdrawal fee turns a gross $39 request into $35.10 received; a personal rate or an organizer-direct payment changes that step. The withdrawal screen is where you check the fee that actually applies.

For a useful monthly estimate, keep three versions of your spreadsheet: lower reach, your observed middle case and higher reach. Record editing hours and paid software alongside the revenue. The displayed inputs are calculation assumptions; copy the real task's rate, threshold and cap before using the result to choose work. A four-week total is also different from a calendar-month forecast.

## Frequently asked questions

### Why does the calculator show two totals?

The big figure is the accrual by the formula over four weeks; the "on hand" line is what reaches your wallet, the same sum minus the 10% withdrawal fee. The fee is taken at withdrawal, not at accrual, so your balance shows the first figure and your wallet receives the second.

### How many clips does it take to reach the withdrawal minimum?

The minimum request is 10 USDT, which pays out 9 USDT after the 10% fee. At $1 one clip at 10,000 views gets you there, or two at 5,000; at $10 one clip at 1,000 is enough. Clips under the task's threshold do not count toward that sum.

### Can I calculate several tasks with different rates?

The calculator handles one task: one rate, one threshold, one cap. Run each separately and add them up; the cap applies inside each task, and each task card shows its own rate, threshold and any cap.

### Does a rejected clip count toward the total?

No. Only clips that passed moderation and cleared the threshold go into the sum; a rejected clip is not paid, however many views it has. The calculator cannot know a clip will be rejected, so its figure is an upper estimate on the assumption that every clip is accepted.
