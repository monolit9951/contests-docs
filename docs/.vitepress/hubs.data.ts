// Build-time data loader: the pages of every hub, with their own titles and
// descriptions, derived from the registry and from the frontmatter on disk.
//
// WHY IT IS GENERATED. Each hub index used to carry a hand-written "Страницы
// раздела" list. The lists were already stale before this migration — the
// earnings hub named five of its articles and the fleet had shipped ten — and a
// migration that reshuffles pages between hubs would have rotted them
// completely. Internal linking is the cheapest ranking asset we have and the
// one most easily lost to drift, so it stops being something a human maintains:
// a page that exists in the registry is linked from its hub, always.
//
// Titles and descriptions come from the pages themselves rather than being
// restated here, so the hub can never advertise a page as something it no
// longer is.

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PAGES, HUBS, LOCALES, pagePath, sourceFile, localesOf, type HubId, type Locale } from './registry'

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..')

export interface HubPage {
    readonly id: string
    readonly path: string
    readonly title: string
    readonly description: string
}

/** hub id -> language -> pages. Keyed by language because a hub lists what
 *  exists IN THAT language: the Ukrainian earnings hub listing Russian articles
 *  is how a reader gets thrown out of their own tree by the page that was
 *  supposed to keep them in it. */
export type HubData = Record<string, Record<string, HubPage[]>>

// Frontmatter is read with a narrow regex rather than a YAML parser: these are
// files the content fleet writes to a fixed template (`content-conventions`
// enforces `title` and `description` on line 2 and 3), and pulling in a parser
// for two scalar fields would be the more fragile choice, not the safer one.
const field = (raw: string, name: string): string => {
    const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : ''
}

declare const data: HubData
export { data }

export default {
    // Rebuild the hub lists when any page's frontmatter changes, not just when
    // the registry does — otherwise a retitled article keeps its old label on
    // the hub until someone touches this file.
    watch: ['../**/*.md'],
    load(): HubData {
        const out: HubData = {}

        for (const hubId of Object.keys(HUBS) as HubId[]) {
            out[hubId] = {}
            for (const locale of LOCALES) {
                const lang = locale.language
                const pages: HubPage[] = []
                for (const entry of PAGES) {
                    if (entry.hub !== hubId) continue
                    if (!localesOf(entry).includes(lang)) continue
                    // The hub index is not an item of its own list.
                    if (entry.slugs[lang] === '') continue

                    const file = join(DOCS, sourceFile(entry, lang)!)
                    if (!existsSync(file)) {
                        throw new Error(`hubs.data: ${entry.id} declares ${sourceFile(entry, lang)}, which does not exist`)
                    }
                    const raw = readFileSync(file, 'utf8')
                    pages.push({
                        id: entry.id,
                        path: pagePath(entry, lang)!,
                        title: field(raw, 'title') || entry.id,
                        description: field(raw, 'description'),
                    })
                }
                // Alphabetical by title: any order beats none, and an explicit
                // ordering field would be one more thing to keep in sync for a
                // list whose whole point is that nobody maintains it.
                out[hubId][lang] = pages.sort((a, b) => a.title.localeCompare(b.title, lang))
            }
        }
        return out
    },
}
