# Node 22, not 20: the build runs the registry gate and the generators, and they
# import registry.ts directly via --experimental-strip-types, which does not
# exist before 22.6. On node:20 the build died with exit code 9 and no message
# about the flag at all.
ARG RELEASE_SHA=development
# Hashed-asset retention (scripts/retain-content-assets.mjs). RETENTION_BASE is the
# image whose /usr/share/nginx the merge reads: in release CD the committed release
# (contestvibe/contests-docs@sha256:..., resolved from `latest`) with its revision;
# for local, dev and boot-check builds the bare runtime base
# nginx:alpine@sha256:4a73073b... with RETENTION_BASE_REVISION=genesis. No defaults:
# a blank base fails the build instead of silently dropping the previous release.
ARG RETENTION_BASE
ARG RETENTION_BASE_REVISION

FROM ${RETENTION_BASE} AS retention-base

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# DOCS_ENV controls sitemap host + preview noindex (config.ts). GitHub builds
# release only; guarded on-box development builds may pass DOCS_ENV=dev.
ARG DOCS_ENV=prod
ARG RELEASE_SHA
# Search-console ownership tokens. Optional: unset expands to an empty string and
# config.ts omits the <meta> entirely. Not secrets in any real sense — Google and
# Yandex verify by reading them off the public page.
ARG GOOGLE_SITE_VERIFICATION=
ARG YANDEX_VERIFICATION=
RUN DOCS_ENV=$DOCS_ENV \
    RELEASE_SHA=$RELEASE_SHA \
    GOOGLE_SITE_VERIFICATION=$GOOGLE_SITE_VERIFICATION \
    YANDEX_VERIFICATION=$YANDEX_VERIFICATION \
    npm run docs:build

# Carry the hashed assets that recent releases retired, so HTML a crawler fetched
# before this deploy still renders after it. Runs after check:dist and writes only
# to /app/retained: the verified dist stays exactly as built. The base is mounted
# read-only; RELEASE_EPOCH (commit time) makes the result independent of build time.
# RETENTION_WINDOW_DAYS is empty unless an emergency purge sets it (0 keeps nothing).
ARG RETENTION_BASE_REVISION
ARG RELEASE_EPOCH
ARG RETENTION_WINDOW_DAYS=
RUN --mount=type=bind,from=retention-base,source=/usr/share/nginx,target=/retention-base,ro \
    node scripts/retain-content-assets.mjs \
      --base /retention-base \
      --base-revision "$RETENTION_BASE_REVISION" \
      --dist docs/.vitepress/dist \
      --release-sha "$RELEASE_SHA" \
      --release-epoch "$RELEASE_EPOCH" \
      --window-days "$RETENTION_WINDOW_DAYS" \
      --out /app/retained

FROM nginx:alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752

ARG RELEASE_SHA
ARG RETENTION_BASE_REVISION
LABEL org.opencontainers.image.revision=$RELEASE_SHA
# The release whose assets this image carries. deploy-content-transaction.sh refuses
# a candidate unless this equals the running release, so `genesis` never ships.
LABEL org.darebay.content.retention-base=$RETENTION_BASE_REVISION

COPY nginx.conf /etc/nginx/conf.d/default.conf
# The 301 map for every retired address, generated from the page registry.
# `include`d by nginx.conf — regenerate with scripts/gen-nginx-redirects.mjs,
# never edit by hand.
# ⚠️ snippets/, NOT conf.d/. The base image auto-includes every
# `/etc/nginx/conf.d/*.conf` at the HTTP level, where a bare `location` is
# illegal — so a file meant to be included inside a `server` block is parsed
# twice and the second parse kills nginx on boot with
# `"location" directive is not allowed here`. The container restart-looped in
# production for exactly this. A directory nginx does not auto-include removes
# the whole class.
RUN mkdir -p /etc/nginx/snippets
COPY redirects.conf /etc/nginx/snippets/redirects.conf

# Base is '/' since the 2026-08 URL migration: content answers on root-level topic hubs
# (/zarabotok/, /pomoshch/, ...) and the host nginx routes exactly those prefixes here.
# So the dist goes at the document root, and the filesystem layout matches the URL layout
# both behind the host and when the container is hit directly on localhost:3002.
COPY --from=build /app/docs/.vitepress/dist /usr/share/nginx/html
# Retired hashed assets of recent releases, with their original mtimes (stable ETag
# and Last-Modified). The merge refused any name the dist also has with other bytes
# and skipped identical ones, so nothing here overwrites the dist. The manifest sits
# outside the web root: nginx cannot serve it, and the next build reads it back.
COPY --from=build /app/retained/content-assets /usr/share/nginx/html/content-assets
COPY --from=build /app/retained/content-assets-retention.json /usr/share/nginx/content-assets-retention.json

# Nginx runs as the `nginx` user inside this image; make sure it can read
# everything regardless of any umask/ACL quirks in the build context.
RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
