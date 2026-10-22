import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ChronoDropZone } from '../src/components/chrono-drop-zone.tsx'

const html = (node: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)

it('the box drop zone names its hint as the description and says where the file is read', () => {
  const box = html(
    <ChronoDropZone id="f" label="Files" variant="box" multiple onFiles={() => {}} />,
  )
  expect(box).toContain('aria-describedby="f-hint"')
  expect(box).toContain('id="f-hint"')
  expect(box).toContain('Drop files here or click to choose. Read in this browser, not uploaded.')
  expect(box).toContain(' multiple=""')
  expect(html(<ChronoDropZone id="f" label="File" variant="box" onFiles={() => {}} />)).toContain(
    'Drop a file here or click to choose. Read in this browser, not uploaded.',
  )
})

it('the bar drop zone keeps its hint short and describes the input by the hidden help', () => {
  const bar = html(
    <ChronoDropZone id="f" label="File" variant="bar" help="The help." onFiles={() => {}} />,
  )
  expect(bar).toContain('aria-describedby="f-help"')
  expect(bar).toContain('<span id="f-help" class="visually-hidden">The help.</span>')
  expect(bar).toContain('<span class="drop-zone-hint">Drop a file here or click to choose</span>')
  expect(bar).not.toContain('f-hint')
  expect(bar).not.toContain(' multiple=""')
})
