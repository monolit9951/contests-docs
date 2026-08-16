---
title: How are winners chosen?
description: Four selection types - seeded random among eligible active works, organizer choice, community voting, or oracle-attested pay per view.
provenance: { snapshot_date: "2026-08-15", source: "darebay-prod" }
numbers_used: []
---

# How are winners chosen?

Every DareBay contest uses **one of four** selection types. The type is
fixed before the start: the organizer picks it at creation and cannot
change it mid-run.

Whichever type a contest uses, the budget is recorded against it from publication, and in a
wallet-backed contest it is charged from the organizer at that moment. After the result is
confirmed, the platform stores a credit or obligation; fulfilment can be processed by hand and no
settlement date is promised.

## Seeded draw among eligible active works (RANDOM)

When the entry window closes, the system uses a stored seed to shuffle all
prize-eligible submissions whose visibility status is **ACTIVE**. Likes do not
filter or weight this pool.

- **Good for:** giveaways, contests with no expert judging, hype
  campaigns.
- **Feels like:** an auditable seeded draw.
- **What the participant does:** submits an eligible work; the draw decides the rest.

## The organizer's own call (CREATOR_DECISION)

After the deadline the organizer reviews the submissions and names the
winner themselves, by the **selection deadline** they fixed at creation.

- **Good for:** subjective quality (design, copy, craft), curated
  contests.
- **Feels like:** classic judging.
- **What the participant does:** follows the task to the letter and shows
  real quality.
- **On trust:** contests decided by the organizer lean heavily on their
  **rating**. Low-rated organizers who judge their own contests draw few
  entries, and rightly so.

## A vote by the audience (VIEWER_VOTING)

Submissions move into a voting phase where viewers vote for the ones they
like (one vote per account per contest). The top of the vote count wins.

- **Good for:** community contests, brand activations, anything where "who
  the crowd picked" is the whole point.
- **Feels like:** a talent show final.
- **What the participant does:** submits, then gathers support honestly
  (sharing is fine, bots are not).

## Oracle-attested pay per view (ORACLE_ATTESTED_POOL)

Nobody picks a winner. The platform's independent counter reads the published view counter on the site
each video was posted on, then applies the contest's rate per 1000 views, its view threshold and
its cap per submission. Every submission over the threshold is paid by formula, so several people
can be "the winner" at once.

- **Good for:** buying reach rather than one hero video.
- **Feels like:** a rate card, not a competition.
- **What the participant does:** publishes and sends the link. The link is what enters the clip
  into the contest.

## Rules around voting

These apply where a vote or a like is part of the decision:

- Organizers do not vote in their own contests.
- Participants do not vote for their own submission.
- One vote per account per contest.
- Suspicious patterns (a flood of votes from one address, coordinated timing, freshly created
  accounts voting in unison) go to review.

Review means a person looking at it, not an automatic reversal. In pay-per-view contests none of
this applies at all: likes and votes have no effect on the money, because the formula only reads
the view counter.

## What if the winner never responds

If a named winner does not claim the prize in time, the prize passes to the
next in line for voting, a seeded replacement for RANDOM, or the organizer picks again
(the organizer's own call). The claim deadline is always stated in the
notification the winner receives.

---

→ See also: **[Create your first contest](/en/help/your-first-contest)**, **[fake submissions](/en/help/protection-from-view-fraud)**.
