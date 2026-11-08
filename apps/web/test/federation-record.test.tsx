import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { FederationData, FederationDisciplines } from '../src/components/federation-record.tsx'

const render = (node: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)

const row = { id: 'issf-10m-air-rifle', name: '10m Air Rifle', distanceM: 10, faces: 1 }

it('leaves out the Number column where no discipline has a number', () => {
  const plain = render(<FederationDisciplines rows={[row]} listHref="/disciplines" />)
  expect(plain).not.toContain('>Number</th>')
  const numbered = render(
    <FederationDisciplines rows={[row, { ...row, id: 'b', number: '1.10' }]} listHref="/d" />,
  )
  expect(numbered).toContain('>Number</th>')
  expect(numbered.match(/<tr/g)).toHaveLength(3)
})

it('shows the country without the abbreviation the title chip already shows', () => {
  const html = render(<FederationData country="international" />)
  expect(html).toContain('International')
  expect(html).not.toContain('Abbreviation')
})
