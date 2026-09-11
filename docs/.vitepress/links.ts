import type { Locale } from './registry'

// Single source of truth for the outbound links the docs site owns: the product itself
// and the Telegram channel. The product has one explicit route per locale. Keeping the
// route here — instead of scattering bare `https://darebay.com` links through the theme —
// prevents a reader from being thrown back into Russian when they leave an EN/UK article.
//
// TELEGRAM is the channel, not the bot: `@darebay_app_bot` is the mini-app entry point and
// belongs in product surfaces, not in a docs "follow us" slot.
export const HOMEPAGE = 'https://darebay.com'
export const TELEGRAM = 'https://t.me/darebay_app'

const PRODUCT_PATH: Record<Locale, string> = {
  ru: '/',
  uk: '/ua',
  en: '/en',
}

/** Product homepage in the same language as the current content page. */
export const productUrlForLocale = (locale: Locale): string => `${HOMEPAGE}${PRODUCT_PATH[locale]}`

// The open-task catalogue, one route per locale. Every page of this corpus answers a question
// about earning on DareBay, and the reader who finished it wants the list of tasks, not the
// landing that sells the platform again. Measured 11.09: 63% of search visitors reached the
// app through the homepage anyway; the button now skips that hop.
const TASKS_PATH: Record<Locale, string> = {
  ru: '/tasks',
  uk: '/ua/tasks',
  en: '/en/tasks',
}

/** Open-task catalogue in the same language as the current content page. */
export const tasksUrlForLocale = (locale: Locale): string => `${HOMEPAGE}${TASKS_PATH[locale]}`
