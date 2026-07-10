import { defineConfig } from 'vitepress'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

export default defineConfig({
  base: '/docs/',
  sitemap: { hostname: HOSTNAME },
  cleanUrls: true,
  // force-dark: always dark, no theme toggle in the UI at all
  appearance: 'force-dark',

  title: 'DareBay Docs',
  description: 'The DareBay Manifesto — how we run contests, pick winners, and keep it real.',

  head: [
    // dev/preview builds are noindex; only the prod (release) build is indexable.
    ...(DOCS_ENV !== 'prod' ? [['meta', { name: 'robots', content: 'noindex' }] as [string, Record<string, string>]] : []),
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/docs/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#02140E' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'DareBay Docs' }],
    // Manrope — matches the darebay.com frontend
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap',
    }],
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      title: 'DareBay Docs',
      description: 'Run contests, submit work, win prizes on DareBay.',
      themeConfig: {
        nav: [
          { text: 'Getting Started', link: '/getting-started/' },
          { text: 'FAQ', link: '/faq/' },
          // The CTA link is styled separately via CSS (data attribute on
          // the text) — see .VPNavBarMenuLink.cta in custom.css.
          { text: 'darebay.com  →', link: 'https://darebay.com' },
        ],
        sidebar: [
          {
            text: 'Getting Started',
            collapsed: false,
            items: [
              { text: 'Overview', link: '/getting-started/' },
              { text: 'Create your first contest', link: '/getting-started/create-your-first-contest' },
              { text: 'Submit a work', link: '/getting-started/submit-a-work' },
              { text: 'Watch, vote & win', link: '/getting-started/watch-vote-win' },
              { text: 'Prizes & payouts', link: '/getting-started/prizes-and-payouts' },
              { text: 'Verification & trust', link: '/getting-started/verification-and-trust' },
            ],
          },
          {
            text: 'FAQ',
            collapsed: false,
            items: [
              { text: 'All questions', link: '/faq/' },
              { text: 'What fees does DareBay charge?', link: '/faq/fees' },
              { text: 'Can I pay with crypto?', link: '/faq/crypto' },
              { text: 'Can I withdraw my winnings?', link: '/faq/withdraw' },
              { text: 'What happens if no one submits?', link: '/faq/no-submissions' },
              { text: 'How are winners chosen?', link: '/faq/choosing-winners' },
              { text: "What's stopping fake submissions?", link: '/faq/fake-submissions' },
              { text: 'Illegal or harmful content?', link: '/faq/illegal-content' },
            ],
          },
          {
            text: 'About',
            collapsed: false,
            items: [
              { text: 'Manifesto', link: '/' },
            ],
          },
        ],
        darkModeSwitchLabel: 'Theme',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Back to top',
        outline: { label: 'On this page', level: [2, 3] },
      },
    },
    ru: {
      label: 'Русский',
      lang: 'ru',
      title: 'Документация DareBay',
      description: 'Запускайте конкурсы, отправляйте работы, выигрывайте призы на DareBay.',
      link: '/ru/',
      themeConfig: {
        nav: [
          { text: 'Быстрый старт', link: '/ru/getting-started/' },
          { text: 'FAQ', link: '/ru/faq/' },
          { text: 'darebay.com  →', link: 'https://darebay.com' },
        ],
        sidebar: {
          '/ru/': [
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
                { text: 'Манифест', link: '/ru/' },
              ],
            },
          ],
        },
        darkModeSwitchLabel: 'Тема',
        sidebarMenuLabel: 'Меню',
        returnToTopLabel: 'Наверх',
        outline: { label: 'На этой странице', level: [2, 3] },
        docFooter: { prev: 'Предыдущая страница', next: 'Следующая страница' },
      },
    },
  },

  themeConfig: {
    logo: { src: '/logo.svg', alt: 'DareBay' },
    // No site title text — just the logo, which links to darebay.com
    // (href is rewritten at runtime in theme/index.ts).
    siteTitle: false,
    // Search disabled — the content volume doesn't warrant it yet, and a
    // quiet header reads better than one with a half-empty search box.
    socialLinks: [
      {
        icon: {
          // Telegram isn't a built-in VitePress icon; inline SVG.
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>',
        },
        link: 'https://t.me/darebay',
        ariaLabel: 'Telegram',
      },
      {
        icon: 'discord',
        link: 'https://discord.gg/darebay',
      },
      {
        icon: 'x',
        link: 'https://x.com/darebay',
      },
      {
        icon: 'youtube',
        link: 'https://youtube.com/@darebay',
      },
      {
        icon: 'instagram',
        link: 'https://instagram.com/darebay',
      },
    ],
    footer: {
      message: 'darebay.com',
      copyright: '© DareBay',
    },
  },
})
