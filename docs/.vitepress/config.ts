import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/docs/',
  cleanUrls: true,
  appearance: 'dark',

  title: 'DareBay Docs',
  description: 'The DareBay Manifesto — how we run contests, pick winners, and keep it real.',

  head: [
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
      description: 'The DareBay Manifesto.',
      themeConfig: {
        nav: [
          { text: '← darebay.com', link: 'https://darebay.com' },
        ],
        darkModeSwitchLabel: 'Theme',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Back to top',
        outline: { label: 'On this page', level: [2, 3] },
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
          { text: '← darebay.com', link: 'https://darebay.com' },
        ],
        darkModeSwitchLabel: 'Тема',
        sidebarMenuLabel: 'Меню',
        returnToTopLabel: 'Наверх',
        outline: { label: 'На этой странице', level: [2, 3] },
        docFooter: { prev: false, next: false },
      },
    },
  },

  themeConfig: {
    logo: { src: '/logo.svg', alt: 'DareBay' },
    // No site title text — just the logo, which links to darebay.com
    // (href is rewritten at runtime in theme/index.ts).
    siteTitle: false,
    search: {
      provider: 'local',
    },
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
