<template>
  <div>
    <v-card v-for="item in careers" :key="item.order" outlined class="my-3" max-width="500px">
      <lazy-image v-if="item.cover" :src="item.cover" />
      <v-card-title>{{ item.title }}</v-card-title>
      <v-card-subtitle>{{ formatDuration(item) }}</v-card-subtitle>
      <v-card-text>
        {{ item.department }}
        <div v-if="item.project">
          {{ item.project }}
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script>
import LazyImage from './lazy-image.vue'

function dateFormat (date) {
  const yyyy = date.getFullYear().toString()
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')

  return `${yyyy}.${mm}`
}

export default {
  components: { LazyImage },
  props: {
    careers: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    formatDuration (item) {
      const from = new Date(item.from)
      const to = item.to ? new Date(item.to) : null

      return `${dateFormat(from)} ~ ${to ? dateFormat(to) : '재직 중'}`
    }
  }
}
</script>

<style>

</style>
