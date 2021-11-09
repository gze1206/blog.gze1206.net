<template>
  <div class="full-width article-image mt-4" :style="{ 'max-width': width, 'max-height': height }">
    <if-wrap :if="to">
      <a :href="to" target="_blank">
        <lazy-image :src="src" :max-width="width" :max-height="height" />
      </a>
    </if-wrap>
    <p v-if="text || ref" class="text-caption text-center">
      {{ text }}
      <a v-if="ref" :href="ref.link" target="_blank">
        출처 : {{ ref.label }}
      </a>
    </p>
  </div>
</template>

<script>
import ifWrap from './if-wrap.vue'
import LazyImage from './lazy-image.vue'
export default {
  components: { ifWrap, LazyImage },
  props: {
    to: {
      type: String,
      default: () => null
    },
    width: {
      type: [Number, String],
      default: () => '500px'
    },
    height: {
      type: [Number, String],
      default: () => '500px'
    },
    src: {
      type: String,
      default: () => null
    },
    text: {
      type: String,
      default: () => null
    },
    refLabel: {
      type: String,
      default: () => null
    },
    refLink: {
      type: String,
      default: () => null
    }
  },
  computed: {
    ref () {
      if (!(this.refLabel && this.refLink)) { return null }
      return {
        label: this.refLabel,
        link: this.refLink
      }
    }
  }
}
</script>

<style>

</style>
