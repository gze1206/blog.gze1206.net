function dateFormat (date, format = 'yyyy.mm.dd hh:MM (tz)') {
  const yyyy = date.getFullYear().toString()
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  const dd = date.getDate().toString().padStart(2, '0')
  const hh = date.getHours().toString().padStart(2, '0')
  const MM = date.getMinutes().toString().padStart(2, '0')
  const tz = 'KST'

  return format
    .replaceAll('yyyy', yyyy)
    .replaceAll('mm', mm)
    .replaceAll('dd', dd)
    .replaceAll('hh', hh)
    .replaceAll('MM', MM)
    .replaceAll('tz', tz)
}

export {
  dateFormat
}
