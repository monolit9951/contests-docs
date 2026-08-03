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
//   node scripts/image-boot-check.mjs

import { execFileSync, execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TAG = 'contests-docs:boot-check'
const NAME = 'contests-docs-boot-check'
const PORT = 18190

const sh = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })

const cleanup = () => {
    try { sh(`docker rm -f ${NAME}`) } catch { /* not running */ }
}
process.on('exit', cleanup)
cleanup()

console.log('image-boot-check: сборка образа…')
execFileSync('docker', ['build', '-q', '-t', TAG, '.'], { cwd: ROOT, stdio: 'pipe' })

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

const failures = []

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
    ]) {
        const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { redirect: 'manual' })
        if (res.status !== expected) failures.push(`${path} -> ${res.status}, ожидался ${expected}`)
    }
}

cleanup()
process.removeAllListeners('exit')

if (failures.length) {
    console.error(`\n✗ образ не прошёл проверку: ${failures.length}\n`)
    for (const f of failures) console.error(`  ${f}`)
    process.exit(1)
}
console.log('✓ образ поднимается и отдаёт: 6 проб, 0 замечаний')
