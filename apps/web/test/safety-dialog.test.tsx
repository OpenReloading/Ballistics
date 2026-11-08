import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { SafetyActions } from '../src/components/safety-dialog.tsx'

const buttons = (required: boolean) =>
  [
    ...renderToStaticMarkup(
      <MantineProvider>
        <SafetyActions
          required={required}
          onAccept={() => {}}
          onDecline={() => {}}
          onClose={() => {}}
        />
      </MantineProvider>,
    ).matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g),
  ].map((m) => m[1]?.replace(/<[^>]+>/g, ''))

it('a required notice offers Decline and I accept', () => {
  expect(buttons(true)).toEqual(['Decline', 'I accept'])
})

it('a notice opened from the button offers Close only', () => {
  expect(buttons(false)).toEqual(['Close'])
})
