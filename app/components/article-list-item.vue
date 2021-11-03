<template>
  <v-card outlined :to="getURL(article)" class="ma-3 text-decoration-none">
    <lazy-image v-if="article.thumbnail" alt="article thumb" :src="article.thumbnail" max-height="200px" />
    <v-card-title>{{ article.title }}</v-card-title>
    <v-card-subtitle>{{ formatPubDate(article) }} / {{ getCategory(article) }}</v-card-subtitle>
    <v-card-text>{{ getDescription(article) }}</v-card-text>
  </v-card>
</template>

<script>
import { dateFormat } from '../commons/utils'
import lazyImage from './lazy-image.vue'

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
