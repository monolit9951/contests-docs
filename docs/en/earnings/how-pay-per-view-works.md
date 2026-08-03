---
title: How pay-per-view works on DareBay
description: The mechanics of a DareBay PPV contest - from locking the budget to paying clippers automatically against validated views.
provenance: { snapshot_date: "2026-07-11", source: "darebay-prod" }
numbers_used: [ppv_cpm_median, ppv_min_views_threshold_live, ppv_max_per_work_typical, selection_creator_window_min, winner_confirmation_min]
seo: true
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"Article","headline":"How pay-per-view works on DareBay","datePublished":"2026-07-10","dateModified":"2026-07-10","author":{"@type":"Organization","name":"DareBay"},"publisher":{"@type":"Organization","name":"DareBay"},"description":"The mechanics of a DareBay PPV contest - from locking the budget to paying clippers automatically against validated views."}'
---

# How pay-per-view works on DareBay

Pay-per-view on DareBay works like this: the organizer locks a budget on the platform, clippers publish their content, the platform counts views automatically through the platforms' APIs and splits the money by formula. Each creator gets a share proportional to their real views. The platform acts as intermediary and guarantor: the money is frozen until finalization, the organizer cannot take it back, and the payout runs automatically with no human in the loop. A clipper never has to negotiate with the buyer directly.

Every figure on this page comes from the platform's own data (snapshot: 2026-07-11).

## The full chain, budget to payout

1. **The organizer locks the budget.** When creating a PPV contest they set the parameters (rate, threshold, cap) and freeze the whole budget on the platform. The money leaves the organizer's balance and is tied to that contest. It cannot be withdrawn before the contest ends.

2. **Clippers publish their work.** Creators take the brief, film, and publish on TikTok with the required hashtag (the platform is named in the brief). Each submission is registered in the system.

3. **The oracle counts views.** The platform pulls view data automatically through the platforms' APIs. Views are validated: the system checks them for inflation. More on this in [how views are counted](/en/earnings/how-views-are-counted).

4. **A deterministic split by formula.** When the contest ends, the system computes each submission's payout: `views / 1000 * rate`. Submissions below the minimum view threshold take no part in the split. The per-submission cap limits the maximum.

5. **Automatic payout.** Each clipper receives their share via wallet, card or another chosen method. The organizer plays no part in it.

6. **The remainder goes back.** If the budget is not fully spent — few entrants, or submissions that did not reach enough views — the unspent part returns to the organizer's balance automatically.

## PPV parameters

| Parameter | Value | What it means |
|-----------|-------|---------------|
| Median rate | $0.50 per 1000 views | The typical rate across live contests |
| View threshold | 2000 views | Typical in live contests; the exact figure is the organizer's |
| Cap per submission | $50 | Typical in live contests; the maximum one submission can earn |
| Selection window | 24 hours | Time for the organizer to review submissions after entries close |
| Confirmation window | 48 hours (2 days) | Time to confirm results before the payout |

The organizer sets the rate, threshold and cap when creating the contest. The threshold is what keeps the budget from being spread across dozens of submissions with a handful of views each.

## A worked example

Say an organizer creates a contest with a $200 budget, a rate of $0.50 per 1000 views, a threshold of 2000 views and a $50 cap per submission. Three clippers enter:

- **Creator A:** at 120,000 views the maths is 120,000 / 1000 * $0.50 = $60. The cap is $50, so they receive **$50**.
- **Creator B:** at 40,000 views, 40,000 / 1000 * $0.50 = $20. Below the cap, so they receive **$20**.
- **Creator C:** at 1500 views the 2000 threshold is not met, so the submission **takes no part** in the split.

Paid out: $50 + $20 = $70. The remaining $130 returns to the organizer.

The cap applies per submission: several different videos can be entered, and each is counted on its own.

## Why a threshold and a cap

The **threshold** (2000 views) filters out submissions with minimal reach. Without it the budget would spread across hundreds of entries that got 10 to 50 views each. It rewards content people actually watch.

The **cap** ($50 per submission) stops one creator taking the whole budget. If a single clip goes viral to a million views, without a cap it would eat the entire pool. With one, everything above the limit returns to the organizer.

More on this in [the view threshold](/en/earnings/view-threshold).

## Frequently asked questions

### Who counts the views?

The platform pulls them automatically through the source platform's API — today that is TikTok. Neither the organizer nor the participant types a number in by hand. It is an independent count that neither side can adjust.

### What if someone inflates their views?

The system validates views before the split. Suspicious spikes — bots, purchased views — are checked and can be rejected. Details in [how views are counted](/en/earnings/how-views-are-counted).

### When does the money arrive?

After the contest ends there is a selection window (up to 24 hours) and a confirmation window (up to 48 hours). After that the payout runs automatically. From entries closing to money in hand is usually no more than 3 days.

### What payout methods are available?

Several: wallet (USDT on TON), bank card, bank transfer, Telegram Stars and Telegram gifts. The wallet is one of them, not the only one.

### What if a contest gets no entries?

If no submission clears the view threshold — or there were no submissions at all — the whole budget returns to the organizer. The money does not disappear.

### Can the organizer refuse to pay?

No. The budget is frozen when the contest is created and the organizer takes no part in the payout. The platform works as intermediary and guarantor: the money is locked, the payout automatic.

### Is there a minimum to take part?

For a clipper there is none: taking part is free and there are no deposits. The only condition is clearing the contest's view threshold (typically 2000) so the submission joins the split.

## Where to next

- [How it works](/en/how-it-works) - an overview of the DareBay mechanic
- [How views are counted](/en/earnings/how-views-are-counted) - the oracle, validation and fraud protection
- [The view threshold](/en/earnings/view-threshold) - default, median, and how organizers set it
- [What commission does DareBay take?](/en/help/what-commission) - the platform's cut from the organizer
- [Does DareBay really pay?](/en/about/does-darebay-really-pay) - how the payout is secured
- [How winners are chosen](/en/help/how-winners-are-chosen) - selection types other than PPV
