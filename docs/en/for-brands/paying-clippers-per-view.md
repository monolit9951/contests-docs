---
title: How to pay clippers per view
description: The pay-per-view model for buyers - locking the budget on DareBay, the payout formula, the commission on top of the budget, the automatic split and the refund of what is left.
provenance: { snapshot_date: "2026-07-10", source: "darebay-prod" }
numbers_used: [commission_fiat, commission_crypto, commission_coins]
seo: true
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"Article","headline":"How to pay clippers per view","datePublished":"2026-07-10","dateModified":"2026-07-11","author":{"@type":"Organization","name":"DareBay"},"publisher":{"@type":"Organization","name":"DareBay"},"description":"The pay-per-view model for buyers - locking the budget on DareBay, the payout formula, the commission on top of the budget, the automatic split and the refund of what is left."}'
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"HowTo","name":"How to pay clippers per view through DareBay","step":[{"@type":"HowToStep","position":1,"name":"Create a pay-per-view contest and lock the budget","text":"Create a contest with pay-per-view payment, write the brief, set the rate per 1000 views, the threshold and the cap, then pay in the budget. The platform locks the amount until the contest ends."},{"@type":"HowToStep","position":2,"name":"Clippers publish their work","text":"Creators take the brief, film the content and post the videos on the platform with the required hashtag."},{"@type":"HowToStep","position":3,"name":"The oracle validates the views","text":"The platform counts the views automatically through the platform API (TikTok today). Submissions showing signs of view fraud go to review."},{"@type":"HowToStep","position":4,"name":"The budget is split automatically by formula","text":"The system calculates the payout for each submission by the formula: views / 1000 * rate. Submissions below the threshold do not take part, and the cap limits the maximum per submission. The remainder goes back to the organizer."}]}'
---

# How to pay clippers per view

To pay clippers per view automatically, create a pay-per-view contest on DareBay. You set the rate per 1000 views, the threshold and the cap, lock the budget on the platform, and from there everything runs without you. An oracle counts the views through the platform API, the system splits the budget by formula, and each clipper receives their share to a wallet, a card or another method. The platform works as an intermediary and guarantor: the money is locked until finalization, and the payout is automatic, based on an independent count. Whatever is left of the budget comes back to you.

## How the payment model works

1. **You create the contest and lock the budget.** Open [contest creation on DareBay](https://darebay.com), choose pay-per-view, write the brief for the clippers and pay in the budget. The amount is locked and tied to the contest, and you cannot take it back before the contest ends. That is the guarantee for the clippers: the money is already on the platform and the organizer cannot change their mind.
2. **Clippers publish their work.** Creators see your contest, take the brief, film the content and post the videos with the required hashtag. Every submission is registered in the system.
3. **The oracle validates the views.** The platform pulls view data automatically through the platform API (TikTok today). Submissions showing signs of view fraud go to review and can be rejected outright. For more on how views are counted, see [the dedicated page](/en/earnings/how-views-are-counted).
4. **The system splits the budget by formula.** Each clipper receives their share automatically: to a wallet, a card, a bank transfer, Telegram Stars or gifts. Whatever is left over goes back to your balance.

For the step-by-step setup (how to pick the rate, the threshold and the cap for your case), see [how to set up a clipping contest](/en/for-brands/set-up-a-clipping-contest).

## Rate, threshold, cap and the formula

Three parameters define the payment model:

- **The rate** - what you pay per 1000 views. You choose the amount when creating the contest.
- **The threshold** - the minimum number of views for a submission to take part in the split. Submissions below it get no payout.
- **The cap** - the maximum amount per submission. It stops one viral video from taking the whole budget.

When a contest ends, the system calculates the payout for each submission:

> submission views / 1000 * rate

Submissions below the threshold do not take part. The cap limits the maximum per submission.

## Commission

There is no separate charge for creating a contest. The only commission is a percentage of the prize amount, paid once when the contest is created, on top of the budget. The prize pool goes to the clippers in full, and nothing is withheld from the payouts.

| Parameter | Value | What it means |
|-----------|-------|---------------|
| Commission (card, bank transfer) | 5% of the prize amount | Paid on top of the budget when the contest is created |
| Commission (wallet, USDT on TON) | 8% of the prize amount | Paid on top of the budget when the contest is created |
| Commission (COINS) | 10% of the prize amount | Paid on top of the budget when the contest is created |
| Refund of the remainder | automatic | Whatever is left of the budget goes back to the organizer balance |

The figures on this page come from DareBay platform data (snapshot: 2026-07-10).

## Why this works for the buyer

**The budget is protected.** You pay only for real views. If the clippers do not get the views, the budget comes back.

**No need to negotiate with each creator.** You create one contest and the clippers take the brief themselves. The platform does the counting and the paying.

**An independent count.** The views are counted by an oracle through the platform API. Neither you nor the clippers can adjust the numbers.

**The split runs itself.** Each clipper is paid by the formula without you doing anything. No manually wiring money to ten different creators.

## Frequently asked questions

### What does it cost to create a contest?

There is no separate charge for creating one. When the contest is created, a commission on the prize amount is charged: fiat (card, bank transfer) is **5%**, wallet (USDT on TON) is **8%**, COINS (the internal platform currency) is **10%**. The commission is paid on top of the budget, so the prize pool is not reduced. More on the commission in the [FAQ section](/en/help/what-commission).

### What if the clippers do not get the views?

If no submission clears the minimum view threshold, or nobody entered at all, the whole budget goes back to your balance automatically. A locked budget is never lost.

### How does the remainder come back?

The remainder returns to the organizer balance automatically once the contest ends and the payouts are distributed. If the budget was $200 and $70 was paid out, the remaining $130 comes back to your balance.

### Can the rate be changed after the contest is created?

The rate and the threshold are fixed when the contest is created and do not change. That is part of the guarantee: the clippers see the terms in advance and the organizer cannot alter them after the fact. The cap per submission is the one thing the buyer can adjust later.

### How do clippers get the money?

Clippers are paid automatically once the contest ends. The available methods: wallet (USDT on TON), bank card, bank transfer, Telegram Stars, Telegram gifts.

### Do I have to check the views myself?

No. The views are counted by an oracle - an automatic system that pulls the data from the platform API. You do not have to verify or confirm anything by hand. The platform does all of it.

## Where to next

- [How it works](/en/how-it-works) - an overview of the DareBay mechanic
- [How pay-per-view works](/en/earnings/how-pay-per-view-works) - the PPV mechanic from the participant side
- [How views are counted for the payout](/en/earnings/how-views-are-counted) - the details of the oracle and validation
- [What commission does DareBay take?](/en/help/what-commission) - more on the commission by payment method
- [Does DareBay really pay?](/en/about/does-darebay-really-pay) - the payout guarantee
- [Earning on DareBay](/en/earnings/) - what you can earn
