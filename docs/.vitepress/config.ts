import { defineConfig } from 'vitepress'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { productUrlForLocale, TELEGRAM } from './links'
import { CHROME_COPY, type DareBayThemeConfig } from './chrome'
import { installCoveredHeadingRule } from './coveredHeading'
import PAGE_DATES from '../page-dates.json'
import PLATFORMS from './data/platforms.json'

// Source file -> commit date, rekeyed to the URL VitePress hands `transformItems`
// (docs-relative, no leading slash, `.md` dropped, `index` collapsed away).
interface PageDates { readonly published: string; readonly modified: string }

const PAGE_DATES_BY_URL: Record<string, PageDates> = Object.fromEntries(
  Object.entries(PAGE_DATES as Record<string, PageDates>).map(([file, dates]) => [
    file.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, ''),
    dates,
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
 * The name each language calls itself, in that language.
 *
 * One table, read by the `locales` block AND by the per-page switcher links in
 * transformPageData — VitePress matches the current locale by comparing LABELS,
 * so two copies of these strings would silently stop the menu from hiding the
 * page you are already on.
 */
const LOCALE_LABELS: Record<Locale, string> = {
  ru: 'Русский',
  uk: 'Українська',
  en: 'English',
}

/**
 * Search-console ownership tags, read from the build environment — the same
 * two variables the frontend build takes (see `scripts/seo-routes.mjs` there),
 * so one pair of repo secrets verifies both containers.
 *
 * A `https://darebay.com/` URL-prefix property covers both renderers: product
 * routes and the root-level content hubs. Keeping the same verification tags
 * in both builds avoids ownership depending on which container answers the
 * particular URL Google chooses to fetch.
 *
 * Empty values omit the corresponding tag; CI can inject ownership tokens at build time.
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

// Open Graph wants a locale, not a language: `ru_RU`, not `ru`. hreflang wants
// the opposite. Two audiences, two formats, one table so they cannot drift.
const OG_LOCALE: Record<Locale, string> = { ru: 'ru_RU', uk: 'uk_UA', en: 'en_US' }

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
const localePrefix = (lang: Locale) => LOCALES.find((l) => l.language === lang)?.prefix ?? ''
const contentHomeForLocale = (lang: Locale) => {
  const home = PAGES.find((page) => page.id === 'earnings-hub')
  if (!home) throw new Error('config: earnings-hub is missing from docs/content-pages.json')
  return pagePath(home, lang)!
}

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
 * a reader who switched language was thrown straight back out of it by the very
 * first thing they clicked.
 *
 * A section with no pages in this language is dropped entirely rather than shown
 * empty — the same rule as everywhere else here.
 */
export const themeForLocale = (lang: Locale): DareBayThemeConfig => {
  const copy = CHROME_COPY[lang]
  const productUrl = productUrlForLocale(lang)

  return {
    // Native VitePress config is reactive across client-side locale changes, so the
    // server-rendered and hydrated logo always share this exact href. No DOM rewrite.
    logoLink: contentHomeForLocale(lang),
    nav: [
      { text: HUB_TITLES[lang].earnings, link: `${localePrefix(lang)}/${HUBS.earnings[lang]}/` },
      { text: HUB_TITLES[lang].brands, link: `${localePrefix(lang)}/${HUBS.brands[lang]}/` },
      { text: HUB_TITLES[lang].help, link: `${localePrefix(lang)}/${HUBS.help[lang]}/` },
      // The CTA link is styled separately via CSS — see the `:last-child` rules under
      // "The CTA" in custom.css. It must stay LAST in this array: the gradient-pill
      // styling keys off `:last-child`, and so does the rule that keeps it visible on
      // phones while the other nav items collapse into the hamburger.
      { text: copy.navCta, link: productUrl },
    ],
    sidebar: SIDEBAR_ORDER.map((hubId) => hubSection(hubId, lang)).filter((section) => section.items.length),
    notFound: copy.notFound,
    darkModeSwitchLabel: copy.darkModeSwitchLabel,
    lightModeSwitchTitle: copy.lightModeSwitchTitle,
    darkModeSwitchTitle: copy.darkModeSwitchTitle,
    sidebarMenuLabel: copy.sidebarMenuLabel,
    returnToTopLabel: copy.returnToTopLabel,
    langMenuLabel: copy.langMenuLabel,
    skipToContentLabel: copy.skipToContentLabel,
    outline: { label: copy.outlineLabel, level: [2, 3] },
    docFooter: { prev: copy.previousPage, next: copy.nextPage },
    // Only surfaces DareBay actually runs. Add another network only once the
    // account exists and is controlled by DareBay.
    socialLinks: [
      {
        icon: {
          // Telegram isn't a built-in VitePress icon; inline SVG.
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>',
        },
        link: TELEGRAM,
        ariaLabel: copy.telegramAriaLabel,
      },
    ],
    footer: {
      message: `<a href="${productUrl}">darebay.com</a> · <a href="${TELEGRAM}" target="_blank" rel="noreferrer">Telegram</a>`,
      copyright: '© DareBay',
    },
    darebayCta: {
      ...copy.cta,
      productUrl,
      telegramUrl: TELEGRAM,
    },
  }
}

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


// ---------------------------------------------------------------------------
// Structured data, DERIVED from the page.
//
// WHY. It used to be hand-written JSON-LD inside each page's frontmatter: an
// Article block repeating the title and description, a FAQPage repeating the
// visible Q&A, a HowTo repeating the visible numbered steps. Three copies of the
// same words, and the copy pass of 2026-08-03 proved what that costs — the
// visible text was rewritten across 129 pages while the markup kept the old
// wording, so a page said one thing to a reader and another to Google. Two of
// them still advertised regional copy that had just been removed from the page.
//
// Nothing here is authored any more. The markup is read off the page itself, so
// the two cannot disagree: edit the text and the structured data follows.
//
// A block is emitted only when the page actually HAS that shape — no FAQ
// section, no FAQPage. Claiming structure a page does not have is exactly what
// Google penalises.
// ---------------------------------------------------------------------------

// One entity graph per page. Every node has schema.org context through the
// graph root and stable ids shared with the application.
const ENTITY_ORIGIN = 'https://darebay.com'
const ORG_ID = `${ENTITY_ORIGIN}/#organization`
const AUTHOR_ID = `${ENTITY_ORIGIN}/#founder`
const WEBSITE_ID = `${ENTITY_ORIGIN}/#website`
const LOGO_ID = `${ENTITY_ORIGIN}/#logo`

// The entity, described the way a model or a directory would describe it: what
// it is, who founded it, when, and every public profile it actually runs. The
// same profiles must exist on the app's Organization node (contests-frontend).
const ORGANIZATION = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: 'DareBay',
  alternateName: ['Darebay', 'Дарбей'],
  description:
    'DareBay is a pay-per-view clipping platform: brands, streamers and creators post tasks with their footage, clippers cut and post short clips on their own accounts and are paid per counted view. Available on the web and in Telegram; pays clippers in Russia, Ukraine, CIS and worldwide.',
  url: `${ENTITY_ORIGIN}/`,
  logo: { '@id': LOGO_ID },
  foundingDate: '2026',
  founder: { '@id': AUTHOR_ID },
  sameAs: [
    'https://t.me/darebay_app',
    'https://t.me/darebaycreatorschat',
    'https://www.tiktok.com/@darebay.com',
    'https://www.linkedin.com/company/darebay',
    'https://www.youtube.com/@darebay',
  ],
}

// The founder's name in the page's own script: Latin on English pages,
// Cyrillic on Russian and Ukrainian, the other form as alternateName.
const author = (language: Locale) => ({
  '@type': 'Person',
  '@id': AUTHOR_ID,
  name: language === 'en' ? 'Ruslan Bey' : 'Руслан Бей',
  alternateName: language === 'en' ? 'Руслан Бей' : 'Ruslan Bey',
  url: `${ENTITY_ORIGIN}/o-proekte/`,
  sameAs: ['https://t.me/ruslanbwork'],
  jobTitle: 'Founder',
  worksFor: { '@id': ORG_ID },
})

const WEBSITE = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: 'DareBay',
  url: `${ENTITY_ORIGIN}/`,
  inLanguage: LOCALES.map((locale) => locale.language),
  publisher: { '@id': ORG_ID },
}

const FAQ_HEADING = /вопрос|питання|question/i

const stripMarkdown = (text: string) =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim()

function faqPairs(body: string) {
  const lines = body.split('\n')
  const out: { q: string; a: string }[] = []
  let inFaq = false
  let question: string | null = null
  let answer: string[] = []

  const flush = () => {
    const text = stripMarkdown(answer.join(' '))
    if (question && text) out.push({ q: question, a: text })
    question = null
    answer = []
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush()
      inFaq = FAQ_HEADING.test(line)
      continue
    }
    if (!inFaq) continue
    if (line.startsWith('### ')) {
      flush()
      question = stripMarkdown(line.slice(4))
      continue
    }
    if (question && line.trim()) answer.push(line)
  }
  flush()
  return out
}

function structuredData(
  relativePath: string,
  title: string,
  description: string,
  url: string,
  language: Locale,
  crumbs: { name: string; path: string }[],
  hubPages: { title: string; path: string }[],
  isHub: boolean,
  hub: HubId,
  dates?: PageDates,
  compare?: { name: string; url: string }[]
) {
  const file = join(DOCS_DIR, relativePath)
  const raw = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const body = raw.replace(/^---\n[\s\S]*?\n---/, '')
  const published = dates?.published?.slice(0, 10)
  const modified = dates?.modified?.slice(0, 10)

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'ImageObject',
      '@id': LOGO_ID,
      url: `${ENTITY_ORIGIN}/android-chrome-512x512.png`,
      contentUrl: `${ENTITY_ORIGIN}/android-chrome-512x512.png`,
      width: 512,
      height: 512,
    },
    ORGANIZATION,
    author(language),
    WEBSITE,
  ]

  if (isHub) {
    graph.push({
      '@type': 'CollectionPage',
      '@id': url,
      name: title,
      description,
      url,
      inLanguage: language,
      isPartOf: { '@id': WEBSITE_ID },
      ...(modified ? { dateModified: modified } : {}),
    })
  } else if (hub === 'legal') {
    graph.push({
      '@type': 'WebPage',
      '@id': url,
      name: title,
      description,
      url,
      inLanguage: language,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORG_ID },
      ...(modified ? { dateModified: modified } : {}),
    })
  } else {
    const imageId = `${url}#primaryimage`
    graph.push(
      {
        '@type': 'ImageObject',
        '@id': imageId,
        url: OG_IMAGE,
        contentUrl: OG_IMAGE,
        width: 1200,
        height: 630,
        caption: title,
      },
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: title,
        description,
        url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        inLanguage: language,
        image: { '@id': imageId },
        author: { '@id': AUTHOR_ID },
        publisher: { '@id': ORG_ID },
        isPartOf: { '@id': WEBSITE_ID },
        ...(published ? { datePublished: published } : {}),
        ...(modified ? { dateModified: modified } : {}),
      }
    )
  }

  if (crumbs.length > 1) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: `${HOSTNAME}${crumb.path}`,
      })),
    })
  }

  const faq = faqPairs(body)
  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      isPartOf: { '@id': WEBSITE_ID },
      mainEntity: faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    })
  }

  if (isHub) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${url}#items`,
      name: title,
      numberOfItems: hubPages.length,
      itemListElement: hubPages.map((page, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: page.title,
        url: `${HOSTNAME}${page.path}`,
      })),
    })
  }

  // A comparison landing lists the platforms it compares, in page order — the
  // same ItemList shape hub pages use, so a model reading the markup sees the
  // ranking as a list of named entities, not only as prose.
  if (compare?.length) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${url}#platforms`,
      name: title,
      numberOfItems: compare.length,
      itemListElement: compare.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    })
  }

  return { '@context': 'https://schema.org', '@graph': graph }
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
    // page-dates.json, generated from the full git history before Docker build.
    transformItems: (items) =>
      items.map((item) => {
        const dates = PAGE_DATES_BY_URL[item.url.replace(/^\//, '')]
        return dates?.modified ? { ...item, lastmod: new Date(dates.modified) } : item
      }),
  },
  cleanUrls: true,

  markdown: {
    config(md) {
      installCoveredHeadingRule(md)
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
  // from `page-dates.json`, generated where git exists (see scripts/gen-page-dates.mjs)
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
    root: { label: LOCALE_LABELS.ru, lang: 'ru', themeConfig: themeForLocale('ru') },
    ua: { label: LOCALE_LABELS.uk, lang: 'uk', title: 'DareBay', description: 'Запускайте активності, надсилайте роботи, отримуйте винагороди на DareBay.', themeConfig: themeForLocale('uk') },
    en: { label: LOCALE_LABELS.en, lang: 'en', title: 'DareBay', description: 'Launch activities, submit work, get rewarded on DareBay.', themeConfig: themeForLocale('en') },
  },

  // The stock language switcher builds the other locale's address by swapping
  // the prefix on the current path, which is wrong the moment a slug is
  // translated — and ours are, on purpose: a docs slug IS the query it answers.
  // Replacing the composable rather than the two components that call it keeps
  // VitePress's markup, styling and mobile variant exactly as they are.
  vite: {
    resolve: {
      alias: [
        {
          find: /^.*\/composables\/langs$/,
          replacement: fileURLToPath(new URL('./theme/langs.ts', import.meta.url)),
        },
      ],
    },
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
          `Add its semantic id and localized slug to docs/content-pages.json.`
      )
    }
    const url = HOSTNAME + pagePath(found.entry, found.lang)

    // The real date of the commit that last touched this file. VitePress only
    // emits `<lastmod>` when it has one, and a sitemap of 129 URLs with no dates
    // gives Google no reason to recrawl any of them.
    const dates = (PAGE_DATES as Record<string, PageDates>)[pageData.relativePath.split(/[\\/]/).join('/')]
    if (dates?.modified) pageData.lastUpdated = new Date(dates.modified).getTime()
    // frontmatter.description wins; the site description is the floor, so a page never ships
    // with an empty share card.
    const description = pageData.frontmatter.description || pageData.description || SITE_DESCRIPTION
    const title = pageData.frontmatter.title || pageData.title || 'DareBay'

    // What the language switcher offers, resolved through the registry rather
    // than by swapping the prefix on the current path. VitePress's own version
    // does the swap, and our slugs are translated — so on 2026-08-03 the menu
    // offered 86 addresses across the Russian tree and 79 of them were 404.
    // Read by theme/langs.ts, which replaces the stock composable.
    //
    // Only the locales this page HAS, so the menu can never offer a translation
    // that does not exist — the same promise `hreflangCluster` above makes.
    pageData.frontmatter.localeLinks = LOCALES.filter(
      (locale) => locale.language !== found.lang && localesOf(found.entry).includes(locale.language)
    ).map((locale) => ({
      text: LOCALE_LABELS[locale.language],
      link: pagePath(found.entry, locale.language)!,
    }))

    pageData.frontmatter.head ??= []

    // ⚠️ Any hand-written JSON-LD left in a page's frontmatter is DROPPED here,
    // and that is the point: it was a second copy of the page's own words, and
    // it went stale the moment the page was edited. The blocks below are read
    // off the page itself.
    pageData.frontmatter.head = pageData.frontmatter.head.filter(
      (tag: [string, Record<string, string>, string?]) =>
        !(tag[0] === 'script' && tag[1]?.type === 'application/ld+json')
    )

    // Breadcrumb trail: hub, then page. The hub index is its own root, so it
    // gets a single crumb and no list.
    const hubSegment = HUBS[found.entry.hub][found.lang]
    const hubEntry = PAGES.find((e) => e.hub === found.entry.hub && e.slugs[found.lang] === '')
    const crumbs = hubEntry
      ? [
          { name: HUB_TITLES[found.lang][found.entry.hub], path: pagePath(hubEntry, found.lang)! },
          ...(found.entry.id === hubEntry.id ? [] : [{ name: title, path: pagePath(found.entry, found.lang)! }]),
        ]
      : []
    void hubSegment

    // A hub page lists its section; an article lists nothing.
    const isHub = found.entry.slugs[found.lang] === ''
    const hubPages =
      isHub
        ? PAGES.filter(
            (e) =>
              e.hub === found.entry.hub &&
              e.slugs[found.lang] !== undefined &&
              e.slugs[found.lang] !== ''
          ).map((e) => ({ title: pageTitle(sourceFile(e, found.lang)!, e.id), path: pagePath(e, found.lang)! }))
        : []
    const isArticle = !isHub && found.entry.hub !== 'legal'

    // Comparison landings: the compared platforms, from the same data file the
    // table renders, so markup and visible table cannot disagree.
    const compareIds = (pageData.frontmatter.compare as { ids?: string[] } | undefined)?.ids
    const compared = compareIds
      ? compareIds
          .map((id) => PLATFORMS.platforms.find((p) => p.id === id))
          .filter((p): p is (typeof PLATFORMS.platforms)[number] => Boolean(p))
          .map((p) => ({ name: p.name, url: p.id === 'darebay' ? (p.home?.[found.lang] ?? p.url) : p.url }))
      : undefined

    const schema = structuredData(
      pageData.relativePath,
      title,
      description,
      url,
      found.lang,
      crumbs,
      hubPages,
      isHub,
      found.entry.hub,
      dates,
      compared
    )
    if (pageData.frontmatter.landing) {
      // Display face of the landing shell (self-hosted next to Manrope). Only
      // landing pages pay for it; docs pages keep Manrope alone.
      pageData.frontmatter.head.push(
        ['link', { rel: 'preload', href: '/content-assets/fonts/unbounded-var-latin.woff2', as: 'font', type: 'font/woff2', crossorigin: '' }],
        ['link', { rel: 'stylesheet', href: '/content-assets/fonts/unbounded.css' }]
      )
    }
    pageData.frontmatter.head.push(['script', { type: 'application/ld+json' }, JSON.stringify(schema)])

    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: url }],
      // The page's translations, itself included. Today every page is Russian, so a
      // cluster is one self-referencing link plus x-default — which is valid, and is
      // what keeps the set symmetric the moment a translation is added. A cluster
      // Google considers asymmetric is a cluster Google throws away entirely.
      ...hreflangCluster(found.entry).map(
        ({ hreflang, href }) => [
          'link',
          { rel: 'alternate', hreflang, href: href.replace(ENTITY_ORIGIN, HOSTNAME) },
        ] as [string, Record<string, string>]
      ),
      // Per-page Open Graph. Only site-level og:type/og:site_name/og:locale existed before, so
      // every share of an article — the only pages of ours that rank — rendered as a bare link.
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:image', content: OG_IMAGE }],
      ['meta', { property: 'og:image:alt', content: title }],
      // `article` on an article, `website` on a hub index. The site-level tag said
      // `website` for all 129 pages — the one value that tells a reader's client
      // "this is a landing page", on the pages that are the opposite of that.
      ['meta', { property: 'og:type', content: isArticle ? 'article' : 'website' }],
      // Freshness in the format social crawlers read, off the same page-dates.json
      // the sitemap uses — one source, so the two cannot disagree.
      ...(dates?.published && isArticle
        ? ([['meta', { property: 'article:published_time', content: new Date(dates.published).toISOString() }]] as [
            string,
            Record<string, string>,
          ][])
        : []),
      ...(dates?.modified && isArticle
        ? ([['meta', { property: 'article:modified_time', content: new Date(dates.modified).toISOString() }]] as [
            string,
            Record<string, string>,
          ][])
        : []),
      // The page's own locale, plus the ones it is translated into — the same
      // list hreflang gets, from the same registry call.
      ['meta', { property: 'og:locale', content: OG_LOCALE[found.lang] }],
      ...LOCALES.filter(
        (locale) => locale.language !== found.lang && localesOf(found.entry).includes(locale.language)
      ).map(
        (locale) =>
          ['meta', { property: 'og:locale:alternate', content: OG_LOCALE[locale.language] }] as [
            string,
            Record<string, string>,
          ]
      ),
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'twitter:image', content: OG_IMAGE }],
      ['meta', { name: 'twitter:image:alt', content: title }],
    )
  },

  head: [
    // Snippet and preview limits. Without this Google truncates the description
    // to its own default and shows no image thumbnail; with it a result can take
    // the full snippet and a large preview, which is more of the page visible in
    // the SERP for the same ranking position. The application has carried these
    // since July; the content site, which is the half that actually ranks, did
    // not carry them at all.
    //
    // Exactly one robots directive. Multiple contradictory tags rely on a
    // crawler-specific "most restrictive wins" merge and are needlessly fragile.
    ['meta', {
      name: 'robots',
      content: DOCS_ENV === 'prod'
        ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
        : 'noindex, follow',
    }],
    ...VERIFICATION_TAGS,
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/content-assets/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#02140E' }],
    // og:type and og:locale are per-page now (see transformPageData): a site-wide
    // value would have to be wrong on two of the three trees.
    //
    // "Документация DareBay" is gone for the reason titleTemplate is gone — these
    // pages answer commercial queries, and calling them documentation in every
    // share card told the reader they had landed in a manual.
    ['meta', { property: 'og:site_name', content: 'DareBay' }],
    // Manrope, self-hosted — same files the frontend serves from public/fonts. The app moved off
    // Google Fonts on purpose: it is unreachable for part of the RU audience, who were left on
    // fallback fonts. These docs kept requesting fonts.googleapis.com, so on the only pages of
    // ours that actually rank, part of the readers paid for a render-blocking request to nowhere.
    ['link', { rel: 'preload', href: '/content-assets/fonts/manrope-400-cyrillic.woff2', as: 'font', type: 'font/woff2', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: '/content-assets/fonts/manrope.css' }],
  ],

  themeConfig: {
    logo: { src: '/content-assets/logo.svg', alt: 'DareBay' },
    // No site title text — just the logo. Its locale-aware docs-home href and
    // every visible chrome label live in `themeForLocale` above.
    siteTitle: false,
    // Search disabled — the content volume doesn't warrant it yet, and a
    // quiet header reads better than one with a half-empty search box.
    // All remaining fields live in `locales[*].themeConfig` — see themeForLocale.
  },
})
