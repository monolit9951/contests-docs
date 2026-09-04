<script setup lang="ts">
// Glossary grid rendered from `frontmatter.glossary` (id, term, definition);
// the same array feeds the DefinedTermSet in the page's JSON-LD (config.ts).
import { useData } from 'vitepress'
import { computed } from 'vue'
import { LANDING_COPY, localeOf } from './copy'

interface Term { id: string; term: string; definition: string }
const { frontmatter, lang } = useData()
const copy = computed(() => LANDING_COPY[localeOf(lang.value)])
const terms = computed<Term[]>(() => ((frontmatter.value.glossary as Term[] | undefined) ?? []).filter((t) => t && t.id && t.term && t.definition))
</script>

<template>
  <section v-if="terms.length" class="lp-bleed lp-section" id="glossary">
    <div class="lp-section-head"><div><span class="lp-kicker">{{ copy.glossaryTitle }} · {{ terms.length }}</span></div></div>
    <dl class="lp-glossary">
      <div v-for="t in terms" :key="t.id" :id="t.id">
        <dt><a :href="'#' + t.id">{{ t.term }}</a></dt>
        <dd>{{ t.definition }}</dd>
      </div>
    </dl>
  </section>
</template>
