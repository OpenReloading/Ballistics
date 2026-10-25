import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DirectoryTable } from '../src/components/directory-table.tsx'
import { PanelTable, ScrollRegion } from '../src/components/scroll-region.tsx'

// the server HTML is a region and a tab stop: a box that overflows before hydration is reachable by
// keyboard (axe scrollable-region-focusable); the observer drops both once the content fits
it('a scroll region starts as a named region and a tab stop', () => {
  const html = renderToStaticMarkup(
    <ScrollRegion label="Values">
      <table />
    </ScrollRegion>,
  )
  expect(html).toContain('<div class="scroll" role="region" aria-label="Values" tabindex="0">')
})

it('a directory table box is a named region and its first row link the one tab stop', () => {
  const html = renderToStaticMarkup(
    <MantineProvider>
      <DirectoryTable<{ id: string }>
        rows={[{ id: 'a' }, { id: 'b' }]}
        columns={[
          { key: 'name', label: 'Name', cell: (r) => r.id },
          {
            key: 'note',
            label: 'Note',
            cell: (r, tabIndex) => (
              <button type="button" tabIndex={tabIndex}>
                {r.id}
              </button>
            ),
          },
        ]}
        link="name"
        href={(r) => `/x/${r.id}`}
        facts={() => ''}
        label={(r) => r.id}
        caption="All rows"
        noun="rows"
        sort={undefined}
        onSort={() => {}}
        empty={null}
      />
    </MantineProvider>,
  )
  expect(html).toContain(
    '<div class="directory-scroll page-panel page-panel-flush" role="region" aria-label="All rows">',
  )
  const tabindexOf = (tag: string, text: string) =>
    new RegExp(`<${tag}[^>]*tabindex="(-?\\d)"[^>]*>(?:<[^>]*>)*${text}<`).exec(html)?.[1]
  expect(tabindexOf('a', 'a')).toBe('0')
  expect(tabindexOf('button', 'a')).toBe('-1')
  expect(tabindexOf('a', 'b')).toBe('-1')
  expect(tabindexOf('button', 'b')).toBe('-1')
})

it('a panel table gives every table element its ARIA role, header cells by scope and place', () => {
  const html = renderToStaticMarkup(
    <PanelTable label="Limits" caption="Limits" columns={['Limit', 'Value']}>
      <tr>
        <th scope="row">Pmax</th>
        <td>380</td>
      </tr>
    </PanelTable>,
  )
  expect(html).toContain('<table role="table"><caption>Limits</caption><thead role="rowgroup">')
  expect(html).toContain('<th scope="col" role="columnheader">Limit</th>')
  expect(html).toContain(
    '<tbody role="rowgroup"><tr role="row"><th scope="row" role="rowheader">Pmax</th><td role="cell">380</td></tr>',
  )
})
