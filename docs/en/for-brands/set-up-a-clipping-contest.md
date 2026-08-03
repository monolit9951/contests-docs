---
title: How to set up a clipping contest on DareBay
description: A step-by-step guide to setting up a pay-per-view contest - how to choose the rate, the threshold and the cap, lock the budget and get the remainder back.
provenance: { snapshot_date: "2026-07-10", source: "darebay-prod" }
numbers_used: [ppv_default_min_views_threshold, ppv_min_views_threshold_live, ppv_max_per_work_typical]
seo: true
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"Article","headline":"How to set up a clipping contest on DareBay","datePublished":"2026-07-10","dateModified":"2026-07-11","author":{"@type":"Organization","name":"DareBay"},"publisher":{"@type":"Organization","name":"DareBay"},"description":"A step-by-step guide to setting up a pay-per-view contest - how to choose the rate, the threshold and the cap, lock the budget and get the remainder back."}'
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"HowTo","name":"How to set up a contest for clippers","step":[{"@type":"HowToStep","position":1,"name":"Set the rate per 1000 views","text":"State what you pay for every thousand counted views of a clipper submission."},{"@type":"HowToStep","position":2,"name":"Set the minimum view threshold","text":"Set the minimum number of views at which a submission takes part in the budget split. Leave the field empty and the default of 1000 views applies; the median across live contests is 2000 views."},{"@type":"HowToStep","position":3,"name":"Set the cap per submission","text":"Limit the maximum payout for a single submission so that one clipper cannot take the whole budget. The typical value is $50. The cap can be adjusted after launch."},{"@type":"HowToStep","position":4,"name":"Lock the budget","text":"The full budget is locked on the platform when the contest is created. It cannot be taken back before the contest ends."},{"@type":"HowToStep","position":5,"name":"Clippers upload their work","text":"Creators take the brief, film the content and post it on TikTok with the required hashtag."},{"@type":"HowToStep","position":6,"name":"The oracle counts the views","text":"The platform pulls view data automatically through the TikTok API and checks it for view fraud."},{"@type":"HowToStep","position":7,"name":"The split runs automatically","text":"The system distributes the budget by the formula: views / 1000 * rate. Each clipper receives their share automatically."},{"@type":"HowToStep","position":8,"name":"The remainder comes back","text":"Whatever part of the budget was not spent returns to the organizer balance automatically."}]}'
---

# How to set up a clipping contest on DareBay

A clipping contest on DareBay is a way to promote something through content that creators film for a reward. You set the budget and three parameters (the rate, the threshold and the cap), the platform locks the money, clippers upload their videos, and the system counts the views and pays each creator automatically. You pay only for a counted result, and the budget is protected: the platform works as an intermediary and guarantor, the money is locked and paid out by formula with no human in the loop. If the views do not come, the remainder returns to you.

Every figure on this page comes from the platform's own data (snapshot: 2026-07-10).

## Step by step

### 1. Set the rate per 1000 views

The rate defines what you pay for every thousand counted views of a clipper submission. You state it when creating the contest, and it cannot be changed after launch. The higher the rate, the more attractive the brief is to creators and the faster the budget burns. For more on how the calculation works, see [how pay-per-view works](/en/earnings/how-pay-per-view-works).

### 2. Set the minimum view threshold

The threshold filters out submissions with minimal reach: if a video does not hit the required number of views, it does not take part in the budget split. You enter the value in the "minimum views" field. Leave it empty and the system applies its default minimum of 1000 views. The median threshold across live contests is **2000 views**. For more on choosing a threshold, see [the view threshold for a payout](/en/earnings/view-threshold).

### 3. Set the cap per submission

The cap limits the maximum a single submission can receive. The typical value across live contests is **$50**. The cap exists so that one clipper cannot drain the whole pool: if a video goes viral and pulls a million views, without a limit it takes the entire budget. With a cap, that submission gets its maximum and the rest of the budget comes back to you once the contest ends. The cap is the only parameter you can adjust after launch.

### 4. Lock the budget

The full budget is locked on the platform when the contest is created. The platform works as an intermediary and guarantor: the money is tied to that specific contest, the organizer cannot take it back before the end, and the clippers know the payout is coming.

### 5. Clippers upload their work

Once the contest is live, creators take the brief, film the content and post it on TikTok with the required hashtag. Every submission is registered in the system.

### 6. The oracle counts the views

The platform pulls view data automatically through the TikTok API and checks it for view fraud. More on that: [how views are counted for the payout](/en/earnings/how-views-are-counted).

### 7. The split runs automatically

The system distributes the budget by the formula: `views / 1000 * rate`. Submissions below the threshold do not take part. Submissions above the cap receive the cap. Each clipper gets their share to a wallet, a card or another method.

### 8. The remainder comes back

If the budget is not spent in full, the unused part returns to the organizer balance automatically.

## Contest setup parameters

| Parameter | Typical value in live contests | What it means |
|-----------|--------------------------------|---------------|
| Rate per 1000 views | set by the organizer | What you pay for every thousand counted views |
| View threshold | 2000 (system default is 1000) | The minimum views for a submission to take part in the split |
| Cap per submission | $50 | The maximum payout for a single submission |

You set the rate, the threshold and the cap yourself when creating the contest. The exact set of fields is shown on the contest creation screen.

## Cost and commission

There is no separate charge for creating a contest. The platform takes a commission: it is calculated on the prize amount and paid on top of the budget, so the prize pool goes to the clippers in full. The exact commission is shown during contest creation, before you pay. For the rates by payment method, see [what commission DareBay takes](/en/help/what-commission); for the full pay-per-view model, see [how to pay clippers per view](https://darebay.com/en/for-brands/paying-clippers-per-view).

## Frequently asked questions

### Can the rate be changed after the contest starts?

No. The rate, the threshold and the budget are fixed when the contest is created and do not change: that is part of the guarantee for clippers. The one exception is the cap per submission, which can be adjusted after launch.

### Why is there a cap per submission?

The cap protects the budget from a situation where one video takes everything. If a video goes viral and pulls hundreds of thousands of views, without a cap one creator gets the whole budget and everyone else gets nothing. With a cap, the budget spreads more fairly.

### What if nobody enters?

If no submission was made, or no submission cleared the view threshold, the whole budget goes back to the organizer. A locked budget is never lost.

### When does the remaining budget come back?

The remainder returns automatically once the contest ends and the selection and confirmation windows have passed. That usually happens within a few days of submissions closing.

### Which platforms are supported?

Right now views are pulled automatically from TikTok through its API. The platform for publishing is stated in the terms of each contest.

### Does a clipper need a minimum audience?

No. Entry is free, with no deposits and no follower requirements. To get paid, a creator only has to meet the terms of the brief (post the video with the required hashtag) and clear the view threshold.

### How do clippers find out about the contest?

Once created, the contest appears in the public catalogue on [DareBay](https://darebay.com). Creators pick the briefs that suit their topic and format themselves.

## Where to next

- [How it works](/en/how-it-works) - an overview of the DareBay mechanic
- [How to pay clippers per view](https://darebay.com/en/for-brands/paying-clippers-per-view) - the payment model: formula, commission, automatic split
- [How pay-per-view works](/en/earnings/how-pay-per-view-works) - the full chain from budget to payout
- [The view threshold for a payout](/en/earnings/view-threshold) - how the threshold works and why it exists
- [What commission does DareBay take?](/en/help/what-commission) - commissions across every payment method
- [The payout guarantee](/en/about/payout-guarantee) - how the payout to clippers is secured
