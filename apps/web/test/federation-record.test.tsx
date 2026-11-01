import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  FederationData,
  FederationDisciplines,
  FederationFaces,
} from '../src/components/federation-record.tsx'

const render = (node: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)

const row = { id: 'issf-10m-air-rifle', name: '10m Air Rifle', distanceM: 10, faces: 1 }

it('leaves out the Number column where no discipline has a number, and aligns the numeric heads right', () => {
  const plain = render(<FederationDisciplines rows={[row]} listHref="/disciplines" />)
  expect(plain).not.toContain('>Number</th>')
  expect(plain).toMatch(/<th[^>]*class="num"[^>]*>Distance<\/th>/)
  expect(plain).toMatch(/<th[^>]*class="num"[^>]*>Targets<\/th>/)
  expect(plain).toMatch(/<th[^>]*scope="col"[^>]*>Discipline<\/th>/)
  expect(plain).not.toMatch(/class="num"[^>]*>Discipline</)
  const numbered = render(
    <FederationDisciplines rows={[row, { ...row, id: 'b', number: '1.10' }]} listHref="/d" />,
  )
  expect(numbered).toContain('>Number</th>')
  expect(numbered.match(/<tr/g)).toHaveLength(3)
  const faces = render(
    <FederationFaces rows={[{ id: 'f', name: 'Face', uses: 2, drawing: null }]} />,
  )
  expect(faces).toMatch(/<th[^>]*class="num"[^>]*>Disciplines<\/th>/)
})

it('shows the country without the abbreviation the title chip already shows', () => {
  const html = render(<FederationData country="international" />)
  expect(html).toContain('International')
  expect(html).not.toContain('Abbreviation')
})
