// Interface strings of the tools catalogue (`LTools.vue`), per locale. Labels only, never a claim
// about a product: what a tool does and costs is data (`data/tools.json`, with its sources).
//
// A table of its own rather than more keys in `LANDING_COPY`: only the catalogue's page uses these,
// and `LTools` is an async chunk, so strings kept here stay out of the theme chunk every page
// downloads. `locales.test.ts` holds it to every known language like the other tables.
import type { Locale } from '../../registry'
import type { PayClass } from '../../tools'

export interface ToolsCopy {
  /** Accessible name of the row of category chips. */
  nav: string
  /** The chip that shows every card again, once filtering works. */
  all: string
  /** Hidden label of the search field, and its placeholder. */
  search: string
  placeholder: string
  /** "Showing 12 of 30". */
  shown: string
  of: string
  empty: string
  reset: string
  /** Heading of the group of DareBay's own tools. */
  own: string
  price: string
  free: string
  access: string
  /** The day a price was read, linking to its page: `{date}` is replaced. */
  asOf: string
  /** The summary of a card's disclosure: the free tier and how to pay (`<details>`). */
  more: string
  /** One word of how a tool is paid for (`pay` in data/tools.json). */
  pay: Record<PayClass, string>
  /**
   * The link to our article that compares the tool with others. Not "{name} review": the article
   * compares several tools (a CapCut piece covers VN and DaVinci too), and a Cyrillic name broke the
   * Russian grammar of «Обзор {name}».
   */
  compared: string
  /** A third-party tool's site, and a DareBay tool's place in the product. */
  site: string
  open: string
}

export const TOOLS_COPY: Record<Locale, ToolsCopy> = {
  ru: {
    nav: 'Категории инструментов',
    all: 'Все',
    search: 'Поиск по инструментам',
    placeholder: 'Название или задача…',
    shown: 'Показано',
    of: 'из',
    empty: 'Ничего не нашлось. Попробуй другое слово или покажи все категории.',
    reset: 'Показать все',
    own: 'В DareBay',
    price: 'Цена',
    free: 'Бесплатный тариф',
    access: 'Доступ и оплата',
    asOf: 'на\u00a0{date}',
    more: 'Тариф и оплата',
    pay: { rub: 'Карта РФ', 'foreign-card': 'Зарубежная карта', free: 'Бесплатно', unavailable: 'Нет в РФ', 'app-store': 'Магазин приложений' },
    compared: 'Сравнение с аналогами →',
    site: 'Сайт ↗',
    open: 'Открыть →',
  },
  uk: {
    nav: 'Категорії інструментів',
    all: 'Усі',
    search: 'Пошук серед інструментів',
    placeholder: 'Назва або завдання…',
    shown: 'Показано',
    of: 'із',
    empty: 'Нічого не знайшлося. Спробуй інше слово або покажи всі категорії.',
    reset: 'Показати всі',
    own: 'У DareBay',
    price: 'Ціна',
    free: 'Безкоштовний тариф',
    access: 'Доступ і оплата',
    asOf: 'на\u00a0{date}',
    more: 'Тариф і оплата',
    pay: { rub: 'Картка банку РФ', 'foreign-card': 'Закордонна картка', free: 'Безкоштовно', unavailable: 'Недоступно в РФ', 'app-store': 'Магазин застосунків' },
    compared: 'Порівняння з аналогами →',
    site: 'Сайт ↗',
    open: 'Відкрити →',
  },
  en: {
    nav: 'Tool categories',
    all: 'All',
    search: 'Search the tools',
    placeholder: 'Name or task…',
    shown: 'Showing',
    of: 'of',
    empty: 'Nothing found. Try another word or show every category.',
    reset: 'Show all',
    own: 'In DareBay',
    price: 'Price',
    free: 'Free tier',
    access: 'Availability',
    asOf: 'as\u00a0of {date}',
    more: 'Plan and availability',
    pay: { rub: 'Russian card', 'foreign-card': 'Card', free: 'Free', unavailable: 'Region-locked', 'app-store': 'App stores' },
    compared: 'Compared with alternatives →',
    site: 'Website ↗',
    open: 'Open →',
  },
  // Right-to-left: an arrow that means "onward" points left; the outbound one keeps its diagonal.
  ar: {
    nav: 'فئات الأدوات',
    all: 'الكل',
    search: 'البحث في الأدوات',
    placeholder: 'الاسم أو المهمة…',
    shown: 'المعروض',
    of: 'من',
    empty: 'لا توجد نتائج. جرّب كلمة أخرى أو اعرض كل الفئات.',
    reset: 'عرض الكل',
    own: 'في DareBay',
    price: 'السعر',
    free: 'الخطة المجانية',
    access: 'التوفر والدفع',
    asOf: 'بتاريخ\u00a0{date}',
    more: 'الخطة والتوفر',
    pay: { rub: 'بطاقة روسية', 'foreign-card': 'بطاقة', free: 'مجاني', unavailable: 'غير متاح', 'app-store': 'متاجر التطبيقات' },
    compared: 'مقارنة مع البدائل ←',
    site: 'الموقع ↗',
    open: 'افتح ←',
  },
}
