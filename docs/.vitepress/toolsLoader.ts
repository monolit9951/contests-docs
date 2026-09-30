// Build-time reading of the tools catalogue (see tools.ts for the whole design), shared by the data
// loaders of each language: `tools.ru.data.ts`, `tools.en.data.ts`.
//
// A page that shows the catalogue imports the component and ITS language's loader in its own
// `<script setup>`, and passes the cards in:
//
//   <script setup>
//   import LTools from '../.vitepress/theme/landing/LTools.vue'
//   import { data as tools } from '../.vitepress/tools.ru.data'
//   </script>
//
//   <LTools :data="tools" />
//
// VitePress serialises what a loader returns into a chunk that only the pages importing it load, so
// the catalogue never reaches the theme chunk; and one loader per language keeps each page to its
// own cards (one loader for both shipped the English cards to the Russian page and back: about
// 20 KB of script each page downloaded for nothing). A malformed `data/tools.json` fails the build.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toolsView, validateToolsCatalog, type ToolLocale, type ToolsCatalog, type ToolsView } from './tools'

const FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'tools.json')

/** The catalogue of one language, checked: what `<LTools :data>` receives. */
export function loadToolsView(locale: ToolLocale): ToolsView {
  const catalog: unknown = JSON.parse(readFileSync(FILE, 'utf8'))
  const problems = validateToolsCatalog(catalog)
  if (problems.length) throw new Error(`tools: docs/.vitepress/data/tools.json\n  ${problems.join('\n  ')}`)
  const view = toolsView(catalog as ToolsCatalog)[locale]
  if (!view) throw new Error(`tools: docs/.vitepress/data/tools.json lists no tool in ${locale}`)
  return view
}
