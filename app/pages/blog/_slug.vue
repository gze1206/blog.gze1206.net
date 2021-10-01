<template>
  <div class="noselect" style="min-height: 800px!important;">
    <v-parallax id="article-hero" dark :src="thumbnail" height="400">
      <v-row id="article-title" align="center" justify="center">
        <v-col cols="12" class="text-center">
          <h1 class="display-1 font-weight-bold mb-4">
            {{ article.title }}
          </h1>
        </v-col>
      </v-row>
    </v-parallax>
    <nuxt-content id="article-body" :document="article" />
  </div>
</template>

<script>
export default {
  async asyncData ({ $content, params }) {
    const article = await $content('articles', params.slug).fetch()

    return {
      article
    }
  },
  head () {
    const article = this.article

    return {
      title: article?.title,
      meta: [
        {
          hid: 'description',
          name: 'description',
          content: article?.description
        },
        // Open Graph
        {
          hid: 'og:title',
          property: 'og:title',
          content: article?.title
        },
        {
          hid: 'og:description',
          property: 'og:description',
          content: article?.description
        },
        // Twitter Card
        {
          hid: 'twitter:title',
          name: 'twitter:title',
          content: article?.title
        },
        {
          hid: 'twitter:description',
          name: 'twitter:description',
          content: article?.description
        }
      ]
    }
  },
  computed: {
    thumbnail () {
      return this.article?.thumbnail ?? '/img/hero1.jpg'
    }
  }
}
</script>

<style scoped>
#article-hero {
  left: 0;
  top: 0;
  position: absolute;
  width: 100%;
}
#article-title {
  background-color: #00000077;
}
#article-body {
  margin-top: 400px;
  padding: 2em;
  padding-top: 5em;
}
</style>
