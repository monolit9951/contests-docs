#!/usr/bin/env node
//
// Does the real image actually boot, and serve?
//
// WHY SEPARATELY FROM url-gates.mjs. Those probes stand up nginx from a config
// this repo composes — both containers' `server` blocks glued into one file.
// That is not how the shipped image assembles its configuration: the base nginx
// image auto-includes every `/etc/nginx/conf.d/*.conf` at the HTTP level, and a
// snippet written for a `server` block is illegal there. On 2026-08-03 that
// killed the content container in a restart loop, in production, with all nine
// gates green — because the one thing nobody checked was whether the container
// starts at all.
//
// So this builds the image and runs it. Slow, and worth it: everything else here
// verifies what the site SAYS, this verifies that it comes up.
//
//   node scripts/image-boot-check.mjs           genesis: on the bare nginx base
//   node scripts/image-boot-check.mjs --chain   on the committed release
//
// The Dockerfile has no default retention base (scripts/retain-content-assets.mjs),
// so the build arguments are always explicit here. Genesis uses the runtime base the
// Dockerfile already pins and needs nothing beyond base pulls. --chain resolves the
// public contestvibe/contests-docs:latest to its digest and revision, exactly as
// release CD does, and proves that a retired asset of that release is served.

import { execFileSync, execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { request } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENESIS, RETENTION_MANIFEST_PATH } from './content-asset-policy.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TAG = 'contests-docs:boot-check'
const NAME = 'contests-docs-boot-check'
const PORT = 18190
const RELEASE_REPOSITORY = 'contestvibe/contests-docs'
const CHAIN = process.argv.includes('--chain')

const sh = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })
// No shell: the Go templates carry quotes and braces, and this also runs on Windows.
const docker = (...args) => execFileSync('docker', args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })
const label = (image, name) => docker('image', 'inspect', '--format', `{{index .Config.Labels "${name}"}}`, image).trim()

const cleanup = () => {
    try { sh(`docker rm -f ${NAME}`) } catch { /* not running */ }
}
process.on('exit', cleanup)
cleanup()

// The genesis base is the runtime base the Dockerfile pins, not a second copy of it.
const genesisBase = () => {
    const pinned = [...readFileSync(join(ROOT, 'Dockerfile'), 'utf8').matchAll(/^FROM (nginx:alpine@sha256:[a-f0-9]{64})$/gm)]
    if (pinned.length !== 1) throw new Error('Dockerfile: ожидался ровно один закреплённый runtime-образ nginx:alpine@sha256')
    return { image: pinned[0][1], revision: GENESIS }
}

// The same resolution as CD's "Resolve the committed release" step.
const committedRelease = () => {
    const ref = `${RELEASE_REPOSITORY}:latest`
    docker('pull', '-q', ref)
    const digests = docker('image', 'inspect', '--format', '{{range .RepoDigests}}{{println .}}{{end}}', ref)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith(`${RELEASE_REPOSITORY}@`))
    if (digests.length !== 1 || !/@sha256:[a-f0-9]{64}$/.test(digests[0])) {
        throw new Error(`${ref}: не удалось однозначно получить digest (${digests.join(', ') || 'нет'})`)
    }
    const revision = label(digests[0], 'org.opencontainers.image.revision')
    if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error(`${digests[0]}: нет 40-hex revision (${revision})`)
    return { image: digests[0], revision }
}

const releaseEpoch = () => {
    try {
        return execFileSync('git', ['show', '-s', '--format=%ct', 'HEAD'], { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }).trim()
    } catch {
        return String(Math.floor(Date.now() / 1000))
    }
}

const base = CHAIN ? committedRelease() : genesisBase()
const buildArgs = {
    RETENTION_BASE: base.image,
    RETENTION_BASE_REVISION: base.revision,
    RELEASE_EPOCH: releaseEpoch(),
}
console.log(`image-boot-check: сборка образа (${CHAIN ? 'chain' : 'genesis'}: ${base.image}, ${base.revision})…`)
execFileSync(
    'docker',
    ['build', '-q', ...Object.entries(buildArgs).flatMap(([key, value]) => ['--build-arg', `${key}=${value}`]), '-t', TAG, '.'],
    { cwd: ROOT, stdio: 'pipe' },
)

console.log('image-boot-check: запуск…')
sh(`docker run -d --name ${NAME} -p ${PORT}:80 ${TAG}`)

const ready = async () => {
    for (let i = 0; i < 60; i += 1) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/health`)
            if (res.ok) return true
        } catch { /* not up yet */ }
        await new Promise((r) => setTimeout(r, 500))
    }
    return false
}

// fetch() normalises `/../x` to `/x`; a traversal probe needs the raw request line.
const rawStatus = (path) => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: PORT, path, method: 'GET' }, (res) => {
        res.resume()
        res.on('end', () => resolve(res.statusCode))
    })
    req.on('error', reject)
    req.end()
})

const failures = []
let probes = 0
const expectStatus = async (path, expected, check) => {
    probes += 1
    const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { redirect: 'manual' })
    if (res.status !== expected) failures.push(`${path} -> ${res.status}, ожидался ${expected}`)
    else if (check) await check(res)
    return res
}

if (!(await ready())) {
    // The logs are the whole point of this check: an nginx that refuses its own
    // config says exactly why, and that message never reaches any other gate.
    const logs = (() => { try { return sh(`docker logs --tail 20 ${NAME}`) } catch { return '(нет логов)' } })()
    failures.push(`контейнер не поднялся за 30 с\n${logs}`)
} else {
    // A boot is necessary, not sufficient: nginx starts happily with a config
    // that serves nothing. One address of each shape.
    for (const [path, expected] of [
        ['/zarabotok/', 200],
        ['/pomoshch/', 200],
        ['/llms.txt', 200],
        ['/sitemap-content.xml', 200],
        ['/docs/ru/faq/', 301],
        ['/nope-nothing-here', 404],
    ]) await expectStatus(path, expected)

    // A hashed name that no retained release ever had stays 410, briefly cached.
    await expectStatus('/content-assets/app.AAAAAAAA.js', 410, (res) => {
        const cache = res.headers.get('cache-control') ?? ''
        if (!/max-age=600/.test(cache)) failures.push(`/content-assets/app.AAAAAAAA.js: cache-control=${cache}, ожидался max-age=600`)
    })

    // The retention record is outside the web root: never served, not even by traversal.
    probes += 1
    const exposed = await fetch(`http://127.0.0.1:${PORT}/content-assets-retention.json`, { redirect: 'manual' })
    if (exposed.status === 200) failures.push('/content-assets-retention.json отдаётся (200)')
    probes += 1
    const traversal = await rawStatus('/../content-assets-retention.json')
    if (traversal === 200) failures.push('/../content-assets-retention.json отдаётся (200)')

    probes += 1
    const carried = label(TAG, 'org.darebay.content.retention-base')
    if (carried !== base.revision) failures.push(`label org.darebay.content.retention-base=${carried}, ожидался ${base.revision}`)

    probes += 1
    let manifest = null
    try {
        manifest = JSON.parse(docker('exec', NAME, 'cat', RETENTION_MANIFEST_PATH))
    } catch (error) {
        failures.push(`${RETENTION_MANIFEST_PATH} не читается в контейнере: ${error.message.split('\n')[0]}`)
    }
    if (manifest && manifest.baseRevision !== base.revision) {
        failures.push(`manifest.baseRevision=${manifest.baseRevision}, ожидался ${base.revision}`)
    }
    const retained = Object.keys(manifest?.retained ?? {}).sort()
    if (manifest && !CHAIN && retained.length > 0) failures.push(`genesis-образ несёт ${retained.length} чужих файлов`)
    if (manifest && CHAIN && retained.length === 0) {
        // Honest, not green: nothing changed relative to the committed release,
        // so there is no retired file to prove the chain with.
        console.log(`image-boot-check: ⚠ в ${base.revision} нечего удерживать (сборка совпадает с релизом) — проба удержанного файла пропущена`)
    }
    if (manifest && CHAIN && retained.length > 0) {
        const path = retained[0]
        const record = manifest.retained[path]
        await expectStatus(`/${path}`, 200, async (res) => {
            const cache = res.headers.get('cache-control') ?? ''
            if (!/immutable/.test(cache)) failures.push(`/${path}: cache-control=${cache}, ожидался immutable`)
            const digest = createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex')
            if (digest !== record.sha256) failures.push(`/${path}: sha256 ${digest}, в манифесте ${record.sha256}`)
        })
        // mtime of the committed release's file survives the carry, so ETag and
        // Last-Modified of a hashed name do not change between releases.
        probes += 1
        const file = `/usr/share/nginx/html/${path}`
        const mtimeHere = docker('exec', NAME, 'stat', '-c', '%Y', file).trim()
        const mtimeBase = docker('run', '--rm', '--entrypoint', 'stat', base.image, '-c', '%Y', file).trim()
        if (mtimeHere !== mtimeBase) failures.push(`${file}: mtime ${mtimeHere}, в ${base.revision} было ${mtimeBase}`)
        console.log(`image-boot-check: удержано ${retained.length} файлов из ${base.revision}; проба ${path}`)
    }
}

cleanup()
process.removeAllListeners('exit')

if (failures.length) {
    console.error(`\n✗ образ не прошёл проверку: ${failures.length}\n`)
    for (const f of failures) console.error(`  ${f}`)
    process.exit(1)
}
console.log(`✓ образ поднимается и отдаёт (${CHAIN ? 'chain' : 'genesis'}): ${probes} проб, 0 замечаний`)
