<template>
  <div>
    <div v-if="isByCategory && category" class="ma-3 mb-7">
      <h1>Category : {{ category.name }}</h1>
      <span class="text-subtitle-2">{{ category.description }}</span>
    </div>
    <div v-if="!isLoading && articles.length">
      <article-list-item v-for="article in articles" :key="article.title" :article="article" />
      <div class="text-center">
        <v-pagination
          v-model="page"
          :length="maxPage"
          :total-visible="7"
          @input="updatePage"
        />
      </div>
    </div>
    <v-container v-else-if="!isLoading" class="text-center">
      <v-icon size="72">
        mdi-alert-circle-outline
      </v-icon><br>
      There's no articles
    </v-container>
    <v-overlay :value="isLoading">
      <v-progress-circular
        indeterminate
        size="64"
      />
    </v-overlay>
  </div>
</template>

<script>
const ITEM_PER_PAGE = 10

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
      page: 1,
      category: null,
      isLoading: true
    }
  },
  computed: {
    isByCategory () {
      return this.$route.params.slug != null
    }
  },
  created () {
    this.fetchArticles(1)
  },
  methods: {
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

      if (slug) {
        const categories = (await this.$content('categories').fetch())?.body ?? []
        const category = categories.find(v => v.slug === slug)
        this.category = category
      }
      this.isLoading = false
    }
  }
}
</script>
