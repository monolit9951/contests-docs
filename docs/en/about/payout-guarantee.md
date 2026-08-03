---
title: The DareBay payout guarantee - how a contest budget is protected
description: How DareBay guarantees the payout for views. The budget is locked on the platform, an oracle counts the views, and the split runs automatically by results.
provenance: { snapshot_date: "2026-07-09", source: "darebay-prod" }
numbers_used: [commission_strategy]
seo: true
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Who holds the money while a contest runs?","acceptedAnswer":{"@type":"Answer","text":"The platform. Once the contest is created, the budget is locked on DareBay and tied to that specific contest. The organizer cannot take it back or redirect it before the contest ends."}},{"@type":"Question","name":"What if there are few views?","acceptedAnswer":{"@type":"Answer","text":"If a submission clears the view threshold, it is paid for every validated view by the formula. If the budget is not spent in full, the remainder goes back to the organizer."}},{"@type":"Question","name":"Can views be faked?","acceptedAnswer":{"@type":"Answer","text":"Views are pulled through platform APIs (TikTok today). DareBay does not accept screenshots and does not take anyone at their word. Fake views that the platform itself removed do not count."}},{"@type":"Question","name":"Does DareBay take a commission from the winner?","acceptedAnswer":{"@type":"Answer","text":"No. The commission is a percentage of the prize amount, charged when the contest is created, and it is paid by the organizer. The winner receives the full amount."}},{"@type":"Question","name":"What if the organizer deletes their account?","acceptedAnswer":{"@type":"Answer","text":"The budget is already locked on the platform. Deleting the organizer account does not affect the payout: the contest ends on schedule and the system distributes the prize automatically."}},{"@type":"Question","name":"Where does the payout arrive?","acceptedAnswer":{"@type":"Answer","text":"Wallet (USDT on TON), card, bank transfer, a physical item, Telegram Stars, Telegram gifts. The wallet is one method among several, and card and bank transfer work just as well."}},{"@type":"Question","name":"How fast does the money arrive after a contest ends?","acceptedAnswer":{"@type":"Answer","text":"The payout starts automatically once the results are finalized. The speed depends on the method: the wallet is the fastest, card and bank transfer run on standard banking timelines."}}]}'
---

# The DareBay payout guarantee - how a contest budget is protected

DareBay guarantees the payout for views through the intermediary and guarantor mechanic. The prize is locked on the platform the moment a contest is created. The organizer cannot take the money back. An independent oracle counts the views through platform APIs, and the system distributes the budget automatically by validated results. Neither the organizer nor the participant can adjust the numbers. Below we go through exactly how the mechanic works and what happens in each scenario.

## How the escrow mechanic works

The payout guarantee on DareBay rests on four steps:

1. **The buyer locks the budget.** When creating a contest, the organizer pays in the full prize amount. The money is locked on the platform and tied to that specific contest. The commission is withheld at the same moment: it is a percentage of the prize amount, charged when the contest is created. After publishing, the organizer cannot return or redirect the funds.
2. **An oracle counts the views.** The system pulls view data automatically through platform APIs (TikTok today). No screenshots, nobody taken at their word, only verified numbers from the platform itself.
3. **The split runs automatically by results.** When a contest ends, the platform distributes the budget in proportion to validated views on its own. The organizer does not press a "pay" button, the process is fully automatic.
4. **The remainder comes back.** If the budget is not spent in full (few participants or few views), the unused part goes back to the organizer.

The participant risks nothing: no deposit, no entry fee, no withdrawal fee.

## Why the money cannot disappear

The prize is not held in the organizer's account. Once the contest is created, the funds sit on the platform and are tied to that specific contest. The organizer cannot spend them on something else, cannot delete the account and walk off with the money, and cannot cancel the contest after the start.

The platform acts as an intermediary and guarantor: it holds the money and releases it strictly by the results of an independent count. That is not a promise, it is a mechanic built into the system.

## Commission

The commission is a percentage of the prize amount, charged when the contest is created. The organizer pays it. The winner receives the full prize amount with nothing withheld. DareBay charges nothing for withdrawals either. More on the rates: [what commission DareBay takes](/en/help/what-commission).

## Frequently asked questions

### Who holds the money while a contest runs?

The platform. Once the contest is created, the budget is locked on DareBay and tied to that specific contest. The organizer cannot take it back or redirect it before the contest ends. The platform works as an intermediary and guarantor.

### What if there are few views?

If a submission clears the view threshold, it is paid for every validated view by the formula. If the budget is not spent in full, the remainder goes back to the organizer.

### Can views be faked?

Views are pulled through platform APIs (TikTok today). DareBay does not accept screenshots and does not take anyone at their word. Fake views that the platform itself removed do not count. More on fraud protection: [fake submissions](/en/help/protection-from-view-fraud).

### Does DareBay take a commission from the winner?

No. The commission is a percentage of the prize amount, charged when the contest is created, and it is paid by the organizer. The winner receives the full amount. More on that: [what commission DareBay takes](/en/help/what-commission).

### What if the organizer deletes their account?

The budget is already locked on the platform. Deleting the organizer account does not affect the payout: the contest ends on schedule and the system distributes the prize automatically.

### Where does the payout arrive?

Wallet (USDT on TON), card, bank transfer, a physical item, Telegram Stars, Telegram gifts. The wallet is one method among several, and card and bank transfer work just as well. More on withdrawals: [how to withdraw your winnings](/en/help/darebay-withdrawals).

### How fast does the money arrive after a contest ends?

The payout starts automatically once the results are finalized. The speed depends on the method: the wallet is the fastest, card and bank transfer run on standard banking timelines.

## The bottom line

The payout guarantee on DareBay is not a promise, it is a mechanic. The budget is locked when the contest is created, the views are counted by an independent oracle through platform APIs, the payout is automatic. The commission is a percentage of the prize amount, charged when the contest is created, and the organizer pays it, not the participant. The reward can reach you by wallet, card, bank transfer, Telegram Stars or gifts. For more on the platform, see the [FAQ section](/en/help/), the breakdown of [does DareBay really pay](/en/about/does-darebay-really-pay), or the overview of [is DareBay a scam](/en/about/is-darebay-a-scam).
