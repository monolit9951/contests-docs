// UI strings of the landing shell and components, per locale. Product facts are
// NOT here (they live in data/platforms.json with sources); only labels.
import type { Locale } from '../../registry'

export interface LandingCopy {
  updated: string
  snapshotNote: string
  keyTakeaways: string
  compareTitle: string
  compareNote: string
  us: string
  bestFor: string
  pros: string
  cons: string
  sources: string
  notPublished: string
  methodTitle: string
  calcTitle: string
  calcViews: string
  calcRate: string
  calcCap: string
  calcOut: string
  calcNote: string
  ctaTitle: string
  ctaLede: string
  ctaPrimary: string
  ctaSecondary: string
  columns: Record<string, string>
  cis: { yes: string; no: string; partial: string; unknown: string }
  footerHome: string
  footerTelegram: string
}

const columns = {
  en: {
    rate: 'Rate per 1,000 views',
    threshold: 'View threshold',
    cap: 'Cap per clip',
    fee: 'Fee on payout',
    minPayout: 'Minimum payout',
    payoutMethods: 'Payout methods',
    cis: 'Pays in Russia / CIS',
    followers: 'Followers required',
    escrow: 'Budget locked upfront',
    networks: 'Platforms counted',
    verification: 'View verification',
  },
  ru: {
    rate: 'Ставка за 1000',
    threshold: 'Порог просмотров',
    cap: 'Потолок на ролик',
    fee: 'Комиссия с выплаты',
    minPayout: 'Минимум вывода',
    payoutMethods: 'Способы выплаты',
    cis: 'Платит в РФ / СНГ',
    followers: 'Нужны подписчики',
    escrow: 'Бюджет заблокирован заранее',
    networks: 'Какие площадки в зачёте',
    verification: 'Как считают просмотры',
  },
  uk: {
    rate: 'Ставка за 1000',
    threshold: 'Поріг переглядів',
    cap: 'Стеля на ролик',
    fee: 'Комісія з виплати',
    minPayout: 'Мінімум виведення',
    payoutMethods: 'Способи виплати',
    cis: 'Платить в Україну / СНД',
    followers: 'Потрібні підписники',
    escrow: 'Бюджет заблоковано заздалегідь',
    networks: 'Які майданчики в заліку',
    verification: 'Як рахують перегляди',
  },
}

export const LANDING_COPY: Record<Locale, LandingCopy> = {
  en: {
    updated: 'Updated',
    snapshotNote: 'Competitor figures are taken from each platform’s own public pages on the date shown; DareBay figures come from live platform data.',
    keyTakeaways: 'Key takeaways',
    compareTitle: 'Side by side',
    compareNote: 'Click a column to sort. A superscript number links to the source page.',
    us: 'DareBay',
    bestFor: 'Best for',
    pros: 'Strong points',
    cons: 'Watch out for',
    sources: 'Sources',
    notPublished: 'not published',
    methodTitle: 'How this comparison was built',
    calcTitle: 'What a clip pays on DareBay',
    calcViews: 'Counted views on one clip',
    calcRate: 'Rate per 1,000 views',
    calcCap: 'Cap per clip',
    calcOut: 'Payout for this clip',
    calcNote: 'Formula: rate × views ÷ 1,000, never above the cap. Rates and caps come from the live open contests.',
    ctaTitle: 'Take a brief and get paid per view',
    ctaLede: 'No followers, no application. The budget is locked on the platform before you start; views are counted independently.',
    ctaPrimary: 'Open DareBay →',
    ctaSecondary: 'Telegram channel',
    columns: columns.en,
    cis: { yes: 'yes', no: 'no', partial: 'partly', unknown: 'not stated' },
    footerHome: 'darebay.com',
    footerTelegram: 'Telegram',
  },
  ru: {
    updated: 'Обновлено',
    snapshotNote: 'Цифры площадок сняты с их публичных страниц в указанную дату; цифры DareBay берутся из живых данных платформы.',
    keyTakeaways: 'Главное',
    compareTitle: 'Площадки рядом',
    compareNote: 'Нажми на колонку, чтобы отсортировать. Цифра сверху ведёт на страницу-источник.',
    us: 'DareBay',
    bestFor: 'Кому подходит',
    pros: 'Сильные стороны',
    cons: 'На что смотреть',
    sources: 'Источники',
    notPublished: 'не публикует',
    methodTitle: 'Как строили сравнение',
    calcTitle: 'Сколько платит один ролик на DareBay',
    calcViews: 'Засчитанных просмотров на ролике',
    calcRate: 'Ставка за 1000',
    calcCap: 'Потолок на ролик',
    calcOut: 'Выплата за этот ролик',
    calcNote: 'Формула: ставка × просмотры ÷ 1000, но не выше потолка. Ставки и потолки взяты из открытых конкурсов.',
    ctaTitle: 'Возьми задание и получай за просмотры',
    ctaLede: 'Подписчики и заявка не нужны. Бюджет лежит на платформе до старта, просмотры считаются независимо.',
    ctaPrimary: 'Открыть DareBay →',
    ctaSecondary: 'Канал в Telegram',
    columns: columns.ru,
    cis: { yes: 'да', no: 'нет', partial: 'частично', unknown: 'не указано' },
    footerHome: 'darebay.com',
    footerTelegram: 'Telegram',
  },
  uk: {
    updated: 'Оновлено',
    snapshotNote: 'Цифри майданчиків зняті з їхніх публічних сторінок у вказану дату; цифри DareBay беруться з живих даних платформи.',
    keyTakeaways: 'Головне',
    compareTitle: 'Майданчики поруч',
    compareNote: 'Натисни на колонку, щоб відсортувати. Цифра зверху веде на сторінку-джерело.',
    us: 'DareBay',
    bestFor: 'Кому підходить',
    pros: 'Сильні сторони',
    cons: 'На що зважати',
    sources: 'Джерела',
    notPublished: 'не публікує',
    methodTitle: 'Як будували порівняння',
    calcTitle: 'Скільки платить один ролик на DareBay',
    calcViews: 'Зарахованих переглядів на ролику',
    calcRate: 'Ставка за 1000',
    calcCap: 'Стеля на ролик',
    calcOut: 'Виплата за цей ролик',
    calcNote: 'Формула: ставка × перегляди ÷ 1000, але не вище стелі. Ставки та стелі взяті з відкритих конкурсів.',
    ctaTitle: 'Візьми завдання й отримуй за перегляди',
    ctaLede: 'Підписники та заявка не потрібні. Бюджет лежить на платформі до старту, перегляди рахуються незалежно.',
    ctaPrimary: 'Відкрити DareBay →',
    ctaSecondary: 'Канал у Telegram',
    columns: columns.uk,
    cis: { yes: 'так', no: 'ні', partial: 'частково', unknown: 'не вказано' },
    footerHome: 'darebay.com',
    footerTelegram: 'Telegram',
  },
}

export const localeOf = (lang: string): Locale => (lang === 'uk' ? 'uk' : lang === 'en' ? 'en' : 'ru')
