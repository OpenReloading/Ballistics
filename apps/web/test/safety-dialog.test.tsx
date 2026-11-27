import { I18nProvider } from '@lingui/react'
import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { SafetyActions } from '../src/components/safety-dialog.tsx'
import { linguiOf } from '../src/i18n/lingui.ts'
import { replaceUntilStable } from './markup.ts'

/** The footer's button texts in English; a message without its English fails the test. */
function buttons(required: boolean) {
  const missing: string[] = []
  const stop = linguiOf('en').on('missing', ({ id }) => missing.push(id))
  const html = renderToStaticMarkup(
    <I18nProvider i18n={linguiOf('en')}>
      <MantineProvider>
        <SafetyActions
          required={required}
          onAccept={() => {}}
          onDecline={() => {}}
          onClose={() => {}}
        />
      </MantineProvider>
    </I18nProvider>,
  )
  stop()
  expect(missing).toEqual([])
  return [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
    replaceUntilStable(m[1] ?? '', /<[^>]+>/g),
  )
}

it('a required notice offers Decline and I accept', () => {
  expect(buttons(true)).toEqual(['Decline', 'I accept'])
})

it('a notice opened from the button offers Close only', () => {
  expect(buttons(false)).toEqual(['Close'])
})
