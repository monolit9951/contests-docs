import { defineConfig } from 'vitepress'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HOMEPAGE, TELEGRAM } from './links'

// Branch-aware host for the sitemap + a dev-only noindex (the develop preview must not be indexed;
// only the release/prod build is indexable). CD passes DOCS_ENV=prod on the release branch.
const DOCS_ENV = process.env.DOCS_ENV || 'dev'
// hostname MUST include the /docs/ base — VitePress sitemap joins hostname + base-stripped path,
// so without it the sitemap emits .../ru/... (404) instead of .../docs/ru/... .
const HOSTNAME = DOCS_ENV === 'prod' ? 'https://darebay.com/docs/' : 'https://dev.darebay.com/docs/'

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

// Auto-list pages in a RU content zone so the fleet never has to edit this config file
// (producers are forbidden to touch config.ts; new pages self-register in the sidebar on build).
function ruZone(zone: string, text: string) {
  const dir = join(DOCS_DIR, 'ru', zone)
  const items: { text: string; link: string }[] = []
  if (existsSync(join(dir, 'index.md'))) items.push({ text: 'Обзор', link: `/ru/${zone}/` })
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith('.md') || f === 'index.md') continue
      const slug = f.slice(0, -3)
      const m = readFileSync(join(dir, f), 'utf8').match(/^---\n[\s\S]*?\btitle:\s*(.+)\n[\s\S]*?\n---/)
      const title = m ? m[1].trim().replace(/^["']|["']$/g, '') : slug
      items.push({ text: title, link: `/ru/${zone}/${slug}` })
    }
  }
  return { text, collapsed: false, items }
}

// Self-referencing canonical. VitePress emits none, and with cleanUrls the same page answers on
// both /foo and /foo.html — two URLs, one page. `relativePath` is docs-relative ('ru/faq/crypto.md');
// index.md maps to the directory URL.
function canonical(relativePath: string) {
  const path = relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
  return HOSTNAME + path
}

export default defineConfig({
  base: '/docs/',
  sitemap: { hostname: HOSTNAME },
  cleanUrls: true,
  // force-dark: always dark, no theme toggle in the UI at all
  appearance: 'force-dark',

  // Single-language site (RU). The EN tree was removed 2026-07-25 (seo-fleet DECISIONS B5): the
  // market is RU/СНГ, and the EN pages sat on the SHORT urls (/docs/, /docs/faq/...) while RU sat
  // a level deeper, so Google indexed the English ones and served English sitelinks under a
  // Russian brand result. Old EN urls 301 to their RU counterparts in nginx.conf — never
  // reintroduce an EN tree at the root without redirects.
  lang: 'ru',
  title: 'Документация DareBay',
  description: 'Запускайте активности, отправляйте работы, получайте награды на DareBay.',

  // The manifesto moved from /ru/ to the root so that /docs/ — the url Google already has
  // indexed and shows as a sitelink — stays a live page and simply turns Russian, instead of
  // becoming a redirect. `ru/faq/illegal-content.md` still links to the old `/ru/`, which
  // nginx.conf 301s onto `/`: correct for a reader, invisible to this build-time checker.
  // Deliberately anchored — it must not mute anything else under /ru/. VitePress resolves a
  // directory link to its `index`, so the pattern matches `/ru/index`, not `/ru/`.
  ignoreDeadLinks: [/^\/ru\/index$/],

  transformPageData(pageData) {
    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push(['link', { rel: 'canonical', href: canonical(pageData.relativePath) }])
  },

  head: [
    // dev/preview builds are noindex; only the prod (release) build is indexable.
    ...(DOCS_ENV !== 'prod' ? [['meta', { name: 'robots', content: 'noindex' }] as [string, Record<string, string>]] : []),
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/docs/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#02140E' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Документация DareBay' }],
    ['meta', { property: 'og:locale', content: 'ru_RU' }],
    // Manrope — matches the darebay.com frontend
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap',
    }],
  ],

  themeConfig: {
    logo: { src: '/logo.svg', alt: 'DareBay' },
    // No site title text — just the logo, which links to darebay.com
    // (href is rewritten at runtime in theme/index.ts).
    siteTitle: false,
    // Search disabled — the content volume doesn't warrant it yet, and a
    // quiet header reads better than one with a half-empty search box.
    nav: [
      { text: 'Быстрый старт', link: '/ru/getting-started/' },
      { text: 'FAQ', link: '/ru/faq/' },
      // The CTA link is styled separately via CSS — see the `:last-child` rules under
      // "The CTA" in custom.css. It must stay LAST in this array: the gradient-pill
      // styling keys off `:last-child`, and so does the rule that keeps it visible on
      // phones while the other nav items collapse into the hamburger.
      { text: 'darebay.com  →', link: HOMEPAGE },
    ],
    sidebar: [
      {
        text: 'Быстрый старт',
        collapsed: false,
        items: [
          { text: 'Обзор', link: '/ru/getting-started/' },
          { text: 'Создать первый конкурс', link: '/ru/getting-started/create-your-first-contest' },
          { text: 'Отправить работу', link: '/ru/getting-started/submit-a-work' },
          { text: 'Смотреть, голосовать, выиграть', link: '/ru/getting-started/watch-vote-win' },
          { text: 'Призы и выплаты', link: '/ru/getting-started/prizes-and-payouts' },
          { text: 'Верификация и доверие', link: '/ru/getting-started/verification-and-trust' },
        ],
      },
      {
        text: 'FAQ',
        collapsed: false,
        items: [
          { text: 'Все вопросы', link: '/ru/faq/' },
          { text: 'Какая комиссия на DareBay?', link: '/ru/faq/kakaya-komissiya' },
          { text: 'Можно платить криптой?', link: '/ru/faq/crypto' },
          { text: 'Как вывести выигрыш?', link: '/ru/faq/darebay-vyvod-deneg' },
          { text: 'DareBay - скам или нет?', link: '/ru/faq/darebay-eto-skam' },
          { text: 'DareBay - развод или нет?', link: '/ru/faq/darebay-razvod-ili-net' },
          { text: 'DareBay реально платит?', link: '/ru/faq/darebay-realno-platit' },
          { text: 'DareBay - отзывы и факты', link: '/ru/faq/darebay-otzyvy' },
          { text: 'Гарантия выплат', link: '/ru/faq/garantiya-vyplat' },
          { text: 'Если никто не участвует?', link: '/ru/faq/no-submissions' },
          { text: 'Как выбирают победителя?', link: '/ru/faq/choosing-winners' },
          { text: 'Защита от подделок?', link: '/ru/faq/fake-submissions' },
          { text: 'Запрещённый контент?', link: '/ru/faq/illegal-content' },
        ],
      },
      ruZone('zarabotok', 'Заработок'),
      ruZone('platformy', 'Платформы и комиссии'),
      ruZone('kak-rabotaet', 'Как это работает'),
      ruZone('blog', 'Блог'),
      {
        text: 'О платформе',
        collapsed: false,
        items: [
          { text: 'Манифест', link: '/' },
        ],
      },
      {
        text: 'Юридические документы',
        collapsed: false,
        items: [
          { text: 'Обзор', link: '/ru/legal/' },
          { text: 'Политика конфиденциальности', link: '/ru/legal/privacy' },
          { text: 'Условия использования', link: '/ru/legal/terms' },
        ],
      },
    ],
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
