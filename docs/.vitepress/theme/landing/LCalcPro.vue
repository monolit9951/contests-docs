<script setup lang="ts">
// Monthly earnings calculator: views per clip × clips per week × rate, with the
// threshold, the cap per clip and the withdrawal fee applied. Every number comes
// from data/platforms.json (`calc` on the DareBay entry), refreshed from the
// baseline; nothing product-specific is typed here.
import { useData } from 'vitepress'
import { computed, ref } from 'vue'
import { LANDING_COPY, localeOf } from './copy'
import { byId } from './platforms'

interface Calc { rateMin: number; rateMax: number; cap: number; threshold: number; fee: number; minPayout: number }
const { lang } = useData()
const copy = computed(() => LANDING_COPY[localeOf(lang.value)])
const calc = computed<Calc>(() => ({ rateMin: 1, rateMax: 2, cap: 100, threshold: 2000, fee: 10, minPayout: 10, ...((byId('darebay') as unknown as { calc?: Partial<Calc> } | undefined)?.calc ?? {}) }))
const views = ref(20000)
const clips = ref(5)
const rate = ref(calc.value.rateMin)
const perClipRaw = computed(() => (views.value < calc.value.threshold ? 0 : (rate.value * views.value) / 1000))
const capped = computed(() => perClipRaw.value > calc.value.cap)
const perClip = computed(() => Math.min(perClipRaw.value, calc.value.cap))
const perWeek = computed(() => perClip.value * clips.value)
const perMonth = computed(() => perWeek.value * 4)
const net = computed(() => perMonth.value * (1 - calc.value.fee / 100))
const numLocale = computed(() => (lang.value === 'en' ? 'en-US' : lang.value === 'uk' ? 'uk-UA' : 'ru-RU'))
const fmt = (n: number) => n.toLocaleString(numLocale.value)
const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (m, k) => String(values[k] ?? m))
</script>

<template>
  <section class="lp-bleed lp-section" id="calculator">
    <div class="lp-section-head"><div><span class="lp-kicker">{{ copy.calcProTitle }}</span></div></div>
    <div class="lp-calc">
      <div>
        <label for="lpp-views">{{ copy.calcViews }}: <span class="lp-calc-val lp-num">{{ fmt(views) }}</span></label>
        <input id="lpp-views" type="range" min="1000" max="500000" step="1000" v-model.number="views" />
        <label for="lpp-clips">{{ copy.calcClipsPerWeek }}: <span class="lp-calc-val lp-num">{{ clips }}</span></label>
        <input id="lpp-clips" type="range" min="1" max="30" step="1" v-model.number="clips" />
        <label for="lpp-rate">{{ copy.calcRate }}: <span class="lp-calc-val lp-money">{{ money(rate) }}</span></label>
        <input id="lpp-rate" type="range" :min="calc.rateMin" :max="calc.rateMax" step="0.25" v-model.number="rate" />
        <label>{{ copy.calcCap }}: <span class="lp-calc-val lp-money">{{ money(calc.cap) }}</span></label>
        <p class="lp-calc-net">{{ fill(copy.calcThresholdNote, { threshold: fmt(calc.threshold) }) }}</p>
      </div>
      <div class="lp-calc-out">
        <div class="lp-kicker">{{ copy.calcPerMonth }}</div>
        <div class="lp-big">{{ money(perMonth) }}</div>
        <div class="lp-calc-rows">
          <div><span class="lp-kicker">{{ copy.calcPerClip }}</span><b>{{ money(perClip) }}</b><span v-if="capped" class="lp-calc-badge">{{ copy.calcCapped }}</span></div>
          <div><span class="lp-kicker">{{ copy.calcPerWeek }}</span><b>{{ money(perWeek) }}</b></div>
        </div>
        <p class="lp-calc-net">{{ fill(copy.calcNet, { fee: calc.fee }) }}: <b>{{ money(net) }}</b>. {{ fill(copy.calcMinPayout, { min: calc.minPayout }) }}.</p>
        <p>{{ copy.calcNote }}</p>
      </div>
    </div>
  </section>
</template>
