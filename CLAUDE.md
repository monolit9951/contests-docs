# contests-docs — Agent Guide

> Truth order: live prod/code > `darebay-ceo/STATUS.md` > product truth-pack > prose docs.
> Cross-repo safety, data persistence, git and deployment rules come from `/root/CLAUDE.md`.

`CLAUDE.md` is intentionally the single repository guide for both providers: Claude loads it
natively and managed Codex loads it through `project_doc_fallback_filenames`. Do not add a duplicate
`AGENTS.md`; after changing this guide, verify that each provider sees one global guide and one
repository guide.

## Purpose and stack

This repository owns DareBay's public multilingual VitePress guides and their SEO delivery
artifacts. Russian pages use root topic hubs; Ukrainian and English use `/ua/` and `/en/`.
Treat darebay.com and Telegram as co-equal product entrances. Consumer copy frames DareBay as an
intermediary/guarantor; never present planned on-chain escrow as current behavior.

- Runtime/build: Node.js + VitePress.
- VitePress 1.x is intentionally paired with a scoped `vite@6.4.3` override: it keeps the stable
  renderer while closing the vulnerable Vite 5 development-server chain. Keep full `npm audit`
  and the 129-URL production build green; remove the override only when stable VitePress declares
  compatibility with an equally patched Vite release (do not move this site to a VitePress alpha).
- Tests: Vitest plus the repository-owned executable contract/self-tests in `npm test`.
- Canonical semantic URL model: `docs/content-pages.json`. It owns stable page IDs, locale axes,
  localized hub segments and slugs. Do not create a second URL/locale registry.
- Product numbers and current capabilities come from
  `/root/code/darebay-seo-fleet/data/product-facts.md` and live code/state. Never carry volatile
  counts, prices, commissions or reset dates forward from an article or agent memory.

## Required verification

Install deterministically with `npm ci`.

For an uncommitted working-tree preflight, run:

```bash
npm test
DOCS_ENV=dev npm run docs:build
```

After the candidate commit exists, validate the exact committed change before push:

```bash
npm test
node --experimental-strip-types --no-warnings scripts/anti_doorway_lint.mjs \
  --corpus docs --base <actual-target-branch-base-sha>
DOCS_ENV=prod npm run docs:build
```

Run post-commit validation from a clean isolated worktree checked out at the candidate HEAD; verify
that `git status --porcelain` is empty before starting. The linter derives paths from git but reads
file contents from the working tree.

Do not rely on the linter's default `origin/develop` base when targeting `release`. Inspect generated
tracked changes after every build; never discard another session's output.

`docs:build` owns generation, the VitePress build, finalization and dist SEO gates. A generic
`npm run build` is not the contract. The build gate does not replace integration-specific checks.
Routing, manifest or nginx changes also require `npm run gates` with current built frontend and
content artifacts. Docker/image changes require `npm run check:image` in an authorized isolated
runner; global rules prohibit manual Docker builds on this production host.

When narrowing a failure, use the current scripts from `package.json` (`check:registry`,
`check:dist`, generators and URL gates). The candidate lint plus production build is authoritative
for the content/build contract; the scope-specific integration checks above remain required.
A red generator or gate is a release blocker. Diagnose whether the root cause is source data,
generator logic, test contract or environment; never weaken a valid invariant merely to get green,
and never hand-patch `docs/.vitepress/dist`.

## Content and URL invariants

- Add a page and its stable semantic entry in `docs/content-pages.json` in the same change. Every
  semantic page must declare an existing Russian root canonical. Add `uk` or `en` only when the
  corresponding source file exists; an omitted locale produces no docs URL and no hreflang.
- Every Markdown page needs `title` and `description`; their combined search snippet must satisfy
  the executable uniqueness and cannibalization checks. Changed non-hub fleet content needs
  `provenance.snapshot_date`; `seo: true` leaves must satisfy the executable thin-content,
  duplication and wave-cap rules.
- Navigation, sitemap, canonical, hreflang, host routes, language switching and the public
  `/.well-known/darebay-content-pages.json` artifact are derived from the manifest. Extend the
  owner/generator instead of editing downstream copies independently.
- Generated files must be regenerated through their package script. Never edit `dist`, generated
  sitemap/redirect/llms/date/release artifacts as an isolated fix.
- Avoid doorway pages, near-duplicate locale shells and keyword-stuffed copy. Each page needs a
  distinct user question, honest product grounding and useful internal links.
- Preserve established Russian/Ukrainian/English terminology and plain consumer language. The
  payment rail is never the pitch; do not imply unsupported automation, integrations or payouts.

## Testing policy

- Behavior changes ship with tests in the same commit. Prefer tests against the canonical manifest,
  generator output and final HTML invariants over duplicated expected URL lists.
- A changed/deleted test is a deliberate contract change; explain why the old expectation ceased
  to be valid.
- Build artifacts are evidence only when produced from the current HEAD with the intended
  `DOCS_ENV`. Do not reuse a stale `docs/.vitepress/dist`.
- Keep all temporary servers, output directories and probes session-scoped; remove only artifacts
  created by the current task.

## Delivery

- `release` is production; `develop` is the guarded on-box dev sync. Never deploy, rebuild or
  restart containers manually.
- Pushes may trigger CI/CD. Use `[skip ci]` only for a genuinely non-runtime documentation-only
  change such as this agent guide; never use it to bypass a required product/content deployment.
- Preserve unrelated dirty files in the shared checkout. Stage named paths, inspect the staged
  diff, and keep the commit focused.
- In a shared checkout, do not run `npm ci`, builds or generators concurrently with another owner;
  use an isolated worktree. These commands rewrite `node_modules`, `dist` and tracked generated
  files. `npm run gates` uses fixed default ports, while `npm run check:image` uses a fixed Docker
  container, tag and port; serialize them and never clean another session's resources.
