# Deploy notes — docs site (SEO/GEO fleet)

## Indexation model
- **develop** → deploys to the dev preview and is built with `DOCS_ENV` unset/`dev` → every page carries
  `<meta name="robots" content="noindex">` (config.ts). The preview is NOT indexable.
- **release** → production. CD must build with **`DOCS_ENV=prod`** so the noindex is dropped and the sitemap
  hostname is `https://darebay.com/`. **TODO (founder, one line):** pass `DOCS_ENV=prod` into the docker
  build on the release branch (in the Makefile `docker` target / `--build-arg`, surfaced to the build env).
  Until then prod pages render with `noindex` — safe, but they won't index.
- Promoting `develop` → `release` is the indexation gate (publish-gate #4).

## Sitemap & robots
- VitePress generates `sitemap.xml` at the docs root → `https://darebay.com/docs/sitemap.xml`.
- `docs/public/robots.txt` (served at `/docs/robots.txt`) lists it. **The authoritative root robots**
  (`https://darebay.com/robots.txt`, owned by `contests-frontend/public/robots.txt`) should ALSO list
  `Sitemap: https://darebay.com/docs/sitemap.xml` — cross-repo founder step.

## Rollback
- A bad page → revert PR on the branch (re-triggers CD push-on-branch). There is **no health gate** in
  `redeploy-docs.sh` (it just pull→recreate→prune), so a broken build that still produces a container will
  deploy — rely on the `lint` PR check (`docs:build`) to catch breakage BEFORE merge.

## RU spell (TODO / L5)
`.github/scripts/spell-diff.sh` runs cspell on changed RU markdown but is **advisory** (`|| true`) — RU
needs a `cspell.json` + ru dictionary calibration so real RU vocabulary isn't flagged. Until calibrated,
spell never blocks; the hard gates are the anti-doorway linter + `docs:build`.
