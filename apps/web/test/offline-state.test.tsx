import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { NotFoundState, OfflineState } from '../src/components/offline-state.tsx'

// Retry reloading the page is not checked here (no DOM)
it('the offline state has a title below the page h1, Retry and links to the pages kept on the device', () => {
  const html = renderToStaticMarkup(
    <MantineProvider>
      <OfflineState
        links={[
          { href: '/workbench', label: 'Load workbench' },
          { href: '/firearms', label: 'Firearms' },
        ]}
      />
    </MantineProvider>,
  )
  expect(html).toContain('Not available offline')
  expect(html).not.toMatch(/<h1/)
  expect(html).toMatch(/<button[^>]*>.*Retry/)
  expect(html).toContain('aria-label="Pages kept on this device"')
  expect(html.match(/href="\/(workbench|firearms)"/g)).toEqual([
    'href="/workbench"',
    'href="/firearms"',
  ])
})

it('the not-found state offers Search and links every page given', () => {
  const html = renderToStaticMarkup(
    <MantineProvider>
      <NotFoundState
        links={[
          { href: '/workbench', label: 'Load workbench' },
          { href: '/cartridges', label: 'Cartridges' },
        ]}
      />
    </MantineProvider>,
  )
  expect(html).toContain('This page could not be found.')
  expect(html).toMatch(/<button[^>]*>.*Search/)
  expect(html.match(/href="\/(workbench|cartridges)"/g)).toEqual([
    'href="/workbench"',
    'href="/cartridges"',
  ])
})
