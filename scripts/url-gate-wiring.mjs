/**
 * Runtime wiring of a container's nginx config for the URL gates (url-gates.mjs).
 *
 * The gates run each container's config AS SHIPPED: rewriting it would be testing
 * a config that exists nowhere. Only what ties the config to its container is
 * patched: the listen port, the web root, the validation cache directory, the
 * redirects include and Docker's `backend` service name, which resolves nowhere
 * outside Compose. The name becomes a loopback port where the gates answer as
 * the backend would for what the shipped sitemaps publish (`standInBackendStatus`).
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

/**
 * What the stand-in backend answers one of the app's validators.
 *
 * Since contests-frontend 24693bc4 (2026-10-01) the app asks the backend about every
 * task page before serving it (`auth_request /_seo_validate_task`), and an upstream
 * that refuses the connection is a 503 (`error_page 500 502 504 =503`). With nothing
 * listening on the stand-in, every task card, every redirect onto one and every UGC
 * check failed on the harness rather than on the artifacts: 529 findings against a
 * build whose addresses were all fine (2026-10-29). A key the shipped sitemaps publish
 * exists; anything else is the backend's 404, which is what the gates expect of an
 * unknown key. Profiles are published nowhere, so a handle is always unknown.
 */
export const standInBackendStatus = (path, { tasks, products }) => {
    const [, kind, raw] = String(path).match(/^\/api\/(contests|store\/products|users\/username)\/([^/?#]+)/) ?? []
    if (!kind) return 404
    let key
    try {
        key = decodeURIComponent(raw)
    } catch {
        return 404
    }
    if (kind === 'contests') return tasks.has(key) ? 200 : 404
    if (kind === 'store/products') return products.has(key) ? 200 : 404
    return 404
}

export const containerServer = (text, { port, root, cacheDir, redirectsPath }) =>
    text
        .replace(/listen\s+80;/, `listen ${port};`)
        .replace(/root\s+\/usr\/share\/nginx\/html;/, `root ${root};`)
        .replaceAll('http://backend:8080', `http://${BACKEND_STAND_IN}`)
        .replace(/(\bserver\s+)backend:8080\s+resolve\b/g, (_, directive) => `${directive}${BACKEND_STAND_IN}`)
        .replaceAll('/var/cache/nginx/seo-validation', cacheDir)
        .replace(/include\s+\/etc\/nginx\/snippets\/redirects\.conf;/, `include ${redirectsPath};`)
