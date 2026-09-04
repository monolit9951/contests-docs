---
title: "How pay-per-view works: how views are counted and paid"
description: "The platform reads the site's counter and the formula views / 1000 × rate sets the payout: the 2000-view threshold is not deducted, the typical cap is $100."
provenance: { snapshot_date: "2026-08-23", source: "darebay-prod" }
numbers_used: [ppv_cpm_band_low, ppv_cpm_band_high, ppv_cpm_median, ppv_min_views_threshold_live, ppv_default_min_views_threshold, ppv_max_per_work_typical]
seo: true
landing: true
hero:
  kicker: "Guide · 2026"
  lede: "You cut a clip and want to know where the money comes from and who counts the views. On DareBay the chain is closed: a wallet-backed budget is frozen up front, the platform reads the counter, a formula sets the amount, and the transfer can be handled by hand."
  takeaways:
    - "<b>The platform reads the views, not a person:</b> an independent counter takes the site's public counter at the link you sent, and both sides see one figure."
    - "<b>The threshold is not deducted:</b> clear the typical 2000 views and the whole counter goes into the maths; the system default is 1000 and buyers usually raise it."
    - "<b>The formula is deterministic:</b> views / 1000 × rate, never above the cap on one submission (usually $100), and it cannot be recomputed in anyone's favour."
    - "<b>The calculation is automatic, the transfer can be manual:</b> no deadline is promised, but a wallet-backed budget is frozen before you start."
cta:
  title: "Take a task whose arithmetic you can check"
  lede: "The rate, the threshold and the cap are fixed on the DareBay task card before the start, and the result of the calculation is recorded against you. Pick a task and send the link."
---

## The full chain: budget to payout

1. **The buyer sets the terms and funds the budget.** The buyer names the rate, the threshold and the cap; in wallet-backed mode the budget is frozen on the platform until the task ends, while direct-payment tasks change step 6 only.
2. **The clipper publishes the clip and sends the link.** You publish on the site named in the terms, and a submission enters the task only through the link you send: there is no import by hashtag.
3. **A moderator checks the terms, the platform reads the views.** Nobody types the figure in by hand: an independent counter reads the published view counter on the site. A submission with suspicious growth goes on hold, which is a pause, not a removal.
4. **The formula sets the amount.** At the end the system works out the payout for each submission: `views / 1000 × rate`. The threshold is an entry condition, not a deduction, and the cap limits one submission.
5. **The amount is recorded against the author.** The platform creates a credit with a status that the buyer cannot recompute or erase. Once a submission is approved, the credit can be locked in with "Claim now", and fresh credits mature for 24 hours.
6. **An undistributed remainder goes back to the buyer.** In a wallet-backed task the platform holds the budget and returns the unspent part to the buyer's balance; with direct payment there is nothing to return.

## Task parameters: rate, threshold, cap, site

| Parameter | Value | What it means |
|---|---|---|
| Rate | from $1.00 to $2.00 per 1000 views across open tasks | The typical rate is $1.00; the buyer names their own |
| View threshold | 2000 views (typical); the system default is 1000 | The entry condition; the buyer sets the exact value |
| Cap per submission | $100 (typical) | The most one submission can earn |
| Site | Set by the task | Stats are collected for TikTok, YouTube and Instagram |

All three numbers are fixed at creation and stand on the card before you submit. Every figure on this page comes from the platform's own data (snapshot: 2026-08-23) and counts only open tasks.

## Where the view figure comes from and who confirms it

An independent counter reads the published view counter on the site at the link you sent when you submitted. Both sides look at the same number, and there is no manual entry anywhere in the chain. The platform does not recount the counter its own way, and only moderation and basic checks run above it. The counter is refreshed several times a day, so the figure in your cabinet can lag the site by a few hours; the final value is fixed at task finalization, and views gathered after that no longer count.

## The threshold is not deducted: the whole counter counts

The threshold is an admission condition, not a deductible: it only decides whether the submission takes part in the budget split. The buyer sets it in the "minimum views" field; left empty, the system fills in its default of **1000 views**, and in practice buyers set it higher: the typical threshold across open tasks is **2000 views**.

An example: a threshold of 2000 views, a rate of $1.00 per 1000 views, and a submission that reached 6000 views.

- **How DareBay counts it:** 6000 / 1000 × $1.00 = **$6.00**; all 6000 views go into the maths.
- **If the threshold were deducted:** only the remainder would count, 4000 / 1000 × $1.00 = **$4.00**.

| Views on the submission | Task threshold | What goes into the maths |
|---|---|---|
| 1800 | 2000 | nothing, the threshold was not cleared |
| 2000 | 2000 | 2000 views |
| 6000 | 2000 | 6000 views |

The most valuable stretch in a task is the last few hundred views before the threshold: they turn a zero into a payout on the whole counter.

## Which views go into the maths

| Views | In the maths | Note |
|---|:-:|---|
| The video counter on the task's site | Yes | Public value at your link |
| Views gathered before the threshold was cleared | Yes | The threshold is not deducted |
| Views after the final data collection | No | The counter is taken as of task finalization |
| A copy of the video on another site or account | No | One link per submission |
| A video deleted or hidden before finalization | No | Nothing left to read or confirm |
| A photo post instead of a video on Instagram | No | A photo post has no view counter |
| A submission rejected by moderation | No | No part in the split |

The platform takes the number the site's public counter shows and does no deduplication of its own, so keep the video published until the task is over.

## Suspicious growth: the hold and its three outcomes

A submission whose growth pattern looks suspicious is flagged and goes on hold: crediting for it is paused pending review. It is a pause followed by a moderation decision with three possible outcomes: the submission goes through and the whole counter goes into the maths; it stays on hold, and once the review period runs out a payout for it is possible; or moderation rejects it, and there is no money for it. Buying views is therefore a bad bet: you pay for them up front, while a payout on that submission is guaranteed by nothing.

## The calculation is automatic, the transfer can be manual

**The system computes.** The formula is deterministic: the same views at the same rate give the same amount, and the result is recorded as a credit with a status you can see in the task.

**A person executes.** A transfer to your payout details and a balance withdrawal are processed by hand, so between "the amount is recorded" and "the money is in your hands" there is a step that depends on people, not on code. DareBay does not claim a standard like "paid within N hours" and does not promise an instant transfer. The support is different: a wallet-backed task budget is already frozen on the platform, the calculation is already recorded in a status, and it cannot be replayed in anyone's favour. Taking part costs a clipper nothing; withdrawing a balance is a separate operation, see [what fees does DareBay charge](/en/help/what-commission).

## What happens to an unspent budget

A PPV task budget is spent against the views actually earned, so there is nearly always a part that nobody earned: fewer submissions than expected, some below the threshold, or a submission that hit the cap. In a wallet-backed task the unspent part returns to the buyer's balance; with direct payment the budget was never held up front, so there is nothing to return.

## Frequently asked questions

### When does the money arrive?

The calculation starts at the end of the task and produces a credit with a status; once a submission is approved, the credit can be locked in with "Claim now", and fresh credits mature for 24 hours. Execution is handled by hand, so DareBay promises no fixed period; a submission on hold is decided separately, up to and including a payout on timeout.

### What payout methods are available?

The withdrawal wizard offers USDT to an external wallet on the TON network and Telegram Stars: the minimum withdrawal is 10 USDT, the withdrawal fee is 10% of the requested amount (a personal rate is possible), and processing is manual. In tasks with direct payment the organizer pays you themselves, in Stars or to a TON wallet; the platform never asks you to send money in advance to "activate" a payout. Details: [withdrawing money from DareBay](/en/help/darebay-withdrawals).

### Can I submit more than one clip?

Yes, unless the terms of that task limit submissions from one author. The cap applies to one submission, not to the author, so each video is counted separately; copies of the same video are not several submissions but a reason for a moderation check.

### What happens if I inflate my views?

The submission goes on hold and crediting for it stops pending review; moderation can reject it outright, and then it takes no part in the budget split. The money you spent is already gone; the buyer's side of that protection is in [protection from view fraud](/en/help/protection-from-view-fraud).

### Are all views counted, or only unique ones?

The platform takes the number the site's public counter shows and does no deduplication of its own on top of it: whatever the site counts as a view goes into the maths once the threshold is cleared.

## Where to next

- [How much clipping pays](/en/earnings/how-much-clipping-pays) - the formula and the rate per 1000 views
- [Protection from view fraud](/en/help/protection-from-view-fraud) - what the buyer sees
- [What fees does DareBay charge](/en/help/what-commission) - current terms
- [Does DareBay really pay?](/en/about/does-darebay-really-pay) - what backs the payout
- [Earning from clips](/en/earn/clips) - live tasks
