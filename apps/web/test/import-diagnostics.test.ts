import { autoMap, buildRecords, idOfKey, readTable } from '@open-reloading/importers'
import { describe, expect, it } from 'vitest'
import de from '../src/i18n/de.json'
import { type Catalogue, english, translator } from '../src/i18n/translate.ts'
import { recordOf } from '../src/lib/candidates.ts'
import { tableReasonText } from '../src/lib/import-diagnostics.ts'
import { loadWarning } from '../src/lib/load-warnings.ts'

const german = translator(de as Catalogue, 'de')
const { t } = english

describe('the reasons of a table import in words', () => {
  it('words each code as the importers wrote it before they returned codes', () => {
    const cases = [
      [
        { code: 'emptyCell', params: { field: 'Name' } },
        'Name is empty. Fill the cell or delete the row.',
      ],
      [
        { code: 'notNumber', params: { field: 'Diameter', cell: 'x7', mark: '.' } },
        'Diameter "x7" is not a number with "." as decimal mark. Fix the cell or change the decimal mark of the column.',
      ],
      [
        { code: 'notAboveZero', params: { field: 'Diameter', cell: '0' } },
        'Diameter 0 is not above 0. Fix the cell or leave it empty.',
      ],
      [
        {
          code: 'outsideUsual',
          params: { field: 'Diameter', cell: '30', unit: 'mm', low: 3, high: 25, stored: 'mm' },
        },
        'Diameter 30 mm is outside the usual 3 to 25 mm. Check the unit of the column.',
      ],
      [
        {
          code: 'unitOther',
          params: { field: 'Max pressure', symbols: ['bar', 'psi', 'MPa', 'kpsi'] },
        },
        'Max pressure: the header names a unit other than bar, psi, MPa, kpsi. Choose the unit of the column.',
      ],
      [
        {
          code: 'notChoice',
          params: {
            field: 'Grain form',
            cell: 'pellet',
            choices: ['ball', 'extruded', 'flake', 'other'],
          },
        },
        'Grain form "pellet" is not one of ball, extruded, flake, other. The value is left out; change the cell to keep it.',
      ],
      [
        { code: 'noColumn', params: { fields: ['Diameter'] } },
        'No column is mapped to Diameter. Map a column to it or read the file as another kind.',
      ],
      [
        { code: 'noColumns', params: { fields: ['Name', 'Diameter', 'Mass'] } },
        'No column is mapped to Name, Diameter, Mass. Map a column to each or read the file as another kind.',
      ],
      [
        { code: 'sameBulletId', params: { first: 2, row: 3 } },
        'Rows 2 and 3 give the same name, maker, diameter and mass, so one id: only row 2 is imported. Change the name, maker, diameter or mass of row 3 to import it as a record of its own.',
      ],
    ] as const
    for (const [reason, text] of cases) expect(tableReasonText(reason, t)).toBe(text)
  })

  it('gives the repeated-id warning of a table import in German', () => {
    const read = readTable('name,maker,diameter,mass\nB1,M1,7.82,175\nB1,M1,7.82,175')
    if ('refusal' in read) throw new Error(read.refusal)
    const built = buildRecords(read.table, 'bullet', autoMap(read.table, 'bullet'))
    const reason = built.warnings[0]?.reason
    if (!reason) throw new Error('no warning')
    expect(tableReasonText(reason, german.t)).toBe(
      'Die Zeilen 2 und 3 haben denselben Namen, Hersteller, Durchmesser und dieselbe Masse und damit eine ID: Nur Zeile 2 wird importiert. Ändern Sie Name, Hersteller, Durchmesser oder Masse der Zeile 3, um sie als eigenen Datensatz zu importieren.',
    )
  })

  it('shows a field by its label and a number with the decimal mark of the language', () => {
    const reason = {
      code: 'outsideUsual',
      params: {
        field: 'Bulk density',
        cell: '1,5',
        unit: 'g/cm3',
        low: 0.4,
        high: 1.2,
        stored: 'g/cm3',
      },
    } as const
    expect(tableReasonText(reason, german.t)).toBe(
      `${german.t('Bulk density')} 1,5 g/cm3 liegt außerhalb der üblichen 0,4 bis 1,2 g/cm3. Prüfen Sie die Einheit der Spalte.`,
    )
  })
})

describe('the warnings of a load file in words', () => {
  it('words each code as the readers wrote it before they returned codes', () => {
    const cases = [
      [
        { code: 'notConverted', params: { at: 'gun.twistlen', value: '200', unit: 'in' } },
        'gun.twistlen: "200" in unit "in" is not converted; the field is not read.',
      ],
      [
        { code: 'otherFormat', params: { format: '2', expected: '1' } },
        'The file is of format "2"; the reader is written for format 1. Check every value.',
      ],
      [
        {
          code: 'chargesBeyondLimit',
          params: { at: 'appendix.Measurement', count: 2, shots: 4, max: 500 },
        },
        'appendix.Measurement: 2 charges (4 shots) of the series beyond the limit of 500 are left out.',
      ],
    ] as const
    for (const [warning, text] of cases) {
      const { message, values } = loadWarning(warning)
      expect(t(message, values)).toBe(text)
    }
  })
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
    id: idOfKey('manufacturer|m1'),
    name: 'M1',
    saved: '2026-11-07T00:00:00.000Z',
    data: { origin: 'user' },
  })
})
