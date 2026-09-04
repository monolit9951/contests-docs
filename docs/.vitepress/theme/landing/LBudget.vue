<script setup lang="ts">
// Brand-side budget calculator: what a budget buys at a given rate, and how many
// clips at the cap it takes to spend it. Rates and caps come from the same
// data file as the creator calculator.
import { useData } from 'vitepress'
import { computed, ref } from 'vue'
import { LANDING_COPY, localeOf } from './copy'
import { byId } from './platforms'

interface Calc { rateMin: number; rateMax: number; cap: number }
const { lang } = useData()
const copy = computed(() => LANDING_COPY[localeOf(lang.value)])
const calc = computed<Calc>(() => ({ rateMin: 1, rateMax: 2, cap: 100, ...((byId('darebay') as unknown as { calc?: Partial<Calc> } | undefined)?.calc ?? {}) }))
const budget = ref(1000)
const rate = ref(calc.value.rateMin)
const cap = ref(calc.value.cap)
const views = computed(() => Math.floor((budget.value / rate.value) * 1000))
const clipsAtCap = computed(() => Math.ceil(budget.value / cap.value))
const numLocale = computed(() => (lang.value === 'en' ? 'en-US' : lang.value === 'uk' ? 'uk-UA' : 'ru-RU'))
const fmt = (n: number) => n.toLocaleString(numLocale.value)
const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
</script>

<template>
  <section class="lp-bleed lp-section" id="budget">
    <div class="lp-section-head"><div><span class="lp-kicker">{{ copy.budgetTitle }}</span></div></div>
    <div class="lp-calc">
      <div>
        <label for="lpb-budget">{{ copy.budgetBudget }}: <span class="lp-calc-val lp-num">{{ fmt(budget) }}</span></label>
        <input id="lpb-budget" type="range" min="100" max="20000" step="50" v-model.number="budget" />
        <label for="lpb-rate">{{ copy.calcRate }}: <span class="lp-calc-val lp-money">{{ money(rate) }}</span></label>
        <input id="lpb-rate" type="range" :min="calc.rateMin" :max="Math.max(calc.rateMax, 5)" step="0.25" v-model.number="rate" />
        <label for="lpb-cap">{{ copy.calcCap }}: <span class="lp-calc-val lp-money">{{ money(cap) }}</span></label>
        <input id="lpb-cap" type="range" min="10" max="500" step="10" v-model.number="cap" />
      </div>
      <div class="lp-calc-out">
        <div class="lp-kicker">{{ copy.budgetViews }}</div>
        <div class="lp-big lp-num">{{ fmt(views) }}</div>
        <div class="lp-calc-rows">
          <div><span class="lp-kicker">{{ copy.budgetClips }}</span><b>{{ fmt(clipsAtCap) }}</b></div>
          <div><span class="lp-kicker">{{ copy.budgetCpm }}</span><b>{{ money(rate) }}</b></div>
        </div>
        <p>{{ copy.budgetNote }}</p>
      </div>
    </div>
  </section>
</template>
