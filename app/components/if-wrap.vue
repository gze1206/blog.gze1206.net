<script>
export default {
  functional: true,
  props: {
    if: {
      type: [Boolean, Function],
      default: () => false
    }
  },
  render (h, ctx) {
    const children = ctx.children.filter(v => v.tag)
    if (children.length !== 1) {
      // eslint-disable-next-line no-console
      console.warn('this component accepts only one root node in its slot')
    }

    return ctx.props.if ? children[0] : children[0].children
  }
}
</script>

<style>

</style>
