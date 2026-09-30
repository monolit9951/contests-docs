<script setup lang="ts">
// The tools catalogue (see tools.ts). The PAGE imports this component and the catalogue in its own
// script setup block and passes the catalogue of its language as the one prop (toolsLoader.ts shows
// the snippet): `<LTools :data="tools" />`. Both land in chunks only that page loads, never in the
// theme chunk every page downloads; the build refuses a page that uses the tag without both imports
// or with another language's catalogue (`sourceProblems` in landingFrontmatter.ts).
//
// No `vitepress` import in this file, on purpose: a page chunk that imports `vitepress` makes Rollup
// split VitePress's client module from its `Content` component across chunks, a circular chunk
// order it warns about ("will likely lead to broken execution order"). The language comes with the
// catalogue (`data.locale`), the block's heading from the page's frontmatter (`$frontmatter.tools`,
// which VitePress gives every component). `showcase.test.ts` holds the file to that.
//
// Everything is in the server's HTML: every group, every card, and a row of chips that jump to the
// groups. Once the page hydrates, the chips become filters (`aria-pressed`) and the search field is
// switched on; the count of shown cards is a live region. Nothing depends on JavaScript: without it
// the chips stay links and every card stays on the page.
//
// A card is short enough to scan on a phone (tools.ts, "How a card reads"): the free tier and how
// to pay open from the card's own `<details>`, which needs no JavaScript and keeps the text in the
// HTML. DareBay's own tools are one panel of rows above the stages, each with its icon. After every
// third stage (not after the last) the page's own call to action (`tools.cta`) interrupts the list:
// on a phone the Russian catalogue ran 28 screens without a way into DareBay (review 2026-09-30).
import { computed, getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import type { CtaKey } from '../../links'
import type { ToolCard, ToolsView } from '../../tools'
import { searchText } from '../catalog'
import { LANDING_COPY } from './copy'
import { ctaAfterStages, ctaButton, ctaLabel } from './showcase'
import { TOOLS_COPY } from './toolsCopy'

interface Head { title?: string; lede?: string; ownTitle?: string; ownLede?: string; cta?: { text: string; to: CtaKey; label?: string } }

const props = defineProps<{ data: ToolsView }>()
const t = computed(() => TOOLS_COPY[props.data.locale])
// The block's copy, from the page's frontmatter (`tools:`), through the `$frontmatter` VitePress
// gives every component.
const page = getCurrentInstance()?.proxy as { $frontmatter?: { tools?: Head } } | null | undefined
const head = computed<Head>(() => page?.$frontmatter?.tools ?? {})

const OWN = 'darebay'
const groups = computed(() => [
  ...(props.data.own.length ? [{ id: OWN, label: head.value.ownTitle ?? t.value.own, lede: head.value.ownLede, tools: props.data.own }] : []),
  ...props.data.groups,
])
const total = computed(() => groups.value.reduce((sum, group) => sum + group.tools.length, 0))

const enhanced = ref(false)
const query = ref('')
const active = ref('all')
const search = ref<HTMLInputElement | null>(null)
// The reset button disappears with the empty state it belongs to; the focus goes to the search
// field the reader was typing in, not to the top of the document.
const reset = () => {
  query.value = ''
  active.value = 'all'
  void nextTick(() => search.value?.focus())
}
// Each chip is a toggle: pressing the pressed one lets it go, back to every card.
const choose = (id: string) => { active.value = active.value === id ? 'all' : id }
onMounted(() => { enhanced.value = true })

const matches = (tool: ToolCard, words: string[]) => {
  const text = searchText(`${tool.name} ${tool.what} ${tool.stage ?? ''}`)
  return words.every((word) => text.includes(word))
}
const shownGroups = computed(() => {
  const words = searchText(query.value).trim().split(/\s+/).filter(Boolean)
  return groups.value
    .filter((group) => active.value === 'all' || active.value === group.id)
    .map((group) => ({ ...group, tools: words.length ? group.tools.filter((tool) => matches(tool, words)) : group.tools }))
    .filter((group) => group.tools.length)
})
const shown = computed(() => shownGroups.value.reduce((sum, group) => sum + group.tools.length, 0))
const asOf = (date: string) => t.value.asOf.replace('{date}', () => date)
// A DareBay card's button says where it goes (its CTA key's label); a third-party card opens the site.
const siteLabel = (tool: ToolCard) => (tool.to ? ctaLabel(LANDING_COPY[props.data.locale], tool.to) : tool.own ? t.value.open : t.value.site)
// The page's call to action after every third stage shown (DareBay's own panel not counted), never
// after the last one: the page's closing band follows the catalogue.
const cta = computed(() => {
  const spec = head.value.cta
  if (!spec) return null
  const after = ctaAfterStages(shownGroups.value.filter((group) => group.id !== OWN).map((group) => group.id))
  return after.size ? { after, text: spec.text, ...ctaButton(spec, props.data.locale, LANDING_COPY[props.data.locale]) } : null
})
</script>

<template>
  <section id="tools" class="lp-bleed lp-section lp-tools" aria-labelledby="tools-title">
    <div class="lp-section-head">
      <div>
        <h2 id="tools-title" class="lp-h2">{{ head.title ?? t.nav }}</h2>
        <p v-if="head.lede">{{ head.lede }}</p>
      </div>
    </div>
    <div class="lp-tools-bar">
      <!-- The same chips before and after hydration, so the row does not move: links to the groups
           from the server (a navigation), filters once the page runs (a group of toggles). -->
      <div v-if="enhanced" role="group" :aria-label="t.nav">
        <ul class="lp-tchips">
          <li><button type="button" class="lp-tchip" :aria-pressed="active === 'all'" @click="active = 'all'">{{ t.all }} <span>{{ total }}</span></button></li>
          <li v-for="group in groups" :key="group.id"><button type="button" class="lp-tchip" :aria-pressed="active === group.id" @click="choose(group.id)">{{ group.label }} <span>{{ group.tools.length }}</span></button></li>
        </ul>
      </div>
      <nav v-else :aria-label="t.nav">
        <ul class="lp-tchips">
          <li><a class="lp-tchip" href="#tools-results">{{ t.all }} <span>{{ total }}</span></a></li>
          <li v-for="group in groups" :key="group.id"><a class="lp-tchip" :href="`#tools-${group.id}`">{{ group.label }} <span>{{ group.tools.length }}</span></a></li>
        </ul>
      </nav>
      <label class="lp-tsearch">
        <span class="lp-sr">{{ t.search }}</span>
        <input ref="search" v-model="query" type="search" :disabled="!enhanced" :placeholder="t.placeholder" autocomplete="off" aria-controls="tools-results" />
      </label>
      <p class="lp-tstat" role="status" aria-live="polite" aria-atomic="true">{{ t.shown }} <b>{{ shown }}</b> {{ t.of }} {{ total }}</p>
    </div>
    <div id="tools-results" class="lp-tresults">
      <template v-for="group in shownGroups" :key="group.id">
        <section :id="`tools-${group.id}`" class="lp-tgroup" :class="{ 'lp-tgroup--own': group.id === OWN }" :aria-labelledby="`tools-${group.id}-title`">
          <h3 :id="`tools-${group.id}-title`">{{ group.label }}</h3>
          <p v-if="group.lede">{{ group.lede }}</p>
          <div class="lp-tgrid">
            <article v-for="tool in group.tools" :key="tool.id" class="lp-tool">
              <div class="lp-tool-h">
                <i v-if="tool.icon" class="lp-mono" aria-hidden="true" v-html="tool.icon"></i>
                <i v-else class="lp-mono" aria-hidden="true">{{ tool.mono }}</i>
                <div class="lp-tool-t"><h4>{{ tool.name }}</h4><em v-if="tool.stage">{{ tool.stage }}</em></div>
                <b v-if="tool.badge" class="lp-tool-badge">{{ tool.badge }}</b>
              </div>
              <p>{{ tool.what }}</p>
              <!-- DareBay's own price in the colour of its money, and where it works, on one line. -->
              <p v-if="tool.own" class="lp-tool-meta"><b class="lp-money">{{ tool.price }}</b> · {{ tool.access }}</p>
              <template v-else>
                <!-- Another service's price in plain type, so no price of the comparison reads as
                     highlighted (landing-tools-spec §6), with the day it was read on its own page. -->
                <p v-if="tool.pay || !tool.badge" class="lp-tool-price"><span v-if="tool.pay" class="lp-pay">{{ t.pay[tool.pay] }}</span><template v-if="tool.pay && !tool.badge">{{ ' ' }}</template><template v-if="!tool.badge">{{ tool.price }}<template v-if="tool.asOf">{{ ' ' }}<a class="lp-tsrc" :href="tool.asOf.href" rel="nofollow noopener" target="_blank">{{ asOf(tool.asOf.date) }}</a></template></template></p>
                <details class="lp-tool-more">
                  <summary>{{ t.more }}</summary>
                  <dl>
                    <div v-if="tool.badge"><dt>{{ t.price }}<template v-if="tool.asOf">{{ ' ' }}<a class="lp-tsrc" :href="tool.asOf.href" rel="nofollow noopener" target="_blank">{{ asOf(tool.asOf.date) }}</a></template></dt><dd>{{ tool.price }}</dd></div>
                    <div v-if="tool.free"><dt>{{ t.free }}</dt><dd>{{ tool.free }}</dd></div>
                    <div><dt>{{ t.access }}</dt><dd>{{ tool.access }}</dd></div>
                  </dl>
                </details>
              </template>
              <p class="lp-tool-a"><a v-if="tool.review" class="lp-review" :href="tool.review">{{ t.compared }}</a>{{ ' ' }}<a v-bind="tool.site">{{ siteLabel(tool) }}</a></p>
            </article>
          </div>
        </section>
        <div v-if="cta && cta.after.has(group.id)" class="lp-tools-cta">
          <p>{{ cta.text }}</p>
          <a class="lp-btn lp-btn-primary" v-bind="cta.anchor">{{ cta.label }}</a>
        </div>
      </template>
      <div v-if="!shown" class="lp-tempty"><p>{{ t.empty }}</p><button type="button" class="lp-tchip" @click="reset">{{ t.reset }}</button></div>
    </div>
  </section>
</template>
