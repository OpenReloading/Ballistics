import { readFileSync } from 'node:fs'
import { I18nProvider } from '@lingui/react'
import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { linguiOf } from '../src/i18n/lingui.ts'
import { fromRecord } from '../src/lib/cartridge-designer.ts'
import { draftSpec } from '../src/lib/cartridge-draft.ts'
import { drawable } from '../src/lib/cartridge-sheet.ts'
import { presetUnits } from '../src/lib/units.ts'
import { verified } from './drawing-rules.ts'
import { figureSvgs } from './figure-svgs.tsx'
import { sheetRecord } from './records.ts'

const { TechnicalDrawing } = await import('../src/components/technical-drawing.tsx')
const { CartridgeDrawing } = await import('../src/components/cartridge-drawing.tsx')

const metric = presetUnits('metric-grams')
const golden = (name: string) =>
  readFileSync(new URL(`golden/${name}.svg`, import.meta.url), 'utf8')

// read only: the golden files belong to drawing-markup.test.tsx and are never rewritten here
describe('cartridge designer, unchanged verified records', () => {
  for (const { id } of verified)
    it(`${id} draws the golden screen and print SVG of its cartridge page`, () => {
      const record = sheetRecord(id)
      const spec = { ...draftSpec(fromRecord(record, metric)), id }
      const svgs = figureSvgs(TechnicalDrawing, spec)
      expect(svgs.length).toBeGreaterThan(0)
      for (const [name, svg] of svgs) expect(svg).toBe(golden(name))
      // the whole figure as the designer renders it: captions, views and description included
      const page = (s: ReturnType<typeof drawable>) =>
        renderToStaticMarkup(
          <I18nProvider i18n={linguiOf('en')}>
            <MantineProvider>
              <CartridgeDrawing spec={s} />
            </MantineProvider>
          </I18nProvider>,
        )
      expect(page({ ...drawable(record), table: spec.table, values: spec.values })).toBe(
        page(drawable(record)),
      )
    })
})
