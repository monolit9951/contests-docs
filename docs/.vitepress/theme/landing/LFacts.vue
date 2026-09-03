<script setup lang="ts">
// The fact sheet grid: every comparable field of DareBay with its source date.
import { useData } from 'vitepress'
import { computed } from 'vue'
import { LANDING_COPY, localeOf } from './copy'
import { byId, text } from './platforms'

const FIELDS = ['rate', 'threshold', 'cap', 'fee', 'minPayout', 'payoutMethods', 'cis', 'followers', 'escrow', 'networks', 'verification']
const { lang, frontmatter } = useData()
const loc = computed(() => localeOf(lang.value))
const copy = computed(() => LANDING_COPY[loc.value])
const p = computed(() => byId((frontmatter.value.facts as { id?: string } | undefined)?.id ?? 'darebay'))
const fields = computed(() => ((frontmatter.value.facts as { fields?: string[] } | undefined)?.fields ?? FIELDS))
</script>

<template>
  <section v-if="p" class="lp-bleed lp-section" id="facts">
    <dl class="lp-facts">
      <div v-for="f in fields" :key="f" class="lp-fact">
        <dt>{{ copy.columns[f] ?? f }}</dt>
        <dd :class="{ 'lp-money': f === 'rate' }">{{ text(p, f, loc) || (p.fields[f]?.state ? copy.cis[p.fields[f].state!] : copy.notPublished) }}</dd>
        <small v-if="p.fields[f]?.source?.date">{{ copy.updated }} {{ p.fields[f].source!.date }}</small>
      </div>
    </dl>
  </section>
</template>
