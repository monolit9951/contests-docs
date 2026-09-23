#!/usr/bin/env node
//
// Carry the hashed assets of recent releases into the next image.
//
// WHY. A docs release is one immutable image, and before this it held only its
// own hashed files. nginx answers every other hashed name with 410. Crawlers
// render HTML hours or days after they fetched it, so after each deploy they
// asked for page chunks that no longer existed: Googlebot got 410 for two
// `.md.<hash>.lean.js` chunks minutes after the 21.09 10:31 release, and the
// failed first import is what VitePress turns into its 404 view.
//
// WHAT. A deterministic merge that runs in the Docker build stage after
// `npm run docs:build`. It reads the committed release image, mounted read-only
// as the retention base, and writes the files to keep into `--out`. The dist
// that check:dist verified is never touched; the runtime stage copies `--out`
// next to it.
//
//   node scripts/retain-content-assets.mjs \
//     --base /retention-base            (the base image's /usr/share/nginx)
//     --base-revision <40-hex | genesis>
//     --dist docs/.vitepress/dist
//     --release-sha <sha> --release-epoch <commit time, seconds>
//     [--window-days <n>]               (empty = policy default; 0 = purge)
//     --out /app/retained
//
//   node scripts/retain-content-assets.mjs --self-test
//
// Rules, in order:
//   1. The base is the release it claims to be (its release marker), or, for
//      `genesis`, a bare nginx image with no content-assets at all.
//   2. A hashed file of the base that this build no longer has is retired now
//      (retiredAt = release epoch). One the base itself retained keeps its
//      retiredAt from the base manifest.
//   3. A name present in both the base and this build must carry the same
//      bytes. Identical: nothing to retain. Different: the build fails, since
//      clients hold the old bytes as `immutable` for a year.
//   4. Keep what retired less than the window ago, then drop the oldest
//      retirements (then by path) until the raw bytes fit the cap.
//   5. Copy the kept files with the base file's mtime, so nginx's ETag and
//      Last-Modified for a hashed name stay stable across releases, and write
//      a sorted manifest that the next build reads back.

import { createHash } from 'node:crypto'
import {
    copyFileSync,
    cpSync,
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    utimesSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import {
    GENESIS,
    HASHED_ASSET_LOCATION_SOURCE,
    MAX_RETAINED_BYTES,
    RETENTION_MANIFEST_NAME,
    RETENTION_MANIFEST_PATH,
    RETENTION_MANIFEST_SCHEMA,
    RETENTION_WINDOW_DAYS,
    isHashedContentAsset,
} from './content-asset-policy.mjs'

const ASSETS_DIR = 'content-assets'
const RELEASE_MARKER = ['.well-known', 'darebay-content-release.txt']
const DAY_SECONDS = 86400
const SHA40 = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
// The same identities gen-release-marker.mjs accepts.
const RELEASE_ID = /^(?:[a-f0-9]{7,40}|development)$/

export class RetentionError extends Error {}

const fail = (message) => {
    throw new RetentionError(message)
}

const sha256File = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
const mib = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MiB`

const isDirectory = (path) => {
    try {
        return lstatSync(path).isDirectory()
    } catch {
        return false
    }
}

const readMarker = (htmlRoot) => {
    const file = join(htmlRoot, ...RELEASE_MARKER)
    if (!existsSync(file)) return null
    return readFileSync(file, 'utf8').trim()
}

// Every hashed file under <htmlRoot>/content-assets, keyed by its path below
// the web root (`content-assets/chunks/theme.DS2p5bH_.js`).
export function hashedFiles(htmlRoot) {
    const found = new Map()
    const top = join(htmlRoot, ASSETS_DIR)
    if (!existsSync(top)) return found
    if (!isDirectory(top)) fail(`${top} is not a directory`)
    const walk = (directory) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const file = join(directory, entry.name)
            if (entry.isDirectory()) {
                walk(file)
                continue
            }
            const path = relative(htmlRoot, file).split(sep).join('/')
            if (!isHashedContentAsset(`/${path}`)) continue
            if (!entry.isFile()) fail(`${file}: a hashed asset must be a regular file`)
            found.set(path, file)
        }
    }
    walk(top)
    return found
}

function readBaseManifest(base, baseRevision) {
    const file = join(base, RETENTION_MANIFEST_NAME)
    if (!existsSync(file)) return {}
    let manifest
    try {
        manifest = JSON.parse(readFileSync(file, 'utf8'))
    } catch (error) {
        fail(`base manifest ${file} is not JSON: ${error.message}`)
    }
    const { retained } = manifest ?? {}
    if (
        manifest?.schema !== RETENTION_MANIFEST_SCHEMA ||
        retained === null ||
        typeof retained !== 'object' ||
        Array.isArray(retained)
    ) {
        fail(`base manifest ${file} has an unknown shape (schema ${manifest?.schema})`)
    }
    if (manifest.releaseSha !== baseRevision) {
        fail(`base manifest was written by release ${manifest.releaseSha}, the base is ${baseRevision}`)
    }
    for (const [path, entry] of Object.entries(retained)) {
        if (
            !isHashedContentAsset(`/${path}`) ||
            !Number.isSafeInteger(entry?.retiredAt) ||
            entry.retiredAt <= 0 ||
            !SHA256.test(entry?.sha256 ?? '') ||
            !Number.isSafeInteger(entry?.bytes) ||
            entry.bytes < 0
        ) {
            fail(`base manifest entry ${path} is malformed: ${JSON.stringify(entry)}`)
        }
    }
    return retained
}

const parseWindowDays = (value) => {
    if (value === undefined || value === '') return RETENTION_WINDOW_DAYS
    if (!/^\d+$/.test(String(value))) fail(`--window-days must be a whole number of days, got "${value}"`)
    return Number(value)
}

export function retainContentAssets({
    base,
    baseRevision,
    dist,
    releaseSha,
    releaseEpoch,
    out,
    windowDays = RETENTION_WINDOW_DAYS,
    maxBytes = MAX_RETAINED_BYTES,
    log = console.log,
}) {
    if (!base || !dist || !out) fail('--base, --dist and --out are required')
    if (!Number.isSafeInteger(releaseEpoch) || releaseEpoch <= 0) {
        fail(`--release-epoch must be the commit time in seconds, got "${releaseEpoch}"`)
    }
    if (!Number.isSafeInteger(windowDays) || windowDays < 0) fail(`invalid window: ${windowDays} days`)
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) fail(`invalid byte cap: ${maxBytes}`)
    if (!RELEASE_ID.test(releaseSha ?? '')) fail(`--release-sha is not a git revision: "${releaseSha}"`)

    // The manifest names the release it belongs to; the dist must be that release.
    const distMarker = readMarker(dist)
    if (distMarker !== releaseSha) fail(`dist was built as release ${distMarker}, not ${releaseSha}`)

    const baseHtml = join(base, 'html')
    if (baseRevision === GENESIS) {
        // A chain starts only from an image that never served docs. Mounting a
        // real release as `genesis` would silently drop everything it retains.
        if (existsSync(join(baseHtml, ASSETS_DIR))) {
            fail(`genesis base already has ${ASSETS_DIR}/: pass the release it serves, not ${GENESIS}`)
        }
        if (existsSync(join(base, RETENTION_MANIFEST_NAME))) {
            fail(`genesis base already has ${RETENTION_MANIFEST_NAME}: pass the release it serves, not ${GENESIS}`)
        }
    } else {
        if (!SHA40.test(baseRevision ?? '')) {
            fail(`--base-revision must be a 40-hex release or "${GENESIS}", got "${baseRevision}"`)
        }
        const baseMarker = readMarker(baseHtml)
        if (baseMarker !== baseRevision) {
            fail(`base image serves release ${baseMarker ?? '(no release marker)'}, not ${baseRevision}`)
        }
    }

    const manifest = baseRevision === GENESIS ? {} : readBaseManifest(base, baseRevision)
    const baseFiles = hashedFiles(baseHtml)
    const buildFiles = hashedFiles(dist)
    if (buildFiles.size === 0) fail(`dist ${dist} has no hashed ${ASSETS_DIR}: wrong --dist?`)

    for (const path of Object.keys(manifest)) {
        if (!baseFiles.has(path)) fail(`base manifest lists ${path}, but the base image does not have it`)
    }

    const stats = {
        current: { files: 0, bytes: 0 },
        unchanged: { files: 0, bytes: 0 },
        revived: { files: 0, bytes: 0 },
        retired: { files: 0, bytes: 0 },
        carried: { files: 0, bytes: 0 },
        prunedWindow: { files: 0, bytes: 0 },
        prunedCap: { files: 0, bytes: 0 },
        kept: { files: 0, bytes: 0 },
    }
    const count = (bucket, bytes) => {
        stats[bucket].files += 1
        stats[bucket].bytes += bytes
    }
    for (const file of buildFiles.values()) count('current', statSync(file).size)

    const candidates = []
    const conflicts = []
    for (const path of [...baseFiles.keys()].sort()) {
        const file = baseFiles.get(path)
        const bytes = statSync(file).size
        const sha256 = sha256File(file)
        const record = Object.hasOwn(manifest, path) ? manifest[path] : null
        if (record && (record.sha256 !== sha256 || record.bytes !== bytes)) {
            fail(`base ${path} does not match its manifest record (sha256 or size changed)`)
        }
        const current = buildFiles.get(path)
        if (current) {
            if (sha256File(current) !== sha256) conflicts.push(path)
            else count(record ? 'revived' : 'unchanged', bytes)
            continue
        }
        const retiredAt = record ? record.retiredAt : releaseEpoch
        count(record ? 'carried' : 'retired', bytes)
        candidates.push({ path, file, bytes, sha256, retiredAt })
    }
    if (conflicts.length > 0) {
        fail(
            `${conflicts.length} hashed name(s) carry different bytes in the base and in this build ` +
                `(clients cache them as immutable): ${conflicts.slice(0, 10).join(', ')}`,
        )
    }

    // Younger than the window: a zero-day window keeps nothing (the purge).
    const windowSeconds = windowDays * DAY_SECONDS
    const kept = []
    for (const candidate of candidates) {
        if (releaseEpoch - candidate.retiredAt < windowSeconds) kept.push(candidate)
        else count('prunedWindow', candidate.bytes)
    }
    kept.sort((a, b) => a.retiredAt - b.retiredAt || byPath(a, b))
    let total = kept.reduce((sum, candidate) => sum + candidate.bytes, 0)
    while (total > maxBytes) {
        const oldest = kept.shift()
        count('prunedCap', oldest.bytes)
        total -= oldest.bytes
    }
    kept.sort(byPath)

    if (existsSync(out) && (!isDirectory(out) || readdirSync(out).length > 0)) {
        fail(`--out ${out} must not exist or be an empty directory`)
    }
    // Always created, even empty: the runtime stage COPYs it unconditionally.
    mkdirSync(join(out, ASSETS_DIR), { recursive: true })
    const retained = {}
    for (const candidate of kept) {
        const target = join(out, ...candidate.path.split('/'))
        mkdirSync(dirname(target), { recursive: true })
        copyFileSync(candidate.file, target)
        const { atime, mtime } = statSync(candidate.file)
        utimesSync(target, atime, mtime)
        retained[candidate.path] = {
            retiredAt: candidate.retiredAt,
            sha256: candidate.sha256,
            bytes: candidate.bytes,
        }
        count('kept', candidate.bytes)
    }

    const record = {
        schema: RETENTION_MANIFEST_SCHEMA,
        releaseSha,
        baseRevision,
        releaseEpoch,
        windowDays,
        maxRetainedBytes: maxBytes,
        retained,
    }
    writeFileSync(join(out, RETENTION_MANIFEST_NAME), `${JSON.stringify(record, null, 2)}\n`)

    const line = (label, bucket, note) =>
        log(
            `  ${label.padEnd(9)} ${String(stats[bucket].files).padStart(5)} files ` +
                `${String(stats[bucket].bytes).padStart(11)} bytes  ${note}`,
        )
    log(
        `retain-content-assets: base ${baseRevision} -> release ${releaseSha} ` +
            `(epoch ${releaseEpoch}, window ${windowDays} d, cap ${mib(maxBytes)})`,
    )
    line('current', 'current', 'hashed assets of this build')
    line('unchanged', 'unchanged', 'same name and bytes in the base and this build')
    line('revived', 'revived', 'retained by the base, current again')
    line('retired', 'retired', 'current in the base, gone from this build')
    line('carried', 'carried', 'retained by the base, still gone')
    line('pruned', 'prunedWindow', `retired ${windowDays} or more days ago`)
    line('capped', 'prunedCap', `oldest retirements over ${mib(maxBytes)}`)
    line('kept', 'kept', `-> ${join(out, ASSETS_DIR)}`)
    return { manifest: record, stats }
}

// ---------------------------------------------------------------------------
// --self-test

async function selfTest() {
    const { deepStrictEqual, equal, ok, throws } = await import('node:assert/strict')
    const HERE = dirname(fileURLToPath(import.meta.url))
    const root = mkdtempSync(join(tmpdir(), 'retain-content-assets-'))
    const quiet = () => {}
    const DAY = DAY_SECONDS
    const T0 = 1_780_000_000
    const shaOf = (n) => String(n).repeat(40).slice(0, 40)
    let serial = 0

    // A dist: release marker, one stable unhashed name and the given hashed files.
    const writeDist = (release, files) => {
        const dist = join(root, `dist-${serial++}`)
        mkdirSync(join(dist, '.well-known'), { recursive: true })
        writeFileSync(join(dist, '.well-known', 'darebay-content-release.txt'), `${release}\n`)
        mkdirSync(join(dist, ASSETS_DIR, 'fonts'), { recursive: true })
        writeFileSync(join(dist, ASSETS_DIR, 'logo.svg'), '<svg/>')
        writeFileSync(join(dist, ASSETS_DIR, 'fonts', 'manrope-400-cyrillic.woff2'), 'font')
        for (const [path, body] of Object.entries(files)) {
            mkdirSync(dirname(join(dist, path)), { recursive: true })
            writeFileSync(join(dist, path), body)
        }
        return dist
    }
    // The image the Dockerfile's runtime stage assembles from a dist and --out.
    const imageOf = (dist, out) => {
        const image = join(root, `image-${serial++}`)
        cpSync(dist, join(image, 'html'), { recursive: true, preserveTimestamps: true })
        cpSync(join(out, ASSETS_DIR), join(image, 'html', ASSETS_DIR), { recursive: true, preserveTimestamps: true })
        cpSync(join(out, RETENTION_MANIFEST_NAME), join(image, RETENTION_MANIFEST_NAME), { preserveTimestamps: true })
        return image
    }
    // The bare nginx base: a web root without any content-assets.
    const genesisBase = () => {
        const base = join(root, `nginx-${serial++}`)
        mkdirSync(join(base, 'html'), { recursive: true })
        writeFileSync(join(base, 'html', 'index.html'), 'nginx')
        writeFileSync(join(base, 'html', '50x.html'), 'error')
        return base
    }
    const merge = (options) => {
        const out = join(root, `out-${serial++}`)
        const result = retainContentAssets({ out, log: quiet, ...options })
        return { out, ...result }
    }
    const treeDigest = (directory) => {
        const lines = []
        const walk = (current) => {
            for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
                const file = join(current, entry.name)
                if (entry.isDirectory()) walk(file)
                else lines.push(`${relative(directory, file)} ${sha256File(file)} ${statSync(file).mtimeMs}`)
            }
        }
        walk(directory)
        return lines.join('\n')
    }
    const A = 'content-assets/app.AAAAAAAA.js'
    const THEME_1 = 'content-assets/chunks/theme.Theme001.js'
    const THEME_2 = 'content-assets/chunks/theme.Theme002.js'
    const PAGE_1 = 'content-assets/zarabotok_x.md.Page0001.lean.js'
    const PAGE_1_FULL = 'content-assets/zarabotok_x.md.Page0001.js'
    const PAGE_2 = 'content-assets/zarabotok_x.md.Page0002.lean.js'
    const PAGE_3 = 'content-assets/zarabotok_x.md.Page0003.lean.js'
    const MTIME = 1_700_000_000

    try {
        // Regex: nginx.conf's immutable location is exactly the policy regex, and
        // its fallback is the 410 that retention narrows.
        const nginx = readFileSync(join(HERE, '..', 'nginx.conf'), 'utf8')
        const location = nginx.match(/location ~ "([^"]+)" \{\n(?:[^}]*\n)*?\s*try_files \$uri @gone_content_asset;/)
        ok(location, 'nginx.conf: the hashed content-assets location with the 410 fallback is missing')
        equal(location[1], HASHED_ASSET_LOCATION_SOURCE, 'nginx.conf hashed-asset regex drifted from content-asset-policy.mjs')
        ok(/^\s*root \/usr\/share\/nginx\/html;$/m.test(nginx), 'nginx.conf root moved')
        ok(
            RETENTION_MANIFEST_PATH === `/usr/share/nginx/${RETENTION_MANIFEST_NAME}`,
            'the retention manifest must live outside the web root /usr/share/nginx/html',
        )
        for (const hashed of [
            '/content-assets/app.Bb-cdalk.js',
            '/content-assets/chunks/theme.DS2p5bH_.js',
            '/content-assets/zarabotok_zarabotok-na-vk-klipah.md.DqrZIdJi.lean.js',
            '/content-assets/style.Cx9mVs3a.css',
        ]) ok(isHashedContentAsset(hashed), hashed)
        for (const stable of [
            '/content-assets/logo.svg',
            '/content-assets/fonts/manrope-400-cyrillic.woff2',
            '/content-assets/app.short.js',
            '/assets/app.Bb-cdalk.js',
        ]) ok(!isHashedContentAsset(stable), stable)

        // Genesis: nothing to carry, an empty assets directory and manifest.
        const release1 = shaOf(1)
        const dist1 = writeDist(release1, { [A]: 'app-1', [THEME_1]: 'theme-1', [PAGE_1]: 'page-1', [PAGE_1_FULL]: 'page-1-full' })
        const g = merge({ base: genesisBase(), baseRevision: GENESIS, dist: dist1, releaseSha: release1, releaseEpoch: T0 })
        deepStrictEqual(g.manifest.retained, {})
        equal(g.manifest.baseRevision, GENESIS)
        equal(g.stats.current.files, 4, 'logo.svg and the fonts are stable names, not hashed')
        ok(isDirectory(join(g.out, ASSETS_DIR)) && readdirSync(join(g.out, ASSETS_DIR)).length === 0)
        // A real release mounted as genesis would silently drop what it serves,
        // with or without a manifest (the first retention base has none).
        const preRetention = join(root, 'pre-retention')
        cpSync(dist1, join(preRetention, 'html'), { recursive: true })
        for (const mounted of [preRetention, imageOf(dist1, g.out)]) {
            throws(
                () => merge({ base: mounted, baseRevision: GENESIS, dist: dist1, releaseSha: release1, releaseEpoch: T0 }),
                /genesis base already has content-assets/,
            )
        }
        const manifestOnly = genesisBase()
        writeFileSync(join(manifestOnly, RETENTION_MANIFEST_NAME), '{}')
        throws(
            () => merge({ base: manifestOnly, baseRevision: GENESIS, dist: dist1, releaseSha: release1, releaseEpoch: T0 }),
            /genesis base already has content-assets-retention\.json/,
        )
        throws(
            () => merge({ base: genesisBase(), baseRevision: GENESIS, dist: writeDist(release1, {}), releaseSha: release1, releaseEpoch: T0 }),
            /has no hashed content-assets: wrong --dist/,
        )
        const image1 = imageOf(dist1, g.out)
        // The mtime the base image gives this file must survive every carry.
        utimesSync(join(image1, 'html', ...THEME_1.split('/')), MTIME, MTIME)

        // Carry-over: release 2 replaces the theme and the page; release 1's
        // versions are retired now, with the base mtime.
        const release2 = shaOf(2)
        const T2 = T0 + 1 * DAY
        const dist2 = writeDist(release2, { [A]: 'app-1', [THEME_2]: 'theme-2', [PAGE_2]: 'page-2' })
        const dist2Before = treeDigest(dist2)
        throws(
            () => merge({ base: image1, baseRevision: shaOf(9), dist: dist2, releaseSha: release2, releaseEpoch: T2 }),
            /base image serves release 1{40}, not 9{40}/,
        )
        throws(
            () => merge({ base: image1, baseRevision: release1, dist: dist2, releaseSha: shaOf(3), releaseEpoch: T2 }),
            /dist was built as release 2{40}/,
        )
        const m2 = merge({ base: image1, baseRevision: release1, dist: dist2, releaseSha: release2, releaseEpoch: T2 })
        equal(treeDigest(dist2), dist2Before, 'the verified dist must not be touched')
        deepStrictEqual(Object.keys(m2.manifest.retained), [THEME_1, PAGE_1_FULL, PAGE_1])
        for (const entry of Object.values(m2.manifest.retained)) equal(entry.retiredAt, T2)
        equal(m2.stats.unchanged.files, 1, 'app.AAAAAAAA.js is the same file in both releases')
        equal(readFileSync(join(m2.out, ...THEME_1.split('/')), 'utf8'), 'theme-1')
        equal(Math.trunc(statSync(join(m2.out, ...THEME_1.split('/'))).mtimeMs / 1000), MTIME, 'mtime of the base file')
        deepStrictEqual(m2.manifest.retained[THEME_1], {
            retiredAt: T2,
            sha256: createHash('sha256').update('theme-1').digest('hex'),
            bytes: 7,
        })

        // Determinism: the same inputs give byte-identical output.
        const m2Again = merge({ base: image1, baseRevision: release1, dist: dist2, releaseSha: release2, releaseEpoch: T2 })
        equal(
            readFileSync(join(m2Again.out, RETENTION_MANIFEST_NAME), 'utf8'),
            readFileSync(join(m2.out, RETENTION_MANIFEST_NAME), 'utf8'),
        )
        equal(treeDigest(join(m2Again.out, ASSETS_DIR)), treeDigest(join(m2.out, ASSETS_DIR)), 'same files, bytes and mtimes')

        // Chain: release 3 carries release 1's files with their original
        // retiredAt and retires release 2's page now.
        const image2 = imageOf(dist2, m2.out)
        const release3 = shaOf(3)
        const T3 = T0 + 5 * DAY
        const dist3 = writeDist(release3, { [A]: 'app-1', [THEME_2]: 'theme-2', [PAGE_3]: 'page-3' })
        const m3 = merge({ base: image2, baseRevision: release2, dist: dist3, releaseSha: release3, releaseEpoch: T3 })
        deepStrictEqual(Object.keys(m3.manifest.retained), [THEME_1, PAGE_1_FULL, PAGE_1, PAGE_2])
        equal(m3.manifest.retained[THEME_1].retiredAt, T2)
        equal(m3.manifest.retained[PAGE_2].retiredAt, T3)
        equal(m3.stats.carried.files, 3)
        equal(m3.stats.retired.files, 1)
        equal(Math.trunc(statSync(join(m3.out, ...THEME_1.split('/'))).mtimeMs / 1000), MTIME, 'mtime survives a second carry')

        // Identical overlap: release 1's page comes back with the same bytes. It
        // is current again, so it is skipped, not retained and not a conflict.
        const image3 = imageOf(dist3, m3.out)
        const release4 = shaOf(4)
        const T4 = T0 + 6 * DAY
        const dist4 = writeDist(release4, { [A]: 'app-1', [THEME_2]: 'theme-2', [PAGE_3]: 'page-3', [PAGE_1]: 'page-1' })
        const m4 = merge({ base: image3, baseRevision: release3, dist: dist4, releaseSha: release4, releaseEpoch: T4 })
        ok(!Object.hasOwn(m4.manifest.retained, PAGE_1), 'a current file is never listed as retained')
        ok(!existsSync(join(m4.out, ...PAGE_1.split('/'))), 'a current file is never copied twice')
        equal(m4.stats.revived.files, 1)
        deepStrictEqual(Object.keys(m4.manifest.retained), [THEME_1, PAGE_1_FULL, PAGE_2])

        // Conflicting overlap: the same hashed name with other bytes fails, for
        // a retained file and for a file current in both releases.
        const dist4Conflict = writeDist(release4, { [A]: 'app-1', [THEME_2]: 'theme-2', [PAGE_3]: 'page-3', [PAGE_1]: 'other' })
        throws(
            () => merge({ base: image3, baseRevision: release3, dist: dist4Conflict, releaseSha: release4, releaseEpoch: T4 }),
            /1 hashed name\(s\) carry different bytes.*zarabotok_x\.md\.Page0001\.lean\.js/,
        )
        const dist4Changed = writeDist(release4, { [A]: 'app-2', [THEME_2]: 'theme-2', [PAGE_3]: 'page-3' })
        throws(
            () => merge({ base: image3, baseRevision: release3, dist: dist4Changed, releaseSha: release4, releaseEpoch: T4 }),
            /app\.AAAAAAAA\.js/,
        )

        // Window pruning: exactly 14 days after release 2, its retirements go;
        // release 3's stay. A zero-day window is the emergency purge.
        const T5 = T2 + RETENTION_WINDOW_DAYS * DAY
        const dist5 = writeDist(shaOf(5), { [A]: 'app-1', [THEME_2]: 'theme-2', [PAGE_3]: 'page-3' })
        const m5 = merge({ base: image3, baseRevision: release3, dist: dist5, releaseSha: shaOf(5), releaseEpoch: T5 })
        deepStrictEqual(Object.keys(m5.manifest.retained), [PAGE_2])
        equal(m5.stats.prunedWindow.files, 3)
        const m5Day = merge({ base: image3, baseRevision: release3, dist: dist5, releaseSha: shaOf(5), releaseEpoch: T5 - 1 })
        deepStrictEqual(Object.keys(m5Day.manifest.retained), [THEME_1, PAGE_1_FULL, PAGE_1, PAGE_2], 'one second inside the window')
        const purge = merge({ base: image3, baseRevision: release3, dist: dist5, releaseSha: shaOf(5), releaseEpoch: T5, windowDays: 0 })
        deepStrictEqual(purge.manifest.retained, {})
        equal(purge.manifest.windowDays, 0)
        equal(parseWindowDays(''), RETENTION_WINDOW_DAYS)
        equal(parseWindowDays('0'), 0)
        throws(() => parseWindowDays('-1'), RetentionError)

        // Cap: oldest retirement first, then path order within one retirement.
        // Retired at T2, in path order: theme-1 (7 B), page-1 full (11 B),
        // page-1 lean (6 B); retired at T3: page-2 (6 B). 30 B against a 13 B
        // cap drops the theme and the full chunk, leaving 12 B.
        const capped = merge({ base: image3, baseRevision: release3, dist: dist5, releaseSha: shaOf(5), releaseEpoch: T3, maxBytes: 13 })
        deepStrictEqual(Object.keys(capped.manifest.retained), [PAGE_1, PAGE_2])
        equal(capped.stats.prunedCap.files, 2)
        equal(capped.manifest.maxRetainedBytes, 13)
        const none = merge({ base: image3, baseRevision: release3, dist: dist5, releaseSha: shaOf(5), releaseEpoch: T3, maxBytes: 0 })
        deepStrictEqual(none.manifest.retained, {})
        // Age decides before the path does: a newer retirement whose path sorts
        // first survives an older one whose path sorts last.
        const OLDER = 'content-assets/zz.Older001.js'
        const NEWER = 'content-assets/aa.Newer001.js'
        const capDist1 = writeDist(shaOf(6), { [A]: 'app-1', [OLDER]: 'older' })
        const capGenesis = merge({ base: genesisBase(), baseRevision: GENESIS, dist: capDist1, releaseSha: shaOf(6), releaseEpoch: T0 })
        const capDist2 = writeDist(shaOf(7), { [A]: 'app-1', [NEWER]: 'newer' })
        const capM2 = merge({ base: imageOf(capDist1, capGenesis.out), baseRevision: shaOf(6), dist: capDist2, releaseSha: shaOf(7), releaseEpoch: T0 + DAY })
        const capDist3 = writeDist(shaOf(8), { [A]: 'app-1' })
        const capM3 = merge({ base: imageOf(capDist2, capM2.out), baseRevision: shaOf(7), dist: capDist3, releaseSha: shaOf(8), releaseEpoch: T0 + 2 * DAY, maxBytes: 5 })
        deepStrictEqual(capM3.manifest.retained, {
            [NEWER]: { retiredAt: T0 + 2 * DAY, sha256: createHash('sha256').update('newer').digest('hex'), bytes: 5 },
        })

        // A base whose files no longer match its own manifest is refused.
        const tampered = imageOf(dist3, m3.out)
        writeFileSync(join(tampered, 'html', ...THEME_1.split('/')), 'theme-X')
        throws(
            () => merge({ base: tampered, baseRevision: release3, dist: dist5, releaseSha: shaOf(5), releaseEpoch: T4 }),
            /does not match its manifest record/,
        )
        const missing = imageOf(dist3, m3.out)
        rmSync(join(missing, 'html', ...PAGE_2.split('/')))
        throws(
            () => merge({ base: missing, baseRevision: release3, dist: dist5, releaseSha: shaOf(5), releaseEpoch: T4 }),
            /base manifest lists .*Page0002/,
        )
        throws(
            () => merge({ base: image3, baseRevision: release3, dist: dist5, releaseSha: shaOf(5), releaseEpoch: 0 }),
            /--release-epoch/,
        )
        const occupied = join(root, 'occupied')
        mkdirSync(occupied)
        writeFileSync(join(occupied, 'stale'), 'x')
        throws(
            () => retainContentAssets({ base: image3, baseRevision: release3, dist: dist5, releaseSha: shaOf(5), releaseEpoch: T4, out: occupied, log: quiet }),
            /must not exist or be an empty directory/,
        )
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
    console.log(
        'retain-content-assets: self-test passed (nginx regex, genesis, carry-over, chain, window, purge, cap, ' +
            'identical and conflicting overlap, mtime, determinism, untouched dist, tampered base)',
    )
}

// ---------------------------------------------------------------------------

async function main() {
    const { values } = parseArgs({
        options: {
            'self-test': { type: 'boolean' },
            base: { type: 'string' },
            'base-revision': { type: 'string' },
            dist: { type: 'string' },
            'release-sha': { type: 'string' },
            'release-epoch': { type: 'string' },
            'window-days': { type: 'string' },
            out: { type: 'string' },
        },
        strict: true,
    })
    if (values['self-test']) {
        await selfTest()
        return
    }
    const epoch = values['release-epoch'] ?? ''
    if (!/^\d+$/.test(epoch)) fail(`--release-epoch must be the commit time in seconds, got "${epoch}"`)
    retainContentAssets({
        base: values.base && resolve(values.base),
        baseRevision: values['base-revision'],
        dist: values.dist && resolve(values.dist),
        releaseSha: values['release-sha'],
        releaseEpoch: Number(epoch),
        windowDays: parseWindowDays(values['window-days']),
        out: values.out && resolve(values.out),
    })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        await main()
    } catch (error) {
        if (!(error instanceof RetentionError) && !String(error?.code).startsWith('ERR_PARSE_ARGS')) throw error
        console.error(`retain-content-assets: ✗ ${error.message}`)
        process.exit(1)
    }
}
