// What the showcase blocks of a hub index share: a button named by a CTA key, a tile or step link
// named by a key or by a page of this site, the CTA band's defaults per section, and the one
// client-side correction every registration button needs. Pure, apart from the click listener at
// the end; `showcase.test.ts` holds it.
import { ctaAnchor, isCtaKey, localizedSitePath, type CtaKey, type SourceAnchor } from '../../links'
import type { Locale } from '../../registry'
import type { LandingCopy } from './copy'

/** A button a page asks for in its frontmatter: the destination by key, and optionally its label. */
export interface CtaSpec {
  readonly to: CtaKey
  readonly label?: string
}

/** A link ready to render: its visible label and the attributes of the `<a>`. */
export interface LinkButton {
  readonly label: string
  readonly anchor: SourceAnchor
}

/** A key's own label when the page gives none. `tasks`, `business` and `founder` keep the texts the CTA band always printed for them. */
export const ctaLabel = (copy: LandingCopy, key: CtaKey): string =>
  key === 'tasks' ? copy.ctaPrimary : key === 'business' ? copy.bizCtaPrimary : key === 'founder' ? copy.bizCtaSecondary : copy.actions[key]

export const ctaButton = (spec: CtaSpec, locale: Locale, copy: LandingCopy): LinkButton => ({
  label: spec.label?.trim() || ctaLabel(copy, spec.to),
  anchor: ctaAnchor(spec.to, locale),
})

/**
 * A hero button: a CTA key, or a jump to a block of the same page (`href: "#tools"`, the catalogue
 * of the tools landing). The dist gate `anchor-target` fails the build on a jump to no block.
 */
export const heroAction = (
  action: { readonly to?: unknown; readonly href?: unknown; readonly label?: unknown },
  locale: Locale,
  copy: LandingCopy,
): LinkButton | null => {
  const label = typeof action.label === 'string' ? action.label : undefined
  if (isCtaKey(action.to)) return ctaButton({ to: action.to, label }, locale, copy)
  if (typeof action.href === 'string' && action.href.startsWith('#') && label) return { label, anchor: { href: action.href } }
  return null
}

/**
 * The link of a feature tile or a flow step: a CTA key (`to`) or a page of this site (`href`, moved
 * into the reader's language when that page has a version there), or none. The build refuses an
 * `href` that is not a page of the registry (`landingFrontmatter.ts`), so nothing here can print a
 * dead address.
 */
export const itemLink = (
  item: { readonly to?: unknown; readonly href?: unknown; readonly label?: unknown },
  locale: Locale,
  copy: LandingCopy,
): LinkButton | null => {
  const label = typeof item.label === 'string' ? item.label : undefined
  if (isCtaKey(item.to)) return ctaButton({ to: item.to, label }, locale, copy)
  if (typeof item.href === 'string' && item.href) return { label: label?.trim() || copy.more, anchor: { href: localizedSitePath(item.href, locale).href } }
  return null
}

/**
 * Where a page lists its section's catalogue (HubIndex): above the Markdown on a plain section
 * index (`top`), inside the Markdown where a showcase index places `<LCatalog />` (`inline`), after
 * the Markdown on a showcase index that does not place it (`after`), nowhere on an article. Exactly
 * one of these renders it, so a section is listed once (dist gate `hub-directory`).
 */
export type CatalogPlacement = 'top' | 'inline' | 'after' | null

export const catalogPlacement = (frontmatter: { readonly isHub?: unknown; readonly showcase?: unknown; readonly catalogInline?: unknown }): CatalogPlacement =>
  !frontmatter.isHub ? null : frontmatter.showcase !== true ? 'top' : frontmatter.catalogInline === true ? 'inline' : 'after'

/**
 * The two buttons of a section's CTA band when its page names none (`cta.primary`, `cta.secondary`).
 * Brands send a business to its page and to the founder. Creator sections open the full task
 * catalogue first: the reader chooses a task before the application asks them to register.
 * The content-farm section also offers setup help; tools keep the community room.
 */
export const HUB_CTA: Readonly<Record<string, readonly [CtaKey, CtaKey]>> = {
  brands: ['business', 'founder'],
  farm: ['tasks', 'founder'],
  tools: ['tasks', 'community'],
}

/** Creator acquisition sections, using the hub IDs supplied by the content registry. */
export const isCreatorSection = (hub: string): boolean =>
  hub === 'earnings' || hub === 'farm' || hub === 'tools' || hub === 'about'

/**
 * The stages of a long list after which the page's call to action interrupts it (LTools.vue): every
 * third one, never the last, which the page's closing band follows anyway. On a phone the tools
 * catalogue ran 28 screens without a way into DareBay (review 2026-09-30).
 */
export const ctaAfterStages = (stages: readonly string[]): ReadonlySet<string> =>
  new Set(stages.filter((_, index) => index % 3 === 2 && index < stages.length - 1))

/**
 * The CTA band's two buttons (LCta.vue): the keys the page names (`cta.primary`, `cta.secondary`),
 * else its section's pair (`HUB_CTA`), else the task catalogue and `null` for the second, which
 * the band fills with the community room the site's chrome names for the page's language.
 */
export const bandButtons = (
  hub: string,
  cta: { readonly primary?: CtaSpec; readonly secondary?: CtaSpec },
  locale: Locale,
  copy: LandingCopy,
): readonly [LinkButton, LinkButton | null] => {
  const pair = HUB_CTA[hub]
  const second = cta.secondary ?? (pair ? { to: pair[1] } : null)
  return [ctaButton(cta.primary ?? { to: pair?.[0] ?? 'tasks' }, locale, copy), second ? ctaButton(second, locale, copy) : null]
}

// `?auth=signup` opens the application's registration dialog, and the application opens it for a
// visitor who is signed in too (contests-frontend `authModal.tsx` never looks at the session;
// verified 2026-09-29): a returning reader who pressed «Начать на DareBay» got «Создайте аккаунт»
// over the catalogue, `auth_signup_started` counted a registration nobody began, and a second
// e-mail made a second account. The docs share the application's origin and so its storage: when
// this browser holds a DareBay session, the button opens the catalogue itself. Without JavaScript,
// or with storage blocked, the link stays as the server rendered it.

/** Where the application keeps its session token (contests-frontend `authToken.ts`, `TOKEN_STORAGE_KEY`). */
export const SESSION_STORAGE_KEY = 'userToken'

/** A registration link without its dialog: the page it opens over. Any other address as it was. */
export const withoutSignup = (href: string): string => href.replace(/\?auth=signup(?=#|$)/, '')

let returningLinksInstalled = false

/** Rewrites a registration link at the moment it is followed, for a visitor who is signed in here. */
export const installReturningVisitorLinks = (): void => {
  if (returningLinksInstalled || typeof document === 'undefined') return
  returningLinksInstalled = true
  document.addEventListener(
    'click',
    (event) => {
      const link = (event.target as Element | null)?.closest?.('a[href*="?auth=signup"]') as HTMLAnchorElement | null
      if (!link) return
      let signedIn = false
      try {
        signedIn = Boolean(window.localStorage.getItem(SESSION_STORAGE_KEY))
      } catch {
        // Storage blocked: keep the registration link.
      }
      if (signedIn) link.href = withoutSignup(link.href)
    },
    true,
  )
}
