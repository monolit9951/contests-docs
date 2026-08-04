---
title: The DareBay payout guarantee - how a contest budget is protected
description: How DareBay records the budget and obligations, independently counts results, and manually fulfils payouts and withdrawals.
provenance: { snapshot_date: "2026-08-04", source: "darebay-prod" }
numbers_used: [withdrawal_min_amount, withdrawal_commission]
seo: true
---

# The DareBay payout guarantee - how a contest budget is protected

DareBay secures payout obligations through the intermediary and guarantor mechanic. The budget is recorded against the contest, an independent oracle counts the views, and validated results create a credit or payout obligation. Fulfilment can be manual; this is not a promise of an instant automatic transfer.

## How the budget is protected

The payout guarantee on DareBay rests on four steps:

1. **The funding mode is recorded.** A wallet-backed contest locks its money prize. A manual-payout contest has no platform lock or wallet involvement: the organizer pays creators directly. Creating and topping up a contest currently carry a 0% fee.
2. **An independent oracle counts the views.** DareBay reads the published counter through the configured tikwm provider. tikwm is not the official TikTok API, and DareBay does not claim that this counter alone detects every kind of manipulation.
3. **The amount is recorded from the result.** When a contest ends, the platform calculates a credit or creates a payout obligation in proportion to validated views. Fulfilment follows payout details and statuses.
4. **The remainder comes back.** If the budget is not spent in full (few participants or few views), the unused part goes back to the organizer.

The participant pays no deposit or entry fee. Withdrawing an available balance has a fee, minimum and manual processing.

## Why the money cannot disappear

In a wallet-backed contest, the prize sits in the platform wallet and is tied to that contest. In a manual-payout contest, the funds remain outside DareBay and the organizer must fulfil the recorded obligation directly. The product shows which mode applies.

The platform acts as intermediary and guarantor by recording the budget, result and obligation history. Manual fulfilment and withdrawal remain separate status-driven stages.

## Commission

Creating and topping up a contest currently carry a 0% fee. Withdrawing an available balance has a 10% fee and a 10 USDT minimum; requests are processed manually. See [current DareBay fees](/en/help/what-commission).

## Frequently asked questions

### Who holds the money while a contest runs?

For a wallet-backed contest, the platform wallet holds the locked budget. For a manual-payout contest, nobody deposits the wallet-backed prize with DareBay: the organizer remains the direct payer and DareBay records the obligation and status.

### What if there are few views?

If a submission clears the view threshold, it is paid for every validated view by the formula. If the budget is not spent in full, the remainder goes back to the organizer.

### Can views be faked?

The configured tikwm oracle reads the published TikTok counter; it is not the official TikTok API and is not a promise to identify every manipulated view. Moderation can still reject invalid work. More on fraud protection: [fake submissions](/en/help/protection-from-view-fraud).

### Does DareBay take a commission from the winner?

Entry is free. The contest result records the winner's amount, but a later balance withdrawal has a 10% fee. See [current DareBay fees](/en/help/what-commission).

### What if the organizer deletes their account?

The platform stores the budget and obligations separately from organizer access. An account problem does not erase the status; manual fulfilment is tracked through the payout record.

### Where does the payout arrive?

A contest can define USDT, fiat, a physical item, Telegram Stars or a gift. For an available-balance withdrawal, the form offers USDT to an external wallet or Telegram Stars; other rewards can be fulfilled manually. See [how withdrawals work](/en/help/darebay-withdrawals).

### How fast does the money arrive after a contest ends?

Finalization records a credit or obligation. Fulfilment and withdrawal are processed manually, so there is no guaranteed “instant” or “within minutes” timeline. The product shows the status.

## The bottom line

The DareBay guarantee is a recorded budget, independent calculation and stored credit or obligation. Contest creation currently carries no fee; withdrawal has a minimum, fee and manual processing. See the [FAQ section](/en/help/), [does DareBay really pay](/en/about/does-darebay-really-pay), or [is DareBay a scam](/en/about/is-darebay-a-scam).
