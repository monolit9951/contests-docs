import { appPathFor, type Locale } from './registry'

// Single source of truth for the outbound links the docs site owns: the product itself, the
// business page, the Telegram channel and the founder's own Telegram. The product has one explicit
// route per locale. Keeping the route here — instead of scattering bare `https://darebay.com` links
// through the theme — prevents a reader from being thrown back into Russian when they leave an
// EN/UK article.
//
// Which application tree a docs locale leads into is the registry's call (`appPathFor`): the same
// language where the application has it, English where it does not — an Arabic article's buttons
// open the English interface. The addresses below are that one rule applied, not a table per
// language that could say otherwise.
//
// TELEGRAM is the channel, not the bot: `@darebay_app_bot` is the mini-app entry point and belongs
// in product surfaces, not in a docs "follow us" slot.
export const HOMEPAGE = 'https://darebay.com'
export const TELEGRAM = 'https://t.me/darebay_app'
/** The founder's personal Telegram: the contact a brand is sent to, and `Person.sameAs`. */
export const FOUNDER_TELEGRAM = 'https://t.me/ruslanbwork'

/** Product homepage in the application tree of the current content page. */
export const productUrlForLocale = (locale: Locale): string => `${HOMEPAGE}${appPathFor(locale, '')}`

// The open-task catalogue. Every page of this corpus answers a question about earning on DareBay,
// and the reader who finished it wants the list of tasks, not the landing that sells the platform
// again. Measured 11.09: 63% of search visitors reached the app through the homepage anyway; the
// button now skips that hop.

/** Open-task catalogue in the application tree of the current content page. */
export const tasksUrlForLocale = (locale: Locale): string => `${HOMEPAGE}${appPathFor(locale, 'tasks')}`

// The brands section answers a business deciding whether to fund a task. Its reader has no use
// for the creators' catalogue: from 11.09 to 13.09 the only buttons on those pages led there, and
// the page that explains the launch and reaches the founder sat in a text link.

/** The business page in the application tree of the current content page. */
export const businessUrlForLocale = (locale: Locale): string => `${HOMEPAGE}${appPathFor(locale, 'for-business')}`
