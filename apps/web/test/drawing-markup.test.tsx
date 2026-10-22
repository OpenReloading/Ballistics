import { describe, expect, it, vi } from 'vitest'
import { drawable } from '../src/lib/cartridge-sheet.ts'
import { verified } from './drawing-rules.ts'
import { figureSvgs } from './figure-svgs.tsx'
import { sheetRecord } from './records.ts'

// next/font is compiled by Next; here the drawing font class is a fixed name
vi.mock('next/font/local', () => ({ default: () => ({ variable: 'drawing-font', className: '' }) }))
const { TechnicalDrawing } = await import('../src/components/technical-drawing.tsx')

/** 20 sample figures (every drawn table and its extremes), 284 Win. and 11,5 x 51. */
const samples = [
  'cip-308-win-2008-09-23',
  'cip-458-socom-2021-11-09',
  'cip-400-legend-2023-11-08',
  'cip-9-x-39-2018-05-16',
  'cip-30-30-win-2002-05-15',
  'cip-6-5-x-58-r-2002-05-15',
  'cip-8-x-51-r-lebel-2015-05-19',
  'cip-7-x-67-r-luyven-2006-05-16',
  'cip-308-norma-mag-2016-10-18',
  'cip-300-weath-mag-2002-05-15',
  'cip-9-mm-luger-2008-09-23',
  'cip-454-casull-2015-05-19',
  'cip-7-62-nagant-2000-06-07',
  'cip-22-long-rifle-2024-05-14',
  'cip-6mm-me-flobert-court-2006-05-24',
  'cip-22-long-shot-2000-06-07',
  'cip-9-c-f-mori-2006-09-19',
  'cip-4-mm-randz-court-blanc-1992-06-10',
  'cip-35-r-gr-1994-03-01',
  'cip-18-x-81-2000-06-07',
  'cip-284-win-2005-05-25',
  'cip-11-5-x-51-2009-05-05',
]
/** And the verified records, every figure. */
const specs = [...new Set([...samples, ...verified.map((r) => r.id)])]

describe('drawing markup', () => {
  for (const id of specs)
    it(`${id} screen and print, every figure`, async () => {
      for (const [name, svg] of figureSvgs(TechnicalDrawing, drawable(sheetRecord(id))))
        await expect(svg).toMatchFileSnapshot(`golden/${name}.svg`)
    })
})
