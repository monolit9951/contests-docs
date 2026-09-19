---
title: "Clipping platforms that pay in Nigeria, Kenya and Ghana"
description: "Which clipping platforms pay Nigerian, Kenyan and Ghanaian clippers, and how the money lands: PayPal via Paga, M-PESA, MoMo, USDT. Sourced and dated."
provenance: { snapshot_date: "2026-09-19", source: "darebay-prod" }
numbers_used: [ppv_cpm_band_low, ppv_cpm_band_high, ppv_max_per_work_band_high]
seo: true
landing: true
sources: visible
hero:
  updated: "2026-09-19"
  kicker: "Payout access · Nigeria, Kenya, Ghana · 2026"
  lede: "PayPal's own payout list settles the question before any rate card does: Kenya is on it, Nigeria and Ghana are not. So a platform whose single rail is PayPal can pay a clipper in Nairobi and cannot pay one in Lagos or Accra, whatever its landing page claims about country counts. Below: what each rail reaches, what each platform states about these three countries, and what the CBN, the CBK and the Bank of Ghana have published about a stablecoin payout."
  secondary: "Country table"
  takeaways:
    - "<b>PayPal splits the three countries in two.</b> PayPal's payout-eligibility table lists Kenya with the full send, receive and withdraw feature set; Nigeria and Ghana are absent from it altogether."
    - "<b>Nigeria got a personal PayPal route in 2026, through Paga.</b> Paga advertises receiving international payments into the wallet and withdrawing in naira. That is a person receiving money, not a platform sending a payout."
    - "<b>Kenya is the one country here with a direct card-free bridge.</b> Safaricom runs a PayPal-to-M-PESA transfer with Thunes, in US dollars, for Kenyan M-PESA users on Android."
    - "<b>DareBay pays the same way in all three.</b> No country list to check and no naira, shilling or cedi leg: the balance leaves as USDT on the TON network, on a request from 10 USDT with a 10% fee taken inside it."
compare:
  ids: [darebay, whop, vyro, reach-cat, clipping-net, vues, cliptocash]
  columns: [nigeria, kenya, payoutMethods, minPayout, fee]
  highlight: darebay
  title: "What each platform states about Nigeria, Kenya and Ghana"
method:
  - "Country statements are read off each platform's own supported-country page, payout documentation, terms or FAQ on 18 September 2026; the Kenya column also carries what a platform says about Ghana, because most of them treat the two together or name neither."
  - "Rails, thresholds and fees come from the same pages. \"Not published\" means the platform states no figure anywhere on its public pages — it is not an estimate, and it is not zero."
  - "Payment-service availability comes from PayPal's, Stripe's and Wise's own reference pages, and the regulatory lines from the CBN, SEC Nigeria, the Nigeria Revenue Service, the CBK, the KRA and the Bank of Ghana. DareBay's own figures come from its live data snapshot and help pages."
cta:
  title: "Paid the same way in Lagos, Nairobi and Accra"
  lede: "DareBay has no country list to check yourself against and no PayPal dependency to trip over: the balance leaves as USDT on the TON network, on a request from 10 USDT with a 10% fee taken inside it. Take a task off the open board, post the clip on your own account, and the platform counts the views."
---

## A PayPal payout reaches Nairobi but not Lagos or Accra

PayPal publishes a reference table of the countries a merchant can send a payout to. Kenya appears there with the full feature set, "Send, receive, and withdraw", which PayPal glosses as merchants being able to send payouts from the country and account holders being able to receive and withdraw money; Nigeria and Ghana do not appear in that table at all <!-- source: https://developer.paypal.com/payouts/supported-features 2026-09-18 -->.

That table decides more than any campaign's rate card. A platform that pays through PayPal and nothing else has a working route to a Kenyan clipper and none to a Nigerian or Ghanaian one, whatever its marketing copy counts.

<LCompare />

## Nigeria: the Paga route, and what it is not

In 2026 PayPal became usable in Nigeria through a partner. Paga's page for the integration says you can "Send and receive money worldwide with PayPal" and "Withdraw in naira or USD straight to your Paga account", and that Paga Remit Limited is licensed by the Central Bank of Nigeria as an international money transfer operator which, as a PayPal partner, "provides limited access and services for PayPal account holders based on user-granted permissions" <!-- source: https://www.mypaga.com/pagapaypal/ 2026-09-18 -->. PayPal's Nigerian help centre adds the same condition from its side: a new customer in Nigeria should link a partner bank to start receiving money <!-- source: https://www.paypal.com/ng/cshelp/article/how-do-i-receive-money-through-paypal-help667 2026-09-18 -->.

The distinction matters. A person in Lagos receiving money into a linked Paga wallet is one thing; a platform running a batch payout to Nigeria is another, and the table above still does not list Nigeria. If a campaign says "we pay by PayPal", the Paga route does not make it reach you.

Inside the country the last leg is not the problem: the CBN's payments page says electronic transactions facilitated by platforms like NIBSS Instant Payment have become increasingly popular, with web transfer the most-used channel at 51.91 per cent of e-payment transactions as of 30 June 2024 <!-- source: https://www.cbn.gov.ng/PaymentsSystem/modes.html 2026-09-18 -->. The problem is crossing the border.

Nigeria does not appear on Whop's sanctioned-country page, so registration is not blocked <!-- source: https://docs.whop.com/trust-and-safety/trust-safety-overview/sanctioned-countries 2026-09-18 -->, yet Nigeria is also absent from the list of 200-plus countries Whop says it pays out to, while Kenya, Ghana and Niger are on it <!-- source: https://docs.whop.com/manage-your-business/manage-payouts/set-up-payouts 2026-09-18 -->. Whop's public pages do not reconcile the two, so ask its support first.

## Kenya: M-PESA is the shortest route from a clipping payout

Safaricom states that M-PESA Global lets registered customers send and receive money globally, and that "M-PESA registered customers can also receive funds from abroad on their MPESA account" <!-- source: https://www.safaricom.co.ke/main-mpesa/m-pesa-services/m-pesa-global 2026-09-18 -->. The wallet in your hand is a valid destination for money that starts outside Kenya.

There is also a named bridge from the rail most platforms use. Safaricom describes a PayPal-to-M-PESA service provided by Thunes with Safaricom and PayPal, moving funds between a customer's own PayPal and M-PESA accounts, with specific conditions: top-ups and withdrawals in US dollars only, the M-PESA account managed in shillings only, and the service offered only to users in Kenya with registered M-PESA accounts, PayPal accounts and Android devices <!-- source: https://www.safaricom.co.ke/main-mpesa/m-pesa-services/m-pesa-global/paypal 2026-09-18 -->.

So a Kenyan clipper has the widest menu of the three. Whop lists Kenya among its payout countries <!-- source: https://docs.whop.com/manage-your-business/manage-payouts/set-up-payouts 2026-09-18 -->, Vyro does not put Kenya on its unsupported-countries list though it pays only through PayPal or Stripe by region <!-- source: https://vyro.com/help/getting-started/what-countries-are-supported 2026-09-18 --><!-- source: https://vyro.com/help/earnings-and-payments/how-can-i-withdraw-my-earnings 2026-09-18 -->, and a stablecoin payout works here as anywhere. If you already use M-PESA daily, a PayPal-paying campaign is convenient here — and not one border west.

## Ghana: MoMo takes money from abroad, two platforms stop at the border

MTN Ghana describes Mobile Money as a service that lets you "send and receive money, pay bills, receive money from abroad as well as access Loans and savings" <!-- source: https://mtn.com.gh/momo/ 2026-09-18 -->, and Ghana appears on MTN's list of countries where you can receive international funds into a MoMo wallet <!-- source: https://momo.mtn.com/receiving-countries/ 2026-09-18 -->. The wallet is ready; the question is which platform reaches it. Two of the better-known boards do not. Ghana is absent from PayPal's payout table alongside Nigeria <!-- source: https://developer.paypal.com/payouts/supported-features 2026-09-18 -->, and Ghana is named outright on Vyro's unsupported-countries list, where Vyro says that in a restricted region "you won't be able to use Vyro or receive payouts" <!-- source: https://vyro.com/help/getting-started/what-countries-are-supported 2026-09-18 -->. Whop carries Ghana in its payout countries <!-- source: https://docs.whop.com/manage-your-business/manage-payouts/set-up-payouts 2026-09-18 -->.

## The boards built for Lagos and Abuja, and what Nairobi has

Three boards name Nigeria first among the markets they are built for; the last row sets DareBay against the same fields.

| Platform | How it pays | Rails | Minimum | What it does not publish |
|---|---|---|---|---|
| **ClipperFC**, Lagos | "(Total Views ÷ 1,000) × Rate per 1k views", with the brand setting the rate, ₦500 per 1,000 marked an "Example rate", and a 15% platform fee off creator earnings; views are self-reported with screenshots an admin verifies <!-- source: https://clipperfc.com/how-it-works/clipping 2026-09-19 --> <!-- source: https://clipperfc.com/ 2026-09-19 --> | bank (NUBAN), PayPal or a BTC wallet, 1–3 business days after review, creator payout fee "None" <!-- source: https://app.clipperfc.com/legal/terms 2026-09-19 --> <!-- source: https://clipperfc.com/for-brands 2026-09-19 --> | Not published | how a PayPal payout reaches creators it places "across all 36 Nigerian states", a view threshold, a per-clip cap, a follower minimum, an ID check, or an operator name behind "based in Lagos, Nigeria" <!-- source: https://clipperfc.com/guides 2026-09-19 --> <!-- source: https://app.clipperfc.com/legal/privacy 2026-09-19 --> |
| **ClippaPay**, Abuja | pays for views checked by AI scanning and human review, on content "reviewed daily" <!-- source: https://clippapay.com/ 2026-09-19 --> | bank transfer or a USDT wallet | wallet balance above ₦1,000 <!-- source: https://clippapay.com/ 2026-09-19 --> | any rate per 1,000, and terms outside the dashboard login; its Play listing is filed under the developer name UleinsonTech Solutions <!-- source: https://play.google.com/store/apps/details?id=com.clippadigitalhubltd.clippapayapp 2026-09-19 --> |
| **ClipToCash** | not paying yet: "We're onboarding in waves", with $0.50–$2.00 per 1,000 flagged "Illustrative rates" <!-- source: https://cliptocash.io/ 2026-09-19 --> | promises a local bank account or a stablecoin wallet | Not published | a launch date, a fee, an operator name or a terms page <!-- source: https://cliptocash.io/ 2026-09-19 --> |
| **DareBay** | $1.00–$2.00 per 1,000 counted views, up to $500 per clip, nothing taken from the task budget, then 10% deducted inside the withdrawal request | USDT on the TON network only, no bank or mobile-money leg, no country list | request from 10 USDT | a settlement time: a person checks every request by hand |

Nairobi has no equivalent with published terms: skycontentrewards.com quotes shilling rates per 1,000 views and an M-PESA payout, but names no operator and publishes no terms, no minimum and no fee <!-- source: https://www.skycontentrewards.com/ 2026-09-19 -->.

## Naira, shillings and cedis on Stripe and Wise

The two services people reach for next do not close the gap. Stripe's availability page flags Nigeria, Kenya and Ghana as "Extended network" entries rather than supported countries, each pointing at a partner <!-- source: https://stripe.com/global 2026-09-18 -->, so a platform paying out through Stripe is not paying into these three the way it pays into a listed country.

Wise draws the line at the currency: NGN, KES and GHS all sit in the group Wise says you can only send money to, and cannot receive or hold <!-- source: https://wise.com/help/articles/2571907/what-currencies-can-i-send-to-and-from 2026-09-18 -->. It is a way for somebody abroad to send you naira, shillings or cedis, not an account a campaign can pay into.

Take the three countries out of the question and what is left is the rail: [clipping platforms that pay without PayPal or Stripe](/en/earnings/clipping-platforms-that-pay-without-paypal-or-stripe) puts every platform here against what it can actually send and what it demands before it sends anything.

## What the CBN, the CBK and the Bank of Ghana have published

**Nigeria.** The CBN states that on 22 December 2023 it issued guidelines for operating bank accounts for Virtual Asset Service Providers, "acknowledging the growing influence of virtual assets like cryptocurrencies and their potential impact on monetary stability" <!-- source: https://www.cbn.gov.ng/AboutCBN/Reforms.html 2026-09-18 -->; its circular register carries that document under reference FPR/DIR/PUB/CIR/002/003 <!-- source: https://www.cbn.gov.ng/Documents/circulars.html 2026-09-18 -->. SEC Nigeria publishes the firms it has admitted: Busha and Quidax appear as Digital Assets Exchanges in its accelerated incubation cohort <!-- source: https://sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/ 2026-09-18 -->.

**Kenya.** The CBK's public notice says the Virtual Assets Service Providers Act, 2025 was gazetted on 21 October 2025 and took effect on 4 November 2025, designating the CBK and the Capital Markets Authority as regulators, and that "Currently CBK and CMA have not licensed any VASPs under the Act to operate in or from Kenya" <!-- source: https://www.centralbank.go.ke/uploads/press_releases/665231223_Public%20Notice%20on%20the%20Virtual%20Assets%20Service%20Providers%20Act%202025.pdf 2026-09-18 -->.

**Ghana.** The Bank of Ghana says the Virtual Asset Service Providers Act, 2025 (Act 1154) "establishes the legal foundation for the registration, licensing, and supervision of Virtual Asset Service Providers (VASPs) in Ghana", and that it has created a Virtual Assets Department to supervise them with the SEC and the Financial Intelligence Centre. On the same page the application process and the fee schedule each read "This page will be available by the end of the third quarter of 2026" <!-- source: https://www.bog.gov.gh/virtual-assets/ 2026-09-18 -->, so licensing is not open yet.

Tax, briefly — the detail is on [taxes for clippers](/en/earnings/taxes-for-clippers). The Nigeria Revenue Service says a resident individual who derives income from virtual-asset transactions is liable to income tax, listing "professional or consultancy fees received in VA" among taxable income, recognised at fair market value on the date you acquire unrestricted control, with progressive rates for individuals and self-assessment on the annual return where the payer is non-resident <!-- source: https://www.nrs.gov.ng/uploads/Guidelines_on_taxation_of_Virtual_Assets_31_7_26_7cd2ef8dab.pdf 2026-09-18 -->. In Kenya the KRA notified an excise duty on "Fees charged on virtual assets transactions by virtual asset providers" at 10% of the excisable value, effective 1 July 2025 <!-- source: https://www.kra.go.ke/news-center/public-notices/2236-imposition-of-excise-duty-on-excisable-goods-services-introduced-by-the-finance-act,-2025 2026-09-18 -->.

<LMethod />

## A DareBay payout in Lagos, Nairobi and Accra — and when another platform fits better

DareBay has no separate Nigeria, Kenya and Ghana answer, because it has no country list: it pays worldwide with no exclusion list, on the same rail everywhere. The money leaves as USDT on the TON network. A withdrawal request starts at 10 USDT, a 10% fee is deducted inside the request, and the team checks the details by hand before sending, so no settlement time is promised — mechanics on the [withdrawals page](/en/help/darebay-withdrawals). Nothing is taken from the task budget, so that 10% is the only charge a clipper pays. Open tasks pay $1.00–$2.00 per 1,000 counted views, up to $500 per clip; see [how much clipping pays](/en/earnings/how-much-clipping-pays). No followers, no portfolio, no application.

The second rail, Telegram Stars, is not a way to get money out. Telegram's terms describe Stars as virtual items for buying digital goods and services from bots and mini apps inside Telegram, and state that you "may not sell, withdraw, transfer or use Stars in your personal balance for any other purpose" than those set out in the terms <!-- source: https://telegram.org/tos/stars 2026-09-18 -->. For a clipper in Lagos, Nairobi or Accra who wants spendable money, the rail is USDT on TON.

So pick by what you can actually receive:

- **You are in Kenya and PayPal-to-M-PESA already works for you.** Take the PayPal-paying boards: Whop lists Kenya, and the Safaricom bridge turns dollars into shillings without a stablecoin step.
- **You want money in a local bank account, not a wallet.** Whop names bank accounts and mobile wallets among its rails in over 200 countries <!-- source: https://docs.whop.com/manage-your-business/manage-payouts/set-up-payouts 2026-09-18 -->. DareBay offers no local bank rail on balance withdrawals.
- **You are in Nigeria or Ghana with no bank-facing option.** Reach.cat pays to your own wallet with no PayPal step: its payout screen offers USDT on ERC20, BEP20 or Solana, or a bank transfer by IBAN <!-- source: https://reach.cat/dashboard/creator/earnings 2026-09-18 -->. Its landing page says "No KYC. No ID check." <!-- source: https://reach.cat/become-a-clipper/ 2026-09-18 -->, but its terms effective 13 September 2026 require identity verification through iDenfy once payout requests pass $500 <!-- source: https://reach.cat/terms 2026-09-18 -->. Clipping.net pays by PayPal or by USDC and USDT on Ethereum only, with the method fixed by the campaign <!-- source: https://clipping.net/docs/clippers/payments 2026-09-18 -->; Vues publishes no country list and makes payouts subject to provider screening <!-- source: https://vues.app/terms 2026-09-18 -->.
- **You want a platform built for the region.** The naira boards sit in the table above; ClipToCash, still a waitlist, now names South Africa as a fourth country beside Nigeria, Ghana and Kenya <!-- source: https://cliptocash.io/ 2026-09-19 -->. Mind the namesake — cliptocash.com is a different, live platform under French law, paying through Stripe or Whop every Monday <!-- source: https://cliptocash.com/legal/terms 2026-09-19 -->.

For the wider field, see [the best clipping platforms](/en/earnings/best-clipping-platforms).

## Frequently asked questions

### Does Whop pay Nigerians?

Whop's own pages do not settle it. Nigeria is not on Whop's sanctioned-country list, so an account is not blocked <!-- source: https://docs.whop.com/trust-and-safety/trust-safety-overview/sanctioned-countries 2026-09-18 -->, but Nigeria is also missing from the list of 200-plus countries Whop says it pays out to, while Kenya, Ghana and Niger are on it <!-- source: https://docs.whop.com/manage-your-business/manage-payouts/set-up-payouts 2026-09-18 -->. Treat it as unresolved and ask Whop support first.

### Can I receive money on PayPal in Nigeria now?

As a person, through Paga: its integration page describes receiving international payments and withdrawing in naira <!-- source: https://www.mypaga.com/pagapaypal/ 2026-09-18 -->, and PayPal's Nigerian help centre tells a new customer to link a partner bank to start receiving money <!-- source: https://www.paypal.com/ng/cshelp/article/how-do-i-receive-money-through-paypal-help667 2026-09-18 -->. As a destination for a platform's payout, no: Nigeria is not in PayPal's payout-eligibility table <!-- source: https://developer.paypal.com/payouts/supported-features 2026-09-18 -->.

### Can M-PESA receive money from abroad?

Yes. Safaricom states that M-PESA registered customers can receive funds from abroad on their M-PESA account <!-- source: https://www.safaricom.co.ke/main-mpesa/m-pesa-services/m-pesa-global 2026-09-18 -->. There is also a PayPal-to-M-PESA transfer run with Thunes, in US dollars, for Kenyan users with registered M-PESA and PayPal accounts on Android <!-- source: https://www.safaricom.co.ke/main-mpesa/m-pesa-services/m-pesa-global/paypal 2026-09-18 -->.

### Is USDT legal in Nigeria?

That is a question for the regulators' own words. The CBN issued guidelines on 22 December 2023 for operating bank accounts for Virtual Asset Service Providers <!-- source: https://www.cbn.gov.ng/AboutCBN/Reforms.html 2026-09-18 -->, SEC Nigeria publishes the digital-asset exchanges it has admitted <!-- source: https://sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/ 2026-09-18 -->, and the Nigeria Revenue Service treats income received in virtual assets as taxable <!-- source: https://www.nrs.gov.ng/uploads/Guidelines_on_taxation_of_Virtual_Assets_31_7_26_7cd2ef8dab.pdf 2026-09-18 -->.

### Is crypto regulated in Kenya and Ghana?

Both have a statute. Kenya's Virtual Assets Service Providers Act, 2025 took effect on 4 November 2025 with the CBK and the Capital Markets Authority as regulators, and the CBK's notice states that no VASPs had been licensed under the Act at that point <!-- source: https://www.centralbank.go.ke/uploads/press_releases/665231223_Public%20Notice%20on%20the%20Virtual%20Assets%20Service%20Providers%20Act%202025.pdf 2026-09-18 -->. In Ghana, Act 1154 sets the framework and the Bank of Ghana has a Virtual Assets Department, but its application and fees pages say they will be available by the end of Q3 2026 <!-- source: https://www.bog.gov.gh/virtual-assets/ 2026-09-18 -->.

### How do I turn a USDT payout into naira, shillings or cedis?

Through a provider registered or licensed where you live, and that register is at a different stage in each country. SEC Nigeria lists the digital-asset exchanges in its incubation programme <!-- source: https://sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/ 2026-09-18 -->. The CBK said licensing would begin once regulations were issued, with no VASPs licensed at the date of its notice <!-- source: https://www.centralbank.go.ke/uploads/press_releases/665231223_Public%20Notice%20on%20the%20Virtual%20Assets%20Service%20Providers%20Act%202025.pdf 2026-09-18 -->, and in Ghana licensing is not open yet <!-- source: https://www.bog.gov.gh/virtual-assets/ 2026-09-18 -->. Check the regulator's own register first, and read [taxes for clippers](/en/earnings/taxes-for-clippers) before you plan around the net figure.
