import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PageData } from 'vitepress'
import { describe, expect, it } from 'vitest'
import siteConfig from './config'
import { ABSOLUTE_URL, FONT_DIR, FONT_FACE_STYLESHEETS, FONT_PRELOADS, HEAD_END, STYLE_BUNDLE_LINK, VP_ICONS_LINK, cssUrls, fontPreloadHrefs, inlineStylesheets, stripVpIconsLink } from './headAssets'
import { KNOWN_LOCALES, LOCALES, PAGES, localesOf, sourceFile, type Locale } from './registry'

const DOCS = fileURLToPath(new URL('..', import.meta.url))
const ROOT = join(DOCS, '..')

describe('font preloads per tree', () => {
    it('names a list for every known language, of files that exist', () => {
        expect(Object.keys(FONT_PRELOADS).sort()).toEqual([...KNOWN_LOCALES].sort())
        for (const language of KNOWN_LOCALES) {
            for (const href of fontPreloadHrefs(language)) {
                expect(existsSync(join(DOCS, 'public', href)), href).toBe(true)
            }
        }
    })

    it('gives a Cyrillic headline both Unbounded subsets: latin also holds spaces and digits', () => {
        for (const language of ['ru', 'uk'] as Locale[]) {
            expect(FONT_PRELOADS[language]).toEqual(expect.arrayContaining([
                'unbounded-var-cyrillic.woff2',
                'unbounded-var-latin.woff2',
                'manrope-400-cyrillic.woff2',
            ]))
        }
    })

    it('preloads no Cyrillic for English, no display face for Arabic, and never latin-ext', () => {
        expect(FONT_PRELOADS.en.some((file) => file.includes('cyrillic'))).toBe(false)
        expect(FONT_PRELOADS.en).toContain('unbounded-var-latin.woff2')
        expect(FONT_PRELOADS.ar.some((file) => file.startsWith('unbounded'))).toBe(false)
        for (const language of KNOWN_LOCALES) {
            expect(FONT_PRELOADS[language].some((file) => file.includes('-ext')), language).toBe(false)
        }
    })

    it('is what every declared tree writes into its pages, and the site head preloads no font', () => {
        const siteFontPreloads = (siteConfig.head ?? []).filter(([name, attrs]) => name === 'link' && attrs.rel === 'preload')
        expect(siteFontPreloads).toEqual([])

        for (const language of LOCALES.map((axis) => axis.language) as Locale[]) {
            const page = PAGES.find((entry) => localesOf(entry).includes(language))!
            const pageData = {
                relativePath: sourceFile(page, language)!,
                title: 'Title',
                description: 'Description',
                headers: [],
                frontmatter: { title: 'Title', description: 'Description' },
            } as unknown as PageData
            void siteConfig.transformPageData!(pageData, {} as never)
            const preloads = (pageData.frontmatter.head as [string, Record<string, string>][])
                .filter(([name, attrs]) => name === 'link' && attrs.rel === 'preload' && attrs.as === 'font')
            expect(preloads.map(([, attrs]) => attrs.href), language).toEqual(fontPreloadHrefs(language))
            for (const [, attrs] of preloads) {
                // A font preload without `crossorigin` is fetched twice: fonts are CORS requests.
                expect(attrs, language).toMatchObject({ type: 'font/woff2', crossorigin: '' })
                expect(attrs.href.startsWith(`${FONT_DIR}/`)).toBe(true)
            }
        }
    })
})

describe('the stock theme without Inter', () => {
    it('imports the default theme without its fonts, because Manrope replaces Inter', () => {
        const theme = readFileSync(join(DOCS, '.vitepress', 'theme', 'index.ts'), 'utf8')
        expect(theme).toMatch(/from 'vitepress\/theme-without-fonts'/)
        expect(theme).not.toMatch(/from 'vitepress\/theme'/)
        const css = readFileSync(join(DOCS, '.vitepress', 'theme', 'custom.css'), 'utf8')
        expect(css).toMatch(/--vp-font-family-base:\s*'Manrope'/)
    })
})

describe('the empty vp-icons.css link', () => {
    // The literal VitePress renders (node build, renderPage), with the site's base '/'.
    const vitepressLine = (() => {
        const dir = join(ROOT, 'node_modules', 'vitepress', 'dist', 'node')
        for (const file of readdirSync(dir).filter((name) => name.endsWith('.js'))) {
            const line = readFileSync(join(dir, file), 'utf8')
                .split('\n')
                .find((text) => text.includes('vp-icons.css" as="style">'))
            if (line) return line.replace('${siteData.base}', siteConfig.base ?? '/')
        }
        return undefined
    })()

    it('still matches what this VitePress version writes', () => {
        expect(vitepressLine).toBeDefined()
        expect(vitepressLine!).toMatch(VP_ICONS_LINK)
    })

    it('is removed with its line, and nothing else is', () => {
        const html = [
            '<head>',
            '    <link rel="preload stylesheet" href="/content-assets/style.CS7UsR-a.css" as="style">',
            vitepressLine,
            '    <script type="module" src="/content-assets/app.Bb-cdalk.js"></script>',
            '</head>',
        ].join('\n')
        expect(stripVpIconsLink(html)).toBe([
            '<head>',
            '    <link rel="preload stylesheet" href="/content-assets/style.CS7UsR-a.css" as="style">',
            '    <script type="module" src="/content-assets/app.Bb-cdalk.js"></script>',
            '</head>',
        ].join('\n'))
    })

    it('is stripped by the config, not by a post-build patch', () => {
        const html = `<head>\n${vitepressLine}\n</head>`
        expect(siteConfig.transformHtml!(html, 'x.html', {} as never)).toBe('<head>\n</head>')
    })
})

describe('stylesheets inside the document', () => {
    // The literal VitePress renders for its CSS bundle (node build, renderPage), with the site's base '/'.
    const bundleLine = (() => {
        const dir = join(ROOT, 'node_modules', 'vitepress', 'dist', 'node')
        for (const file of readdirSync(dir).filter((name) => name.endsWith('.js'))) {
            const line = readFileSync(join(dir, file), 'utf8')
                .split('\n')
                .find((text) => text.includes('<link rel="preload stylesheet" href="${siteData.base}${cssChunk.fileName}" as="style">'))
            if (line) {
                return line
                    .slice(line.indexOf('<link'), line.indexOf('as="style">') + 'as="style">'.length)
                    .replace('${siteData.base}', siteConfig.base ?? '/')
                    .replace('${cssChunk.fileName}', 'content-assets/style.CS7UsR-a.css')
            }
        }
        return undefined
    })()
    const bundle = '/content-assets/style.CS7UsR-a.css'
    const [manrope, unbounded] = FONT_FACE_STYLESHEETS
    const files: Record<string, string> = {
        [bundle]: '.lp{color:#fff}.price::before{content:"$& $1 $$"}',
        [manrope]: "@font-face{font-family:'Manrope';src:url(/content-assets/fonts/manrope-400-latin.woff2)}",
        [unbounded]: "@font-face{font-family:'Unbounded';src:url(/content-assets/fonts/unbounded-var-latin.woff2)}",
    }
    const read = (href: string) => {
        if (!(href in files)) throw new Error(`unexpected read ${href}`)
        return files[href]
    }
    // The shape of a built page's head: the bundle link where renderPage writes it, the app script and
    // its module preloads after it, the site head's Manrope link, the page head's font preloads and
    // Unbounded link among its metadata, and a description whose text holds a literal "</head>".
    const page = (bundleLink: string) => [
        '<!DOCTYPE html>',
        '<html lang="en" dir="ltr">',
        '  <head>',
        '    <meta name="description" content="Why a </head> in a description is harmless">',
        '    <meta name="generator" content="VitePress v1.6.4">',
        `    ${bundleLink}`,
        '    <script type="module" src="/content-assets/app.Bb-cdalk.js"></script>',
        '    <link rel="modulepreload" href="/content-assets/chunks/theme.D-pNR7i0.js">',
        '    <meta name="robots" content="index, follow">',
        `    <link rel="stylesheet" href="${manrope}">`,
        '    <link rel="preload" href="/content-assets/fonts/manrope-400-latin.woff2" as="font" type="font/woff2" crossorigin="">',
        `    <link rel="stylesheet" href="${unbounded}">`,
        '    <link rel="canonical" href="https://darebay.com/en/earnings/example">',
        '  </head>',
        '  <body>',
        '    <div id="app"><p>&lt;/head&gt; in the text</p></div>',
        '  </body>',
        '</html>',
    ].join('\n')
    const styles = `<style>${files[bundle]}</style><style>${files[manrope]}\n${files[unbounded]}</style>`
    const inlined = [
        '<!DOCTYPE html>',
        '<html lang="en" dir="ltr">',
        '  <head>',
        '    <meta name="description" content="Why a </head> in a description is harmless">',
        '    <meta name="generator" content="VitePress v1.6.4">',
        '    <meta name="robots" content="index, follow">',
        '    <link rel="canonical" href="https://darebay.com/en/earnings/example">',
        `    ${styles}`,
        '    <script type="module" src="/content-assets/app.Bb-cdalk.js"></script>',
        '    <link rel="modulepreload" href="/content-assets/chunks/theme.D-pNR7i0.js">',
        '    <link rel="preload" href="/content-assets/fonts/manrope-400-latin.woff2" as="font" type="font/woff2" crossorigin="">',
        '  </head>',
        '  <body>',
        '    <div id="app"><p>&lt;/head&gt; in the text</p></div>',
        '  </body>',
        '</html>',
    ].join('\n')

    it('still matches the bundle link this VitePress version writes', () => {
        expect(bundleLine).toBeDefined()
        expect(bundleLine!).toMatch(STYLE_BUNDLE_LINK)
    })

    it('drops the three links, puts the styles after every meta tag and the request tags after the styles, and nothing else changes', () => {
        expect(inlineStylesheets(page(bundleLine!), read)).toBe(inlined)
    })

    it('copies "$&" and "$1" in the CSS as text, not as replacement patterns', () => {
        expect(inlineStylesheets(page(bundleLine!), read)).toContain('content:"$& $1 $$"')
    })

    it('refuses a file that would close the <style> element early', () => {
        const broken = (href: string) => (href === manrope ? '@font-face{}</style><script>' : read(href))
        expect(() => inlineStylesheets(page(bundleLine!), broken)).toThrow(/manrope\.css/)
    })

    it('refuses a document whose head does not end the way renderPage writes it', () => {
        expect(() => inlineStylesheets(page(bundleLine!).replace(HEAD_END, '\n</head><body>'), read)).toThrow(/end of <head>/)
    })

    it('leaves a document without the bundle link as it is, reading nothing', () => {
        const html = page('<link rel="icon" href="/content-assets/favicon.svg">')
        expect(inlineStylesheets(html, () => { throw new Error('read') })).toBe(html)
    })

    it('reads the built files from the output directory through the config', () => {
        const outDir = mkdtempSync(join(tmpdir(), 'docs-inline-css-'))
        try {
            for (const [href, text] of Object.entries(files)) {
                mkdirSync(join(outDir, href, '..'), { recursive: true })
                writeFileSync(join(outDir, href), text)
            }
            const html = siteConfig.transformHtml!(page(bundleLine!), 'x.html', { siteConfig: { outDir } } as never) as string
            expect(html).toBe(inlined)
        } finally {
            rmSync(outDir, { recursive: true, force: true })
        }
    })

    it('keeps both @font-face links in the config heads, for docs:dev, which runs no transformHtml', () => {
        const linked = (head: [string, Record<string, string>][]) =>
            head.filter(([name, attrs]) => name === 'link' && attrs.rel === 'stylesheet').map(([, attrs]) => attrs.href)
        expect(linked((siteConfig.head ?? []) as [string, Record<string, string>][])).toEqual([manrope])
        for (const language of LOCALES.map((axis) => axis.language) as Locale[]) {
            const entry = PAGES.find((candidate) => localesOf(candidate).includes(language))!
            const pageData = {
                relativePath: sourceFile(entry, language)!,
                title: 'Title',
                description: 'Description',
                headers: [],
                frontmatter: { title: 'Title', description: 'Description' },
            } as unknown as PageData
            void siteConfig.transformPageData!(pageData, {} as never)
            expect(linked(pageData.frontmatter.head as [string, Record<string, string>][]), language).toEqual([unbounded])
        }
    })

    it('reads every url() form and tells the ones that mean the same inside a page', () => {
        const css = `a{b:url("data:image/svg+xml,<svg fill='red'/>")}c{d:url( '/x.woff2' )}e{f:url(x.png)}`
            + 'g{h:url(#a)}i{j:url(%23b)}k{l:url(https://x.test/y)}'
        expect(cssUrls(css)).toEqual(["data:image/svg+xml,<svg fill='red'/>", '/x.woff2', 'x.png', '#a', '%23b', 'https://x.test/y'])
        expect(cssUrls(css).filter((target) => !ABSOLUTE_URL.test(target))).toEqual(['x.png'])
    })

    it('names @font-face files that exist and hold only urls that survive inlining', () => {
        for (const href of FONT_FACE_STYLESHEETS) {
            const path = join(DOCS, 'public', href)
            expect(existsSync(path), href).toBe(true)
            const text = readFileSync(path, 'utf8')
            expect(text, href).not.toMatch(/@import/i)
            for (const target of cssUrls(text)) expect(target, href).toMatch(ABSOLUTE_URL)
        }
    })
})
