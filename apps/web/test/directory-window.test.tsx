import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DirectoryTable } from '../src/components/directory-table.tsx'

const render = (count: number) =>
  renderToStaticMarkup(
    <MantineProvider>
      <DirectoryTable<{ id: string }>
        rows={Array.from({ length: count }, (_, i) => ({ id: `r${i}` }))}
        columns={[{ key: 'name', label: 'Name', cell: (r) => r.id }]}
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

const rowElements = (html: string) => html.match(/<tr[^>]*data-row/g)?.length ?? 0

it('the table holds a bounded number of row elements however many rows it is given', () => {
  const small = rowElements(render(200))
  const large = rowElements(render(5000))
  expect(large).toBe(small)
  expect(large).toBeLessThan(100)
})

it('the rows left out are one hidden spacer and the row count still names them all', () => {
  const html = render(5000)
  expect(html.match(/<tr aria-hidden="true" style="height:\d+px"/g)).toHaveLength(1)
  expect(html).toContain('aria-rowcount="5001"')
  expect(html).toContain('aria-rowindex="2"')
  expect(html).not.toContain('aria-rowindex="5002"')
})
