<template>
  <v-app dark>
    <v-main>
      <v-container>
        <Nuxt />
      </v-container>
    </v-main>
    <v-footer
      app
    >
      <span>
        created with
        <a href="https://nuxtjs.org/" target="_blank">Nuxt.js</a> by
        <a href="https://github.com/gze1206/" target="_blank">gze1206</a>,
        {{ new Date().getFullYear() }}
      </span>
    </v-footer>
  </v-app>
</template>

<script>
export default {
  data () {
    return {
      items: [
        {
          icon: 'mdi-apps',
          title: 'Welcome',
          to: '/'
        }
      ]
    }
  }
}
</script>
