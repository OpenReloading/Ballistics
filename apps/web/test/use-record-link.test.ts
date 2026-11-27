import { expect, it } from 'vitest'
import { recordLoadingText } from '../src/components/use-record-link.ts'
import { linguiOf } from '../src/i18n/lingui.ts'

it('has the English of its status without a page that shows it', () => {
  const missing: string[] = []
  const stop = linguiOf('en').on('missing', ({ id }) => missing.push(id))
  linguiOf('en')._(recordLoadingText)
  stop()
  expect(missing).toEqual([])
})
