// Single source of truth for the two outbound links the docs site owns: the product itself
// and the Telegram channel. Imported by both the build-time config (nav CTA, footer, social
// icon) and the client theme (logo href, end-of-page CTA), so the two can't drift apart —
// which is exactly how the socials ended up pointing at accounts that aren't ours.
//
// TELEGRAM is the channel, not the bot: `@darebay_app_bot` is the mini-app entry point and
// belongs in product surfaces, not in a docs "follow us" slot.
export const HOMEPAGE = 'https://darebay.com'
export const TELEGRAM = 'https://t.me/darebay_app'
