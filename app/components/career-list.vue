<template>
  <div>
    <v-card
      v-for="item in careers"
      :key="item.order"
      outlined
      class="my-3"
      max-width="500px"
      @click="open(item)"
    >
      <lazy-image v-if="item.cover" :src="item.cover" />
      <v-card-title>{{ item.title }}</v-card-title>
      <v-card-subtitle>{{ formatDuration(item) }}</v-card-subtitle>
      <v-card-text>
        {{ item.department }}
        <div v-if="item.project">
          {{ item.project }}
        </div>
      </v-card-text>
      <v-card-actions class="text-right">
        <v-card-text>
          More...
        </v-card-text>
      </v-card-actions>
    </v-card>

    <v-dialog v-model="dialog" scrollable max-width="1000px" @click:outside="close">
      <v-card v-if="selected">
        <lazy-image v-if="selected.cover" :src="selected.cover" />
        <v-card-title>{{ selected.title }}</v-card-title>
        <v-card-subtitle v-if="selected.korTitle" class="pb-0">
          {{ selected.korTitle }}
        </v-card-subtitle>
        <v-card-subtitle class="pt-1">
          Working period : {{ formatDuration(selected) }}
        </v-card-subtitle>
        <v-card-text style="color: inherit">
          Department : {{ selected.department }}
          <div v-if="selected.project">
            Project : {{ selected.project }}
          </div>
        </v-card-text>
        <nuxt-content id="career-body" :document="selected" />
      </v-card>
    </v-dialog>
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
  data () {
    return {
      dialog: false,
      selected: null
    }
  },
  methods: {
    formatDuration (item) {
      const from = new Date(item.from)
      const to = item.to ? new Date(item.to) : null

      return `${dateFormat(from)} ~ ${to ? dateFormat(to) : '재직 중'}`
    },
    open (item) {
      if (item == null) {
        return
      }

      this.dialog = true
      this.selected = item
    },
    close () {
      this.dialog = false
      this.selected = null
    }
  }
}
</script>

<style scoped>
.nuxt-content#career-body {
    padding: 1em;
    padding-top: 0;
    word-break: keep-all;
}
</style>
