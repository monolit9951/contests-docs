# contests-docs

Public multilingual guides for [darebay.com](https://darebay.com), built with
[VitePress](https://vitepress.dev/). Russian pages live at root topic hubs such
as `/zarabotok/`; Ukrainian and English use `/ua/...` and `/en/...`.

`docs/content-pages.json` is the canonical semantic URL manifest. It contains
the locale axes, localized hub segments, stable page IDs and per-locale slugs.
The build publishes the exact file at
`/.well-known/darebay-content-pages.json` for other DareBay surfaces.

## Local development

```bash
npm ci
npm run docs:dev
# open http://localhost:5173/zarabotok/
```

## Verification and build

```bash
npm test
DOCS_ENV=prod npm run docs:build  # output: docs/.vitepress/dist
npm run docs:preview
```

The build validates registry/file coverage, unique search snippets, semantic
page caps, deterministic git dates, HTML canonical/hreflang, JSON-LD, sitemap,
localized 404s and the public manifest artifact.

## Container

Every image build names its hashed-asset retention base explicitly (see
"Hashed asset retention" in DEPLOY_NOTES.md). A local build starts a new chain
on the bare nginx runtime base:

```bash
make build_app VERSION=test \
  RETENTION_BASE=nginx:alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752 \
  RETENTION_BASE_REVISION=genesis RELEASE_EPOCH=$(git show -s --format=%ct HEAD)
docker run --rm -p 3002:80 contestvibe/contests-docs:test
# http://localhost:3002/zarabotok/
# http://localhost:3002/ua/zarobitok/
# http://localhost:3002/en/earnings/
```

## Deployment

Only pushes to `release` trigger GitHub CD. Development is the guarded on-box
`develop` sync documented in the project guide; GitHub does not SSH-deploy dev.

Release CD pushes an immutable commit-SHA candidate and resolves its registry
digest; it never publishes an unverified build as `latest`. One private,
digest-authenticated SSH transaction deploys that exact image plus generated
host-nginx routing as a rollback unit under the shared stack lock. Registry
`latest` advances only after the container serves the exact release SHA and the
snippet passes `nginx -t` plus reload, so later stack pulls preserve the last
committed release. CD then probes public routes and submits changed canonical
URLs to IndexNow endpoints.

## Adding a page

1. Add Markdown under a real localized hub (for fleet-authored pages, Russian
   root hubs are `docs/zarabotok/`, `docs/brendam/`, `docs/pomoshch/` or
   `docs/o-proekte/`).
2. Add or update its stable semantic entry in `docs/content-pages.json`.
   Declare only translations that actually exist.
3. Run `npm test` and `DOCS_ENV=prod npm run docs:build`.

Navigation, sitemap, canonical, hreflang, public host routes and the language
switcher are derived from the manifest; do not maintain a second URL table.

## Product truth gate

Public claims about commissions, withdrawals, payout processing, contest funding and escrow are
checked against [`data/product-truth.json`](data/product-truth.json). The snapshot pins both the
backend release commit and the product truth-pack commit, together with the configuration,
runbook and implementation files used for verification.

PPV values come in two classes, and only one of them is double-entered against the reviewed
baseline in `scripts/product-truth-lint.mjs`:

- **`ppv.stable`** — ladder-rounded bands, the code default and the validator limit. These change
  only when the product changes, so they are pinned in the reviewed baseline and a page may print
  them freely.
- **`ppv.volatile`** — live aggregates read from prod Mongo (rate minimum/median/maximum, the
  typical per-work cap, the live threshold median, the contest count). These move on every cron
  refresh: the typical cap went 97 → 98.5 in a single day. Pinning them in a frozen code constant
  turned every refresh into a code review, so they are **not** in the reviewed baseline. They stay
  pinned to the truth-pack commit, are checked for shape and for containment in their stable band,
  and a page may print one only when it declares the matching key in `numbers_used` and carries
  `provenance.snapshot_date`.

A number outside its stable band fails regardless of declaration.

Run the gate directly with:

```bash
npm run check:truth
```

The command regenerates `docs/public/llms.txt` first, then scans it and every Markdown page. It
checks the canonical RU/EN/UA fee, withdrawal and Terms pages and rejects known contradictions such
as free or automatic withdrawal, minute-level settlement, unconditional prize-lock claims, stale
PPV ranges, or claims that on-chain escrow is live. When the pinned source repositories are present
at their recorded paths, the gate also verifies the commits, branch ancestry, properties, runbook
and implementation evidence. Set `PRODUCT_TRUTH_REQUIRE_LOCAL_SOURCES=1` to require those checkouts
instead of permitting a content-only checkout. The gate runs during `npm test` and before every
documentation build.

### Target product: `data/product-intent.json`

Since the founder decision of 2026-09-17 the public pages describe the **target** product, and
[`data/product-intent.json`](data/product-intent.json) is where that target is recorded. A claim is
publishable when it matches the target product, even when the live backend has not shipped the
change yet; every claim the file does not name is still judged against `data/product-truth.json`.

Each record carries the claim in RU/EN/UK, the `liveTruth` path it is about, the decided `target`
value and a `status`:

- `pending-product-change` — the live value still contradicts the page and the backend owes the
  change (today only `withdrawal-free`: the wallet withdrawal fee 10% → 0%).
- `matches-live` — the target and the live product already agree, so the record documents the
  decision and relaxes nothing.

A claim rule names the record that licenses it (`intentId`), and the numeric rules widen only when
the recorded target actually differs from the live value. When a record licenses a claim the gate
prints `claim allowed by product-intent: <id> (pending product change, decided 2026-09-17)`, and
every green run names the rules the file currently holds open. Validation resolves each `liveTruth`
path against the reviewed snapshot: a `matches-live` target that is not the live value, or a
`pending-product-change` target that already equals it, fails the gate. The file can only relax
what it names, and only while it tells the truth about the live product.

`no-withdrawal-minimum` is deliberately left hard: the 10 USDT floor stays in the target product
(`withdrawal-minimum`, `decision: founder-to-confirm`), so "withdraw any amount" contradicts the
target as much as the live snapshot. The rules that are not about money — live on-chain escrow,
the official-API view oracle, the retired selection model, the founder's Latin name, unqualified
prize-lock — are not wired to the intent file at all.

The founder's decision list is `darebay-ceo/docs/seo-growth-founder-queue-2026-09-17.md`, part 4.

When the product policy genuinely changes, update the backend first, then update the reviewed
snapshot, the double-entry baseline in `scripts/product-truth-lint.mjs`, all canonical pages and the
mutation tests in one reviewed change. Do not change the snapshot alone. A decision to change the
product is not a snapshot edit either: record it in `data/product-intent.json`, and retire the
record when the backend ships and the snapshot catches up.
