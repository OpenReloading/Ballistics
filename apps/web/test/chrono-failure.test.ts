import { expect, it, vi } from 'vitest'
import { linguiOf } from '../src/i18n/lingui.ts'
import { english } from '../src/i18n/translate.ts'
import { chronoFailureSay } from '../src/lib/chrono-failure.ts'

const en = linguiOf('en')

it('names a file that was not read when the words of the readers do not load', async () => {
  vi.doMock('../src/lib/chrono-diagnostics.ts', () => {
    throw new Error('Failed to fetch dynamically imported module')
  })
  const say = await chronoFailureSay(new Error('velocityNotNumber'))
  expect(say(english.t, en)).toBe('The file was not read.')
})
