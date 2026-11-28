export function interior() {
  throw Object.assign(new TypeError('bad argument'), { code: 'ERR_INVALID_ARG_TYPE' })
}
