---
title: Privacy Policy
description: What data DareBay collects, why, how long we keep it, and how to control it.
---

# Privacy Policy

**Effective date:** 7 May 2026
**Last updated:** 7 May 2026

This policy describes how **DareBay** ("DareBay", "we", "us", "the
platform") collects, uses, and protects your personal data when you use
**darebay.com**, the DareBay web app, our APIs, and related services
(collectively, the "Service").

We treat your data the way we'd want ours treated: collect only what we
need, keep it only as long as we need it, and never sell it. This policy
explains the specifics.

We follow the **UK General Data Protection Regulation (UK GDPR)**, the
**Data Protection Act 2018**, and the data protection laws of the
jurisdictions where our users reside, applying the strictest standard
where they overlap.

If you only read one section, read [Your rights](#your-rights). The rest is
the detail behind it.

---

## 1. Who we are

| | |
|---|---|
| **Operator** | DareBay |
| **Country of operation** | United Kingdom *(business registration in progress; final entity name and address will be added here once registration completes)* |
| **General contact** | hello@darebay.com |
| **Privacy contact** | privacy@darebay.com |

If you're in the UK and feel we've mishandled your data, you can lodge a
complaint with the [Information Commissioner's Office (ICO)](https://ico.org.uk/).
If you're in the EU, you can complain to your national supervisory
authority. If you're elsewhere, you can use whatever consumer-protection
or data-protection authority your country provides. We'd rather you talk
to us first — but it's your right either way.

---

## 2. What we collect

We collect only what we need to run the platform and pay winners.
Concretely:

### 2.1 Account & profile

- **Identity** — email, password (stored as a bcrypt hash, never in plain
  text), username, display name, avatar, optional bio.
- **Profile signals** — verification tier (BLOGGER / STORE / COMPANY),
  your organizer rating and participant rating, account creation date.
- **Authentication** — JWT session tokens; OAuth identifiers (e.g. Google
  `sub`) when you sign in with a third-party provider.

### 2.2 Contest activity

- Contests you create (title, description, prize, dates, rules).
- Works you submit (text, images, video, source URLs for imported
  content).
- Votes, likes, comments, and reports you make.
- Selection decisions and winner records.

### 2.3 Wallet & transactions

- Your DareBay wallet balance, denominated in **DareBay Coins** — an
  in-platform unit used to fund contests and pay winners.
- Top-up records, prize-funding records, commission charges, payouts to
  winners, and withdrawals (where supported by the methods we offer at
  any given time).
- For payments through our payment partners: transaction metadata
  returned by the partner (we never see or store your full card number;
  it lives with the payment processor).

### 2.4 Connected social accounts

When you connect a TikTok, Instagram, or YouTube account to verify
ownership of imported videos, we receive and store a small set of
identifiers from that platform — see [Section 3](#tiktok-instagram-and-youtube-data).

### 2.5 Technical & device data

Collected automatically when you use the Service:

- IP address, approximate location (country / region from IP).
- User agent (browser, OS version), device type, screen size.
- Timestamps of requests, page views, error logs, security events.

### 2.6 Communications

Emails and messages you send to support, content you post in our help
channels, replies we send back.

### 2.7 What we do **not** collect

- Government IDs are only collected during account verification (BLOGGER /
  STORE / COMPANY tiers). They're held by our verification partner, not
  in our general databases, and are deleted after the verification
  decision.
- We don't read your private messages, emails outside DareBay, or
  third-party social activity beyond what's strictly needed for video
  ownership matching.
- We don't buy or rent personal data from data brokers.

---

## 3. TikTok, Instagram, and YouTube data

This section is specific because these platforms require it (and so do we).

### 3.1 What we receive

When you connect a TikTok account through TikTok Login Kit (OAuth 2.0),
TikTok sends us:

- **`open_id`** — a stable, app-specific identifier for your account.
- **`username`** — your TikTok handle (e.g. `@yourname`), under the
  `user.info.profile` scope.
- **`display_name`** and **`avatar_url`** — under the `user.info.basic`
  scope.

For Instagram and YouTube, we receive equivalent minimal identifiers via
their respective OAuth flows.

### 3.2 What we use it for

**One purpose only:** to confirm that the TikTok / Instagram / YouTube
account you authenticate into is the same one that authored a video
you're submitting to a contest. We compare the authenticated `username`
against the public author handle parsed from the video URL. On match, we
mark the submission as verified and link it to your DareBay account.

We do **not**:

- Post, comment, message, or take any action on TikTok / Instagram /
  YouTube on your behalf.
- Read your private messages or non-public content.
- Sell, license, or share your platform data with third parties.
- Use it for advertising or profile-building.

### 3.3 What we store

- The platform name (e.g. `TIKTOK`).
- Your platform `open_id` and `username`, linked to your DareBay user ID.
- The timestamp at which the link was established and last verified.
- A flag indicating whether the link is still active.

We do **not** store your TikTok / Instagram / YouTube access token after
the verification flow completes — it's used once to make the user-info
call, then discarded.

### 3.4 How to disconnect

Go to your DareBay profile → **Settings → Connected accounts → Disconnect**.
We delete the stored `open_id`, `username`, and link timestamp
immediately. Submissions you previously verified through that account
stay attributed to you (we don't rewrite contest history), but no further
verification will flow from that connection.

### 3.5 Reference

This section is published in the form required by TikTok's Login Kit
review process. If TikTok updates its policy in a way that conflicts with
ours, we'll update ours.

---

## 4. Why we use your data (lawful bases)

Under UK GDPR, every use of personal data needs a lawful basis. Here's
ours:

| What we do | Lawful basis |
|---|---|
| Run your account, deliver contests, process payouts, hold your wallet | **Contract** (Art. 6(1)(b)) — necessary to provide the Service you signed up for |
| Send service emails (password reset, contest milestones, payouts) | **Contract** + **Legitimate interest** in keeping you informed about your activity |
| Detect fraud, prevent abuse, secure the platform | **Legitimate interest** in protecting users and the platform |
| Comply with tax, accounting, anti-money-laundering, and prize-payout law | **Legal obligation** (Art. 6(1)(c)) |
| Verify ownership of imported social media videos | **Contract** — verification is a condition of importing third-party content |
| Send marketing emails and platform updates beyond service notifications | **Consent** (Art. 6(1)(a)) — withdraw any time |
| Aggregate analytics on usage to improve the platform | **Legitimate interest**, with privacy-preserving methods |

We never rely on consent for things you can't realistically refuse
without losing the Service — those are contract or legal obligation.

---

## 5. Who we share data with

Short answer: **as few people as possible**, and only people who are
contractually bound to use it the way we tell them to.

| Recipient | Purpose | Region |
|---|---|---|
| **Cloud hosting** (DigitalOcean) | Servers, databases, object storage | Primarily EU (Frankfurt / Amsterdam) |
| **Payment processors** | Card and bank top-ups / payouts | UK / EU / global, in line with applicable financial regulation |
| **Email delivery** | Service emails (password reset, payout notifications) | UK / EU / US, GDPR-aligned |
| **Verification partner** | One-time KYC / business document check for verified tiers | UK / EU |
| **Anti-fraud / risk** | Pattern detection for suspicious activity | UK / EU |
| **TikTok / Instagram / YouTube** | OAuth for video ownership verification only | Per their respective policies |
| **Law enforcement / authorities** | Only on valid legal request, and only what's strictly required | — |

We do **not** sell your personal data. We do **not** share it for
advertising. We do **not** disclose it to other DareBay users beyond what
your public profile shows (username, avatar, ratings, public contests,
public submissions).

When we use a processor outside the UK / EU / EEA, we rely on:

- **UK International Data Transfer Agreements (IDTA)** or the
  **EU Standard Contractual Clauses (SCCs)** as appropriate;
- **Adequacy decisions** where the receiving country has one;
- **Supplementary measures** (encryption, access controls) where the
  receiving country offers weaker protection than UK / EU law.

---

## 6. How long we keep it

We keep data for as long as we need it for the purpose it was collected
for, then we delete or anonymize it.

| Category | Retention |
|---|---|
| Account & profile data | While your account is active. After deletion: **30 days** in soft-delete (in case you change your mind), then permanent removal |
| Contest history (your contests, submissions, comments) | Public contest data is retained as part of the platform's historical record. Your name in it is replaced with **"Deleted user"** if you delete your account |
| Wallet & transaction records | **6 years** — in line with UK accounting and tax record-keeping requirements (HMRC / Companies Act 2006) |
| Connected social account links (TikTok, Instagram, YouTube) | Until you disconnect, or your account is deleted, whichever comes first |
| Server logs, security events | **90 days**, unless flagged for an active investigation |
| Marketing consent records | Until you withdraw consent, plus **3 years** of evidence of withdrawal |
| KYC / verification documents | Per our verification partner's policy — typically the duration of the legal hold plus statutory retention |

---

## 7. Your rights

You have the following rights over your personal data. We honour them
globally; if your jurisdiction gives you more, you get more.

- **Access** — get a copy of the data we hold about you.
- **Rectification** — fix any data that's wrong.
- **Deletion** ("right to be forgotten") — have your data deleted, subject
  to legal retention obligations (e.g. accounting records).
- **Portability** — get a machine-readable export of your data to take
  somewhere else.
- **Restriction** — ask us to stop processing your data while a dispute is
  resolved.
- **Objection** — object to processing based on legitimate interest, or
  to direct marketing.
- **Withdraw consent** — for anything we do based on consent. Past
  processing remains lawful, but we stop going forward.
- **Complaint** — to your national data protection authority.

**How to exercise these:** email **privacy@darebay.com** from the address
on your account. We respond within 30 days (usually faster). We may ask
for basic verification if the request is sensitive.

You can do most of this yourself in **Settings → Account & Privacy**:
download a data export, delete your account, withdraw marketing consent,
disconnect social accounts.

---

## 8. Security

- Passwords are stored as **bcrypt** hashes — we never see the plain text.
- Data in transit is encrypted with **TLS 1.2+**.
- Data at rest in our databases and object storage is encrypted.
- Access to production systems requires SSH keys and is logged and
  audited.
- We run automated dependency vulnerability scans and patch promptly.
- Wallet and prize logic is built so commission and payouts are
  deterministic — no humans in the loop with access to redirect funds.

If a breach occurs that's likely to result in a risk to your rights, we
notify the supervisory authority within **72 hours** and you, where
required, without undue delay.

---

## 9. Cookies and similar technologies

We use cookies and local storage minimally:

- **Authentication** — session cookies and JWT storage to keep you signed
  in. Strictly necessary; can't be turned off without losing access.
- **Preferences** — language, theme, audio mute state. Stored locally on
  your device.
- **Security** — anti-CSRF tokens, fraud signals.

We don't run advertising cookies, third-party trackers, or cross-site
fingerprinting. If we add analytics, we'll use a privacy-preserving
option (self-hosted, no IP collection, no third-party sharing) and
update this policy.

---

## 10. Children

DareBay is **not for users under 13**. If you're between 13 and the age
of majority in your country, you can use DareBay only with parental
consent where required by law, and you can't run prize-bearing contests
or withdraw funds from your wallet to an external account.

If you're a parent and believe a child under 13 has created an account,
email **privacy@darebay.com** and we'll delete it.

---

## 11. International transfers

DareBay's primary infrastructure is in the **European Union**
(DigitalOcean Frankfurt / Amsterdam). Some of our processors operate in
the UK, the US, and other jurisdictions. Where data leaves the UK / EU /
EEA, we use:

- **UK IDTA** or **EU SCCs** approved by the relevant authority.
- **Supplementary measures** (encryption, access controls) where needed.
- **Vendors certified** under recognized frameworks where applicable.

You can request the list of current sub-processors at
**privacy@darebay.com**.

---

## 12. Users in the CIS region

A large share of our user base is in **Russia, Ukraine, Belarus,
Kazakhstan**, and other CIS countries. Where your local law gives you
specific rights or imposes specific obligations on us:

- You retain all rights granted under your country's data-protection
  legislation (e.g. Russian Federal Law 152-FZ, Ukrainian Law on
  Personal Data Protection, similar instruments in Belarus / Kazakhstan).
- You can contact us in **Russian or English** for any privacy request;
  we respond in the language you used.
- Where your law requires us to act on your data only with your explicit
  consent, we obtain that consent before doing so.

If a conflict arises between this policy and a binding requirement of
your local law, the local law prevails for that requirement.

---

## 13. Changes to this policy

We update this policy when we change the platform or the law changes
beneath us. Material changes are announced by:

1. Updating the **Last updated** date at the top.
2. Email to your account address for material changes.
3. A banner notice on the site for **30 days** after the change.

If you don't agree with a change, you can stop using the Service and
delete your account. Continuing to use DareBay after the effective date
of a change means you accept it.

---

## 14. Contact

| | |
|---|---|
| General privacy questions | privacy@darebay.com |
| Data Protection contact | dpo@darebay.com |
| Postal address | *(to be added once UK business registration completes)* |

---

→ **[Read the Terms of Service](./terms)** • **[Back to Legal](./)**
