import type { TableKind } from '@open-reloading/importers'
import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import { recordOf } from '../src/lib/candidates.ts'
import { parseCsrLoad } from '../src/lib/grt-load-file.ts'
import { tableReasonText } from '../src/lib/import-diagnostics.ts'
import { type BuildView, type ImportReply, importWorker } from '../src/lib/import-entry.ts'

const { t } = english

/** The build of a table file read as `kind` by the import worker: the reasons the page words, from the readers. */
async function built(lines: string[], kind: TableKind): Promise<BuildView> {
  const replies: ImportReply[] = []
  const handle = importWorker(
    { records: async () => ({ records: [], invalid: [] }), put: () => Promise.resolve() },
    (r) => replies.push(r),
  )
  const bytes = new TextEncoder().encode(lines.join('\n')).buffer as ArrayBuffer
  await handle({ type: 'read', id: 1, bytes })
  await handle({ type: 'build', id: 1, kind })
  const last = replies.at(-1)
  if (last?.type !== 'built') throw new Error(`no build: ${JSON.stringify(last)}`)
  return last.build
}

const header = 'Name,Maker,Diameter (mm),Weight (gr),BC G1'

describe('the reasons of a table import in words', () => {
  it('words the rejected rows and a warning as the importers wrote them before they returned codes', async () => {
    const b = await built(
      [
        header,
        ',Invented Arms,7.82,150,0.4',
        'B,Invented Arms,x7,150,0.4',
        'C,Invented Arms,0,150,0.4',
        'D,Invented Arms,30,150,0.4',
      ],
      'bullet',
    )
    expect(b.rejected.map((r) => tableReasonText(r.reason, t))).toEqual([
      'Name is empty. Fill the cell or delete the row.',
      'Diameter "x7" is not a number with "." as decimal mark. Fix the cell or change the decimal mark of the column.',
      'Diameter 0 is not above 0. Fix the cell or leave it empty.',
    ])
    expect(tableReasonText(b.firstWarning?.reason ?? fail(), t)).toBe(
      'Diameter 30 mm is outside the usual 3 to 25 mm. Check the unit of the column.',
    )
  })

  it('words the reasons of columns, choices and repeated rows', async () => {
    const first = async (lines: string[], kind: TableKind, which: 'rejected' | 'warning') => {
      const b = await built(lines, kind)
      const reason = which === 'rejected' ? b.rejected[0]?.reason : b.firstWarning?.reason
      return tableReasonText(reason ?? fail(), t)
    }
    expect(await first(['Name,Weight (g)', 'A,10'], 'bullet', 'rejected')).toBe(
      'No column is mapped to Diameter. Map a column to it or read the file as another kind.',
    )
    expect(await first(['Foo,Bar', 'A,10'], 'bullet', 'rejected')).toBe(
      'No column is mapped to Name, Diameter, Mass. Map a column to each or read the file as another kind.',
    )
    expect(
      await first(['Name,Case length,Max pressure (atm)', 'C0,51,4000'], 'cartridge', 'rejected'),
    ).toBe(
      'Max pressure: the header names a unit other than bar, psi, MPa, kpsi. Choose the unit of the column.',
    )
    expect(await first(['Name,Grain form', 'P2,pellet'], 'powder', 'warning')).toBe(
      'Grain form "pellet" is not one of ball, extruded, flake, other. The value is left out; change the cell to keep it.',
    )
    expect(
      await first([header, 'B1,M1,7.82,175,0.5', 'B1,M1,7.82,175,0.6'], 'bullet', 'warning'),
    ).toBe(
      'Rows 2 and 3 give the same name, maker, diameter and mass, so one id: only row 2 is imported. Change the name, maker, diameter or mass of row 3 to import it as a record of its own.',
    )
  })
})

it('words the warnings of a load file as the reader wrote them before it returned codes', () => {
  const file = [
    '<ChamberSimReloaded format="2">',
    '<load><title>T</title><appendix><Measurement>',
    '<charge name="Empty" value="0.002"><shot velocity="0"/></charge>',
    '<charge name="No%20mass" value=""><shot velocity="650"/></charge>',
    '</Measurement></appendix></load>',
    '</ChamberSimReloaded>',
  ].join('')
  const p = parseCsrLoad(file)
  if (!p.ok) throw new Error(p.reason)
  expect((p.warnings ?? []).map((w) => t(w.message, w.values))).toEqual([
    'The file is of format "2"; the reader is written for format 1. Check every value.',
    'appendix.Measurement.charge: a shot without a velocity is not read.',
    'appendix.Measurement.charge: the charge Empty holds no shot with a velocity; it is not read.',
    'appendix.Measurement.charge: the charge No mass has no mass; its string varies nothing.',
  ])
})

it('makes a record of a candidate with the id of its key and the save time', () => {
  const candidate = {
    kind: 'manufacturer',
    key: 'manufacturer|m1',
    name: 'M1',
    data: { origin: 'user' },
  } as const
  expect(recordOf(candidate, '2026-11-07T00:00:00.000Z')).toEqual({
    kind: 'manufacturer',
    id: 'fe0f962a-3cda-80e8-afe3-a44aed367288',
    name: 'M1',
    saved: '2026-11-07T00:00:00.000Z',
    data: { origin: 'user' },
  })
})

/** A failed expectation where a value is missing. */
function fail(): never {
  throw new Error('missing')
}
