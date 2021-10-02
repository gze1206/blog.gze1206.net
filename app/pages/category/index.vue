<template>
  <v-container>
    <v-card v-for="category in categories" :key="category.name" outlined :to="getURL(category)" class="ma-3 text-decoration-none">
      <v-card-title>{{ category.name }}</v-card-title>
      <v-card-text>{{ category.description }}</v-card-text>
    </v-card>
  </v-container>
</template>

<script>
export default {
  async asyncData ({ $content }) {
    const categories = (await $content('categories').fetch())?.body ?? []

    return {
      categories
    }
  },
  methods: {
    getURL (item) {
      return `/category/${item.slug}`
    }
  }
}
</script>
