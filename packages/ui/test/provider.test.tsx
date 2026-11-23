import { setupI18n } from '@lingui/core'
import { NumberInput } from '@mantine/core'
import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import { UiProvider, uiMessages } from '../src/index.ts'

const i18n = setupI18n({ locale: 'de', messages: uiMessages })

it('writes the decimal mark it is given into number inputs', () => {
  const html = renderToString(
    <UiProvider i18n={i18n} decimalMark=",">
      <NumberInput aria-label="Charge" defaultValue={1.5} />
    </UiProvider>,
  )
  expect(html).toContain('value="1,5"')
})
