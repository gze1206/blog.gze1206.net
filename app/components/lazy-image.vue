<template>
  <v-img :src="src" lazy-src="/img/hero1.jpg" :max-width="maxWidth" :max-height="maxHeight">
    <template #placeholder>
      <v-row
        class="fill-height ma-0"
        align="center"
        justify="center"
      >
        <v-progress-circular
          indeterminate
          color="grey lighten-5"
        />
      </v-row>
    </template>
  </v-img>
</template>

<script>
export default {
  props: {
    src: {
      type: String,
      default: () => null
    },
    maxWidth: {
      type: Number,
      default: () => null
    },
    maxHeight: {
      type: Number,
      default: () => null
    }
  }
}
</script>

<style>

</style>
