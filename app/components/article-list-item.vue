<template>
  <v-card outlined :to="getURL(article)" class="ma-3 text-decoration-none">
    <lazy-image v-if="article.thumbnail" alt="article thumb" :src="article.thumbnail" max-height="200px" />
    <v-card-title>{{ article.title }}</v-card-title>
    <v-card-subtitle>{{ formatPubDate(article) }} / {{ getCategory(article) }}</v-card-subtitle>
    <v-card-text>{{ getDescription(article) }}</v-card-text>
  </v-card>
</template>

<script>
import lazyImage from './lazy-image.vue'

function dateFormat (date) {
  const yyyy = date.getFullYear().toString()
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  const dd = date.getDate().toString().padStart(2, '0')
  const hh = date.getHours().toString().padStart(2, '0')
  const MM = date.getMinutes().toString().padStart(2, '0')

  return `${yyyy}.${mm}.${dd} ${hh}:${MM}`
}

export default {
  components: {
    lazyImage
  },
  props: {
    article: {
      type: Object,
      default: () => null
    }
  },
  methods: {
    formatPubDate (item) {
      return dateFormat(new Date(item.date))
    },
    getCategory (item) {
      return item.category ?? 'ETC'
    },
    getDescription (item) {
      return item.description
    },
    getURL (item) {
      return `/blog/${item.slug}`
    }
  }
}
</script>

<style>

</style>
