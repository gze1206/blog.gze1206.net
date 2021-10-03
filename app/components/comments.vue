<template>
  <div>
    <h5>
      <span>Comments</span>
      <small class="text-xs">Must have a Github account</small>
    </h5>
    <script
      src="https://utteranc.es/client.js"
      repo="gze1206/blog-comment"
      issue-term="pathname"
      theme="dark-blue"
      crossorigin="anonymous"
      async
    />
  </div>
</template>

<script>
export default {
}
</script>

<style>
.utterances {
  width: 100%;
  margin: 0 !important;
  max-width: 100%;
}
</style>
