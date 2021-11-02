/* eslint-disable no-undef */
const slugControl = createClass({
  getInitialState () {
    return { touched: false }
  },

  handleChange (e) {
    this.props.onChange(e.target.value)
    this.state.touched = true
  },

  render () {
    return h('input', {
      id: this.props.forID,
      className: this.props.classNameWrapper,
      type: 'text',
      value: this.state.touched ? this.props.value : this.props.entry.get('slug'),
      onChange: this.handleChange
    })
  }
})

const slugPreview = createClass({
  render () {
    return null
  }
})

const schema = {
  properties: {}
}

CMS.registerWidget('slug', slugControl, slugPreview, schema)
