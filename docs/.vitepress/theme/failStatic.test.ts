import { readFileSync } from 'node:fs'
import type { PageData } from 'vitepress'
import { describe, expect, it } from 'vitest'
import siteConfig from '../config'
import { LOCALES, PAGES, localesOf, sourceFile, type Locale } from '../registry'
import { DocsEvent, sanitizeDocsMeta } from './analytics'
import {
    KEPT_STATIC_MESSAGE,
    NOT_FOUND_SELECTOR,
    PAGE_METADATA_SELECTOR,
    captureServedPage,
    isPageMetadataTag,
    restoreServedHead,
    shouldKeepServedPage,
    type DocumentLike,
    type ServedPage,
} from './failStatic'

// The browser half (static vnode hydration, the head restore after useUpdateHead, removing the
// served metadata on the next navigation) is exercised in a real browser with the page chunks
// blocked; these are the rules that decide it, held against the code they depend on.

const ELEMENT = 1
const TEXT = 3
const COMMENT = 8

interface FakeMeta {
    content: string
    getAttribute(name: string): string | null
    setAttribute(name: string, value: string): void
}

const fakeDocument = ({
    title = 'Заработок на VK Клипах',
    description = 'Как платит VK' as string | null,
    nodes = [ELEMENT],
    notFound = false,
    hasApp = true,
}: {
    title?: string
    description?: string | null
    nodes?: number[]
    notFound?: boolean
    hasApp?: boolean
} = {}) => {
    const meta: FakeMeta | null = description === null ? null : {
        content: description,
        getAttribute(name) { return name === 'content' ? this.content : null },
        setAttribute(name, value) { if (name === 'content') this.content = value },
    }
    const doc: DocumentLike = {
        title,
        getElementById: (id) => (id === 'app' && hasApp
            ? {
                innerHTML: '<div class="lp">…</div>',
                childNodes: nodes.map((nodeType) => ({ nodeType })),
                querySelector: (selector: string) => (selector === NOT_FOUND_SELECTOR && notFound ? {} : null),
            }
            : null),
        querySelector: (selector) => (selector === 'meta[name="description"]' ? meta : null),
    }
    return { doc, meta }
}

const served: ServedPage = {
    title: 'Заработок на VK Клипах',
    description: 'Как платит VK',
    html: '<div class="lp">…</div>',
    nodeCount: 1,
    notFound: false,
}

/** Run the site's transformPageData on a minimal page, the way VitePress calls it per page. */
const transformedHead = (relativePath: string): [string, Record<string, string>, string?][] => {
    const pageData = {
        relativePath,
        title: 'Title',
        description: 'Description',
        headers: [],
        frontmatter: { title: 'Title', description: 'Description' },
    } as unknown as PageData
    void siteConfig.transformPageData!(pageData, {} as never)
    return pageData.frontmatter.head
}

describe('captureServedPage', () => {
    it('reads the served title, description and #app markup before the client app runs', () => {
        const { doc } = fakeDocument()
        expect(captureServedPage(doc)).toEqual(served)
    })

    it('counts every top-level node the static vnode has to adopt', () => {
        const { doc } = fakeDocument({ nodes: [ELEMENT, TEXT, ELEMENT] })
        expect(captureServedPage(doc)?.nodeCount).toBe(3)
    })

    it('knows when the server rendered the 404 view itself', () => {
        const { doc } = fakeDocument({ notFound: true })
        expect(captureServedPage(doc)?.notFound).toBe(true)
    })

    it('has nothing to keep behind an empty #app (VitePress 404.html, the dev server) or none', () => {
        expect(captureServedPage(fakeDocument({ nodes: [] }).doc)).toBeNull()
        expect(captureServedPage(fakeDocument({ hasApp: false }).doc)).toBeNull()
    })

    it('refuses markup Vue cannot adopt as a static vnode', () => {
        expect(captureServedPage(fakeDocument({ nodes: [COMMENT, ELEMENT] }).doc)).toBeNull()
    })
})

describe('shouldKeepServedPage', () => {
    const article = '/zarabotok/zarabotok-na-vk-klipah'

    it('keeps a served article whose first client load fell back to the 404 data', () => {
        expect(shouldKeepServedPage(served, { isNotFound: true, path: article })).toBe(true)
    })

    it('leaves a page that loaded to VitePress', () => {
        expect(shouldKeepServedPage(served, { isNotFound: false, path: article })).toBe(false)
    })

    it('never keeps a real 404: served as the 404 view, served empty, or outside the content hubs', () => {
        expect(shouldKeepServedPage({ ...served, notFound: true }, { isNotFound: true, path: article })).toBe(false)
        expect(shouldKeepServedPage(null, { isNotFound: true, path: '/definitely-missing-page' })).toBe(false)
        expect(shouldKeepServedPage(served, { isNotFound: true, path: '/definitely-missing-page' })).toBe(false)
    })
})

describe('restoreServedHead', () => {
    it("puts back what useUpdateHead replaced with '404' and 'Not Found'", () => {
        const { doc, meta } = fakeDocument()
        doc.title = '404'
        meta!.setAttribute('content', 'Not Found')

        restoreServedHead(doc, served)

        expect(doc.title).toBe(served.title)
        expect(meta!.content).toBe(served.description)
    })

    it('leaves the description alone when the served page had none', () => {
        const { doc, meta } = fakeDocument()
        meta!.setAttribute('content', 'Not Found')

        restoreServedHead(doc, { ...served, description: null })

        expect(meta!.content).toBe('Not Found')
    })
})

describe('the 404 marker is the one LandingLayout renders', () => {
    it('finds the not-found view by its class', () => {
        const layout = readFileSync(new URL('./landing/LandingLayout.vue', import.meta.url), 'utf8')
        const className = NOT_FOUND_SELECTOR.replace(/^\./, '')
        expect(layout).toMatch(new RegExp(`<main v-if="notFound"[^>]*class="[^"]*\\b${className}\\b`))
    })
})

describe('analytics stay inside the existing contract', () => {
    it('reports a kept page as client_error with an allowlisted message', () => {
        expect(sanitizeDocsMeta(DocsEvent.ClientError, { message: KEPT_STATIC_MESSAGE }))
            .toEqual({ message: KEPT_STATIC_MESSAGE })
    })

    it('gives docs_not_found no property the backend would reject', () => {
        expect(sanitizeDocsMeta(DocsEvent.NotFound, { referrerHost: 'yandex.ru', keptStatic: 'true' }))
            .toEqual({ referrerHost: 'yandex.ru' })
    })
})

describe('page metadata removed after a kept page', () => {
    it('is written as one CSS selector for the browser', () => {
        expect(PAGE_METADATA_SELECTOR).toBe([
            'link[rel="canonical"]',
            'link[rel="alternate"][hreflang]',
            'script[type="application/ld+json"]',
            'meta[property^="og:"]:not([property="og:site_name"])',
            'meta[property^="article:"]',
            'meta[name^="twitter:"]',
        ].join(', '))
    })

    it('covers every page-level tag transformPageData writes, except font links', () => {
        for (const locale of LOCALES.map((axis) => axis.language) as Locale[]) {
            const page = PAGES.find((entry) => localesOf(entry).includes(locale) && entry.slugs[locale] !== '')!
            const head = transformedHead(sourceFile(page, locale)!)
            expect(head.length, locale).toBeGreaterThan(0)
            for (const tag of head) {
                const [name, attrs] = tag
                const fontLink = name === 'link'
                    && (attrs.rel === 'stylesheet' || (attrs.rel === 'preload' && attrs.as === 'font'))
                expect(isPageMetadataTag(tag) !== fontLink, `${locale}: ${JSON.stringify(tag).slice(0, 120)}`).toBe(true)
            }
            for (const [name, attrs] of [
                ['link', { rel: 'canonical' }],
                ['script', { type: 'application/ld+json' }],
                ['meta', { property: 'og:title' }],
            ] as const) {
                const present = head.some(([tag, tagAttrs]) => tag === name
                    && Object.entries(attrs).every(([key, value]) => tagAttrs[key] === value))
                expect(present, `${locale}: ${name} ${JSON.stringify(attrs)}`).toBe(true)
            }
        }
    })

    it('never covers a site-wide head tag: the client does not manage those, so a removed one stays gone', () => {
        // The client site data ships `head: []` (VitePress 1.6), so nothing re-adds a site tag the
        // first navigation after a kept page removed. og:site_name shares the page og: prefix.
        const siteHead = [
            ...(siteConfig.head ?? []),
            ...Object.values(siteConfig.locales ?? {}).flatMap((locale) => locale.head ?? []),
        ]
        expect(siteHead.some(([name, attrs]) => name === 'meta' && attrs.property === 'og:site_name')).toBe(true)
        for (const tag of siteHead) {
            expect(isPageMetadataTag(tag), JSON.stringify(tag)).toBe(false)
        }
    })
})
