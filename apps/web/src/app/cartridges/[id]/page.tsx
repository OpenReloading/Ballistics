import { bulletFits, cartridgeDiameters } from '@openreloading/core'
import { recordFigures } from '@openreloading/drawing/cartridge'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ByLengthUnit } from '../../../components/by-length-unit.tsx'
import { CartridgeBullets } from '../../../components/cartridge-bullets.tsx'
import { CartridgeDrawing } from '../../../components/cartridge-drawing.tsx'
import {
  CartridgeSides,
  RecordFacts,
  RecordScope,
  VariantMatrix,
  VariantSelect,
} from '../../../components/cartridge-record.tsx'
import { Noted } from '../../../components/field-table.tsx'
import { Panel } from '../../../components/panel.tsx'
import { RecordPage } from '../../../components/record-page.tsx'
import { GapBadge, StandardBadge } from '../../../components/standard-badge.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import {
  buildPlaceholderId,
  getCartridge,
  listAllBullets,
  listAllCartridges,
  staticIds,
} from '../../../lib/api.ts'
import {
  combinedRows,
  inReadingOrder,
  pressureStripNote,
  pressureStripValues,
  variantMatrix,
} from '../../../lib/cartridge-record.ts'
import { drawable } from '../../../lib/cartridge-sheet.ts'
import { parseCountries } from '../../../lib/countries.ts'
import { workbenchHref } from '../../../lib/query.ts'

export function generateStaticParams() {
  return staticIds(listAllCartridges, 'cartridge')
}

export async function generateMetadata({
  params,
}: PageProps<'/cartridges/[id]'>): Promise<Metadata> {
  const { id } = await params
  if (id === buildPlaceholderId) notFound()
  const r = await getCartridge(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  return {
    title: `${r.data.name} dimensions and pressures`,
    description: `CIP dimensions and maximum pressures of ${r.data.name}, with sources.`,
  }
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function CartridgePage({ params }: PageProps<'/cartridges/[id]'>) {
  const { id } = await params
  if (id === buildPlaceholderId) notFound()
  const r = await getCartridge(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Cartridge" />
  const c = r.data
  const sheet = drawable(c)
  const list = recordFigures(sheet)
  const rows = inReadingOrder(combinedRows(c, list))
  const matrix = variantMatrix(c)
  const pressures = pressureStripValues(c)
  const aliases = c.aliases ?? []
  const date = c.revised ?? c.published
  // a record without values: nothing to switch, draw or design
  const gap = c.values.length === 0
  // both units laid out here; the page shows the Settings one
  const drawing = (side: 'cartridge' | 'chamber', variant?: string) => (
    <ByLengthUnit
      mm={<CartridgeDrawing spec={sheet} list={list} side={side} variant={variant} />}
      inch={<CartridgeDrawing spec={sheet} list={list} side={side} variant={variant} unit="in" />}
    />
  )
  // the bullets that fit by the CIP rule of the bullet records' cartridge lists
  const fit = cartridgeDiameters(c)
  const all = fit ? await listAllBullets() : undefined
  const bullets =
    fit && all?.status === 'ok' ? all.data.filter((b) => bulletFits(b.diameter, fit)) : []
  const pairs = (matrix.variants.length ? matrix.variants : [undefined]).map((variant) => ({
    variant,
    cartridge: drawing('cartridge', variant),
    chamber: drawing('chamber', variant),
  }))
  return (
    <RecordScope variants={matrix.variants}>
      <RecordPage
        className={matrix.rows.length > 0 ? 'cartridge-record has-variants' : 'cartridge-record'}
        title={c.name}
        badges={['CIP', ...aliases]}
        badgeNodes={
          <>
            <StandardBadge label="CIP" />
            {gap && <GapBadge />}
            {aliases.length > 0 && (
              <Noted
                inline
                className="record-badge record-aliases"
                value={aliases.join(', ')}
                notes={[`Also printed as: ${aliases.join(', ')}`]}
              />
            )}
          </>
        }
        workbench={workbenchHref('cartridge', c.id)}
        design={gap ? undefined : `/cartridges/designer?from=${encodeURIComponent(c.id)}`}
        provenance={c.provenance}
        strip={
          <>
            <RecordFacts
              values={pressures}
              notes={pressures.map((v) => pressureStripNote(v, c.table))}
              standard={{
                table: c.table,
                date: { label: c.revised ? 'Revised' : 'Published', value: date },
                countries: c.country ? parseCountries(c.country) : undefined,
              }}
              build={{
                caseType: c.caseType,
                method: c.pressureMethod,
              }}
            />
            {gap && <p className="record-gap">No dimensions or pressures in this record</p>}
            {/* a shotshell's pressures and lengths by variant, across the page */}
            {matrix.rows.length > 0 && (
              <Panel
                id="record-variants"
                title="Variants"
                className="record-variants"
                controls={<VariantSelect variants={matrix.variants} />}
              >
                <VariantMatrix
                  variants={matrix.variants}
                  rows={matrix.rows}
                  labelledBy="record-variants"
                />
              </Panel>
            )}
          </>
        }
        values={
          rows.length > 0 && (
            <CartridgeSides
              pairs={pairs}
              rows={rows}
              table={c.table}
              drawn={[...new Set(list.flatMap((f) => f.drawn.map((d) => d.side)))]}
            />
          )
        }
        side={bullets.length > 0 && <CartridgeBullets id={c.id} count={bullets.length} />}
      />
    </RecordScope>
  )
}
