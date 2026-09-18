// UI strings of the landing shell and components, per locale. Product facts are
// NOT here (they live in data/platforms.json with sources); only labels.
import { KNOWN_LOCALES, ROOT_LOCALE, type Locale } from '../../registry'

export interface LandingCopy {
  updated: string
  /** Label before the author's name in the hero byline. */
  byline: string
  snapshotNote: string
  keyTakeaways: string
  compareTitle: string
  compareNote: string
  /** Heading of the comparison table's first column, the one naming each platform. */
  platform: string
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
  /** The same block on a page of the brands section: a business, not a creator, reads it. */
  bizCtaTitle: string
  bizCtaLede: string
  bizCtaPrimary: string
  bizCtaSecondary: string
  columns: Record<string, string>
  cis: { yes: string; no: string; partial: string; unknown: string }
  footerHome: string
  footerTelegram: string
  related: string
  hubAll: string
  calcProTitle: string
  calcClipsPerWeek: string
  calcPerClip: string
  calcPerWeek: string
  calcPerMonth: string
  calcNet: string
  calcNetFree: string
  calcThresholdNote: string
  calcCapped: string
  calcMinPayout: string
  budgetTitle: string
  budgetBudget: string
  budgetViews: string
  budgetClips: string
  budgetCpm: string
  budgetNote: string
  glossaryTitle: string
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
    india: 'Pays in India',
    pakistan: 'Pays in Pakistan',
    bangladesh: 'Pays in Bangladesh',
    nigeria: 'Pays in Nigeria',
    kenya: 'Pays in Kenya',
    mena: 'Pays in Egypt / Arab countries',
    indonesia: 'Pays in Indonesia',
    philippines: 'Pays in the Philippines',
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
    india: 'Платит в Индию',
    pakistan: 'Платит в Пакистан',
    bangladesh: 'Платит в Бангладеш',
    nigeria: 'Платит в Нигерию',
    kenya: 'Платит в Кению',
    mena: 'Платит в Египет и арабские страны',
    indonesia: 'Платит в Индонезию',
    philippines: 'Платит на Филиппины',
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
    india: 'Платить в Індію',
    pakistan: 'Платить у Пакистан',
    bangladesh: 'Платить у Бангладеш',
    nigeria: 'Платить у Нігерію',
    kenya: 'Платить у Кенію',
    mena: 'Платить у Єгипет і арабські країни',
    indonesia: 'Платить в Індонезію',
    philippines: 'Платить на Філіппіни',
  },
  // The platform is the grammatical subject (المنصة, feminine), hence تدفع.
  ar: {
    rate: 'السعر لكل 1,000 مشاهدة',
    threshold: 'حد المشاهدات',
    cap: 'الحد الأقصى لكل مقطع',
    fee: 'العمولة عند الدفع',
    minPayout: 'الحد الأدنى للسحب',
    payoutMethods: 'طرق الدفع',
    cis: 'تدفع في روسيا ورابطة الدول المستقلة',
    followers: 'هل يلزم متابعون',
    escrow: 'الميزانية محجوزة مسبقًا',
    networks: 'المنصات المحتسبة',
    verification: 'كيف تُحتسب المشاهدات',
    india: 'تدفع في الهند',
    pakistan: 'تدفع في باكستان',
    bangladesh: 'تدفع في بنغلاديش',
    nigeria: 'تدفع في نيجيريا',
    kenya: 'تدفع في كينيا',
    mena: 'تدفع في مصر والدول العربية',
    indonesia: 'تدفع في إندونيسيا',
    philippines: 'تدفع في الفلبين',
  },
}

export const LANDING_COPY: Record<Locale, LandingCopy> = {
  en: {
    updated: 'Updated',
    byline: 'By',
    snapshotNote: 'Competitor figures are taken from each platform’s own public pages on the date shown; DareBay figures come from live platform data.',
    keyTakeaways: 'Key takeaways',
    compareTitle: 'Side by side',
    compareNote: 'Click a column to sort. A superscript number links to the source page.',
    platform: 'Platform',
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
    ctaPrimary: 'Open the tasks →',
    ctaSecondary: 'Telegram channel',
    bizCtaTitle: 'Creators make the clips and you pay per view',
    bizCtaLede: 'You set the rate, threshold and cap before launch, and the budget goes only to views on clips that cleared the threshold. Questions before you launch? Ask the founder on Telegram.',
    bizCtaPrimary: 'Discuss a launch →',
    bizCtaSecondary: 'Message the founder',
    columns: columns.en,
    cis: { yes: 'yes', no: 'no', partial: 'partly', unknown: 'not stated' },
    footerHome: 'darebay.com',
    footerTelegram: 'Telegram',
    related: 'More in this section',
    hubAll: 'All pages',
    calcProTitle: 'Clipping earnings calculator',
    calcClipsPerWeek: 'Clips per week',
    calcPerClip: 'Per clip',
    calcPerWeek: 'Per week',
    calcPerMonth: 'Per month, four weeks',
    calcNet: 'On hand after the {fee}% withdrawal fee',
    calcNetFree: 'To your wallet, no withdrawal fee',
    calcThresholdNote: 'Below the view threshold of {threshold} a clip earns nothing; once past it, every view from the first one counts.',
    calcCapped: 'at the cap',
    calcMinPayout: 'Minimum withdrawal {min} USDT',
    budgetTitle: 'Campaign budget calculator',
    budgetBudget: 'Budget, USDT',
    budgetViews: 'Paid views this budget buys',
    budgetClips: 'Clips at the cap to spend it all',
    budgetCpm: 'Cost per 1,000 views',
    budgetNote: 'Contest fee 0%: the whole budget goes to creators. Launching is free; in a wallet-backed contest the budget is locked on the platform before the start.',
    glossaryTitle: 'Terms',
  },
  ru: {
    updated: 'Обновлено',
    byline: 'Автор:',
    snapshotNote: 'Цифры площадок сняты с их публичных страниц в указанную дату; цифры DareBay берутся из живых данных платформы.',
    keyTakeaways: 'Главное',
    compareTitle: 'Площадки рядом',
    compareNote: 'Нажми на колонку, чтобы отсортировать. Цифра сверху ведёт на страницу-источник.',
    platform: 'Площадка',
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
    ctaPrimary: 'Открыть задания →',
    ctaSecondary: 'Канал в Telegram',
    bizCtaTitle: 'Ролики о продукте сделают авторы, а вы платите за просмотры',
    bizCtaLede: 'Ставку, порог и потолок на ролик вы задаёте до старта, а бюджет тратится только на просмотры роликов, которые взяли порог. Вопросы до запуска можно задать основателю в Telegram.',
    bizCtaPrimary: 'Обсудить запуск →',
    bizCtaSecondary: 'Написать основателю',
    columns: columns.ru,
    cis: { yes: 'да', no: 'нет', partial: 'частично', unknown: 'не указано' },
    footerHome: 'darebay.com',
    footerTelegram: 'Telegram',
    related: 'Ещё в этом разделе',
    hubAll: 'Все страницы',
    calcProTitle: 'Калькулятор заработка на нарезках',
    calcClipsPerWeek: 'Роликов в неделю',
    calcPerClip: 'За ролик',
    calcPerWeek: 'В неделю',
    calcPerMonth: 'В месяц, четыре недели',
    calcNet: 'На руки после комиссии вывода {fee}%',
    calcNetFree: 'На кошелёк без комиссии за вывод',
    calcThresholdNote: 'Ниже порога {threshold} просмотров ролик не оплачивается; после порога считаются все просмотры с первого.',
    calcCapped: 'упёрся в потолок',
    calcMinPayout: 'Минимальный вывод {min} USDT',
    budgetTitle: 'Калькулятор бюджета кампании',
    budgetBudget: 'Бюджет, USDT',
    budgetViews: 'Оплаченных просмотров на этот бюджет',
    budgetClips: 'Роликов на потолке, чтобы потратить всё',
    budgetCpm: 'Цена за 1000 просмотров',
    budgetNote: 'Комиссия конкурса 0%: весь бюджет уходит авторам. Запуск бесплатный; в кошельковом конкурсе бюджет заблокирован на платформе до старта.',
    glossaryTitle: 'Термины',
  },
  uk: {
    updated: 'Оновлено',
    byline: 'Автор:',
    snapshotNote: 'Цифри майданчиків зняті з їхніх публічних сторінок у вказану дату; цифри DareBay беруться з живих даних платформи.',
    keyTakeaways: 'Головне',
    compareTitle: 'Майданчики поруч',
    compareNote: 'Натисни на колонку, щоб відсортувати. Цифра зверху веде на сторінку-джерело.',
    platform: 'Майданчик',
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
    ctaPrimary: 'Відкрити завдання →',
    ctaSecondary: 'Канал у Telegram',
    bizCtaTitle: 'Ролики про продукт зроблять автори, а ви платите за перегляди',
    bizCtaLede: 'Ставку, поріг і стелю на ролик ви задаєте до старту, а бюджет іде лише на перегляди роликів, які взяли поріг. Питання до запуску можна поставити засновнику в Telegram.',
    bizCtaPrimary: 'Обговорити запуск →',
    bizCtaSecondary: 'Написати засновнику',
    columns: columns.uk,
    cis: { yes: 'так', no: 'ні', partial: 'частково', unknown: 'не вказано' },
    footerHome: 'darebay.com',
    footerTelegram: 'Telegram',
    related: 'Ще в цьому розділі',
    hubAll: 'Усі сторінки',
    calcProTitle: 'Калькулятор заробітку на нарізках',
    calcClipsPerWeek: 'Роликів на тиждень',
    calcPerClip: 'За ролик',
    calcPerWeek: 'На тиждень',
    calcPerMonth: 'На місяць, чотири тижні',
    calcNet: 'На руки після комісії виводу {fee}%',
    calcNetFree: 'На гаманець без комісії за виведення',
    calcThresholdNote: 'Нижче порога {threshold} переглядів ролик не оплачується; після порога рахуються всі перегляди з першого.',
    calcCapped: 'вперся в стелю',
    calcMinPayout: 'Мінімальний вивід {min} USDT',
    budgetTitle: 'Калькулятор бюджету кампанії',
    budgetBudget: 'Бюджет, USDT',
    budgetViews: 'Оплачених переглядів на цей бюджет',
    budgetClips: 'Роликів на стелі, щоб витратити все',
    budgetCpm: 'Ціна за 1000 переглядів',
    budgetNote: 'Комісія конкурсу 0%: увесь бюджет іде авторам. Запуск безкоштовний; у гаманцевому конкурсі бюджет заблоковано на платформі до старту.',
    glossaryTitle: 'Терміни',
  },
  // Arabic. Arrows that mean "onward" point left in a right-to-left line. The product buttons open
  // the English interface (the application has no Arabic one — `appLocaleOf` in the registry), and
  // both CTA ledes say so, so a reader is not surprised after the click. Terms: clip مقطع, view
  // مشاهدة, task مهمة, contest مسابقة, rate السعر, view threshold حد المشاهدات, cap per clip الحد
  // الأقصى لكل مقطع, withdrawal السحب; USDT, TON and Telegram stay in Latin script.
  ar: {
    updated: 'آخر تحديث',
    byline: 'بقلم',
    snapshotNote: 'أرقام المنصات الأخرى مأخوذة من صفحاتها العامة في التاريخ المذكور، وأرقام DareBay من بيانات المنصة الحية.',
    keyTakeaways: 'أهم النقاط',
    compareTitle: 'مقارنة جنبًا إلى جنب',
    compareNote: 'انقر على عمود لترتيب الجدول. الرقم الصغير المرتفع يقود إلى صفحة المصدر.',
    platform: 'المنصة',
    us: 'DareBay',
    bestFor: 'لمن تناسب',
    pros: 'نقاط القوة',
    cons: 'ما يجب الانتباه إليه',
    sources: 'المصادر',
    notPublished: 'غير معلن',
    methodTitle: 'كيف أُعدّت هذه المقارنة',
    calcTitle: 'كم يدفع مقطع واحد على DareBay',
    calcViews: 'المشاهدات المحتسبة لمقطع واحد',
    calcRate: 'السعر لكل 1,000 مشاهدة',
    calcCap: 'الحد الأقصى لكل مقطع',
    calcOut: 'المبلغ المستحق عن هذا المقطع',
    calcNote: 'المعادلة: السعر × المشاهدات ÷ 1,000، دون تجاوز الحد الأقصى. الأسعار والحدود القصوى مأخوذة من المسابقات المفتوحة حاليًا.',
    ctaTitle: 'خذ مهمة واحصل على أجر مقابل المشاهدات',
    ctaLede: 'لا حاجة إلى متابعين ولا إلى طلب انضمام. الميزانية محجوزة على المنصة قبل أن تبدأ، والمشاهدات تُحتسب بشكل مستقل. واجهة المنصة بالإنجليزية.',
    ctaPrimary: 'افتح المهام ←',
    ctaSecondary: 'قناة Telegram',
    bizCtaTitle: 'صانعو المحتوى يصنعون المقاطع وأنت تدفع مقابل المشاهدات',
    bizCtaLede: 'تحدد السعر وحد المشاهدات والحد الأقصى لكل مقطع قبل الإطلاق، ولا تُنفق الميزانية إلا على مشاهدات المقاطع التي تجاوزت الحد. لديك أسئلة قبل الإطلاق؟ اسأل المؤسس على Telegram. واجهة المنصة بالإنجليزية.',
    bizCtaPrimary: 'ناقش الإطلاق ←',
    bizCtaSecondary: 'راسل المؤسس',
    columns: columns.ar,
    cis: { yes: 'نعم', no: 'لا', partial: 'جزئيًا', unknown: 'غير مذكور' },
    footerHome: 'darebay.com',
    footerTelegram: 'Telegram',
    related: 'المزيد في هذا القسم',
    hubAll: 'كل الصفحات',
    calcProTitle: 'حاسبة الأرباح من المقاطع',
    calcClipsPerWeek: 'عدد المقاطع أسبوعيًا',
    calcPerClip: 'لكل مقطع',
    calcPerWeek: 'أسبوعيًا',
    calcPerMonth: 'شهريًا، أربعة أسابيع',
    calcNet: 'الصافي بعد عمولة السحب {fee}%',
    calcNetFree: 'إلى محفظتك دون عمولة سحب',
    calcThresholdNote: 'تحت حد {threshold} مشاهدة لا يُدفع للمقطع شيء، وبعد تجاوزه تُحتسب كل المشاهدات من الأولى.',
    calcCapped: 'بلغ الحد الأقصى',
    calcMinPayout: 'الحد الأدنى للسحب {min} USDT',
    budgetTitle: 'حاسبة ميزانية الحملة',
    budgetBudget: 'الميزانية، USDT',
    budgetViews: 'المشاهدات المدفوعة التي تشتريها هذه الميزانية',
    budgetClips: 'عدد المقاطع عند الحد الأقصى لإنفاق الميزانية كلها',
    budgetCpm: 'التكلفة لكل 1,000 مشاهدة',
    budgetNote: 'عمولة المسابقة 0%: الميزانية كلها تذهب إلى صانعي المحتوى. الإطلاق مجاني، والميزانية محجوزة على المنصة قبل البدء.',
    glossaryTitle: 'المصطلحات',
  },
}

/**
 * How the calculators group a number (`toLocaleString`), per tree. Arabic is written with Latin
 * digits: the money beside every figure is formatted `$1,000.00` whatever the page's language,
 * and the tables, the fact card and the sources this corpus quotes all use Latin digits too — a
 * calculator in Arabic-Indic digits (٥٠٬٠٠٠) would be the one place on the page that disagrees.
 */
export const NUMBER_LOCALE: Record<Locale, string> = {
  ru: 'ru-RU',
  uk: 'uk-UA',
  en: 'en-US',
  ar: 'ar-u-nu-latn',
}

/**
 * The copy locale of a VitePress `lang`: the language itself when the build knows it, the root
 * locale otherwise (the stock 404 page, rendered outside every tree).
 */
export const localeOf = (lang: string): Locale =>
  (KNOWN_LOCALES as readonly string[]).includes(lang) ? (lang as Locale) : ROOT_LOCALE.language
