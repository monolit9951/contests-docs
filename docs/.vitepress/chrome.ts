import type { DefaultTheme } from 'vitepress'
import type { Locale } from './registry'

export interface DareBayCtaConfig {
  readonly title: string
  readonly lede: string
  readonly productLabel: string
  readonly productUrl: string
  readonly telegramLabel: string
  readonly telegramUrl: string
}

/** Default-theme config plus the one custom block rendered by theme/index.ts. */
export interface DareBayThemeConfig extends DefaultTheme.Config {
  readonly darebayCta: DareBayCtaConfig
}

interface ChromeCopy {
  readonly navCta: string
  readonly notFound: NonNullable<DefaultTheme.Config['notFound']>
  readonly darkModeSwitchLabel: string
  readonly lightModeSwitchTitle: string
  readonly darkModeSwitchTitle: string
  readonly sidebarMenuLabel: string
  readonly returnToTopLabel: string
  readonly langMenuLabel: string
  readonly skipToContentLabel: string
  readonly outlineLabel: string
  readonly previousPage: string
  readonly nextPage: string
  readonly telegramAriaLabel: string
  readonly cta: Omit<DareBayCtaConfig, 'productUrl' | 'telegramUrl'>
}

/**
 * Every visible string owned by the shared VitePress chrome.
 *
 * Article copy lives in Markdown; shared navigation copy lives here. The table is
 * exhaustive over `Locale`, so adding a language to the registry cannot silently ship
 * Russian buttons, accessibility labels, or a Russian 404 in the new tree.
 */
export const CHROME_COPY: Record<Locale, ChromeCopy> = {
  ru: {
    navCta: 'Перейти на сайт →',
    notFound: {
      code: '404',
      title: 'Страница не найдена',
      quote: 'Ссылка ведёт в никуда: страницу переименовали или её никогда не было.',
      linkLabel: 'на главную страницу материалов',
      linkText: 'Вернуться к материалам',
    },
    darkModeSwitchLabel: 'Тема',
    lightModeSwitchTitle: 'Включить светлую тему',
    darkModeSwitchTitle: 'Включить тёмную тему',
    sidebarMenuLabel: 'Меню',
    returnToTopLabel: 'Наверх',
    langMenuLabel: 'Сменить язык',
    skipToContentLabel: 'Перейти к содержанию',
    outlineLabel: 'На этой странице',
    previousPage: 'Предыдущая страница',
    nextPage: 'Следующая страница',
    telegramAriaLabel: 'Telegram-канал DareBay',
    cta: {
      title: 'Открыть DareBay',
      lede: 'Задания и конкурсы живут на сайте и в Telegram — это две равные двери в один продукт.',
      productLabel: 'Перейти на darebay.com →',
      telegramLabel: 'Telegram-канал',
    },
  },
  uk: {
    navCta: 'Перейти на сайт →',
    notFound: {
      code: '404',
      title: 'Сторінку не знайдено',
      quote: 'Посилання веде в нікуди: сторінку перейменували або її ніколи не існувало.',
      linkLabel: 'на головну сторінку матеріалів',
      linkText: 'Повернутися до матеріалів',
    },
    darkModeSwitchLabel: 'Тема',
    lightModeSwitchTitle: 'Увімкнути світлу тему',
    darkModeSwitchTitle: 'Увімкнути темну тему',
    sidebarMenuLabel: 'Меню',
    returnToTopLabel: 'Нагору',
    langMenuLabel: 'Змінити мову',
    skipToContentLabel: 'Перейти до вмісту',
    outlineLabel: 'На цій сторінці',
    previousPage: 'Попередня сторінка',
    nextPage: 'Наступна сторінка',
    telegramAriaLabel: 'Telegram-канал DareBay',
    cta: {
      title: 'Відкрити DareBay',
      lede: 'Завдання та конкурси доступні на сайті й у Telegram — це два рівноцінні входи в один продукт.',
      productLabel: 'Перейти на darebay.com →',
      telegramLabel: 'Telegram-канал',
    },
  },
  en: {
    navCta: 'Go to the site →',
    notFound: {
      code: '404',
      title: 'Page not found',
      quote: 'This link leads nowhere: the page was renamed or never existed.',
      linkLabel: 'to the guides home',
      linkText: 'Return to the guides',
    },
    darkModeSwitchLabel: 'Appearance',
    lightModeSwitchTitle: 'Switch to light theme',
    darkModeSwitchTitle: 'Switch to dark theme',
    sidebarMenuLabel: 'Menu',
    returnToTopLabel: 'Return to top',
    langMenuLabel: 'Change language',
    skipToContentLabel: 'Skip to content',
    outlineLabel: 'On this page',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    telegramAriaLabel: 'DareBay Telegram channel',
    cta: {
      title: 'Open DareBay',
      lede: 'Tasks and contests are available on the website and in Telegram — two equal ways into the same product.',
      productLabel: 'Go to darebay.com →',
      telegramLabel: 'Telegram channel',
    },
  },
}
