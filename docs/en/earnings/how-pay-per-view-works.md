---
title: How pay-per-view works on DareBay
description: "The mechanics of DareBay pay-per-view: budget, independent counting, formula, credit or obligation, and manual fulfilment."
provenance: { snapshot_date: "2026-07-11", source: "darebay-prod" }
numbers_used: [ppv_cpm_median, ppv_min_views_threshold_live, ppv_max_per_work_typical, selection_creator_window_min, winner_confirmation_min]
seo: true
---

# How pay-per-view works on DareBay

Pay-per-view works like this: the organizer records a funded budget, clippers publish content, and the platform counts views from the published TikTok counter through the configured tikwm oracle and calculates each amount by formula. After checks, the creator receives a credit or payout obligation with a status. Fulfilment can be manual: calculating the result and transferring money are different stages.

Every figure on this page comes from the platform's own data (snapshot: 2026-07-11).

## The full chain, budget to payout

Here is everything that happens between the contest being created and the money arriving:

1. **The organizer locks the budget in wallet-backed mode.** When creating a PPV contest they set the parameters (rate, threshold, cap) and freeze the whole budget on the platform. The money leaves the organizer's balance and is tied to that contest. It cannot be withdrawn before the contest ends.

2. **Clippers publish their work and send the link.** Creators take the task, film, and publish on TikTok with the required hashtag (the task names the platform). Then each one sends DareBay the link to their video: only then does the submission enter the contest.

3. **The oracle counts views.** The platform pulls view data from the published TikTok counter through the configured tikwm oracle and checks it for inflation. More on this in [how views are counted](/en/earnings/how-views-are-counted).

4. **A deterministic split by formula.** When the contest ends, the system computes each submission's payout: `views / 1000 * rate`. Submissions below the minimum view threshold take no part in the split. The per-submission cap limits the maximum.

5. **The creator amount is recorded.** The platform creates a credit or payout obligation. The available method and next status depend on the flow, and fulfilment can be manual.

6. **The remainder goes back.** If the budget is not fully spent, because few people entered or submissions did not reach enough views, the unspent part returns to the organizer's balance.

## PPV parameters

| Parameter | Value | What it means |
|-----------|-------|---------------|
| Median rate | $0.50 per 1000 views | The typical rate across live contests |
| View threshold | 2000 views | Typical in live contests; the exact figure is the organizer's |
| Cap per submission | $100 | Typical in live contests; the maximum one submission can earn |
| Selection window | 24 hours | Time for the organizer to review submissions after entries close |
| Confirmation window | 48 hours (2 days) | Time to confirm results before the payout |

The organizer sets the rate, threshold and cap when creating the contest and cannot change them after launch. The threshold is what keeps the budget from being spread across dozens of submissions with a handful of views each.

## A worked example

Say an organizer creates a contest with a $200 budget, a rate of $0.50 per 1000 views, a threshold of 2000 views and a $100 cap per submission. Three clippers enter:

- **Creator A:** at 120,000 views the maths is 120,000 / 1000 * $0.50 = **$60**, below the $100 cap.
- **Creator B:** at 40,000 views, 40,000 / 1000 * $0.50 = $20. Below the cap, so they receive **$20**.
- **Creator C:** at 1500 views the 2000 threshold is not met, so the submission **takes no part** in the split.

Paid out: $60 + $20 = $80. The remaining $120 returns to the organizer.

The cap applies per submission: several different videos can be entered, and each is counted on its own.

## Why a threshold and a cap

The **threshold** (2000 views) filters out submissions with minimal reach. Without it the budget would spread across hundreds of entries that got 10 to 50 views each. With it, the money goes to content people actually watch.

The **cap** ($100 per submission) stops one creator taking the whole budget. If a single clip goes viral to a million views, without a cap it would eat the entire pool. With one, everything above the limit returns to the organizer.

More on this in [the view threshold](/en/earnings/view-threshold).

## Frequently asked questions

### Who counts the views?

The platform pulls them from the published TikTok counter through the configured tikwm oracle. Neither the organizer nor the participant types a number in by hand. It is an independent count that neither side can adjust.

### What if someone inflates their views?

The system checks views before the split. Suspicious spikes, whether bots or purchased views, get filtered out. Details in [how views are counted](/en/earnings/how-views-are-counted).

### When does the money arrive?

After the contest ends, selection and confirmation windows run. The platform then records a credit or payout obligation. Fulfilment and withdrawal can be manual, so there is no guaranteed deadline from entries closing to money received.

### What payout methods are available?

The contest defines its reward method. For an available-balance withdrawal, the form offers USDT to an external wallet or Telegram Stars; other methods can be fulfilled manually.

### What if a contest gets no entries?

If no submission clears the view threshold, or there were no submissions at all, the whole budget returns to the organizer. The money does not disappear.

### Can the organizer refuse to pay?

The organizer cannot arbitrarily change the recorded formula or erase an existing obligation.
The platform acts as intermediary and guarantor and stores the budget, result and payout status.
Fulfilment through payout details can be manual and is not promised as an instant transfer.

### Is there a minimum to take part?

For a clipper there is none: taking part is free and there are no deposits. The only condition is clearing the contest's view threshold (2000 in live contests) so the submission joins the split.

## Where to next

- [Earning from clips](/en/earn/clips) - rates, payouts and terms
- [How views are counted](/en/earnings/how-views-are-counted) - the oracle, validation and fraud protection
- [The view threshold](/en/earnings/view-threshold) - default, median, and how organizers set it
- [What fees does DareBay charge?](/en/help/what-commission) - current terms by operation
- [Does DareBay really pay?](/en/about/does-darebay-really-pay) - what backs the payout
- [How winners are chosen](/en/help/how-winners-are-chosen) - selection types other than PPV
