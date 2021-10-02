<template>
  <v-container>
    <v-card v-for="article in articles" :key="article.title" outlined :to="getURL(article)" class="ma-3 text-decoration-none">
      <v-img v-if="article.thumbnail" alt="article thumb" :src="article.thumbnail" max-height="200px" />
      <v-card-title>{{ article.title }}</v-card-title>
      <v-card-subtitle>{{ formatPubDate(article) }} / {{ getCategory(article) }}</v-card-subtitle>
      <v-card-text>{{ getDescription(article) }}</v-card-text>
    </v-card>
    <div class="text-center">
      <v-pagination
        v-model="page"
        :length="maxPage"
        :total-visible="7"
        @input="updatePage"
      />
    </div>
  </v-container>
</template>

<script>
const ITEM_PER_PAGE = 10

function dateFormat (date) {
  const yyyy = date.getFullYear().toString()
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  const dd = date.getDate().toString().padStart(2, '0')
  const hh = date.getHours().toString().padStart(2, '0')
  const MM = date.getMinutes().toString().padStart(2, '0')

  return `${yyyy}.${mm}.${dd} ${hh}:${MM}`
}

async function loadArticles ($content, page) {
  const total = (await $content('articles').only([]).fetch()).length
  const maxPage = Math.ceil(total / ITEM_PER_PAGE)
  const articles = await $content('articles')
    .sortBy('date', 'desc')
    .skip(ITEM_PER_PAGE * (page - 1))
    .limit(ITEM_PER_PAGE)
    .fetch()
  const newPage = Math.min(Math.max(1, page), maxPage)

  return { articles, maxPage, newPage }
}

export default {
  async asyncData ({ $content, query }) {
    const page = parseInt(query.page ?? '1')
    const { articles, maxPage, newPage } = await loadArticles($content, page)

    return {
      articles,
      maxPage,
      newPage
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
    },
    async updatePage (newPage) {
      const { articles, maxPage, page } = await loadArticles(this.$content, newPage)
      this.articles = articles
      this.maxPage = maxPage
      this.page = page
    }
  }
}
</script>
