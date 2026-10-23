import { MantineProvider } from '@mantine/core'
import { chargeLadder, interior } from '@openreloading/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { fractionSpec, LotPanel, lotNote } from '../src/components/lot-rows.tsx'
import { type Outcome, type Step, shownSteps } from '../src/components/workbench-outcome.ts'
import { LadderTable } from '../src/components/workbench-readouts.tsx'
import type { InteriorResponse } from '../src/lib/api-types.ts'
import { exampleInterior, exampleRecords, loadExample } from '../src/lib/example-data.ts'
import { exampleFields } from '../src/lib/examples.ts'
import { siValues } from '../src/lib/field-spec.ts'
import { interiorBody, interiorFields } from '../src/lib/interior-input.ts'
import { lotChartDescription, lotFractionError, lotLoad } from '../src/lib/lot-rows.ts'
import { presetUnits } from '../src/lib/units.ts'

const system = presetUnits('us')
const { load } = interiorBody(
  siValues(exampleFields(interiorFields, exampleInterior, system)),
  exampleRecords.cartridge.id,
)
const { steps: count, step, direction } = loadExample.ladder
const charges = chargeLadder(load.charge, step, count, direction)

/** A step of the run at `charge`, its answer shaped as the API's from the model's own run. */
const stepAt = (l: typeof load, charge: number): Step => {
  const run = interior({ ...l, charge })
  if (run.valid === false) throw new Error(run.reason)
  const body = {
    result: run,
    pressureRange: { nominalPressure: run.peakBreechPressure },
    limits: [],
    warnings: [],
  } as unknown as InteriorResponse
  return { charge, body }
}

const nominal = charges.map((c) => stepAt(load, c))
const ok = {
  kind: 'ok',
  body: nominal[0].body,
  load,
  steps: nominal,
  selected: 0,
  direction,
  ladder: { kind: 'charge' },
} as unknown as Extract<Outcome, { kind: 'ok' }>

const table = (withLot: boolean, failed?: number) => {
  const steps = shownSteps(ok)
  const lotSteps = (lot: 'low' | 'high') =>
    shownSteps({
      ...ok,
      steps: charges.map((c, i) =>
        i === failed
          ? { charge: c, error: { message: 'no valid run' } }
          : stepAt(lotLoad(load, lot, 0.03), c),
      ),
    })
  return renderToStaticMarkup(
    <MantineProvider>
      <LadderTable
        ok={ok}
        steps={steps}
        system={system}
        value={(s) => String(s.charge)}
        velocity={(r) => `${r.muzzleVelocity}`}
        lot={
          withLot
            ? { fraction: 0.03, steps: { low: lotSteps('low'), high: lotSteps('high') } }
            : undefined
        }
      />
    </MantineProvider>,
  )
}

const cells = (html: string, label: string) =>
  [...html.matchAll(new RegExp(`<td data-label="${label}"[^>]*>([^<]*)<`, 'g'))].map((m) => m[1])
const headers = (html: string) =>
  [...html.matchAll(/<th scope="col" role="columnheader">([^<]*)<\/th>/g)].map((m) => m[1])

it('shows three rows per charge, slower lot, nominal, faster lot, in a table of the nominal rows without them', () => {
  const html = table(true)
  expect(cells(html, 'Burn rate')).toEqual(charges.flatMap(() => ['−3 %', 'nominal', '+3 %']))
  expect(headers(html)).toEqual(expect.arrayContaining(['Burn rate', 'Barrel time']))
  expect(cells(html, 'Barrel time')).toHaveLength(count * 3)
  // only the nominal rows are the steps of the run
  expect(html.match(/aria-current="true"/g)).toHaveLength(1)
  const plain = table(false)
  expect(headers(plain)).not.toContain('Burn rate')
  expect(headers(plain)).not.toContain('Barrel time')
  expect(cells(plain, 'Step')).toHaveLength(count)
})

it('labels each cell of a row with a column header, a failed lot row spanning the rest', () => {
  const html = table(true, 1)
  const labels = new Set([...headers(html), 'Result'])
  const used = [...html.matchAll(/data-label="([^"]*)"/g)].map((m) => m[1])
  expect(used.filter((l) => !labels.has(l))).toEqual([])
  const span = headers(html).length - 3 - 1
  expect(html.match(new RegExp(`colSpan="${span}"`, 'g'))).toHaveLength(2)
})

it('states no charge as safe or optimal in the table, the fields, the notes or the chart text', () => {
  const lot = {
    applies: true,
    percent: { text: '3', si: 0.03 },
    setPercent: () => {},
    target: '',
    setTarget: () => {},
    pending: false,
    retry: () => {},
  }
  const panel = renderToStaticMarkup(
    <MantineProvider>
      <LotPanel lot={lot} system={system} />
    </MantineProvider>,
  )
  const texts = [
    table(true),
    panel,
    lotNote,
    fractionSpec.help,
    lotChartDescription(0.03, true),
    lotFractionError(0),
    lotFractionError(1),
  ]
  for (const text of texts) expect(text).not.toMatch(/\b(safe|safely|optimal|best|ideal|node)\b/i)
  expect(lotNote).toMatch(/computed value of the simulation/)
})
