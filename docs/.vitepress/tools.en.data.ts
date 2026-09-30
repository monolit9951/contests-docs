// The English tools catalogue, for the page that shows it (toolsLoader.ts).
import type { ToolsView } from './tools'
import { loadToolsView } from './toolsLoader'

declare const data: ToolsView
export { data }

export default {
  watch: ['./data/tools.json'],
  load: (): ToolsView => loadToolsView('en'),
}
