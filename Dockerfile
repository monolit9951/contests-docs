FROM node:20-alpine AS build

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

# VitePress builds with base: '/docs/', so URLs inside the HTML point to /docs/*.
# We place the dist at /usr/share/nginx/html/docs so the filesystem layout
# matches the URL layout — both when the host nginx proxies /docs/ to us and
# when the container is hit directly on localhost:3002 for debugging.
COPY --from=build /app/docs/.vitepress/dist /usr/share/nginx/html/docs

# Nginx runs as the `nginx` user inside this image; make sure it can read
# everything regardless of any umask/ACL quirks in the build context.
RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
