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
      // The contract is not vacuous: a redirect in the host snippet is refused. The line goes
      // INSIDE an existing proxy block, so openers, braces and proxy_pass lines stay balanced
      // and the `return` itself is the only thing the contract can object to; the same
      // insertion of a comment passes, which proves the mutation site is not the reason.
      const withLine = (line) => {
        const anchor = '    proxy_read_timeout  60;\n'
        expect(snippet).toContain(anchor)
        return snippet.replace(anchor, `${anchor}    ${line}\n`)
      }
      expect(accepts(script, withLine('# a comment is allowed anywhere'))).toBe(true)
      expect(accepts(script, withLine('return 301 /y;'))).toBe(false)
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

  it('routes every exact rule of the shipped redirects.conf to the content container', () => {
    // A rule the host never sends here is a 301 no request can reach: the address keeps
    // whatever the application answers for it. Checked against the two GENERATED artifacts as
    // they ship (the snippet CD installs, the redirects.conf the image copies), so a spelling
    // the redirect generator adds on top of the registry's sources (`.html`, slash and bare
    // forms) is held to the host routes too, not only the sources check-registry sees.
    const exact = new Set()
    const prefixes = []
    for (const [, kind, path] of snippet.matchAll(/^location (=|\^~) (\S+) \{$/gm)) {
      if (kind === '=') exact.add(path)
      else prefixes.push(path)
    }
    const routed = (from) => exact.has(from) || prefixes.some((prefix) => from.startsWith(prefix))
    const conf = readFileSync(join(ROOT, 'redirects.conf'), 'utf8')
    const rules = [...conf.matchAll(/^location = (\S+) \{/gm)].map((match) => match[1])
    expect(rules.length).toBeGreaterThan(0)
    expect(rules.filter((from) => !routed(from))).toEqual([])
    // Not vacuous: a legacy prefix is routed exactly and as `<prefix>/`, never as
    // `<prefix>.html`, which therefore gets no rule (gen-nginx-redirects.mjs).
    expect(routed('/ru/o-proekte')).toBe(true)
    expect(routed('/ru/o-proekte/manifest')).toBe(true)
    expect(routed('/ru/o-proekte.html')).toBe(false)
    expect(rules).not.toContain('/ru/o-proekte.html')
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
