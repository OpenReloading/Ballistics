import { MantineProvider } from '@mantine/core'
import type { PowderFit } from '@open-reloading/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TuneNotes } from '../src/components/powder-tune.tsx'
import { exampleInterior } from '../src/lib/example-data.ts'
import { interiorBody } from '../src/lib/interior-input.ts'

const saved = 'user:0b5f7a2e-3c1d-4e8f-9a6b-2d4c8e1f7a30'
const strings = [{ charge: 0.0025, shots: [{ velocity: { value: 800 } }] }]
const { load } = interiorBody(exampleInterior)
const fitted = {
  kind: 'fit' as const,
  id: 1,
  fit: { parameters: [{ name: 'burnRate', initial: 1, value: 1.234, standardUncertainty: 0.05 }] },
  band: [],
} as unknown as { kind: 'fit'; id: number; fit: PowderFit; band: [] }

const text = (props: Parameters<typeof TuneNotes>[0]) =>
  renderToStaticMarkup(
    <MantineProvider>
      <TuneNotes {...props} />
    </MantineProvider>,
  )

describe('the notes of the tuning route', () => {
  it('asks to save an unsaved load and runs no fit', () => {
    const html = text({
      loaded: { strings, left: [], load: undefined },
      interior: undefined,
      fit: { running: false },
    })
    expect(html).toContain('Save the load to fit a powder from its strings.')
    expect(html).not.toContain('Fitted values')
  })

  it('shows the fitted values of a saved load the workbench handed over', () => {
    const html = text({
      loaded: { strings, left: [], load: saved },
      interior: load,
      fit: { fit: fitted, running: true },
    })
    expect(html).toContain(
      '<td role="cell">1/s</td><td class="num" role="cell">1.000</td><td class="num" role="cell">1.234</td><td class="num" role="cell">0.050</td>',
    )
    expect(html).toContain('Working out the pressure range')
    expect(html).not.toContain('Save the load')
  })

  it('links a saved load nothing was handed over for to the workbench, and names the strings left out', () => {
    const html = text({
      loaded: { strings, left: strings, load: saved },
      interior: undefined,
      fit: { running: false },
    })
    expect(html).toContain('Open this load in the workbench')
    expect(html).toContain('Left out, the strings of another load at 38.6 gr')
  })
})
