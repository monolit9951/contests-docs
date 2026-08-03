# Node 22, not 20: the build runs the registry gate and the generators, and they
# import registry.ts directly via --experimental-strip-types, which does not
# exist before 22.6. On node:20 the build died with exit code 9 and no message
# about the flag at all.
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# DOCS_ENV controls sitemap host + dev-noindex (config.ts). Release build = prod (indexable);
# the develop/DEV build passes DOCS_ENV=dev (noindex preview). Default prod so release is safe.
ARG DOCS_ENV=prod
# Search-console ownership tokens. Optional: unset expands to an empty string and
# config.ts omits the <meta> entirely. Not secrets in any real sense — Google and
# Yandex verify by reading them off the public page.
ARG GOOGLE_SITE_VERIFICATION=
ARG YANDEX_VERIFICATION=
RUN DOCS_ENV=$DOCS_ENV \
    GOOGLE_SITE_VERIFICATION=$GOOGLE_SITE_VERIFICATION \
    YANDEX_VERIFICATION=$YANDEX_VERIFICATION \
    npm run docs:build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
# The 301 map for every retired address, generated from the page registry.
# `include`d by nginx.conf — regenerate with scripts/gen-nginx-redirects.mjs,
# never edit by hand.
COPY redirects.conf /etc/nginx/conf.d/redirects.conf

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
