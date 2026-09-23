// The one policy for content-addressed docs assets: which names are immutable,
// how long a retired one stays fetchable, and where the retention record lives.
//
// nginx.conf (the immutable `location ~` and its 410 fallback), url-gates.mjs
// (gate 8-cache), retain-content-assets.mjs (the build-time merge) and its
// self-test all read the same definitions from here. The self-test fails when
// the regex written into nginx.conf drifts from HASHED_ASSET_LOCATION_SOURCE.

// Vite's 8-character content hash, then VitePress's optional `.lean` segment
// (page chunks keep the hash before it), then one of the extensions we emit.
export const HASHED_ASSET_SUFFIX_SOURCE =
    String.raw`\.[A-Za-z0-9_-]{8}(?:\.lean)?\.(?:js|mjs|css|woff2?|png|jpe?g|svg|webp)`

// Exactly the regex of nginx.conf's immutable content-assets location.
export const HASHED_ASSET_LOCATION_SOURCE =
    String.raw`^/content-assets/(?:.*/)?[^/]+` + HASHED_ASSET_SUFFIX_SOURCE + '$'

export const HASHED_ASSET_LOCATION = new RegExp(HASHED_ASSET_LOCATION_SOURCE)

// `urlPath` is the request path as nginx matches it: `/content-assets/...`.
export const isHashedContentAsset = (urlPath) => HASHED_ASSET_LOCATION.test(urlPath)

// How long a hashed file retired by a release stays in the images that follow.
// 14 days covers every measured crawler lag between fetching HTML and fetching
// its chunks (Google max 78.7 h, Bing 119 h, Yandex 28.6 h, AI bots 257 h).
// Raise it only when post-rollout logs show 410s for names retired 14-30 days
// earlier. The emergency purge is RETENTION_WINDOW_DAYS=0 for one build.
export const RETENTION_WINDOW_DAYS = 14

// Raw bytes of retained files one image may carry. Oldest retirements go first.
export const MAX_RETAINED_BYTES = 256 * 1024 * 1024

// Outside `root /usr/share/nginx/html`, so nginx can never serve it; the next
// build reads it from the committed image mounted as its retention base.
export const RETENTION_MANIFEST_PATH = '/usr/share/nginx/content-assets-retention.json'
// The same file relative to the mounted `/usr/share/nginx` of a base image.
export const RETENTION_MANIFEST_NAME = 'content-assets-retention.json'
export const RETENTION_MANIFEST_SCHEMA = 1

// Base revision of a build that starts a new chain: local, dev and boot-check
// images built on the bare nginx base. The deploy transaction refuses it.
export const GENESIS = 'genesis'
