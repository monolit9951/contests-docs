import type { HubPage } from '../hubs.data'
import type { Locale } from '../registry'

// Editorial metadata contains semantic IDs only. The registry and frontmatter
// own addresses and article copy, including partially translated trees.
export const TOPICS = ['basics', 'money', 'creation', 'platforms', 'countries', 'campaigns', 'trust', 'project', 'rules'] as const
export type Topic = typeof TOPICS[number]

const TOPIC_PAGES: Readonly<Partial<Record<Topic, readonly string[]>>> = {
  basics: ['earnings-clipper-job', 'earnings-where-to-find-work', 'earnings-glossary', 'help-quick-start', 'help-submit-work', 'help-watch-vote-win', 'help-choosing-winners'],
  money: ['earnings-how-much-total', 'earnings-streamer-clip-rate', 'earnings-ppv-mechanics', 'earnings-calculator', 'earnings-rates-by-niche', 'earnings-first-100-dollars', 'earnings-1000-a-month', 'earnings-taxes', 'brands-pay-clippers', 'brands-campaign-cost', 'help-prizes-and-payouts', 'help-crypto-payment', 'help-withdraw', 'help-commission'],
  creation: ['earnings-how-to-clip', 'earnings-film-clips', 'earnings-streamers-who-pay', 'earnings-tiktok-views', 'earnings-youtube-clips', 'earnings-instagram-reels', 'earnings-x-twitter-clips', 'earnings-vk-clips', 'earnings-telegram-clips', 'earnings-account-warmup', 'brands-create-contest', 'brands-brief-template', 'help-first-contest'],
  platforms: ['best-clipping-platforms', 'whop-alternatives', 'darebay-vs-whop', 'darebay-vs-klipni', 'how-to-choose-clipping-platform', 'earnings-whop-review', 'earnings-clipping-net-alternatives', 'earnings-vyro-review', 'clipgrow-review', 'is-wondeed-legit', 'vues-review', 'reach-cat-review', 'prime-oracles-review', 'klipni-review', 'wusul-review'],
  trust: ['earnings-is-clipping-legal', 'earnings-why-clips-rejected', 'help-verification', 'help-fake-submissions', 'help-illegal-content', 'help-no-submissions', 'about-is-it-a-scam', 'about-reviews', 'about-is-it-a-fraud', 'about-really-pays', 'about-payout-guarantee', 'about-clipping-scam-red-flags'],
}
const TOPIC_BY_ID = new Map(Object.entries(TOPIC_PAGES).flatMap(([topic, ids]) => ids.map((id) => [id, topic as Topic] as const)))

export function topicFor(id: string): Topic {
  const topic = TOPIC_BY_ID.get(id)
  if (topic) return topic
  if (id.startsWith('clipping-platforms-')) return 'countries'
  if (id.startsWith('brands-')) return 'campaigns'
  if (id.startsWith('legal-')) return 'rules'
  if (id.startsWith('about-') || id === 'darebay-at-a-glance') return 'project'
  return 'basics'
}

export const TOPIC_LABELS: Record<Locale, Record<Topic, string>> = {
  ru: { basics: 'С чего начать', money: 'Деньги и выплаты', creation: 'Практика и контент', platforms: 'Обзоры и сравнения', countries: 'Платформы по странам', campaigns: 'Продвижение и кампании', trust: 'Правила и безопасность', project: 'О DareBay', rules: 'Документы' },
  uk: { basics: 'З чого почати', money: 'Гроші й виплати', creation: 'Практика й контент', platforms: 'Огляди й порівняння', countries: 'Платформи за країнами', campaigns: 'Просування й кампанії', trust: 'Правила й безпека', project: 'Про DareBay', rules: 'Документи' },
  en: { basics: 'Getting started', money: 'Earnings & payouts', creation: 'Skills & content', platforms: 'Reviews & comparisons', countries: 'Platforms by country', campaigns: 'Promotion & campaigns', trust: 'Rules & safety', project: 'About DareBay', rules: 'Documents' },
  ar: { basics: 'من أين تبدأ', money: 'الأرباح والدفعات', creation: 'المهارات والمحتوى', platforms: 'مراجعات ومقارنات', countries: 'المنصات حسب البلد', campaigns: 'الترويج والحملات', trust: 'القواعد والأمان', project: 'عن DareBay', rules: 'الوثائق' },
}

export const CATALOG_COPY = {
  ru: { kicker: 'Библиотека DareBay', featured: 'Три маршрута для старта', start: 'Разобраться', calculate: 'Посчитать', choose: 'Выбрать', startNote: 'Как устроена работа и где начать.', calculateNote: 'Ставка, просмотры и ваш результат.', chooseNote: 'Что проверить перед первой работой.', browse: 'Все материалы раздела', search: 'Поиск по материалам', placeholder: 'Название, тема или вопрос…', topics: 'Выберите тему', all: 'Все темы', results: 'Найдено', of: 'из', empty: 'Ничего не найдено', emptyNote: 'Попробуйте другое слово или выберите все темы.', reset: 'Сбросить фильтры', read: 'Читать материал' },
  uk: { kicker: 'Бібліотека DareBay', featured: 'Три маршрути для старту', start: 'Розібратися', calculate: 'Порахувати', choose: 'Вибрати', startNote: 'Як влаштована робота й де почати.', calculateNote: 'Ставка, перегляди й ваш результат.', chooseNote: 'Що перевірити перед першою роботою.', browse: 'Усі матеріали розділу', search: 'Пошук у матеріалах', placeholder: 'Назва, тема або питання…', topics: 'Виберіть тему', all: 'Усі теми', results: 'Знайдено', of: 'із', empty: 'Нічого не знайдено', emptyNote: 'Спробуйте інше слово або виберіть усі теми.', reset: 'Скинути фільтри', read: 'Читати матеріал' },
  en: { kicker: 'DareBay library', featured: 'Three ways to get started', start: 'Get started', calculate: 'Calculate', choose: 'Choose', startNote: 'Understand the work and where to begin.', calculateNote: 'Your rate, your views, your result.', chooseNote: 'What to check before your first clip.', browse: 'Explore this section', search: 'Search the guides', placeholder: 'Title, topic or question…', topics: 'Choose a topic', all: 'All topics', results: 'Showing', of: 'of', empty: 'No guides found', emptyNote: 'Try another word or select all topics.', reset: 'Clear filters', read: 'Read guide' },
  ar: { kicker: 'مكتبة DareBay', featured: 'ثلاثة مسارات للبدء', start: 'ابدأ', calculate: 'احسب', choose: 'اختر', startNote: 'افهم العمل واعرف من أين تبدأ.', calculateNote: 'السعر والمشاهدات والنتيجة.', chooseNote: 'ما يجب التحقق منه قبل أول مقطع.', browse: 'تصفّح مواد هذا القسم', search: 'البحث في الأدلة', placeholder: 'عنوان أو موضوع أو سؤال…', topics: 'اختر موضوعًا', all: 'كل المواضيع', results: 'النتائج', of: 'من', empty: 'لا توجد نتائج', emptyNote: 'جرّب كلمة أخرى أو اختر كل المواضيع.', reset: 'مسح المرشحات', read: 'اقرأ الدليل' },
} satisfies Record<Locale, Record<string, string>>

// A locale without these articles gets its complete catalog, never a featured
// route that silently changes language.
export function featuredPages<T extends { id: string }>(pages: readonly T[]): { kind: 'start' | 'calculate' | 'choose'; page: T }[] {
  const routes = [['start', 'earnings-clipper-job'], ['calculate', 'earnings-calculator'], ['choose', 'how-to-choose-clipping-platform']] as const
  const found = routes.flatMap(([kind, id]) => {
    const page = pages.find((page) => page.id === id)
    return page ? [{ kind, page }] : []
  })
  return found.length === routes.length ? found : []
}

const searchText = (value: string): string => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/ё/g, 'е')

/** The empty initial state returns every page, also during server rendering. */
export function filterCatalog<T extends Pick<HubPage, 'id' | 'title' | 'description'>>(pages: readonly T[], query = '', topic: Topic | 'all' = 'all', locale: Locale = 'en'): T[] {
  const words = searchText(query).trim().split(/\s+/).filter(Boolean)
  return pages.filter((page) => {
    const pageTopic = topicFor(page.id)
    if (topic !== 'all' && pageTopic !== topic) return false
    const text = searchText(`${page.title} ${page.description} ${TOPIC_LABELS[locale][pageTopic]}`)
    return words.every((word) => text.includes(word))
  })
}

export function groupCatalog<T extends { id: string }>(pages: readonly T[]): { topic: Topic; pages: T[] }[] {
  return TOPICS.flatMap((topic) => {
    const matches = pages.filter((page) => topicFor(page.id) === topic)
    return matches.length ? [{ topic, pages: matches }] : []
  })
}

// Words of a page id too common to say anything about its subject.
const GENERIC_ID_TOKENS = new Set(['earnings', 'brands', 'help', 'about', 'legal', 'clipping', 'clips', 'review', 'reviews', 'alternatives', 'platforms', 'darebay', 'vs', 'the', 'a', 'to', 'and', 'is'])

/** How related a candidate is to the current page: same topic (+100), then one point per shared id word. */
export function relatedScore(currentId: string, candidateId: string): number {
  const tokens = new Set(currentId.split('-').filter((token) => !GENERIC_ID_TOKENS.has(token)))
  return (topicFor(candidateId) === topicFor(currentId) ? 100 : 0) + candidateId.split('-').filter((token) => tokens.has(token)).length
}

/**
 * Every other page of the list, most relevant first. Relevance always decides. Among EQUAL
 * relevance the page recommended fewer times so far (`inbound`) goes first, and only then the
 * input order.
 */
function rankCandidates<T extends { id: string }>(pages: readonly T[], currentId: string, inbound: ReadonlyMap<string, number>): T[] {
  return pages.filter((page) => page.id !== currentId)
    .map((page, index) => ({ page, index, score: relatedScore(currentId, page.id), load: inbound.get(page.id) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.load - b.load || a.index - b.index)
    .map(({ page }) => page)
}

const plans = new WeakMap<readonly { id: string }[], Map<number, Map<string, { id: string }[]>>>()

/**
 * The related picks of EVERY page of one list (one hub in one language), decided together.
 *
 * Ranking each page alone broke ties by input order — the hub's alphabetical order — so wherever
 * several candidates were equally relevant the same first ones won on every page, and a late
 * article was recommended by nobody (/brendam/narezki-ili-reklama-chto-deshevle: zero related
 * links, only its hub). Here the pages are walked in input order and every pick is counted, so a
 * tie goes to the candidate recommended least so far. Relevance is untouched: a less relevant page
 * never displaces a more relevant one; the balance only chooses among equals.
 *
 * Deterministic: the same list gives the same plan in the SSR build and in the browser, so
 * hydration never swaps a card.
 */
export function relatedPlan<T extends { id: string }>(pages: readonly T[], max = 3): Map<string, T[]> {
  const limit = Math.max(0, max)
  const cached = plans.get(pages)?.get(limit)
  if (cached) return cached as Map<string, T[]>
  const inbound = new Map<string, number>()
  const plan = new Map<string, T[]>()
  for (const page of pages) {
    const picks = rankCandidates(pages, page.id, inbound).slice(0, limit)
    for (const pick of picks) inbound.set(pick.id, (inbound.get(pick.id) ?? 0) + 1)
    plan.set(page.id, picks)
  }
  if (!plans.has(pages)) plans.set(pages, new Map())
  plans.get(pages)!.set(limit, plan)
  return plan
}

/**
 * Same-topic articles first, then semantic overlap; ties balanced across the whole list
 * (`relatedPlan`). A page outside the list — nothing to balance it against — is ranked against
 * the finished plan's counts, so it too leans towards the pages recommended least.
 */
export function rankedRelated<T extends { id: string }>(pages: readonly T[], currentId: string, max = 3): T[] {
  const plan = relatedPlan(pages, max)
  const planned = plan.get(currentId)
  if (planned) return [...planned]
  const inbound = new Map<string, number>()
  for (const picks of plan.values()) for (const pick of picks) inbound.set(pick.id, (inbound.get(pick.id) ?? 0) + 1)
  return rankCandidates(pages, currentId, inbound).slice(0, Math.max(0, max))
}
