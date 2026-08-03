---
title: The view threshold for a DareBay payout
description: The minimum views a submission needs to join the budget split in a PPV contest. The live threshold, the default, and how organizers set it.
provenance: { snapshot_date: "2026-07-10", source: "darebay-prod" }
numbers_used: [ppv_min_views_threshold_live, ppv_default_min_views_threshold, ppv_cpm_median]
seo: true
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"Article","headline":"The view threshold for a DareBay payout","datePublished":"2026-07-10","dateModified":"2026-07-10","author":{"@type":"Organization","name":"DareBay"},"publisher":{"@type":"Organization","name":"DareBay"},"description":"The minimum views a submission needs to join the budget split in a PPV contest."}'
---

# The view threshold for a DareBay payout

To join the budget split of a DareBay PPV contest, a submission has to reach a minimum number of views — the threshold. Across live contests the median threshold is **2000 views**. Below that, nothing is paid for the submission. The organizer sets the threshold when creating the contest; if they leave it blank the system uses a default of **1000 views**. The platform acts as intermediary and guarantor: the budget is frozen and the split rules are fixed before the contest starts.

Every figure on this page comes from the platform's own data (snapshot: 2026-07-10).

## Why a threshold exists

Two reasons:

1. **Micro-fraud protection.** Without one, someone could upload dozens of submissions with 10 to 50 inflated views each and take a slice of the budget. The threshold makes that unprofitable: real reach is required.

2. **Reach that means something.** The organizer is paying for content people actually watch. A submission with a couple of hundred views delivers nothing. The threshold keeps the budget going only to content with a real audience.

## The default and the organizer's setting

| Parameter | Value | What it means |
|-----------|-------|---------------|
| System default | 1000 views | What the platform fills in when the organizer leaves the field blank |
| Median in live contests | 2000 views | The threshold organizers actually set in practice |
| Set by the organizer | Yes, at contest creation | They enter their own value; the default applies only to an empty field |

The organizer sees a "minimum views" field when creating a PPV contest. Left blank, it defaults to 1000. Across live contests the typical (median) threshold is 2000 — a reasonable balance between being reachable for clippers and protecting the budget.

## Below and above the threshold

| Situation | What happens |
|-----------|--------------|
| **Below** the threshold | The submission takes no part in the split and earns nothing. Its views are still counted and displayed; no money is allocated |
| **Exactly at** or **above** | The submission joins the split. The payout is views / 1000 * rate, subject to the per-submission cap if one is set |
| No submission reaches it | The entire budget returns to the organizer. The money does not disappear |

## A worked example

A contest with a 2000-view threshold and a rate of $0.50 per 1000 views:

- **Clipper A** got 8000 views — above the threshold. Payout: 8000 / 1000 * $0.50 = **$4.00**.
- **Clipper B** got 2000 views — exactly at it. Payout: 2000 / 1000 * $0.50 = **$1.00**.
- **Clipper C** got 1800 views — below it. **No payout.**

Clipper C's views are still visible in the stats, but no budget is allocated to that submission.

## Frequently asked questions

### Can the threshold go below the default?

The 1000-view default applies only when the organizer leaves the field blank. They are free to set their own value, including a lower one — and the exact threshold is always shown in the contest terms before you submit.

### What if I do not reach it?

The submission takes no part in the split and earns nothing. Your account is unaffected: no penalties, no blocks, no restrictions. You can enter the next contest.

### Are all views counted, or only unique ones?

The platform pulls view data through the API of the platform the work was published on — today that is TikTok. What the system sees is that platform's counter. Inflated views (bots, automated traffic) go through validation and can be rejected.

### Can an organizer set a very high threshold?

Yes, the choice is theirs. But an inflated threshold reduces participation: clippers see the terms before submitting and can simply skip a contest with an unrealistic one.

### When exactly is the threshold checked?

At finalization, when the system collects the final view figures. Until then views keep accumulating, so a creator has time to reach the minimum.

### Is the threshold the same across platforms?

It is expressed in views and does not depend on the platform. Which platforms are eligible for publication is stated in each contest's terms.

### Is the budget refunded if nobody reaches it?

Yes. If no submission clears the threshold, the whole budget returns to the organizer automatically. The platform works as intermediary and guarantor: the money is frozen, not lost.

## Where to next

- [How pay-per-view works](/en/earnings/how-pay-per-view-works) - the full mechanics, budget to payout
- [How it works](/en/how-it-works) - an overview of the DareBay mechanic
- [What DareBay pays per 1000 views](/en/earnings/pay-per-1000-views) - the rates in PPV contests
- [How much clipping pays](/en/earnings/how-much-clipping-pays) - realistic earning ranges
