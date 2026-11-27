import { I18nProvider } from '@lingui/react'
import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { Home, RecordCount } from '../src/components/home.tsx'
import { linguiOf } from '../src/i18n/lingui.ts'

it('has the English of the home page without another page, counts ungrouped', () => {
  const missing: string[] = []
  const en = linguiOf('en')
  const stop = en.on('missing', ({ id }) => missing.push(id))
  const html = renderToStaticMarkup(
    <I18nProvider i18n={en}>
      <MantineProvider>
        <Home counts={{ '/cartridges': <RecordCount count={1} /> }} />
        <RecordCount count={1234} />
      </MantineProvider>
    </I18nProvider>,
  )
  stop()
  expect(missing).toEqual([])
  expect(html).toContain('1 record<')
  expect(html).toContain('1234 records')
})
