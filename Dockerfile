# Node 22, not 20: the build runs the registry gate and the generators, and they
# import registry.ts directly via --experimental-strip-types, which does not
# exist before 22.6. On node:20 the build died with exit code 9 and no message
# about the flag at all.
ARG RELEASE_SHA=development

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

FROM nginx:alpine@sha256:db35bfc6b2951e7f8a72db5db120288c127ffaeeb4a6d4b95a26fead017d5913

ARG RELEASE_SHA
LABEL org.opencontainers.image.revision=$RELEASE_SHA

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

# Nginx runs as the `nginx` user inside this image; make sure it can read
# everything regardless of any umask/ACL quirks in the build context.
RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
