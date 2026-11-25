'use client'

import type { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import type { Bullet } from '@rangefoundry/schema'
import { FlaskConical } from 'lucide-react'
import { compareFrom } from '../lib/compare-ids.ts'
import { bulletIncomplete } from '../lib/complete-records.ts'
import { countryOf } from '../lib/countries.ts'
import {
  fetchManufacturerNames,
  type ManufacturerNames,
  productLabel,
} from '../lib/manufacturers.ts'
import { workbenchHref } from '../lib/query.ts'
import { ballisticCoefficientRows, bulletDataGroups, bulletStrip } from '../lib/record-fields.ts'
import type { Wording } from '../lib/wording.ts'
import { BulletCartridges } from './bullet-cartridges.tsx'
import { BulletDrawing } from './bullet-drawing.tsx'
import { ByLengthUnit } from './by-length-unit.tsx'
import { RecordScope, UnitSwitch } from './cartridge-record.tsx'
import { FieldStrip } from './field-strip.tsx'
import { CoefficientTable, FieldPanel } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { LinkButton } from './record-actions.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'

/** The cartridges a bullet fits, by name. */
type Fits = { id: string; name: string }[]

function BulletRecord({ b, label, fits }: { b: Bullet; label: string; fits: Fits }) {
  const { i18n } = useLingui()
  // each named, as a badge holds no heading
  const named: (MessageDescriptor | '' | false | undefined)[] = [
    b.productLine && /*i18n*/ {
      id: 'bulletRecord.line',
      message: 'Line {line}',
      values: { line: b.productLine },
    },
    b.caliber && /*i18n*/ {
      id: 'bulletRecord.caliber',
      message: 'Caliber {caliber}',
      values: { caliber: b.caliber },
    },
    b.productNumber && /*i18n*/ {
      id: 'bulletRecord.product',
      message: 'Product {number}',
      values: { number: b.productNumber },
    },
    bulletIncomplete(b) && /*i18n*/ {
      id: 'bulletRecord.valuesMissing',
      message: 'Values missing: the record only names the bullet',
    },
  ]
  const badges: Wording[] = named.filter((x): x is MessageDescriptor => !!x)
  const coefficientsTitle = /*i18n*/ {
    id: 'bulletRecord.coefficients',
    message: 'Ballistic coefficients',
  }
  const coefficients = ballisticCoefficientRows(b)
  return (
    <RecordScope>
      <RecordPage
        title={label}
        className="bullet-record"
        // the strip carries them from 48em, the line under the title on a phone
        badges={badges}
        workbench={workbenchHref('bullet', b.id)}
        compare={compareFrom(b.id, b.diameter?.value)}
        design={`/bullets/designer?from=${encodeURIComponent(b.id)}`}
        provenance={b.provenance}
        strip={
          <>
            <FieldStrip
              items={bulletStrip(b)}
              country={b.country ? countryOf(b.country) : undefined}
              tags={badges}
            />
            {/* below 75em the bar keeps its actions behind Page actions: the primary one stays in view */}
            <LinkButton
              href={workbenchHref('bullet', b.id)}
              icon={<FlaskConical aria-hidden="true" />}
              primary
              className="phone-action"
            >
              {i18n._({ id: 'bulletRecord.useInWorkbench', message: 'Use in workbench' })}
            </LinkButton>
          </>
        }
        figure={
          <>
            <Panel
              id="record-drawing"
              title={/*i18n*/ { id: 'bulletRecord.drawing', message: 'Drawing' }}
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
              <Panel id="record-coefficients" title={coefficientsTitle} translated>
                <CoefficientTable label={coefficientsTitle} rows={coefficients} />
              </Panel>
            )}
          </>
        }
        values={
          <>
            <FieldPanel
              id="record-data"
              title={/*i18n*/ { id: 'bulletRecord.data', message: 'Bullet data' }}
              groups={bulletDataGroups(b)}
            >
              {b.note && <p className="record-note">{b.note}</p>}
            </FieldPanel>
            <BulletCartridges fits={fits} />
          </>
        }
      />
    </RecordScope>
  )
}

/** `fits` (the cartridges it fits by the CIP rule, `fitsOf`) comes from the build: the API has no route that lists them and the browser no fit code. */
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
