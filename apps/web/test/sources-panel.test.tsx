import { MantineProvider } from '@mantine/core'
import type { Source } from '@openreloading/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { Sources, SourceTitles } from '../src/components/sources.tsx'
import { dayText } from '../src/lib/dates.ts'

const hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const sheet: Source = {
  title: 'Data sheet 2026',
  publisher: 'Example Bullets Inc.',
  url: 'https://example.com/sheet.pdf',
  license: 'LicenseRef-example-data',
  retrieved: '2026-05-01',
  sha256: hash,
}

const render = (source: Source) =>
  renderToStaticMarkup(
    <MantineProvider>
      <Sources provenance={{ kind: 'published', sources: [source], note: 'Checked by hand.' }} />
    </MantineProvider>,
  )

it('shows the title linked, the publisher, the edition, the retrieval day, the license and the terms, linked when they are a URL', () => {
  const linked = render({ ...sheet, edition: 'Stand 2026', terms: 'https://example.com/terms' })
  expect(linked).toContain('<a href="https://example.com/sheet.pdf">Data sheet 2026</a>')
  expect(linked).toContain('<span>Example Bullets Inc.</span><span>Stand 2026</span>')
  expect(linked).toContain('<time dateTime="2026-05-01">1 May 2026</time>')
  expect(linked).toContain('>LicenseRef-example-data</td>')
  expect(linked).toContain('<a href="https://example.com/terms">Terms</a>')
  expect(linked).toContain('Checked by hand.')
  expect(render({ ...sheet, terms: 'written permission, 2026-11-02' })).toContain(
    'Terms: written permission, 2026-11-02',
  )
})

it('shows 12 digits of the hash, copies the full hash and keeps the rest in the text for print', () => {
  expect(render(sheet)).toContain(
    `<code>0123456789ab<span class="hash-rest">${hash.slice(12)}</span></code>`,
  )
  expect(render(sheet)).toContain(`aria-label="Copy hash ${hash}"`)
})

it('lists the titles in the compact form, separated by semicolons', () => {
  const html = renderToStaticMarkup(
    <SourceTitles sources={[sheet, { title: 'Manual', page: '12' }]} />,
  )
  expect(html).toBe(
    '<span><a href="https://example.com/sheet.pdf">Data sheet 2026</a></span><span>; Manual, page 12</span>',
  )
})

it('writes a day as day, month name and year, the same in every time zone', () => {
  const tz = process.env.TZ
  process.env.TZ = 'America/Los_Angeles'
  try {
    expect(dayText('2026-05-01')).toBe('1 May 2026')
    expect(dayText('2025-12-31')).toBe('31 December 2025')
  } finally {
    if (tz === undefined) delete process.env.TZ
    else process.env.TZ = tz
  }
  expect(dayText('2026-13-40')).toBe('2026-13-40')
  expect(dayText('May 2026')).toBe('May 2026')
})

it('is a table of source, retrieval day, license and the fields it covers, a column no source fills left out', () => {
  const html = render({ ...sheet, origin: 'manufacturer', fields: ['diameter', 'mass'] })
  expect(html).toMatch(
    /Source<\/th><th[^>]*>Origin<\/th><th[^>]*>Retrieved<\/th><th[^>]*>License<\/th><th[^>]*>Covers<\/th><\/tr>/,
  )
  expect(html).toContain('2 fields')
  expect(html).toContain('diameter, mass')
  expect(render(sheet)).not.toContain('Origin')
  expect(render(sheet)).not.toContain('Covers')
  const both = renderToStaticMarkup(
    <MantineProvider>
      <Sources
        provenance={{ kind: 'published', sources: [sheet, { title: 'Manual', fields: ['mass'] }] }}
      />
    </MantineProvider>,
  )
  expect(both).toContain('>Covers</th>')
  expect(both).toContain('whole record')
  expect(both).toContain('1 field')
})

// below 48em the cells are blocks: WebKit keeps the table semantics only with explicit roles
it('gives every table element of the sources its ARIA role', () => {
  const tags = [...render(sheet).matchAll(/<(table|thead|tbody|tr|th|td)\b([^>]*)>/g)]
  expect(tags.length).toBeGreaterThan(6)
  for (const [tag, , attrs] of tags) expect(attrs, tag).toMatch(/ role="[a-z]+"/)
  expect(render(sheet)).toContain('scope="row" role="rowheader"')
})
