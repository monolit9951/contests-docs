# contests-docs

Public documentation for [darebay.com](https://darebay.com), served at
`https://darebay.com/docs/` (EN) and `https://darebay.com/docs/ru/` (RU).

Built with [VitePress](https://vitepress.dev/). Content is plain Markdown.

## Local development

```bash
npm ci
npm run docs:dev
# open http://localhost:5173/docs/
```

## Build

```bash
npm run docs:build    # output at docs/.vitepress/dist
npm run docs:preview  # preview the built site
```

## Container

```bash
make build_app VERSION=test
docker run --rm -p 3002:80 contestvibe/contests-docs:test
# http://localhost:3002/docs/
# http://localhost:3002/docs/ru/
```

## Deployment

Pushes to `release` and `develop` trigger `.github/workflows/CD.yml`:
build → push to DockerHub (`contestvibe/contests-docs:latest` / `:dev`) →
SSH to the respective droplet → `/root/redeploy-docs.sh`.

The host's Nginx reverse-proxies `/docs/` to the container
on `127.0.0.1:3002`. See the main project CLAUDE.md for infra details.

## Adding a page

1. Create `docs/<slug>.md` (EN) and `docs/ru/<slug>.md` (RU).
2. Add both to the matching locale's `themeConfig.sidebar` in
   `docs/.vitepress/config.ts`.
3. Commit — CI does the rest.
