'use client'

import type { Bullet } from '@open-reloading/schema'
import { msg } from '../i18n/translate.ts'
import { compareFrom } from '../lib/compare-ids.ts'
import { countryOf } from '../lib/countries.ts'
import {
  fetchManufacturerNames,
  type ManufacturerNames,
  productLabel,
} from '../lib/manufacturers.ts'
import { workbenchHref } from '../lib/query.ts'
import { ballisticCoefficientRows, bulletDataGroups, bulletStrip } from '../lib/record-fields.ts'
import { type Wording, worded } from '../lib/wording.ts'
import { BulletCartridges } from './bullet-cartridges.tsx'
import { BulletDrawing } from './bullet-drawing.tsx'
import { ByLengthUnit } from './by-length-unit.tsx'
import { RecordScope, UnitSwitch } from './cartridge-record.tsx'
import { FieldStrip } from './field-strip.tsx'
import { CoefficientTable, FieldPanel } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'

/** The cartridges a bullet fits, by name. */
type Fits = { id: string; name: string }[]

function BulletRecord({ b, label, fits }: { b: Bullet; label: string; fits: Fits }) {
  // each named, as a badge holds no heading
  const badges: Wording[] = [
    b.productLine && worded(msg('Line {line}'), { line: b.productLine }),
    b.caliber && worded(msg('Caliber {caliber}'), { caliber: b.caliber }),
    b.productNumber && worded(msg('Product {number}'), { number: b.productNumber }),
  ].filter((x): x is Wording => !!x)
  const coefficients = ballisticCoefficientRows(b)
  return (
    <RecordScope>
      <RecordPage
        title={label}
        className="bullet-record"
        // the strip carries them from 48em, the line under the title on a phone
        badges={badges}
        workbench={workbenchHref('bullet', b.id)}
        compare={b.diameter && compareFrom(b.id, b.diameter.value)}
        design={`/bullets/designer?from=${encodeURIComponent(b.id)}`}
        provenance={b.provenance}
        strip={
          <FieldStrip
            items={bulletStrip(b)}
            country={b.country ? countryOf(b.country) : undefined}
            tags={badges}
          />
        }
        figure={
          <>
            <Panel
              id="record-drawing"
              title={msg('Drawing')}
              translated
              // the drawing needs the length; without it the panel holds the reason
              controls={b.length && <UnitSwitch />}
            >
              <ByLengthUnit
                mm={<BulletDrawing record={b} label={label} />}
                inch={<BulletDrawing record={b} label={label} unit="in" />}
              />
            </Panel>
            {coefficients.length > 0 && (
              <Panel id="record-coefficients" title={msg('Ballistic coefficients')} translated>
                <CoefficientTable label={msg('Ballistic coefficients')} rows={coefficients} />
              </Panel>
            )}
          </>
        }
        values={
          <>
            <FieldPanel id="record-data" title={msg('Bullet data')} groups={bulletDataGroups(b)}>
              {b.note && <p className="record-note">{b.note}</p>}
            </FieldPanel>
            <BulletCartridges fits={fits} />
          </>
        }
      />
    </RecordScope>
  )
}

/**
 * The bullet record page: the record from its data file, rendered with its drawing in the browser.
 * `fits` (the cartridges the bullet fits by the CIP rule, `fitsOf`) comes from the page at build: the
 * API has no route that lists them, and the browser holds no fit code for it.
 */
export function BulletRecordPage({ id, name, fits }: { id: string; name: string; fits: Fits }) {
  return (
    <RecordViewWith<Bullet, ManufacturerNames>
      kind="bullets"
      id={id}
      name={name}
      what="Bullet"
      extras={() => fetchManufacturerNames()}
    >
      {(b, names) => <BulletRecord b={b} label={productLabel(b, names)} fits={fits} />}
    </RecordViewWith>
  )
}
