import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { CONTENT_SEGMENTS, LEGACY_ROUTE_PREFIXES } from '../docs/.vitepress/registry.ts'

// The host snippet is installed by the CD transaction only when every line of it passes
// `safe_managed_snippet_syntax`: comments, `location =`/`location ^~` openers, braces and the
// fixed proxy directives, nothing else. A snippet the contract refuses aborts the whole content
// release, so the generated file is checked here against the awk program of BOTH deploy
// scripts, read from the scripts themselves rather than copied: a copy would keep passing
// after either contract changed.

const ROOT = new URL('..', import.meta.url).pathname
const snippet = execFileSync(
  'node',
  ['--experimental-strip-types', '--no-warnings', join(ROOT, 'scripts', 'gen-host-nginx.mjs')],
  { encoding: 'utf8' },
)

const contractOf = (script) => {
  const source = readFileSync(join(ROOT, 'deploy', script), 'utf8')
  const match = /safe_managed_snippet_syntax\(\) \{\n {2}local file=\$1\n {2}LC_ALL=C awk '([\s\S]*?)' "\$file"/.exec(source)
  if (!match) throw new Error(`${script}: safe_managed_snippet_syntax awk program not found`)
  return match[1]
}

const work = mkdtempSync(join(tmpdir(), 'host-snippet-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))
const accepts = (script, text) => {
  const file = join(work, 'snippet.conf')
  writeFileSync(file, text)
  try {
    execFileSync('awk', [contractOf(script), file], { env: { ...process.env, LC_ALL: 'C' }, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

describe('generated host snippet', () => {
  for (const script of ['install-host-nginx-snippet.sh', 'deploy-content-transaction.sh']) {
    it(`passes the managed-snippet contract of ${script}`, () => {
      expect(accepts(script, snippet)).toBe(true)
      // The contract is not vacuous: a redirect in the host snippet is refused.
      expect(accepts(script, `${snippet}location ^~ /x/ {\n    return 301 /y;\n}\n`)).toBe(false)
    })
  }

  it('proxies every legacy prefix to the content container, exact and as a prefix', () => {
    expect(LEGACY_ROUTE_PREFIXES.length).toBeGreaterThan(0)
    for (const prefix of LEGACY_ROUTE_PREFIXES) {
      expect(snippet).toContain(`location = ${prefix} {`)
      expect(snippet).toContain(`location ^~ ${prefix}/ {`)
    }
    expect(snippet).not.toMatch(/^\s*return\b/m)
  })

  it('declares every location once', () => {
    const openers = [...snippet.matchAll(/^location (=|\^~) (\S+) \{$/gm)].map((match) => `${match[1]} ${match[2]}`)
    expect(openers.length).toBe(new Set(openers).size)
    // Hubs, legacy prefixes, /content-assets/, the root files and /docs: nothing else.
    expect(openers.filter((opener) => opener.startsWith('^~ ')).length).toBe(
      CONTENT_SEGMENTS.length + LEGACY_ROUTE_PREFIXES.length + 2,
    )
  })
})
