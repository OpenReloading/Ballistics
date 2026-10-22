import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BulletCartridges } from '../../../components/bullet-cartridges.tsx'
import { BulletDrawing } from '../../../components/bullet-drawing.tsx'
import { ByLengthUnit } from '../../../components/by-length-unit.tsx'
import { RecordScope, UnitSwitch } from '../../../components/cartridge-record.tsx'
import { FieldStrip } from '../../../components/field-strip.tsx'
import { CoefficientTable, FieldPanel } from '../../../components/field-table.tsx'
import { Panel } from '../../../components/panel.tsx'
import { RecordPage } from '../../../components/record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import {
  buildPlaceholderId,
  getBullet,
  getManufacturerNames,
  listAllBullets,
  listAllCartridges,
  staticIds,
} from '../../../lib/api.ts'
import { fitsOf } from '../../../lib/bullet-fit.ts'
import { compareFrom } from '../../../lib/compare-ids.ts'
import { countryOf } from '../../../lib/countries.ts'
import { productLabel } from '../../../lib/manufacturers.ts'
import { workbenchHref } from '../../../lib/query.ts'
import {
  ballisticCoefficientRows,
  bulletDataGroups,
  bulletStrip,
} from '../../../lib/record-fields.ts'

export function generateStaticParams() {
  return staticIds(listAllBullets, 'bullet')
}

export async function generateMetadata({ params }: PageProps<'/bullets/[id]'>): Promise<Metadata> {
  const { id } = await params
  if (id === buildPlaceholderId) notFound()
  const r = await getBullet(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  const label = productLabel(r.data, await getManufacturerNames())
  return {
    title: label,
    description: `Drawing, diameter, mass and ballistic coefficients of the ${label}, with sources.`,
  }
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function BulletPage({ params }: PageProps<'/bullets/[id]'>) {
  const { id } = await params
  if (id === buildPlaceholderId) notFound()
  const r = await getBullet(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Bullet" />
  const b = r.data
  const [cartridges, names] = await Promise.all([listAllCartridges(), getManufacturerNames()])
  const label = productLabel(b, names)
  // each named, as a badge holds no heading
  const badges = [
    b.productLine && `Line ${b.productLine}`,
    b.caliber && `Caliber ${b.caliber}`,
    b.productNumber && `Product ${b.productNumber}`,
  ].filter((x): x is string => !!x)
  const coefficients = ballisticCoefficientRows(b)
  return (
    <RecordScope>
      <RecordPage
        title={label}
        className="bullet-record"
        // the strip carries them from 48em, the line under the title on a phone
        badges={badges}
        workbench={workbenchHref('bullet', b.id)}
        compare={compareFrom(b.id, b.diameter.value)}
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
              title="Drawing"
              // the drawing needs the length; without it the panel holds the reason
              controls={b.length && <UnitSwitch />}
            >
              <ByLengthUnit
                mm={<BulletDrawing record={b} label={label} />}
                inch={<BulletDrawing record={b} label={label} unit="in" />}
              />
            </Panel>
            {coefficients.length > 0 && (
              <Panel id="record-coefficients" title="Ballistic coefficients">
                <CoefficientTable label="Ballistic coefficients" rows={coefficients} />
              </Panel>
            )}
          </>
        }
        values={
          <>
            <FieldPanel id="record-data" title="Bullet data" groups={bulletDataGroups(b)}>
              {b.note && <p className="record-note">{b.note}</p>}
            </FieldPanel>
            {cartridges.status === 'ok' && (
              <BulletCartridges fits={fitsOf(b.diameter.value, cartridges.data)} />
            )}
          </>
        }
      />
    </RecordScope>
  )
}
