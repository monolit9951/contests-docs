<script setup lang="ts">
// "How this comparison was built": the page's own methodology text plus the
// full list of source pages with the date each number was taken.
import { useData } from 'vitepress'
import { computed } from 'vue'
import { LANDING_COPY, localeOf } from './copy'
import { pick, sourcesOf, DATA } from './platforms'

const { frontmatter, lang } = useData()
const copy = computed(() => LANDING_COPY[localeOf(lang.value)])
const paragraphs = computed(() => (frontmatter.value.method ?? []) as string[])
const ids = computed(() => ((frontmatter.value.compare ?? {}) as { ids?: string[] }).ids ?? [])
const sources = computed(() => pick(ids.value).flatMap((p) => sourcesOf(p).map((s) => ({ name: p.name, ...s }))))
</script>

<template>
  <section class="lp-bleed lp-section" id="method">
    <div class="lp-section-head"><div><span class="lp-kicker">{{ copy.methodTitle }}</span></div></div>
    <div class="lp-method">
      <div>
        <p v-for="(t, i) in paragraphs" :key="i">{{ t }}</p>
        <p class="lp-muted" style="font-size:13px">{{ copy.snapshotNote }} {{ copy.updated }}: <time :datetime="DATA.snapshot">{{ DATA.snapshot }}</time>.</p>
      </div>
      <div>
        <span class="lp-kicker" style="display:block;margin-bottom:10px">{{ copy.sources }}</span>
        <ul>
          <li v-for="s in sources" :key="s.name + s.url"><span><b style="color:var(--lp-text)">{{ s.name }}</b> · <a :href="s.url" target="_blank" rel="nofollow noopener">{{ s.url.replace(/^https?:\/\/(www\.)?/, '') }}</a></span><time :datetime="s.date">{{ s.date }}</time></li>
        </ul>
      </div>
    </div>
  </section>
</template>
