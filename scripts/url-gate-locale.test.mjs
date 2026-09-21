import { describe, expect, it, vi } from 'vitest'
import { LOCALES, PAGES, ROOT_LOCALE, localesOf, pagePath } from '../docs/.vitepress/registry.ts'
import { appHtmlArtifactPath, expectedHtmlLocale } from './url-gate-locale.mjs'

const contentPaths = new Set(PAGES.flatMap((page) => localesOf(page).map((language) => pagePath(page, language))))
const resolve = (pathname, splitAppLocalePath, overrides = {}) => expectedHtmlLocale(pathname, {
    contentPaths,
    contentLocales: LOCALES,
    contentRootLocale: ROOT_LOCALE,
    splitAppLocalePath,
    ...overrides,
})

describe('HTTP gate probes the emitted app artifact', () => {
    it.each([
        ['/', 'ru', '/', '', 'index.html'],
        ['/pl', 'pl', '/', '', 'pl/index.html'],
        ['/ua', 'uk', '/', '', 'ua/index.html'],
        ['/en/earn/clips', 'en', '/earn/clips', 'earn/clips', 'en/earn/clips.html'],
        ['/pl/tasks/example', 'pl', '/tasks/example', 'tasks/example', 'pl/tasks/example.html'],
    ])('derives %s through the frontend locale parser and file builder', (canonical, language, path, slug, artifact) => {
        const splitAppLocalePath = vi.fn(() => ({ language, path }))
        const routeFile = vi.fn(() => artifact)
        expect(appHtmlArtifactPath(canonical, { splitAppLocalePath, routeFile })).toBe(`/${artifact}`)
        expect(splitAppLocalePath).toHaveBeenCalledExactlyOnceWith(canonical)
        expect(routeFile).toHaveBeenCalledExactlyOnceWith({ slug }, language)
    })
})

describe('HTTP gate language follows the owner of each address', () => {
    it('keeps the registry language and direction for every declared content page', () => {
        const app = vi.fn(() => { throw new Error('a docs URL reached the application resolver') })
        for (const page of PAGES) {
            for (const language of localesOf(page)) {
                const expected = LOCALES.find((locale) => locale.language === language)
                const actual = resolve(pagePath(page, language), app)
                expect(actual.language).toBe(language)
                expect(actual.dir).toBe(expected.dir)
            }
        }
        expect(app).not.toHaveBeenCalled()
    })

    it.each(['/pl', '/pl/earn', '/pl/tasks/example'])('uses the application locale at %s even when docs has no Polish tree', (pathname) => {
        expect(LOCALES.some((locale) => locale.language === 'pl')).toBe(false)
        const app = vi.fn(() => ({ language: 'pl', path: '/' }))
        expect(resolve(pathname, app)).toEqual({ language: 'pl' })
        expect(app).toHaveBeenCalledExactlyOnceWith(pathname)
    })

    it('delegates application pages even when their prefix also exists in docs', () => {
        const app = vi.fn(() => ({ language: 'en', path: '/tasks' }))
        expect(resolve('/en/tasks', app)).toEqual({ language: 'en' })
        expect(app).toHaveBeenCalledExactlyOnceWith('/en/tasks')
    })

    it('does not infer an undeclared application language from a two-letter segment', () => {
        const app = vi.fn(() => ({ language: 'ru', path: '/de/tasks' }))
        expect(resolve('/de/tasks', app)).toEqual({ language: 'ru' })
        expect(app).toHaveBeenCalledExactlyOnceWith('/de/tasks')
    })

    it('matches complete docs locale segments rather than the start of an unrelated path', () => {
        const app = vi.fn()
        expect(resolve('/enough/example', app, { contentPaths: new Set(['/enough/example']) })).toBe(ROOT_LOCALE)
        expect(app).not.toHaveBeenCalled()
    })
})
