<template>
  <div id="article-body">
    <div id="article-header">
      <div v-if="date">
        <v-icon class="mr-3">
          mdi-calendar
        </v-icon>
        {{ formattedDate }}
      </div>
    </div>
    <nuxt-content :document="article" />
    <div v-if="article.tags" id="article-tags">
      <v-chip v-for="tag in article.tags" :key="tag" outlined>
        <v-icon left>
          mdi-label
        </v-icon>
        {{ tag }}
      </v-chip>
    </div>
    <comments id="article-comments" />
    <div v-if="article.category" id="article-footer">
      <h4>
        <span>Recommend articles</span>
        <small class="text-xs ml-2">{{ article.category }} 카테고리 내 다른 글</small>
      </h4>
      <article-list-item v-for="item in relatedArticles" :key="item.slug" :article="item" />
    </div>
  </div>
</template>

<script>
import { dateFormat } from '../commons/utils'

export default {
  props: {
    article: {
      type: Object,
      default: () => null
    }
  },
  data () {
    return {
      relatedArticles: []
    }
  },
  computed: {
    date () {
      return this.article?.date ?? this.article.updatedAt
    },
    formattedDate () {
      return dateFormat(new Date(this.date))
    }
  },
  created () {
    this.fetchRelatedArticles()
  },
  methods: {
    async fetchRelatedArticles () {
      const articles = await this.$content('articles')
        .without('body')
        .where({ category: this.article.category, slug: { $ne: this.article.slug } })
        .sortBy('date', ['asc', 'desc'][Math.round(Math.random())])
        .limit(3)
        .fetch()
      this.relatedArticles = articles.filter(iter => !!iter)
    }
  }
}
</script>

<style scoped lang="scss">
#article-body {
    margin-top: 350px;
    padding: 2em;
    padding-top: 5em;
    word-break: keep-all;
}
#article-header {
    margin-bottom: 50px;

    .v-icon {
        margin-top: -0.15em;
    }
}
#article-tags {
    margin-top: 5em;
    margin-bottom: 1em;

    .v-chip {
        margin-right: 1em;
        margin-bottom: 1em;

        .v-icon {
            margin-top: -0.15em;
        }
    }
}
#article-comments {
    margin-top: 2em;
}
#article-footer {
    margin-top: 1em;
}
</style>
