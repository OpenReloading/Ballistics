import type { I18n } from '@lingui/core'

/** A type check that `tsc -p test` runs and nothing calls: an id outside ui's English catalog fails it (spike S4). */
export const unknownId = (i18n: I18n): string =>
  // @ts-expect-error: ui's English catalog holds no such id
  i18n._({ id: 'ui.frame.unknown', message: 'Unknown' })
