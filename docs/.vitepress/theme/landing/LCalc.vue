<script setup lang="ts">
// Payout calculator for one clip on DareBay: rate × views ÷ 1000, capped.
// Inputs come from data/platforms.json (`calc` on the DareBay entry), which is
// refreshed from the baseline; nothing is typed by hand here.
import { useData } from 'vitepress'
import { computed, ref } from 'vue'
import { LANDING_COPY, localeOf } from './copy'
import { byId } from './platforms'

const { lang } = useData()
const copy = computed(() => LANDING_COPY[localeOf(lang.value)])
const calc = computed(() => (byId('darebay') as unknown as { calc?: { rateMin: number; rateMax: number; cap: number } } | undefined)?.calc ?? { rateMin: 1, rateMax: 2, cap: 100 })
const views = ref(50000)
const rate = ref(calc.value.rateMin)
const payout = computed(() => Math.min((rate.value * views.value) / 1000, calc.value.cap))
const fmt = (n: number) => n.toLocaleString(lang.value === 'en' ? 'en-US' : 'ru-RU')
const money = (n: number) => '$' + n.toFixed(2)
</script>

<template>
  <section class="lp-bleed lp-section" id="calculator">
    <div class="lp-section-head"><div><span class="lp-kicker">{{ copy.calcTitle }}</span></div></div>
    <div class="lp-calc">
      <div>
        <label for="lp-views">{{ copy.calcViews }}: <span class="lp-calc-val lp-num">{{ fmt(views) }}</span></label>
        <input id="lp-views" type="range" min="2000" max="500000" step="1000" v-model.number="views" />
        <label for="lp-rate">{{ copy.calcRate }}: <span class="lp-calc-val lp-money">{{ money(rate) }}</span></label>
        <input id="lp-rate" type="range" :min="calc.rateMin" :max="calc.rateMax" step="0.25" v-model.number="rate" />
        <label>{{ copy.calcCap }}: <span class="lp-calc-val lp-money">{{ money(calc.cap) }}</span></label>
      </div>
      <div class="lp-calc-out">
        <div class="lp-kicker">{{ copy.calcOut }}</div>
        <div class="lp-big">{{ money(payout) }}</div>
        <p>{{ copy.calcNote }}</p>
      </div>
    </div>
  </section>
</template>
