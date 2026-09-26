import type { DefaultTheme } from 'vitepress'
import type { CommunityPlatform } from './links'
import type { Locale } from './registry'

export interface DareBayCtaConfig {
  readonly title: string
  readonly lede: string
  readonly productLabel: string
  readonly productUrl: string
  /** Open-task catalogue in the page's language: the primary CTA target outside the brands section. */
  readonly tasksUrl: string
  /** The community room of the page's language: the Telegram channel or the Discord server. */
  readonly communityLabel: string
  readonly communityUrl: string
  /** The room's platform as a short name, for a footer. */
  readonly communityName: string
  /** Business page in the page's language: the primary CTA target of the brands section. */
  readonly businessUrl: string
  /** The founder's own Telegram: the second CTA of the brands section. */
  readonly founderUrl: string
}

/** The byline every article carries: who signs the corpus and where that page is. */
export interface AuthorLink {
  readonly name: string
  readonly path: string
}

/** Default-theme config plus the custom blocks rendered by the landing shell and theme/index.ts. */
export interface DareBayThemeConfig extends DefaultTheme.Config {
  readonly darebayCta: DareBayCtaConfig
  /** Null only while the author page is missing from the manifest in this locale. */
  readonly authorLink: AuthorLink | null
  /** Accessible name of the section navigation in the header and the footer. */
  readonly navLabel: string
  /** Accessible name of the language switcher. */
  readonly languageLabel: string
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
  /** The room this locale's readers are sent to, and what its links are called. */
  readonly community: {
    readonly platform: CommunityPlatform
    /** Accessible name of the header icon. */
    readonly ariaLabel: string
    /** Visible name in the footer. */
    readonly footerLabel: string
  }
  readonly navLabel: string
  readonly languageLabel: string
  readonly cta: Omit<
    DareBayCtaConfig,
    'productUrl' | 'tasksUrl' | 'communityUrl' | 'communityName' | 'businessUrl' | 'founderUrl'
  >
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
    community: { platform: 'telegram', ariaLabel: 'Telegram-канал DareBay', footerLabel: 'Telegram' },
    navLabel: 'Разделы',
    languageLabel: 'Язык',
    cta: {
      title: 'Открыть DareBay',
      lede: 'Задания и конкурсы живут на сайте и в Telegram — это две равные двери в один продукт.',
      productLabel: 'Перейти на darebay.com →',
      communityLabel: 'Telegram-канал',
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
    community: { platform: 'telegram', ariaLabel: 'Telegram-канал DareBay', footerLabel: 'Telegram' },
    navLabel: 'Розділи',
    languageLabel: 'Мова',
    cta: {
      title: 'Відкрити DareBay',
      lede: 'Завдання та конкурси доступні на сайті й у Telegram — це два рівноцінні входи в один продукт.',
      productLabel: 'Перейти на darebay.com →',
      communityLabel: 'Telegram-канал',
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
    community: { platform: 'discord', ariaLabel: 'DareBay Discord server', footerLabel: 'Discord' },
    navLabel: 'Sections',
    languageLabel: 'Language',
    cta: {
      title: 'Open DareBay',
      lede: 'Tasks and contests are available on the website and in Telegram — two equal ways into the same product.',
      productLabel: 'Go to darebay.com →',
      communityLabel: 'Join our Discord',
    },
  },
  // Right-to-left: an arrow that means "onward" points left. The product buttons open the
  // English interface (the application has no Arabic one — `appLocaleOf` in the registry), and
  // the CTA says so rather than letting the reader find out after the click.
  ar: {
    navCta: 'الانتقال إلى الموقع ←',
    notFound: {
      code: '404',
      title: 'الصفحة غير موجودة',
      quote: 'هذا الرابط لا يؤدي إلى أي مكان: إما أن الصفحة غُيّر اسمها وإما أنها لم تكن موجودة أصلًا.',
      linkLabel: 'إلى الصفحة الرئيسية للأدلة',
      linkText: 'العودة إلى الأدلة',
    },
    darkModeSwitchLabel: 'المظهر',
    lightModeSwitchTitle: 'التبديل إلى المظهر الفاتح',
    darkModeSwitchTitle: 'التبديل إلى المظهر الداكن',
    sidebarMenuLabel: 'القائمة',
    returnToTopLabel: 'العودة إلى الأعلى',
    langMenuLabel: 'تغيير اللغة',
    skipToContentLabel: 'الانتقال إلى المحتوى',
    outlineLabel: 'في هذه الصفحة',
    previousPage: 'الصفحة السابقة',
    nextPage: 'الصفحة التالية',
    community: { platform: 'discord', ariaLabel: 'خادم DareBay على Discord', footerLabel: 'Discord' },
    navLabel: 'الأقسام',
    languageLabel: 'اللغة',
    cta: {
      title: 'افتح DareBay',
      lede: 'المهام والمسابقات متاحة على الموقع وفي Telegram، وهما مدخلان متكافئان إلى المنتج نفسه. واجهة المنصة بالإنجليزية.',
      productLabel: 'الانتقال إلى darebay.com ←',
      communityLabel: 'انضم إلى Discord',
    },
  },
}
