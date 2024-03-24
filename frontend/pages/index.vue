<template>
  <div>
    <nuxt-welcome/>
    <div class="grid grid-cols-2 h-screen">
      <textarea v-model="post.body" class="w-full p-4" />
      <MDC :value="post.body" v-slot="{ data, body }">
        <article class="p-4 prose">
          <MDCRenderer v-if="body" :body="body" :data="data" :prose="false" />
        </article>
      </MDC>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      post: { body: '' }
    }
  },
  async mounted() {
    const res = await axios.get('http://localhost:5870/post');
    this.post = {
      slug: res.data.slug,
      title: res.data.title,
      body: res.data.markdown,
      createdAt: res.data.createdAt, 
      updatedAt: res.data.updatedAt,
    };
  },
}
</script>

<style scoped>

</style>