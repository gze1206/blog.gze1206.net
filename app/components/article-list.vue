<template>
  <div v-if="articles.length">
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
  </div>
  <v-container v-else class="text-center">
    There's no articles
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

async function loadArticles ($content, fetcher, page) {
  const total = (await $content('articles').only([]).fetch()).length
  const maxPage = Math.ceil(total / ITEM_PER_PAGE)
  const newPage = Math.min(Math.max(1, page), maxPage)
  const articles = await fetcher($content, page)

  return { articles, maxPage, newPage }
}

function fetchAll ($content, page) {
  return $content('articles')
    .without(['body'])
    .sortBy('date', 'desc')
    .skip(ITEM_PER_PAGE * (page - 1))
    .limit(ITEM_PER_PAGE)
    .fetch()
}
function fetchCategory (slug) {
  return async ($content, page) => {
    const categories = (await $content('categories').fetch())?.body ?? []
    const category = categories.find(v => v.slug === slug)

    return await $content('articles')
      .without(['body'])
      .where({ category: category.name })
      .sortBy('date', 'desc')
      .skip(ITEM_PER_PAGE * (page - 1))
      .limit(ITEM_PER_PAGE)
      .fetch()
  }
}

export default {
  data () {
    return {
      articles: [],
      maxPage: 1,
      page: 1
    }
  },
  created () {
    this.fetchArticles(1)
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
      await this.fetchArticles(newPage)
    },
    async fetchArticles (page) {
      const slug = this.$route.params.slug
      const fetcher = slug ? fetchCategory(slug) : fetchAll

      const { articles, maxPage, newPage } = await loadArticles(this.$content, fetcher, page)
      this.articles = articles
      this.maxPage = maxPage
      this.page = newPage
    }
  }
}
</script>
