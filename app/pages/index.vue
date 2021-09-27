<template>
  <div class="noselect" style="min-height: 3000px!important;">
    <v-parallax id="main-hero" dark src="/img/hero1.jpg" height="400">
      <v-row align="center" justify="center">
        <v-col cols="12" class="text-center">
          <h1 class="display-1 font-weight-bold mb-4">
            {{ title }}
          </h1>
        </v-col>
      </v-row>
    </v-parallax>
  </div>
</template>

<script>

export default {
  data () {
    return {
      title: 'blog.gze1206.net'
    }
  }
}
</script>

<style scoped>
#main-hero {
  left: 0;
  top: 0;
  position: absolute;
  width: 100%;
  background-color: #00000077;
}
</style>
