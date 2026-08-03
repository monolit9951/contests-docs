import { defineConfig } from 'vitepress'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HOMEPAGE, TELEGRAM } from './links'
import LASTMOD from './lastmod.json'

// Source file -> commit date, rekeyed to the URL VitePress hands `transformItems`
// (docs-relative, no leading slash, `.md` dropped, `index` collapsed away).
const LASTMOD_BY_URL: Record<string, string> = Object.fromEntries(
  Object.entries(LASTMOD as Record<string, string>).map(([file, iso]) => [
    file.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, ''),
    iso,
  ])
)
import {
  HUBS,
  LOCALES,
  PAGES,
  ROOT_LOCALE,
  APP_ROUTES,
  hreflangCluster,
  localesOf,
  resolveLocalizedLink,
  pagePath,
  sourceFile,
  type HubId,
  type Locale,
} from './registry'

// Branch-aware host for the sitemap + a dev-only noindex (the develop preview must not be indexed;
// only the release/prod build is indexable). CD passes DOCS_ENV=prod on the release branch.
const DOCS_ENV = process.env.DOCS_ENV || 'dev'
// The `/docs/` base is gone as of the 2026-08 URL migration: content now answers on
// root-level hubs (`/zarabotok/`, `/pomoshch/`, ...) and the host nginx routes those
// prefixes to this container. So the hostname is the bare origin again.
const HOSTNAME = DOCS_ENV === 'prod' ? 'https://darebay.com' : 'https://dev.darebay.com'

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Search-console ownership tags, read from the build environment — the same
 * two variables the frontend build takes (see `scripts/seo-routes.mjs` there),
 * so one pair of repo secrets verifies both containers.
 *
 * A `https://darebay.com/` URL-prefix property already covers /docs, since the
 * docs are a path on the main domain and not a subdomain. These tags exist for
 * the case worth having: a separate property scoped to `/docs/`, which is the
 * only way to read impressions, average position and — the point — the actual
 * QUERIES for the content pages apart from the product's. Google verifies a
 * path-scoped property by fetching a url under that path, and the frontend's
 * tag does not exist there.
 *
 * Empty by default: the token comes from an account only the founder has, so
 * the plumbing ships and the value is a repo secret away.
 */
const VERIFICATION_TAGS: [string, Record<string, string>][] = [
    ['google-site-verification', process.env.GOOGLE_SITE_VERIFICATION],
    ['yandex-verification', process.env.YANDEX_VERIFICATION],
]
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '')
    .map(([name, content]) => ['meta', { name, content: content.trim() }])

const SITE_DESCRIPTION = 'Запускайте активности, отправляйте работы, получайте награды на DareBay.'
// Shared with the app so a docs link and a site link preview identically.
const OG_IMAGE = 'https://darebay.com/og-default.jpg'

// Nav and sidebar, built from the registry.
//
// They used to be a hand-written list of `/ru/...` links plus a `ruZone()` helper that
// scanned a directory. Both encoded the old layout, and the hand-written half was already
// stale: it named five earnings articles when ten had shipped. Deriving them means a page
// that exists is a page that is linked — the cheapest ranking asset we have, and the one
// that rots fastest when a human owns it.
const HUB_TITLES: Record<Locale, Record<HubId, string>> = {
  ru: { about: 'О проекте', earnings: 'Заработок', brands: 'Брендам', help: 'Помощь', legal: 'Юридические документы' },
  uk: { about: 'Про проєкт', earnings: 'Заробіток', brands: 'Брендам', help: 'Допомога', legal: 'Юридичні документи' },
  en: { about: 'About', earnings: 'Earning', brands: 'For brands', help: 'Help', legal: 'Legal' },
}

const OVERVIEW: Record<Locale, string> = { ru: 'Обзор', uk: 'Огляд', en: 'Overview' }
const NAV_CTA: Record<Locale, string> = { ru: 'Перейти на сайт →', uk: 'Перейти на сайт →', en: 'Go to the site →' }

const localePrefix = (lang: Locale) => LOCALES.find((l) => l.language === lang)?.prefix ?? ''

// Order in the sidebar. "О проекте" is first on purpose: earnings is a subject where the
// reader's first question — and Google's — is who is behind the page and where the
// numbers come from, and that answer has to be one click from every article.
const SIDEBAR_ORDER: HubId[] = ['about', 'earnings', 'brands', 'help', 'legal']

const pageTitle = (file: string, fallback: string) => {
  const full = join(DOCS_DIR, file)
  if (!existsSync(full)) return fallback
  const m = readFileSync(full, 'utf8').match(/^---\n[\s\S]*?\btitle:\s*(.+)\n[\s\S]*?\n---/)
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : fallback
}

/**
 * Nav and sidebar for ONE locale.
 *
 * They used to be built once from the root locale and reused on every tree, so
 * the header on `/ua/` carried Russian labels pointing at Russian addresses:
 a * reader who switched language was thrown straight back out of it by the very
 * first thing they clicked.
 *
 * A section with no pages in this language is dropped entirely rather than shown
 * empty — the same rule as everywhere else here.
 */
export const themeForLocale = (lang: Locale) => ({
  nav: [
    { text: HUB_TITLES[lang].earnings, link: `${localePrefix(lang)}/${HUBS.earnings[lang]}/` },
    { text: HUB_TITLES[lang].brands, link: `${localePrefix(lang)}/${HUBS.brands[lang]}/` },
    { text: HUB_TITLES[lang].help, link: `${localePrefix(lang)}/${HUBS.help[lang]}/` },
    // The CTA link is styled separately via CSS — see the `:last-child` rules under
    // "The CTA" in custom.css. It must stay LAST in this array: the gradient-pill
    // styling keys off `:last-child`, and so does the rule that keeps it visible on
    // phones while the other nav items collapse into the hamburger.
    { text: NAV_CTA[lang], link: HOMEPAGE },
  ],
  sidebar: SIDEBAR_ORDER.map((hubId) => hubSection(hubId, lang)).filter((section) => section.items.length),
})

function hubSection(hubId: HubId, lang: Locale) {
  const entries = PAGES.filter((e) => e.hub === hubId && localesOf(e).includes(lang))
  const items = entries
    .map((entry) => ({
      text:
        entry.slugs[lang] === ''
          ? OVERVIEW[lang]
          : pageTitle(sourceFile(entry, lang)!, entry.id),
      link: pagePath(entry, lang)!,
      isIndex: entry.slugs[lang] === '',
    }))
    // Index first, then alphabetical — the same order the hub page itself renders.
    .sort((a, b) => (a.isIndex ? -1 : b.isIndex ? 1 : a.text.localeCompare(b.text, 'ru')))
    .map(({ text, link }) => ({ text, link }))
  return { text: HUB_TITLES[lang][hubId], collapsed: false, items }
}

// Self-referencing canonical, and the page's hreflang cluster — both from the REGISTRY,
// not from the file path.
//
// VitePress emits no canonical of its own, and with cleanUrls the same page answers on
// both /foo and /foo.html: two URLs, one page. Deriving the address from `relativePath`
// used to be enough, but it stops being enough the moment a slug differs between locales
// — the file tells you where the file is, not what the page IS or which pages are its
// translations. `registryFor` looks the page up by its source file, so both tags stay
// correct through any future move.
function registryFor(relativePath: string) {
  const normalized = relativePath.split(/[\\/]/).join('/')
  for (const entry of PAGES) {
    for (const lang of localesOf(entry)) {
      if (sourceFile(entry, lang) === normalized) return { entry, lang }
    }
  }
  return null
}

export default defineConfig({
  // Root base. Content is no longer "the docs at /docs/" — it answers on topic hubs at
  // the top level, and the host nginx routes those prefixes here. See registry.ts.
  base: '/',
  // ⚠️ NOT the default `assets`. This container and the SPA are two origins behind one
  // domain, and with base '/' both would emit `/assets/...` — the SPA's hashed bundles
  // and these pages' would land on the same prefix and nginx could not tell them apart.
  // That breaks the SITE, not the indexing, and it breaks it silently on the first
  // deploy. A distinct directory is the whole fix.
  assetsDir: 'content-assets',
  // ⚠️ Renamed to sitemap-content.xml after the build — see scripts/finalize-dist.mjs.
  // VitePress always writes `sitemap.xml`, and with base '/' that is the address the
  // APPLICATION's sitemap already owns.
  sitemap: {
    hostname: HOSTNAME,
    // `lastmod` is set HERE and not through `lastUpdated`: that option makes
    // VitePress shell out to git during the build, which fails inside the image
    // (no `.git` in the context, no git binary). The dates come from
    // lastmod.json, generated where git exists.
    transformItems: (items) =>
      items.map((item) => {
        const iso = LASTMOD_BY_URL[item.url.replace(/^\//, '')]
        return iso ? { ...item, lastmod: new Date(iso) } : item
      }),
  },
  cleanUrls: true,

  markdown: {
    config(md) {
      // Rewrites in-page links onto addresses that exist — see
      // `resolveLocalizedLink` in registry.ts. Content is translated page by
      // page, so a translated article links to siblings that may still be
      // Russian only; without this every such link is a dead-link build failure
      // or, worse, a shipped 404.
      const link = md.renderer.rules.link_open ?? ((tokens, i, opts, _env, self) => self.renderToken(tokens, i, opts))
      md.renderer.rules.link_open = (tokens, i, opts, env, self) => {
        const href = tokens[i].attrGet('href')
        if (href) tokens[i].attrSet('href', resolveLocalizedLink(href))
        return link(tokens, i, opts, env, self)
      }
    },
  },
  // ⚠️ NOT `lastUpdated: true`. That shells out to git during the build, and the
  // build runs inside an image where `.git` is excluded from the context and git
  // is not installed — it died with `spawn git ENOENT` on the first page, a
  // failure invisible locally because every dev machine has both. The dates come
  // from `lastmod.json`, generated where git exists (see scripts/gen-lastmod.mjs)
  // and read below in `transformPageData`.
  // force-dark: always dark, no theme toggle in the UI at all
  appearance: 'force-dark',

  // RUSSIAN STAYS AT THE ROOT — `root` is the unprefixed locale and it is `ru`.
  // In July an EN tree sat on the short urls while RU sat a level deeper, Google
  // indexed the English pages and served English sitelinks under a Russian brand
  // query, and the whole tree had to be removed. Never put another language above RU.
  //
  // A locale appears here only once it HAS pages. The registry declares translations
  // per page, so a partially translated section is normal: what exists is served and
  // announced in hreflang, what does not exist simply is not there. That is what keeps
  // a second language from becoming an empty branch.
  lang: 'ru',
  title: 'DareBay',
  description: SITE_DESCRIPTION,

  locales: {
    root: { label: 'Русский', lang: 'ru', themeConfig: themeForLocale('ru') },
    ua: { label: 'Українська', lang: 'uk', title: 'DareBay', description: 'Запускайте активності, надсилайте роботи, отримуйте винагороди на DareBay.', themeConfig: themeForLocale('uk') },
    en: { label: 'English', lang: 'en', title: 'DareBay', description: 'Launch activities, submit work, get rewarded on DareBay.', themeConfig: themeForLocale('en') },
  },

  // No " | Документация DareBay" after every title. Two reasons: it spent ~25 of the ~60
  // characters Google shows on a suffix that says nothing a reader was searching for, and it
  // labelled commercial pages ("Сколько платят за 1000 просмотров") as documentation, which is
  // not what they are. Page titles already carry the brand where it belongs.
  titleTemplate: false,

  // Links from a content page into the product. They are live URLs on the same
  // domain, but the application serves them, so this build has no file to check
  // them against. Enumerated in the registry rather than muted with a pattern —
  // a blanket rule would hide a real typo just as effectively.
  ignoreDeadLinks: APP_ROUTES.map((route) => new RegExp(`^${route.replace(/\//g, '\\/')}$`)),

  transformPageData(pageData) {
    const found = registryFor(pageData.relativePath)
    // A page that is not in the registry has no address anyone can rely on: no
    // canonical, no sitemap entry, no hreflang. Failing the build is the only
    // safe answer — the alternative is a page that ships and is never indexed,
    // which is indistinguishable from working until someone checks months later.
    if (!found) {
      throw new Error(
        `config: docs/${pageData.relativePath} is in no registry entry. ` +
          `Add it to docs/.vitepress/registry.ts (see scripts/check-registry.mjs).`
      )
    }
    const url = HOSTNAME + pagePath(found.entry, found.lang)

    // The real date of the commit that last touched this file. VitePress only
    // emits `<lastmod>` when it has one, and a sitemap of 129 URLs with no dates
    // gives Google no reason to recrawl any of them.
    const updated = LASTMOD[pageData.relativePath.split(/[\\/]/).join('/')]
    if (updated) pageData.lastUpdated = new Date(updated).getTime()
    // frontmatter.description wins; the site description is the floor, so a page never ships
    // with an empty share card.
    const description = pageData.frontmatter.description || pageData.description || SITE_DESCRIPTION
    const title = pageData.frontmatter.title || pageData.title || 'DareBay'

    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: url }],
      // The page's translations, itself included. Today every page is Russian, so a
      // cluster is one self-referencing link plus x-default — which is valid, and is
      // what keeps the set symmetric the moment a translation is added. A cluster
      // Google considers asymmetric is a cluster Google throws away entirely.
      ...hreflangCluster(found.entry).map(
        ({ hreflang, href }) => ['link', { rel: 'alternate', hreflang, href }] as [string, Record<string, string>]
      ),
      // Per-page Open Graph. Only site-level og:type/og:site_name/og:locale existed before, so
      // every share of an article — the only pages of ours that rank — rendered as a bare link.
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:image', content: OG_IMAGE }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'twitter:image', content: OG_IMAGE }],
    )
  },

  head: [
    // dev/preview builds are noindex; only the prod (release) build is indexable.
    ...(DOCS_ENV !== 'prod' ? [['meta', { name: 'robots', content: 'noindex' }] as [string, Record<string, string>]] : []),
    ...VERIFICATION_TAGS,
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/content-assets/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#02140E' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Документация DareBay' }],
    ['meta', { property: 'og:locale', content: 'ru_RU' }],
    // Manrope, self-hosted — same files the frontend serves from public/fonts. The app moved off
    // Google Fonts on purpose: it is unreachable for part of the RU audience, who were left on
    // fallback fonts. These docs kept requesting fonts.googleapis.com, so on the only pages of
    // ours that actually rank, part of the readers paid for a render-blocking request to nowhere.
    ['link', { rel: 'preload', href: '/content-assets/fonts/manrope-400-cyrillic.woff2', as: 'font', type: 'font/woff2', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: '/content-assets/fonts/manrope.css' }],
  ],

  themeConfig: {
    logo: { src: '/content-assets/logo.svg', alt: 'DareBay' },
    // No site title text — just the logo, which links to darebay.com
    // (href is rewritten at runtime in theme/index.ts).
    siteTitle: false,
    // Search disabled — the content volume doesn't warrant it yet, and a
    // quiet header reads better than one with a half-empty search box.
    // nav and sidebar live in `locales[*].themeConfig` — see themeForLocale.

    // VitePress builds a 404.html but nothing serves it — nginx.conf now points `error_page`
    // at it, so these strings are what a reader actually sees on a broken link (the default
    // ones are English, which is the whole thing we just removed from this site).
    notFound: {
      code: '404',
      title: 'Страница не найдена',
      quote: 'Ссылка ведёт в никуда: страницу переименовали или её никогда не было.',
      linkLabel: 'на главную документации',
      linkText: 'Вернуться в документацию',
    },
    darkModeSwitchLabel: 'Тема',
    sidebarMenuLabel: 'Меню',
    returnToTopLabel: 'Наверх',
    outline: { label: 'На этой странице', level: [2, 3] },
    docFooter: { prev: 'Предыдущая страница', next: 'Следующая страница' },
    // Only surfaces DareBay actually runs. The previous list was aspirational and every
    // entry but Telegram pointed at an account we don't own — `t.me/darebay` is a private
    // person (Dare Adebayo), and x/youtube/instagram/discord `darebay` are squatted or
    // empty. Sending readers to a stranger's DM is worse than showing no icon at all.
    // Add a network here only once the account exists and we control it.
    socialLinks: [
      {
        icon: {
          // Telegram isn't a built-in VitePress icon; inline SVG.
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>',
        },
        link: TELEGRAM,
        ariaLabel: 'Telegram-канал DareBay',
      },
    ],
    // `message` is rendered with v-html, so these are real links. Plain text "darebay.com"
    // sat here before and looked clickable without being clickable.
    footer: {
      message: `<a href="${HOMEPAGE}">darebay.com</a> · <a href="${TELEGRAM}" target="_blank" rel="noreferrer">Telegram</a>`,
      copyright: '© DareBay',
    },
  },
})
