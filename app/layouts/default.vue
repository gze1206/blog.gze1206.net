<template>
  <v-app dark class="noselect">
    <v-app-bar id="main-appbar" fixed app>
      <nuxt-link to="/">
        <v-img src="/icon.png" class="mx-2" max-height="40" max-width="40" contain />
      </nuxt-link>
      <v-spacer />
      <v-btn
        v-for="menu in menus"
        :key="menu.to"
        plain
        class="route-btn"
        active-class="active-route"
        :to="menu.to"
        :exact="menu.exact"
        v-text="menu.text"
      />
    </v-app-bar>
    <v-main>
      <v-container>
        <Nuxt />
      </v-container>
    </v-main>
    <v-footer>
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
      title: 'blog.gze1206.net',
      menus: [
        { text: 'categories', to: '/category', exact: false },
        { text: 'blog', to: '/blog', exact: true }
      ]
    }
  }
}
</script>

<style scoped>
#main-appbar {
  background-color: rgba(0,0,0,0.6);
}
</style>
