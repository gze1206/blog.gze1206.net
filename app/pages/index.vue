<template>
  <div style="min-height: 800px!important;">
    <v-parallax id="article-hero" dark :src="thumbnail" :alt="thumbnail" height="400">
      <v-row id="article-title" align="center" justify="center">
        <v-col cols="12" class="text-center">
          <h1 class="display-1 font-weight-bold mb-4">
            {{ mainContents.title }}
          </h1>
        </v-col>
      </v-row>
    </v-parallax>
    <nuxt-content id="article-body" :document="mainContents" />
  </div>
</template>

<script>
import CareerList from '~/components/career-list'

export default {
  components: {
    // eslint-disable-next-line vue/no-unused-components
    CareerList
  },
  async asyncData ({ $content }) {
    const mainContents = await $content('main_contents').fetch()
    const careers = await $content('careers').sortBy('order', 'desc').fetch()
    mainContents.careers = careers

    return {
      mainContents
    }
  },
  head () {
    const mainContents = this.mainContents

    return {
      title: null,
      meta: [
        {
          hid: 'description',
          name: 'description',
          content: mainContents?.description
        },
        // Open Graph
        {
          hid: 'og:title',
          property: 'og:title',
          content: mainContents?.title
        },
        {
          hid: 'og:description',
          property: 'og:description',
          content: mainContents?.description
        },
        // Twitter Card
        {
          hid: 'twitter:title',
          name: 'twitter:title',
          content: mainContents?.title
        },
        {
          hid: 'twitter:description',
          name: 'twitter:description',
          content: mainContents?.description
        }
      ]
    }
  },
  computed: {
    thumbnail () {
      return this.mainContents?.thumbnail ?? '/img/hero1.jpg'
    }
  }
}
</script>

<style scoped>

</style>
