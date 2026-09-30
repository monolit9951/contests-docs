/**
 * Runtime wiring of a container's nginx config for the URL gates (url-gates.mjs).
 *
 * The gates run each container's config AS SHIPPED: rewriting it would be testing
 * a config that exists nowhere. Only what ties the config to its container is
 * patched: the listen port, the web root, the validation cache directory, the
 * redirects include and Docker's `backend` service name, which resolves nowhere
 * outside Compose. The gates never need a live backend, so the name becomes a
 * loopback port nothing listens on.
 *
 * The app spells the backend two ways. `proxy_pass http://backend:8080` was the
 * only one until contests-frontend 77890445 (2026-09-27); since then the
 * validators go through an upstream whose server re-asks Docker's DNS:
 * `server backend:8080 resolve`. That parameter needs nginx 1.27.3 or newer and a
 * resolver that knows the name; the host's nginx 1.26 refused the whole composed
 * config ("invalid parameter "resolve""), so not one gate ran. The stand-in address
 * drops `resolve` and keeps the upstream's other parameters as shipped.
 */
export const BACKEND_STAND_IN = '127.0.0.1:65534'

export const containerServer = (text, { port, root, cacheDir, redirectsPath }) =>
    text
        .replace(/listen\s+80;/, `listen ${port};`)
        .replace(/root\s+\/usr\/share\/nginx\/html;/, `root ${root};`)
        .replaceAll('http://backend:8080', `http://${BACKEND_STAND_IN}`)
        .replace(/(\bserver\s+)backend:8080\s+resolve\b/g, (_, directive) => `${directive}${BACKEND_STAND_IN}`)
        .replaceAll('/var/cache/nginx/seo-validation', cacheDir)
        .replace(/include\s+\/etc\/nginx\/snippets\/redirects\.conf;/, `include ${redirectsPath};`)
