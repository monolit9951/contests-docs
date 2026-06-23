# Branch protection — content fleet gate

The fleet's "human merges, bot never publishes" guarantee needs branch protection on `develop` and
`release`. On a **free-plan PRIVATE repo this is unavailable (403)** — see seo-fleet `DECISIONS.md` B1.

## If `contests-docs` is PUBLIC (recommended — Option A)
Configure on both `develop` and `release`:
- **Require a pull request before merging** (no direct pushes).
- **Require status checks to pass** → required check: **`lint`** (the workflow in `lint.yml`).
- **Require review from someone other than the author** (1 approval) — the producer-bot opens PRs; a human
  (different account) approves + merges. Producer-bot must NOT be in CODEOWNERS `*` (its approval must not count).
- **Block force pushes.**

Result: the bot can open PRs but never merge; a red `lint` blocks merge; numbers are human-fact-checked at merge.

## If staying PRIVATE without GitHub Team (Option C — convention, no enforcement)
Branch protection can't be set. The gate becomes discipline:
- The bot opens PRs; the founder does NOT push directly to develop/release and merges only after the `lint`
  check is green and the numbers are fact-checked.
- `lint.yml` still runs on PRs (advisory CI), it just isn't *required*.
- Document this choice in seo-fleet `DECISIONS.md` B1 and do not claim "enforced no-self-merge".
