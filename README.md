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

```bash
make build_app VERSION=test
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

When the product policy genuinely changes, update the backend first, then update the reviewed
snapshot, the double-entry baseline in `scripts/product-truth-lint.mjs`, all canonical pages and the
mutation tests in one reviewed change. Do not change the snapshot alone.
