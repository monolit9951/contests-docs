import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/docs/',
  cleanUrls: true,

  title: 'DareBay Docs',
  description: 'The DareBay Manifesto — how we run contests, pick winners, and keep it real.',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/docs/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#111111' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'DareBay Docs' }],
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      title: 'DareBay Docs',
      description: 'The DareBay Manifesto.',
      themeConfig: {
        nav: [
          { text: 'Manifesto', link: '/' },
          { text: '← darebay.com', link: 'https://darebay.com' },
        ],
        sidebar: [
          {
            text: 'DareBay',
            items: [
              { text: 'Manifesto', link: '/' },
            ],
          },
        ],
        darkModeSwitchLabel: 'Theme',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Back to top',
        outline: { label: 'On this page' },
        docFooter: { prev: false, next: false },
      },
    },
    ru: {
      label: 'Русский',
      lang: 'ru',
      title: 'Документация DareBay',
      description: 'Манифест DareBay.',
      link: '/ru/',
      themeConfig: {
        nav: [
          { text: 'Манифест', link: '/ru/' },
          { text: '← darebay.com', link: 'https://darebay.com' },
        ],
        sidebar: {
          '/ru/': [
            {
              text: 'DareBay',
              items: [
                { text: 'Манифест', link: '/ru/' },
              ],
            },
          ],
        },
        darkModeSwitchLabel: 'Тема',
        sidebarMenuLabel: 'Меню',
        returnToTopLabel: 'Наверх',
        outline: { label: 'На этой странице' },
        docFooter: { prev: false, next: false },
      },
    },
  },

  themeConfig: {
    logo: { src: '/logo.svg', alt: 'DareBay' },
    siteTitle: 'DareBay Docs',
    search: {
      provider: 'local',
    },
    footer: {
      message: 'darebay.com',
      copyright: '© DareBay',
    },
  },
})
