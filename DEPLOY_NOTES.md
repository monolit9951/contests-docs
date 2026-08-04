# Deploy notes — content site

## Indexation model

- Guarded on-box development builds use `DOCS_ENV=dev`, the dev hostname and
  `noindex`.
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
   its exact commit-SHA tag before changing production;
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
