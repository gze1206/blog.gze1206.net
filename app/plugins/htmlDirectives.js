const visit = require('unist-util-visit')
const h = require('hastscript')

module.exports = function () {
  return function transformer (tree, file) {
    visit(
      tree,
      ['textDirective', 'leafDirective', 'containerDirective'],
      ondirective
    )
    function ondirective (node) {
      const data = node.data || (node.data = {})
      const hast = h(node.name, node.attributes)

      data.hName = hast.tagName
      data.hProperties = hast.properties
    }
  }
}
