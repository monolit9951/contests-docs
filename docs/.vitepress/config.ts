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

// One Organization node with a stable @id, referenced by every page instead of
// being repeated inline. That is what lets a crawler treat 129 pages as one
// publisher rather than 129 unrelated mentions of the same name — the difference
// between a brand entity and a string.
const ORG_ID = `${HOSTNAME}/#organization`
const AUTHOR_ID = `${HOSTNAME}/#founder`

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: 'DareBay',
  url: `${HOSTNAME}/`,
  logo: `${HOSTNAME}/content-assets/logo.svg`,
  sameAs: ['https://t.me/darebay_app', 'https://www.tiktok.com/@darebay.com'],
}

// A named human author, not the company.
//
// Earnings is a YMYL-adjacent subject: Google weighs who is behind the page, and
// "author: Organization" answers that with nobody. The founder is already named
// on the about page for exactly this reason, and the markup should say the same
// thing the page says.
const AUTHOR = {
  '@type': 'Person',
  '@id': AUTHOR_ID,
  name: 'Руслан Бей',
  jobTitle: 'Основатель DareBay',
  url: 'https://t.me/ruslanbwork',
  worksFor: { '@id': ORG_ID },
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

/** Q&A pairs under the FAQ section: `### question` then the prose beneath it. */
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
  iso?: string
) {
  const file = join(DOCS_DIR, relativePath)
  const raw = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const body = raw.replace(/^---\n[\s\S]*?\n---/, '')

  const date = (iso ?? '').slice(0, 10)
  const blocks: Record<string, unknown>[] = [
    ORGANIZATION,
    AUTHOR,
    {
      '@context': 'https://schema.org',
      // A hub index is a list of pages, not a piece of writing. Calling it an
      // Article would claim a body it does not have; CollectionPage is what it
      // actually is, and it pairs with the ItemList emitted below.
      '@type': hubPages.length ? 'CollectionPage' : 'Article',
      headline: title,
      description,
      url,
      inLanguage: language,
      ...(date ? { datePublished: date, dateModified: date } : {}),
      author: { '@id': AUTHOR_ID },
      publisher: { '@id': ORG_ID },
      isPartOf: { '@id': ORG_ID },
    },
  ]

  // BreadcrumbList is the one of these that still CHANGES THE SERP: Google
  // replaces the raw URL under the title with the trail. Two levels is what the
  // site actually has (hub, then page) and inventing a third would be a lie the
  // navigation does not back up.
  if (crumbs.length > 1) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: `${HOSTNAME}${c.path}`,
      })),
    })
  }

  const faq = faqPairs(body)
  if (faq.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    })
  }

  // NO HowTo, deliberately. Two reasons, and the second is the decisive one:
  //
  //  1. Google retired HowTo rich results in 2023 — the markup buys nothing in
  //     the surface it was written for.
  //  2. A numbered list is not a procedure. The commission page explains what
  //     the PLATFORM does in three numbered points, and the detector happily
  //     announced it as a how-to for the reader. Structure a page does not have
  //     is exactly what earns a manual action, and no heuristic here can tell
  //     "steps you take" from "what happens next" reliably enough to risk it.
  //
  // FAQPage stays: Google restricts its rich result too, but the assistant
  // crawlers read it, and they hit this domain 7826 times against Yandex's 598.
  // Structured question-and-answer is exactly what an answer engine ingests.

  // A hub page is a list. Saying so gives a crawler the section's shape in one
  // read instead of making it infer the relationship from anchor tags.
  if (hubPages.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: title,
      numberOfItems: hubPages.length,
      itemListElement: hubPages.map((page, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: page.title,
        url: `${HOSTNAME}${page.path}`,
      })),
    })
  }

  return blocks
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
    const hubPages =
      found.entry.slugs[found.lang] === ''
        ? PAGES.filter(
            (e) =>
              e.hub === found.entry.hub &&
              e.slugs[found.lang] !== undefined &&
              e.slugs[found.lang] !== ''
          ).map((e) => ({ title: pageTitle(sourceFile(e, found.lang)!, e.id), path: pagePath(e, found.lang)! }))
        : []

    for (const block of structuredData(
      pageData.relativePath,
      title,
      description,
      url,
      found.lang,
      crumbs,
      hubPages,
      updated
    )) {
      pageData.frontmatter.head.push(['script', { type: 'application/ld+json' }, JSON.stringify(block)])
    }

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
    // Snippet and preview limits. Without this Google truncates the description
    // to its own default and shows no image thumbnail; with it a result can take
    // the full snippet and a large preview, which is more of the page visible in
    // the SERP for the same ranking position. The application has carried these
    // since July; the content site, which is the half that actually ranks, did
    // not carry them at all.
    //
    // Dev builds override this to `noindex` below, and the later tag wins.
    ['meta', { name: 'robots', content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' }],
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
