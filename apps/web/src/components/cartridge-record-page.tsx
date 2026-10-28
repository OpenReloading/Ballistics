'use client'

import { recordFigures } from '@open-reloading/drawing/cartridge'
import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api-fetch.ts'
import type { CartridgeDetail } from '../lib/api-types.ts'
import {
  combinedRows,
  inReadingOrder,
  pressureStripNote,
  pressureStripValues,
  variantMatrix,
} from '../lib/cartridge-record.ts'
import { drawable } from '../lib/cartridge-sheet.ts'
import { parseCountries } from '../lib/countries.ts'
import { workbenchHref } from '../lib/query.ts'
import { ByLengthUnit } from './by-length-unit.tsx'
import { CartridgeBullets } from './cartridge-bullets.tsx'
import { CartridgeDrawing } from './cartridge-drawing.tsx'
import {
  CartridgeSides,
  RecordFacts,
  RecordScope,
  VariantMatrix,
  VariantSelect,
} from './cartridge-record.tsx'
import { Noted } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordView } from './record-view.tsx'
import { GapBadge, StandardBadge } from './standard-badge.tsx'

function RecordBadges({ aliases, gap }: { aliases: string[]; gap: boolean }) {
  return (
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
  )
}

/** How many bullets fit the cartridge by the CIP rule (`GET /bullets?cartridge`), read once the page is drawn. */
function useFittingBullets(id: string) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const read = new AbortController()
    apiFetch(`bullets?cartridge=${encodeURIComponent(id)}&limit=1`, { signal: read.signal })
      .then((res) => (res.ok ? res.json() : undefined))
      .then((list: { total: number } | undefined) => setCount(list?.total ?? 0))
      // the link is an extra: without the catalogue the page shows no count
      .catch(() => {})
    return () => read.abort()
  }, [id])
  return count
}

function Cartridge({ c }: { c: CartridgeDetail }) {
  const sheet = drawable(c)
  const list = recordFigures(sheet)
  const rows = inReadingOrder(combinedRows(c, list))
  const matrix = variantMatrix(c)
  const pressures = pressureStripValues(c)
  const aliases = c.aliases ?? []
  const date = c.revised ?? c.published
  // a record without values: nothing to switch, draw or design
  const gap = c.values.length === 0
  // each side in the Settings length unit
  const drawing = (side: 'cartridge' | 'chamber', variant?: string) => (
    <ByLengthUnit
      mm={<CartridgeDrawing spec={sheet} list={list} side={side} variant={variant} />}
      inch={<CartridgeDrawing spec={sheet} list={list} side={side} variant={variant} unit="in" />}
    />
  )
  const bullets = useFittingBullets(c.id)
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
        badgeNodes={<RecordBadges aliases={aliases} gap={gap} />}
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
        side={bullets > 0 && <CartridgeBullets id={c.id} count={bullets} />}
      />
    </RecordScope>
  )
}

/** The cartridge record page: the content, drawing and print figures render here from the record's data file (`RecordView`). */
export function CartridgeRecordPage({ id, name }: { id: string; name: string }) {
  return (
    <RecordView<CartridgeDetail> kind="cartridges" id={id} name={name} what="Cartridge">
      {(c) => <Cartridge c={c} />}
    </RecordView>
  )
}
