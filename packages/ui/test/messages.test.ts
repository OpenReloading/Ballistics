import { setupI18n } from '@lingui/core'
import { expect, it } from 'vitest'

it('types its message ids from the compiled source catalog, so an id it lacks fails tsc', () => {
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } })
  // @ts-expect-error: ui's English catalog holds no such id
  expect(typeof i18n._({ id: 'frame.unknown', message: 'Unknown' })).toBe('string')
})
