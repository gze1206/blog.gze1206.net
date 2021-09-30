<template>
  <div class="noselect" style="min-height: 800px!important;">
    <v-parallax id="main-hero" dark src="/img/hero1.jpg" height="400">
      <v-row id="main-title" align="center" justify="center">
        <v-col cols="12" class="text-center">
          <h1 class="display-1 font-weight-bold mb-4">
            {{ mainContents.title }}
          </h1>
        </v-col>
      </v-row>
    </v-parallax>
    <nuxt-content id="main-body" :document="mainContents" />
  </div>
</template>

<script>

export default {
  async asyncData ({ $content }) {
    const mainContents = await $content('main_contents').fetch()

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
  }
}
</script>

<style scoped>
#main-hero {
  left: 0;
  top: 0;
  position: absolute;
  width: 100%;
}
#main-title {
  background-color: #00000077;
}
#main-body {
  margin-top: 400px;
  padding: 2em;
  padding-top: 5em;
}
</style>
