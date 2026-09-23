import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PageData } from 'vitepress'
import { describe, expect, it } from 'vitest'
import siteConfig from './config'
import { FONT_DIR, FONT_PRELOADS, VP_ICONS_LINK, fontPreloadHrefs, stripVpIconsLink } from './headAssets'
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
