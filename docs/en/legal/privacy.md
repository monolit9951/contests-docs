---
title: Privacy Policy
description: What data DareBay collects, why, how long it keeps it, and how to manage it.
---

# Privacy Policy

**Effective date:** 7 May 2026
**Last updated:** 7 May 2026

This policy describes how **DareBay** ("DareBay", "we", "us",
the "Service") collects, uses and protects your personal data
when you use **darebay.com**, the DareBay web app, our
APIs and related services.

We treat your data the way we would want ours treated: we collect only
what is needed, keep it only as long as needed, and never
sell it. The details follow.

**The data controller** within the meaning of the EU and UK data
protection regulations (EU GDPR and UK GDPR) is **Ruslan Bei**, the
sole operator described in [section 1](#_1-who-we-are). We
apply the standards of the **EU GDPR**, the **UK GDPR**, the **UK Data
Protection Act 2018**, and of the personal data protection laws of the
countries our users live in, applying the stricter standard where they
overlap.

If you only have time for one section, read
[Your rights](#_7-your-rights). The rest is detail attached to it.

---

## 1. Who we are

DareBay is run by **Ruslan Bei**, an individual based in
Europe, acting as the sole operator of the Service. Registration of a
UK private limited company (UK Ltd) is
planned; after registration this section will be updated with the company
name, the registration number and the registered office
address, and the operator role will pass to that company.

| | |
|---|---|
| **Operator (data controller)** | Ruslan Bei, an individual trading under the name **DareBay** |
| **Region of operation** | Europe |
| **Future legal entity** | UK private limited company (registration in progress) |
| **General contact** | hello@darebay.com |
| **Privacy contact** | privacy@darebay.com |
| **Postal address** | Provided on written request to **privacy@darebay.com**. We give the current correspondence address to data subjects, to supervisory authorities on request, and to law enforcement as the law requires. |

You can complain about us to the data protection authority of your country:

- **EU/EEA users** - your national supervisory authority. The list:
  [edpb.europa.eu/about-edpb/about-edpb/members](https://www.edpb.europa.eu/about-edpb/about-edpb/members_en).
- **UK users** - the [Information Commissioner's Office (ICO)](https://ico.org.uk/).
- **Ukraine** - the Ukrainian Parliament Commissioner for Human Rights.
- **Other countries** - any relevant data protection or consumer
  authority.

It is better to write to us first, but it is your right.

---

## 2. What we collect

Only what is needed for the platform to work and for winners to get
their prizes. Specifically:

### 2.1 Account and profile

- **Identity** - email, password (stored as a bcrypt hash, never in
  plain text), username, display name, avatar,
  optional bio.
- **Profile signals** - verification level (BLOGGER / STORE / COMPANY),
  your rating as an organizer and as a participant, the account creation date.
- **Authentication** - JWT sessions; OAuth identifiers (for example,
  the Google `sub`) if you sign in through a third-party service.

### 2.2 Contest activity

- The contests you create (title, description, prize, dates,
  rules).
- The works you submit (text, images, video, source
  URLs for imported content).
- Votes, likes, comments, reports.
- Winner decisions and records of winnings.

### 2.3 Wallet and transactions

- The balances of your DareBay wallet: the available and locked **USDT**
  balance used for contests and payouts, plus **COINS**, the platform's
  internal gamification unit.
- Records of top-ups, prize freezes, commissions, payouts to
  winners and withdrawals (where the methods we
  provide at the time are available).
- For payments through our partners: the transaction metadata the
  partner returns (we never see or store the full card number;
  it stays with the payment processor).

### 2.4 Connected social accounts

When you connect TikTok, Instagram or YouTube to confirm
ownership of imported videos, we receive and store a small
set of identifiers from that platform - see [section 3](#_3-tiktok-instagram-and-youtube-data).

### 2.5 Technical and device data

Collected automatically when you use the Service:

- IP address, approximate location (country / region from the IP).
- User agent (browser, OS version), device type, screen size.
- Request timestamps, page views, error logs, security
  events.

### 2.6 Communications

The emails and messages you send to support, the content in our
help channels, and the replies we send.

### 2.7 What we do **not** collect

- Identity documents are collected only during account verification
  (the BLOGGER / STORE / COMPANY levels). They are stored with our
  verification partner, not in our general databases, and are deleted after
  a decision is made.
- We do not read your private messages, your email outside DareBay or your
  activity on third-party social networks, beyond what is strictly needed to
  confirm video ownership.
- We do not buy or rent personal data from data brokers.

---

## 3. TikTok, Instagram and YouTube data

This section is detailed because those platforms require it (and so do
we).

### 3.0 The data flow step by step

When you connect a TikTok account to confirm ownership of an
imported video:

1. You press **Connect TikTok** on the DareBay verification page.
2. We redirect you to TikTok's official OAuth screen at
   `tiktok.com/v2/auth/authorize/`. From there you are in TikTok's environment,
   not ours; we never see your TikTok password.
3. TikTok shows you the permissions we request - `user.info.basic`
   and `user.info.profile` (see [3.1](#_3-1-what-we-receive)) - and asks
   for your permission.
4. You agree (or cancel - cancelling ends the flow and no
   data leaves TikTok).
5. TikTok redirects you back to DareBay with a temporary authorization
   code in the URL.
6. Our server exchanges the code for a short-lived access token,
   makes **one** call to the TikTok endpoint `/v2/user/info/`, reads
   the fields from [3.1](#_3-1-what-we-receive) and immediately discards the
   access token.
7. We compare the `username` we received with the author's public handle,
   parsed from the imported video's URL. On a match we
   record the verification (see [3.3](#_3-3-what-we-store)) and
   return you to DareBay.

The flow is one-shot: exactly one read call to TikTok per
verification. We do not request a refresh token, do not store the access token,
and do not call any other TikTok API.

### 3.1 What we receive

When you connect TikTok through TikTok Login Kit (OAuth 2.0), TikTok
passes us:

- **`open_id`** - a stable identifier for your account,
  specific to our application.
- **`username`** - your TikTok handle (for example, `@yourname`), under the
  `user.info.profile` scope.
- **`display_name`** and **`avatar_url`** - under the `user.info.basic` scope.

For Instagram and YouTube we receive equivalent minimal
identifiers through their OAuth flows.

### 3.2 How we use it

**One purpose only:** to confirm that the TikTok / Instagram /
YouTube account you authenticate into is the same account that
authored the video being submitted to a contest. We compare the
authenticated `username` with the author's public handle, parsed
from the video URL. On a match we mark the work as verified and
attach it to your DareBay account.

We do **not**:

- Post, comment, send messages or do anything else on
  TikTok / Instagram / YouTube on your behalf.
- Read your private messages or your private content.
- Sell, licence or pass your data from these platforms to
  third parties.
- Use it for advertising or for building profiles for targeting.

### 3.3 What we store

- The platform name (for example, `TIKTOK`).
- The platform `open_id` and `username`, tied to your DareBay user
  ID.
- The time the link was established and when it was last
  confirmed.
- A flag indicating whether the link is active.

We do **not** store your TikTok / Instagram / YouTube access token after
the verification flow ends - it is used once to request the user
information and is then discarded.

### 3.4 How to unlink

In your DareBay profile → **Settings → Connected accounts →
Unlink**. We delete the stored `open_id`, `username` and the link
timestamp immediately. Works you previously verified through
that account stay attached to you (we do not rewrite contest
history), but further verification through that link no longer runs.

### 3.5 Note

This section is published in the form the TikTok Login Kit review
process requires. If TikTok updates its policy so that it
conflicts with ours, we will update ours.

---

## 4. Why we use your data (legal bases)

Under the UK GDPR, every use of personal data requires a legal
basis. Ours are:

| What we do | Legal basis |
|---|---|
| Run your account, run contests, process payouts, hold the wallet | **Contract** (art. 6(1)(b)) - necessary to provide the Service you signed up for |
| Send service emails (password reset, contest events, payouts) | **Contract** + **legitimate interest** in keeping you informed about your activity |
| Detect fraud, prevent abuse, protect the platform | **Legitimate interest** in protecting users and the platform |
| Comply with tax, accounting, AML and prize law | **Legal obligation** (art. 6(1)(c)) |
| Confirm ownership of imported videos | **Contract** - verification is a condition of importing third-party content |
| Send marketing emails and platform updates beyond the service ones | **Consent** (art. 6(1)(a)) - can be withdrawn at any time |
| Aggregated usage analytics to improve the platform | **Legitimate interest**, with privacy-preserving methods |

We never rely on "consent" where refusing it is not realistically
possible without losing the Service - there we rely on contract or a legal
obligation.

---

## 5. Who we share data with

In short: **with as few parties as possible**, and only with those
contractually obliged to use the data the way we tell them to.

| Recipient | Purpose | Region |
|---|---|---|
| **Cloud hosting** (DigitalOcean) | Servers, databases, object storage | Mostly the EU (Frankfurt / Amsterdam) |
| **Payment processors** | Card and bank top-ups / payouts | UK / EU / global, in line with applicable financial regulation |
| **Email delivery** | Service emails (password reset, payout notifications) | UK / EU / US, GDPR-compliant |
| **Verification partner** | One-off KYC / business document check for the verification levels | UK / EU |
| **Anti-fraud / risk analytics** | Spotting suspicious patterns | UK / EU |
| **TikTok / Instagram / YouTube** | OAuth solely to confirm video ownership | Per their own policies |
| **Law enforcement** | Only on lawful requests and only what is strictly necessary | - |

We do **not** sell your personal data. We do **not** share it for
advertising. We do **not** disclose it to other DareBay users beyond
what your public profile shows (username, avatar,
ratings, public contests, public works).

When we use a processor outside the UK / EU / EEA, we rely
on:

- **The UK IDTA** (International Data Transfer Agreement) or
  **EU SCCs** (Standard Contractual Clauses), as applicable;
- **Adequacy decisions**, where they exist;
- **Supplementary measures** (encryption, access control) where the receiving
  country offers weaker protection than the UK / EU.

---

## 6. How long we keep data

As long as needed for the purpose it was collected for, then we delete or
anonymize it.

| Category | Retention period |
|---|---|
| Account and profile data | While your account is active. After deletion: **30 days** in soft-delete (in case you change your mind), then final deletion |
| Contest history (your contests, works, comments) | The public contest data stays as part of the platform's historical record. Your name there is replaced with **"Deleted user"** if you delete your account |
| Wallet and transaction records | **6 years** - matching UK accounting and tax record requirements (HMRC / Companies Act 2006) |
| Links to connected social networks (TikTok, Instagram, YouTube) | Until you unlink or delete your account |
| Server logs, security events | **90 days**, unless flagged for an active investigation |
| Marketing consent records | Until consent is withdrawn, plus **3 years** of proof of the withdrawal |
| KYC / verification documents | Per the verification partner's policy - usually the statutory retention period plus the prescribed storage term |

---

## 7. Your rights

You have the following rights over your personal data. We honour
them globally; if your jurisdiction gives you more, you get more.

- **Access** - get a copy of the data we hold about you.
- **Rectification** - correct inaccurate data.
- **Erasure** ("the right to be forgotten") - delete your data, subject to
  mandatory retention (accounting records, for example).
- **Portability** - get a machine-readable export of your data
  to take somewhere else.
- **Restriction** - ask us to pause the processing of your
  data until a dispute is resolved.
- **Objection** - object to processing based on legitimate
  interest, or to direct marketing.
- **Withdrawal of consent** - for everything we do on the basis of consent.
  Past processing stays lawful, but we stop from then on.
- **Complaint** - to your national data protection authority.

**How to use them:** write to **privacy@darebay.com** from the
address listed in your account. We respond within 30 days
(usually faster). We may ask for basic verification if the request
is sensitive.

Most of these you can do yourself in **Settings
→ Account and privacy**: download a data export, delete your account,
withdraw marketing consents, unlink social networks.

---

## 8. Security

- Passwords are stored as **bcrypt** hashes - we never see the
  plain text.
- Data in transit is encrypted with **TLS 1.2+**.
- Data on disk in the database and object storage is encrypted.
- Access to production systems is through SSH keys only, and everything is logged and
  audited.
- Regular automated dependency scans for vulnerabilities and prompt
  patching.
- The wallet and the prize logic are built so that commission and payout
  amounts are computed deterministically rather than set by hand. Payout
  fulfilment through the recorded details can be manual.

If a breach happens that could create a risk to your rights, we
notify the supervisory authority within **72 hours**, and you, where
required, without undue delay.

---

## 9. Cookies and similar technologies

We use cookies and local storage minimally:

- **Authentication** - session cookies and JWT storage to
  keep you signed in. Strictly necessary; it cannot be turned off without losing
  access.
- **Preferences** - language, theme, the mute state for audio. Stored
  locally on your device.
- **Security** - anti-CSRF tokens, anti-fraud signals.

We have no advertising cookies, no third-party trackers and no cross-site
fingerprinting. If we add analytics, we will pick a privacy-preserving option
(self-hosted, no IP collection, nothing passed to third parties) and update
this policy.

---

## 10. Children

DareBay is **not for users under 13**. If you are between 13 and
the age of majority in your country, you may use DareBay
only with parental consent where the law requires it, and you may not run
contests with prizes or withdraw money from the wallet to an external account.

If you are a parent and believe that a child under 13 has created an account,
write to **privacy@darebay.com** and we will delete it.

---

## 11. International data transfers

DareBay's main infrastructure is in the **European Union** (DigitalOcean
Frankfurt / Amsterdam). Some of our processors operate in the
UK, the US and other jurisdictions. When data leaves the UK /
EU / EEA, we use:

- **The UK IDTA** or **EU SCCs**, as approved by the relevant authority.
- **Supplementary measures** (encryption, access control) where
  necessary.
- **Vendors certified** under recognized frameworks, where
  applicable.

You can request the current list of sub-processors at **privacy@darebay.com**.

---

## 12. Users in the CIS

Most of our users are in **Russia, Ukraine, Belarus,
Kazakhstan** and other CIS countries. Where your local law grants
specific rights or places specific obligations on us:

- You keep all the rights granted by your country's
  personal data protection law (for example, FZ-152 in Russia,
  the Law on Personal Data Protection in Ukraine, and the equivalent acts in
  Belarus / Kazakhstan).
- You can contact us **in Russian or English** about any
  privacy question; we reply in the language you wrote in.
- Where your law requires that we act on your data only
  with explicit consent, we obtain that consent before processing begins.

If a conflict arises between this policy and a mandatory
requirement of your local law, the local law prevails
for that requirement.

---

## 13. Changes to the policy

We update the policy when the platform changes or the law changes.
Material changes are announced by:

1. Updating the **Last updated** date at the top.
2. An email to your account address for material changes.
3. A banner on the site for **30 days** after the change.

If you disagree with a change, you can stop using the
Service and delete your account. Continuing to use DareBay after the date
the change takes effect means you accept it.

---

## 14. Contacts

| | |
|---|---|
| General privacy questions | privacy@darebay.com |
| Data protection contact | dpo@darebay.com |
| Operator | Ruslan Bei (sole operator), trading as DareBay |
| Postal address | Provided on written request to **privacy@darebay.com** |

Email is the fastest channel; we handle all privacy requests
within 30 days, usually within 5 working days.

---

→ **[Terms of Use](/en/legal/terms)** • **[Back to legal documents](/en/legal/)**
