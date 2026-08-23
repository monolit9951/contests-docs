---
title: How pay-per-view works on DareBay
description: "The money chain in a DareBay PPV contest: a frozen budget, a submission sent by link, an automatic calculation, the credit, and the ways and timing of getting paid."
provenance: { snapshot_date: "2026-08-23", source: "darebay-prod" }
numbers_used: [ppv_cpm_median, ppv_min_views_threshold_live, ppv_max_per_work_typical]
seo: true
---

# How pay-per-view works on DareBay

You cut a clip and you want to understand where the money comes from. On DareBay that is a closed chain: in a wallet-backed contest the budget is frozen on the platform before you take the task, the rate and the cap are fixed on the card, and the amount is worked out by a formula against the published view counter. Open contests pay from $1.00 per 1000 views, and the typical cap on one submission is $100. The system does the maths; moving the money is a separate stage and it can be handled by hand. Below is the whole chain step by step, and at the end the answers on timing, reward methods and submitting more than one clip.

Every figure on this page comes from the platform's own data (snapshot: 2026-08-23) and counts only open contests - the ones a clipper can take right now.

## The full chain: budget to payout

Here is what happens between the contest being created and the money arriving:

1. **The organizer locks the budget in wallet-backed mode.** Creating a PPV contest, the organizer sets the parameters (rate, threshold, cap) and freezes the whole budget on the platform. The money leaves their balance and is tied to that specific contest: it cannot be taken back before the contest ends. Some contests run without a locked pool, in manual mode - then the platform holds no budget of theirs, and that changes step 6 only.

2. **The clipper publishes the work and sends the link.** The author takes the brief, makes the video and publishes it on the site named in the contest terms. Then they send DareBay a link to the published video - the link is what binds the submission to the contest, and until that moment the work is not in the contest at all. There is no import of submissions by hashtag. A hashtag is needed where the brief spells it out, and it is required for an anonymous submission: there the tag in the video description is the proof that the clip was made for this brief.

3. **An independent counter reads the views.** Nobody types the figures in by hand, neither the author nor the organizer: an independent counter reads the published view counter on the site. Moderation and basic checks run on top of that, and a submission with suspicious growth goes on hold. A hold is a state of its own, not an automatic removal: after review, or on timeout, a payout for that submission may still go through. More in [how views are counted for the payout](/en/earnings/how-views-are-counted).

4. **The formula runs.** When the contest closes, the system works out the payout for each submission: `views / 1000 * rate`. The threshold is an entry condition, not a deduction: a submission that did not clear it takes no part in the split, and one that did goes into the maths with its whole counter. The cap limits the amount for a single submission.

5. **The amount is recorded against the author.** The platform creates a credit or a payout obligation with a status. The organizer cannot recompute the formula after the fact or erase the obligation - it lives on the platform's side.

6. **An undistributed remainder goes back to the organizer.** That is the rule for contests with a frozen wallet-backed budget: the platform holds the money and returns the unspent part to the organizer's balance. In contests without a locked pool (direct debit) there is nothing to return - no leftover refund is queued there, because the platform never held the budget in the first place.

## The parameters of the PPV mechanic

| Parameter | Value | What it means |
|-----------|-------|---------------|
| Typical rate | $1.00 per 1000 views | The floor across open contests; the organizer names their own |
| View threshold | 2000 views | The typical figure across open contests; the organizer sets the exact value |
| Cap on one submission | $100 | The typical value in open contests; the maximum for a single submission |
| Site | Set by the contest | Live view counting works for TikTok, YouTube and Instagram |

The organizer sets the rate, the threshold and the cap when creating the contest and does not move them after launch - all three numbers are visible on the card before you submit, so you know in advance what you are playing for. The view threshold keeps a budget from being smeared across dozens of submissions with a handful of views each.

The site is set by the contest too, and that is not a formality: you have to publish where the brief says. A video on a different site is nothing the platform can count - the view counter is read where the video is published.

## The calculation is automatic, the transfer can be manual

These are two different stages, and separating them is more honest than promising "money right after the contest".

**The system computes.** The formula is deterministic: the same views at the same rate give the same amount. Neither the organizer nor support writes a result in by hand, and nobody has a "credit them less" button. The result is recorded as a credit or a payout obligation with a status you can see in the contest.

**A person executes.** A transfer to your payout details and a balance withdrawal can be processed by hand: a staff member checks the details and puts the operation through. So between "the amount is recorded" and "the money is in your hands" there is a step that depends on people, not on code.

**No deadline is promised.** DareBay does not claim a standard like "paid within N hours" and does not promise an instant transfer. The support here is different: a wallet-backed contest budget is already frozen on the platform, the calculation is already recorded in a status, and it cannot be replayed in anyone's favour. If a status sits unchanged for a long time, write to support with the request identifier rather than creating a second one.

Taking part costs a clipper nothing: the platform charges nothing for a submission and holds back no share of the calculated prize. Withdrawing a balance is a separate operation with its own terms - see [what fees does DareBay charge](/en/help/what-commission) and [withdrawing money from DareBay](/en/help/darebay-withdrawals).

## What happens to an unspent budget

A PPV contest budget is not split "evenly among whoever turned up" - it is spent against the views actually earned. So there is nearly always a part that nobody earned.

A remainder appears in three situations:

- **Fewer submissions arrived than the organizer expected.** Only the videos that were sent are paid for; the rest is not spent.
- **Submissions missed the threshold.** A video with 1500 views against a 2000 threshold does not enter the split, and its share of the budget stays untouched.
- **A submission hit the cap.** At $1.00 per 1000 views a video with 80,000 views comes to 80,000 / 1000 * $1.00 = **$80.00** by the formula - below the cap, so the author gets all of it. A video with 400,000 views would come to 400,000 / 1000 * $1.00 = **$400.00**, but against a cap of $100 the calculation takes $100 and the difference stays in the contest budget.

What happens next depends on the contest type. In a contest with a frozen wallet-backed budget the unspent part returns to the organizer's balance: the money neither burns nor stays with the platform. In a contest with direct debit the budget was never held up front, so there is no remainder to return and no refund queue is created.

For a clipper the conclusion is simple: somebody else's shortfall in views does not raise your figure. You are paid exactly what your video earned, not a share of "whatever is left".

## Frequently asked questions

### When does the money arrive?

The calculation starts once the contest closes: the system fixes the views, works out the amounts by formula and creates a credit or a payout obligation with a status. Execution follows, and it can be handled by hand, so DareBay promises no fixed period between the close of entries and money in your hands. If a submission went on hold over suspicious growth, the decision on it is taken separately - up to and including a payout on timeout. Track the state on the contest card, and after a credit, in the status of the withdrawal request. What does not depend on timing: a wallet-backed contest budget has been frozen since creation, and a recorded calculation cannot be recomputed in anyone's favour.

### What payout methods are available?

The reward method is set by the contest and it is visible on the card before you submit. A reward can be money or an item; for a cash reward the contest can name a wallet (USDT on TON), a card, a bank transfer or Telegram Stars, while an item is handed over between the organizer and the winner. To withdraw a balance that has already been credited, the withdrawal wizard offers USDT to an external wallet and Telegram Stars; other methods are executed separately and can be processed by hand. Go by what your own request form shows: the minimum amount, the fee and the order of processing are described in [withdrawing money from DareBay](/en/help/darebay-withdrawals). The platform never asks you to send money somewhere in advance to "activate" or "speed up" a payout.

### Can I submit more than one clip?

Yes, unless the terms of that particular contest limit how many submissions come from one author. The cap applies to one submission, not to the author, so each video is counted separately: its own link, its own view counter, its own threshold. Two videos are two links and two independent submissions, and a weak result on one does not drag the other down. Two limits are worth remembering. First: several submissions do not get around the per-video cap - each submission has its own. Second: copies of the same video are not several submissions but a reason for a moderation check, and originality requirements are in the contest terms.

### Can the organizer refuse to pay?

The organizer cannot arbitrarily change a recorded formula, lower the rate after the fact or delete an obligation. In wallet-backed mode the budget is frozen on the platform before you took the task and sits there for the whole contest. DareBay acts as intermediary and guarantor: it holds the budget, the result of the calculation and the payout status. Execution against your payout details can be manual and is not promised as an instant transfer.

### Who counts the views and what happens to inflated views?

That is answered on its own page: [how views are counted for the payout](/en/earnings/how-views-are-counted).

### What if a contest gets no entries?

That is answered on its own page: [what if nobody enters](/en/help/if-nobody-enters).

## Where to next

- [How views are counted for the payout](/en/earnings/how-views-are-counted) - the independent counter, the threshold and inflated views
- [How much you can earn from clips](/en/earnings/how-much-clipping-pays) - working out the amount, and whether followers matter
- [What DareBay pays per 1000 views](/en/earnings/pay-per-1000-views) - the rate reference
- [What fees does DareBay charge](/en/help/what-commission) - the current terms per operation
- [Earning from clips](/en/earn/clips) - live contests and the terms of entry
