---
title: The view threshold for a DareBay payout
description: How many views a submission needs to join the budget split in a PPV contest. The live median is 2000 views and the system default is 1000.
provenance: { snapshot_date: "2026-08-04", source: "darebay-prod" }
numbers_used: [ppv_min_views_threshold_live, ppv_default_min_views_threshold, ppv_cpm_median]
seo: true
---

# The view threshold for a DareBay payout

To join the wallet-backed budget split of a DareBay PPV contest, a submission has to reach a minimum number of views: the threshold. Across live contests the median threshold is **2000 views**. Below that, nothing is paid for the submission. The organizer sets the threshold when creating the contest, and leaving the field blank puts the system default of **1000 views** in place. The exact figure sits on the contest card and does not move after launch: the wallet-backed budget is frozen and the split rules are fixed before the contest opens.

Every figure on this page comes from the platform's own data (snapshot: 2026-08-04).

## Why a threshold exists

Two reasons:

1. **Micro-fraud protection.** Without one, someone could upload dozens of submissions carrying 10 to 50 inflated views each and skim a slice of the budget. The threshold wipes out the profit in that tactic: real reach is the only way through.

2. **Reach that means something.** The organizer is paying for content people actually watch, and a submission with a couple of hundred views delivers nothing. The threshold keeps the budget on content with a real audience, which leaves a bigger share of it for the honest authors.

## The default and the organizer's setting

| Parameter | Value | What it means |
|-----------|-------|---------------|
| System default | 1000 views | What the platform fills in when the organizer leaves the field blank |
| Median in live contests | 2000 views | The threshold organizers actually set in practice |
| Set by the organizer | Yes, at contest creation | They enter their own value; the default only fills an empty field |

The organizer sees a "minimum views" field when creating a PPV contest. Left blank, it defaults to 1000. In practice the typical (median) threshold across live contests is 2000, which balances staying reachable for clippers against protecting the budget.

## Below and above the threshold

| Situation | What happens |
|-----------|--------------|
| **Below** the threshold | The submission takes no part in the split and earns nothing. Its views are still counted and displayed, but no money is allocated |
| **Exactly at** or **above** | The submission joins the split. The payout is views / 1000 * rate, subject to the per-submission cap if one is set |
| No submission reaches it | The entire budget returns to the organizer. The money neither disappears nor stays with the platform |

## A worked example

A contest with a 2000-view threshold and a rate of $0.50 per 1000 views:

- **Clipper A** got 8000 views, above the threshold. Payout: 8000 / 1000 * $0.50 = **$4.00**.
- **Clipper B** got 2000 views, exactly at it. Payout: 2000 / 1000 * $0.50 = **$1.00**.
- **Clipper C** got 1800 views, below it. **No payout.**

Clipper C's views still show in the stats, but no budget is allocated to that submission.

## Frequently asked questions

### Can the threshold go below the default?

Yes. The 1000-view default only fills an empty field. The organizer enters whatever value they want, lower ones included, and the exact threshold is always in the contest terms before you submit.

### What if I do not reach it?

The submission takes no part in the split and earns nothing. Your account is untouched: no penalties, no blocks, no restrictions. The next contest is open to you on the same terms.

### Are all views counted, or only unique ones?

The system reads the counter of the platform the work was published on, today TikTok, from its published counter through the configured tikwm oracle. Inflated views do not get through that counter: a submission with bot dynamics is pulled from the contest outright rather than paid in part.

### Can an organizer set a very high threshold?

The choice is theirs, but an inflated threshold costs them: clippers read the terms before submitting and simply walk past a contest with an unrealistic minimum.

### When exactly is the threshold checked?

At finalization, when the system collects the final view figures. Until then views keep accumulating, so a creator has time to reach the minimum.

### Is the threshold the same across platforms?

It is expressed in views and does not depend on the platform. Which platforms are eligible for publication is stated in each contest's terms.

### Is the budget refunded if nobody reaches it?

Yes. If no submission clears the threshold, the whole budget returns to the organizer. The platform works as intermediary and guarantor: the wallet-backed money is frozen, not lost.

## Where to next

- [How pay-per-view works](/en/earnings/how-pay-per-view-works) - the full mechanics, budget to payout
- [How it works](/en/how-it-works) - an overview of the DareBay mechanic
- [What DareBay pays per 1000 views](/en/earnings/pay-per-1000-views) - the rates in PPV contests
- [How much clipping pays](/en/earnings/how-much-clipping-pays) - realistic earning ranges
