---
title: How to set up a clipping contest on DareBay
description: A step-by-step guide to setting up a pay-per-view contest - how to choose the rate, the threshold and the cap, lock the budget and get the remainder back.
provenance: { snapshot_date: "2026-08-15", source: "darebay-prod" }
numbers_used: [ppv_default_min_views_threshold, ppv_min_views_threshold_live, ppv_max_cpm_rate]
seo: true
---

# How to set up a clipping contest on DareBay

A clipping contest is promotion you pay for by results. You fund the budget and set three parameters: the rate per 1000 views, the view threshold and the cap per submission. In the wallet-backed mode the platform holds the money and returns what the clippers did not earn; in the manual-payout mode no money enters the DareBay wallet and you settle with creators directly. Clippers publish their videos and send in the links, and every amount due is worked out by formula from independently counted views.

Every figure on this page comes from the platform's own data (snapshot: 2026-08-15).

## Step by step

### 1. Set the rate per 1000 views

The rate defines what you pay for every thousand counted views of a clipper submission. You state it when creating the contest, and it does not change after launch - creators work on the terms they saw. The higher the rate, the more readily creators take the task and the faster the budget burns. For more on how the calculation works, see [how pay-per-view works](/en/earnings/how-pay-per-view-works).

### 2. Set the minimum view threshold

The threshold filters out submissions with a handful of views: a video that does not hit the required number takes no part in the budget split and costs you nothing. You enter the value in the "minimum views" field. Leave it empty and the system applies its default minimum of 1000 views. The median threshold across live contests is **2000 views**.

Know what the threshold does and does not do before you raise it. It is an admission test, not a deductible: once a submission clears the line, the whole view counter enters the calculation, not the part above the threshold. Raising it therefore removes weak submissions from the split rather than shaving the price of strong ones. For more, see [how views are counted for a payout](/en/earnings/how-views-are-counted).

### 3. Set the cap per submission

The cap limits the most any single submission can be paid. You set it yourself, and it is on the contest card before anyone submits, so clippers know their upside up front. The cap keeps the budget in your hands: without it, one video that goes viral takes everything. With it, that submission gets its maximum and the rest goes to other creators or back to you. It is the only parameter you can adjust after launch, so check it again before the contest fills up.

### 4. Fund the budget

In the wallet-backed mode the full budget is charged when the contest is created, and DareBay holds it as intermediary and guarantor: the money is tied to that one contest, it cannot be taken back before the end, and the clippers can see the payout is covered. That visibility is the reason funded tasks get picked up faster than a promise to pay later. The manual-payout mode works differently: no money enters the DareBay wallet, and the organizer settles with creators directly.

### 5. Clippers publish and send links

Once the contest is live, creators take the task, produce the video and publish it on the site your terms name - statistics are collected today for TikTok, YouTube and Instagram - then send DareBay the link. **A submission enters the contest only when that link arrives.** Nothing is imported by hashtag, so ask for a tag only if you actually want one in the description; it is separately required from anyone submitting anonymously.

### 6. The counter is read

The platform's independent counter reads the published view counter on the site each video went out on. Neither you nor the creator types the number in, and neither can adjust it. On top of that there is moderation: a submission with suspicious view dynamics is flagged and goes on hold pending review instead of going straight into your bill. That is a real check rather than a promise that every manipulated view gets identified. More on that: [how views are counted for the payout](/en/earnings/how-views-are-counted).

### 7. The formula determines each amount

The platform records each obligation using `views / 1000 * rate`. Submissions below the threshold take no part, and submissions above the cap receive the cap. Payout fulfilment then runs manually through payout details and statuses; an automatic transfer immediately after counting is not promised.

### 8. The unearned budget comes back

In the wallet-backed mode, whatever the clippers did not earn returns to your organizer balance. In the manual-payout mode the platform never held the budget, so there is nothing for it to return.

## Contest setup parameters

| Parameter | Typical value in live contests | What it means |
|-----------|--------------------------------|---------------|
| Rate per 1000 views | set by the organizer | What you pay for every thousand counted views |
| View threshold | 2000 (system default is 1000) | The minimum views for a submission to take part in the split |
| Cap per submission | set by the buyer | The maximum payout for a single submission |
| Publishing site | set by the organizer | TikTok, YouTube or Instagram. For Instagram it has to be a video with a view count |

You set the rate, the threshold and the cap yourself when creating the contest. The exact set of fields is shown on the contest creation screen. One system-level limit exists as a typo guard rather than a market signal: the validator refuses a contest with a rate above $100 per 1000 views.

## Cost and commission

Creating a contest and topping up its budget currently carry no fee: the organizer funds the prize budget. Store terms and a creator's later balance withdrawal are separate operations; see [current DareBay fees](/en/help/what-commission). For the full pay-per-view model, see [how to pay clippers per view](/en/for-brands/paying-clippers-per-view).

## Frequently asked questions

### Can the rate be changed after the contest starts?

No. The rate, the threshold and the budget are fixed when the contest is created and do not change: that is part of the guarantee for clippers. The one exception is the cap per submission, which you can adjust after launch.

### Why is there a cap per submission?

The cap protects the budget from a situation where one video takes everything. If a video goes viral and pulls hundreds of thousands of views, without a cap one creator gets the whole budget and everyone else gets nothing. With a cap, the same money buys you more videos and more points of reach.

### Which sites can clippers publish on?

TikTok, YouTube and Instagram: statistics are collected for all three today. Your contest terms name the one you want. For Instagram it has to be a video with a view count, because a photo post produces no such metric and there would be nothing to read.

### Does a clipper need a minimum audience?

No. Entry is free, with no deposits and no follower requirements. To be paid, a creator has to meet the terms of the task and clear the view threshold, and that is the whole test. It is why usable work also comes from creators with no following: you are buying the reach of one video, not the size of a channel.

### Should I attach source material to the task?

You can, and it is worth considering. Across the contests running today, none have material attached, so clippers are sourcing their own footage. Attaching yours narrows what comes back to what you actually wanted, at the cost of writing a tighter brief.

### How do clippers find out about the contest?

The contest goes straight into the public catalogue on [DareBay](https://darebay.com), where creators look for tasks in their own topic and format. You do not have to find anyone or message them one by one.

## Where to next

- [How to pay clippers per view](/en/for-brands/paying-clippers-per-view) - the payment model, the formula and what happens to the remainder
- [Terms for business](/en/for-business) - formats, pricing and guarantees
- [How pay-per-view works](/en/earnings/how-pay-per-view-works) - the full chain from budget to payout
- [How views are counted for a payout](/en/earnings/how-views-are-counted) - how the threshold works and why it exists
- [What fees does DareBay charge?](/en/help/what-commission) - contest, store and withdrawal terms
- [The payout guarantee](/en/about/payout-guarantee) - what is guaranteed to a clipper, and what is not
