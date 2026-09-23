# Deploy notes — content site

## Indexation model

- Guarded on-box development builds use `DOCS_ENV=dev`, the dev hostname and
  `noindex`. Like every image build they name their asset-retention base
  explicitly (genesis, see "Hashed asset retention").
- `release` CD uses `DOCS_ENV=prod`; production HTML is indexable and canonical
  URLs use `https://darebay.com`.
- Promotion from `develop` to `release` is the publication boundary. IndexNow
  runs only after the exact release marker is visible on the public origin.

## Sitemap, robots and machine manifest

- The content sitemap is `https://darebay.com/sitemap-content.xml`. HTML is the
  sole hreflang authority because translated slugs cannot be inferred from the
  VitePress directory tree.
- Root `robots.txt` belongs to `contests-frontend` and lists the application,
  contest, store and content sitemaps.
- `https://darebay.com/.well-known/darebay-content-pages.json` is an exact,
  revalidated copy of `docs/content-pages.json`; other surfaces should consume
  or parity-check it instead of mirroring localized paths silently.

## Host routing delivery

The host vhost includes `/etc/nginx/snippets/darebay-content.conf` before its
SPA fallback. `scripts/gen-host-nginx.mjs` derives that snippet from the same
manifest as the pages. Release CD never publishes a candidate as registry
`latest`. It pushes only the commit-SHA tag, resolves its registry manifest
digest, and sends the snippet plus both deployment scripts through one SSH
session as base64 payloads with SHA-256 digests.

The host creates a random transaction directory below the root-owned 0700
`/var/lib/darebay-content-deploy/` parent. Both the wrapper and child reject
symlinks, unexpected paths, owners or modes and recheck every artifact digest
before the root-owned script can execute. There is no predictable `/tmp` target
and no second cleanup session racing the deployment.

`deploy/deploy-content-transaction.sh` holds the same
`/var/lock/darebay-redeploy.lock` as stack delivery across all mutable steps:

1. re-read the GitHub `release` ref, pin the running image under a unique
   rollback tag, and prove registry `latest` still names that running image;
2. log in with the workflow's ephemeral Docker credentials, pull the candidate
   by immutable manifest digest, and prove write access by idempotently pushing
   its exact commit-SHA tag before changing production; refuse the candidate
   unless its `org.darebay.content.retention-base` label equals the running
   image's revision (see "Hashed asset retention");
3. re-read `release` immediately before cleanup/activation, retag the exact
   local candidate as `latest`, and recreate only `docs` with `--pull never`;
4. require the direct container release marker to equal the exact commit SHA,
   re-read `release`, then install, validate and reload the generated snippet;
5. re-read `release` again, publish registry `latest` only now, and read it back
   until it resolves to the candidate image before declaring the commit done;
6. on any pre-commit or ambiguous-push failure, restore and verify registry
   `latest`, restore the previous snippet, and recreate the pinned container
   with `--pull never`. Failed rollback keeps the unique image pin for repair.

Consequently a failed candidate is never the image selected by a later stack
pull, while a successful transaction leaves both the running container and
registry `latest` on the same verified image. Backend/full-stack delivery also
excludes independently-owned frontend/docs services; the shared lock remains a
second line of isolation.

The snippet installer has its own shared nginx-config lock because the frontend
pipeline edits the same host vhost. Its failure trap covers signals and
unexpected commands between the file move and nginx reload, not just a failed
`nginx -t`.

Post-deploy probes verify every generated hub/locale prefix, root artifacts,
the JSON manifest headers/body, clean-URL redirects, the release identity and
the frontend-owned root IndexNow key.

## Hashed asset retention

Crawlers render HTML hours or days after fetching it, and a page chunk missing
at that moment is what VitePress turns into its 404 view. So each image also
serves the hashed `/content-assets/` files that recent releases retired.
`scripts/content-asset-policy.mjs` holds the whole policy:

- window: 14 days from the retiring release's commit time (`RELEASE_EPOCH`);
- cap: 256 MiB of raw retained bytes; above it the oldest retirements go first;
- hashed names: the regex of nginx.conf's immutable location (the self-test
  fails if they drift). Stable names (fonts, `logo.svg`) are never retained;
- manifest: `/usr/share/nginx/content-assets-retention.json`, outside the web
  root `/usr/share/nginx/html`, so nginx never serves it. It lists every
  retained path with its retirement time, sha256 and size.

Release CD resolves `contestvibe/contests-docs:latest` to one manifest digest
and reads its `org.opencontainers.image.revision`. The Docker build stage
mounts that image read-only and runs `scripts/retain-content-assets.mjs` after
`npm run docs:build`: it checks the base serves the revision it claims, carries
the base's retained files (keeping their retirement time), retires the base's
files this build no longer has, applies the window and the cap, and writes to
`/app/retained`. The dist that `check:dist` verified is never modified. Retained
files keep the base file's mtime, so nginx's ETag and Last-Modified for a hashed
name stay stable across releases. A name the new build also has is current: it
is never retained or copied, so the build's own bytes are served. Two cases of
the same hashed name with other bytes:

- the base still retains the name (inside the window): the build fails, because
  crawlers render old HTML against exactly the retained bytes;
- the name is current in both the base and the build (a toolchain that rewrites
  chunks after hashing, as VitePress does for page chunks in `generateBundle`):
  the build log prints a warning with the names and the build's bytes are
  served, as before retention.

The runtime image carries `org.darebay.content.retention-base=<base revision>`.

The deploy transaction refuses a candidate whose retention base is not the
running release (a genesis image, one built before a manual rollback, or on any
other base), before any production mutation. Rerun CD in that case.

Non-production builds (local, `DOCS_ENV=dev`, `npm run check:image`) start a
new chain on the bare runtime base: pass
`RETENTION_BASE=nginx:alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752`,
`RETENTION_BASE_REVISION=genesis` and `RELEASE_EPOCH=$(git show -s --format=%ct HEAD)`
to `make build_app`; none of the three has a default. A genesis image never
reaches production because of the transaction check. `npm run check:image --
--chain` builds on the committed release instead and probes a retained file.

Emergency purge (old JavaScript must stop being served, e.g. a client-side
security fix): build the next release with `RETENTION_WINDOW_DAYS=0`. In release
CD that means adding `RETENTION_WINDOW_DAYS=0` to the `make build_app` call of
the "Build immutable release candidate" step for that one release and removing
it in the next; `make` passes the build argument only when it is set, and only
`retain-content-assets.mjs` consumes it. The purge image retains nothing (its
manifest records `windowDays: 0`), and the chain restarts empty from it.
Hashed names outside the window, or that never existed, keep answering 410 with
`max-age=600`.

The same one-release purge is the way past a build that failed because a
retained name came back with other bytes: first find why a hashed name changed
its bytes (the failure lists up to ten names), then, if the new bytes are
intended, build that release with `RETENTION_WINDOW_DAYS=0`. Nothing is retained
then, so nothing conflicts, and the next release retains again as usual.

## Rollback

Revert the release commit. CD rebuilds the image and host snippet together.
During a failed deployment, rollback is automatic for both halves of the
transaction and for an ambiguous final registry update. The nginx installer
also keeps timestamped backups under
`/etc/nginx/snippets/backups/` for manual recovery after the transaction ends.

## Spell checking

`.github/scripts/spell-diff.sh` remains advisory until the RU dictionary is
calibrated. Hard gates are tests, anti-doorway lint, registry checks and the
artifact-level production build.
