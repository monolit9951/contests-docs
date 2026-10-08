<script setup lang="ts">
import { Content, useData } from 'vitepress'
import { computed } from 'vue'
import { pagePath, PAGES } from '../../registry'
import { BROLIVO_CONTACT, BROLIVO_WEB_URLS, PUBLISHER_CONTACT, PUBLISHER_COPY, publisherLocale } from './copy'
import brolivoIcon from './brolivo.svg'
import './publisher.css'

const { lang, frontmatter } = useData()
const darebayMark = '/favicon.svg'
const locale = computed(() => publisherLocale(lang.value))
const copy = computed(() => PUBLISHER_COPY[locale.value])
const app = computed(() => frontmatter.value.publisher === 'brolivo')
const contact = computed(() => app.value ? BROLIVO_CONTACT : PUBLISHER_CONTACT)
const productsEntry = PAGES.find((entry) => entry.id === 'about-products')!
const brolivoEntry = PAGES.find((entry) => entry.id === 'about-brolivo')!
const productsHref = computed(() => pagePath(productsEntry, locale.value)!)
const brolivoHref = computed(() => pagePath(brolivoEntry, locale.value)!)
const title = computed(() => app.value ? copy.value.appTitle : copy.value.title)
const primaryHref = computed(() => BROLIVO_WEB_URLS[locale.value])
const secondaryHref = computed(() => app.value ? '#how-it-works' : brolivoHref.value)
const localeLabels = { en: 'EN', ru: 'RU', uk: 'UA' } as const
const languages = computed(() => (['en', 'ru', 'uk'] as const).map((language) => ({
  language, label: localeLabels[language], href: pagePath(app.value ? brolivoEntry : productsEntry, language)!,
})))
</script>

<template>
  <div class="lp publisher" :class="{ 'publisher--app': app }">
    <a class="publisher-skip" href="#main-content" target="_self">{{ copy.skip }}</a>
    <header class="publisher-header">
      <div class="lp-container publisher-header-inner">
        <a class="publisher-brand" :href="productsHref" aria-label="DareBay Products">
          <img class="publisher-brand-mark" :src="darebayMark" alt="" width="40" height="40">
          <span>DareBay <span class="publisher-brand-products">Products</span></span>
        </a>
        <nav class="publisher-nav" :aria-label="copy.footer">
          <a :href="app ? productsHref : '#brolivo'">{{ app ? copy.back : copy.navProduct }}</a>
          <a href="#contact">{{ copy.navContact }}</a>
        </nav>
        <nav class="publisher-languages" :aria-label="copy.languageLabel">
          <a v-for="language in languages" :key="language.language" :href="language.href"
            :lang="language.language" :aria-current="language.language === locale ? 'page' : undefined">{{ language.label }}</a>
        </nav>
      </div>
    </header>

    <main id="main-content" tabindex="-1">
      <section class="publisher-hero">
        <div class="lp-container publisher-hero-inner">
          <div class="publisher-hero-copy">
            <p class="publisher-eyebrow"><span aria-hidden="true"></span>{{ app ? copy.appEyebrow : copy.eyebrow }}</p>
            <h1><span>{{ title[0] }}</span> <span class="publisher-title-accent">{{ title[1] }}</span></h1>
            <p class="publisher-lede">{{ app ? copy.appLede : copy.lede }}</p>
            <div class="publisher-actions">
              <a class="lp-btn lp-btn-primary" :href="primaryHref">{{ app ? copy.appPrimary : copy.primary }} <span aria-hidden="true">↗</span></a>
              <a class="publisher-secondary" :href="secondaryHref">{{ app ? copy.appSecondary : copy.secondary }} <span aria-hidden="true">→</span></a>
            </div>
            <p class="publisher-availability"><span aria-hidden="true"></span>{{ copy.status }}</p>
          </div>
          <figure class="publisher-scene">
            <figcaption>{{ copy.sceneLabel }}</figcaption>
            <p class="publisher-scene-incoming">{{ copy.sceneIncoming }}</p>
            <div class="publisher-scene-reply">
              <p class="publisher-scene-brand"><img :src="brolivoIcon" alt="" width="28" height="28">Brolivo <span>{{ copy.sceneReplyLabel }}</span></p>
              <p>{{ copy.sceneReply }}</p>
            </div>
            <p class="publisher-scene-styles">{{ copy.sceneNote }}</p>
          </figure>
        </div>
      </section>

      <section v-if="!app" id="brolivo" class="publisher-catalog">
        <div class="lp-container">
          <div class="publisher-section-heading">
            <span class="publisher-eyebrow">{{ copy.catalogLabel }}</span>
            <span class="publisher-section-index" aria-hidden="true">01 / BROLIVO</span>
          </div>
          <article class="publisher-product">
            <div class="publisher-product-identity">
              <img :src="brolivoIcon" alt="" width="88" height="88">
              <div><span class="publisher-product-category">{{ copy.productCategory }}</span><h2>Brolivo</h2></div>
            </div>
            <div class="publisher-product-body">
              <h3>{{ copy.catalogTitle }}</h3>
              <p>{{ copy.productSummary }}</p>
              <ul class="publisher-tags"><li v-for="tag in copy.tags" :key="tag">{{ tag }}</li></ul>
              <div class="publisher-product-footer">
                <a class="publisher-product-link" :href="primaryHref">{{ copy.productLink }} <span aria-hidden="true">↗</span></a>
                <span class="publisher-product-status">{{ copy.status }}</span>
              </div>
            </div>
          </article>
          <p class="publisher-store-note">{{ copy.statusNote }}</p>
        </div>
      </section>
      <section v-else class="publisher-process">
        <div class="lp-container">
          <p class="publisher-eyebrow">{{ copy.processLabel }}</p>
          <ol><li v-for="(step, index) in copy.processSteps" :key="step"><span aria-hidden="true">0{{ index + 1 }}</span>{{ step }}</li></ol>
          <p class="publisher-store-note">{{ copy.statusNote }}</p>
        </div>
      </section>
      <section class="publisher-editorial">
        <div class="lp-container"><Content class="lp-content publisher-content" /></div>
      </section>
      <section id="contact" class="publisher-contact">
        <div class="lp-container publisher-contact-inner">
          <div><p class="publisher-eyebrow">{{ copy.contactLabel }}</p><h2>{{ copy.contactTitle }}</h2><p>{{ app ? copy.appContactText : copy.contactText }}</p></div>
          <a class="publisher-email" :href="'mailto:' + contact">{{ contact }} <span aria-hidden="true">↗</span></a>
        </div>
      </section>
    </main>
    <footer class="publisher-footer">
      <div class="lp-container publisher-footer-inner">
        <span>© {{ copy.copyright }}</span>
        <a href="https://darebay.com/" target="_self">{{ copy.platform }} <span aria-hidden="true">↗</span></a>
      </div>
    </footer>
  </div>
</template>
