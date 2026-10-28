'use client'

import { recordFigures } from '@open-reloading/drawing/cartridge'
import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
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
import { methodWording } from '../lib/record-values.ts'
import { verbatim } from '../lib/wording.ts'
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
import { PageBar } from './page-bar.tsx'
import { PageNotFound } from './page-not-found.tsx'
import { Panel } from './panel.tsx'
import { RecordPage } from './record-page.tsx'
import { GapBadge, StandardBadge } from './standard-badge.tsx'
import { DataError, Loading } from './states.tsx'
import { useRecord } from './use-record.ts'

function RecordBadges({ aliases, gap }: { aliases: string[]; gap: boolean }) {
  const { t } = useTranslation()
  return (
    <>
      <StandardBadge label="CIP" />
      {gap && <GapBadge />}
      {aliases.length > 0 && (
        <Noted
          inline
          className="record-badge record-aliases"
          value={aliases.join(', ')}
          notes={[t('Also printed as: {aliases}', { aliases: aliases.join(', ') })]}
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
  const { t } = useTranslation()
  const sheet = drawable(c)
  const list = recordFigures(sheet)
  const rows = inReadingOrder(combinedRows(c, list, t))
  const matrix = variantMatrix(c, t)
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
        badges={[verbatim('CIP'), ...aliases.map(verbatim)]}
        badgeNodes={<RecordBadges aliases={aliases} gap={gap} />}
        workbench={workbenchHref('cartridge', c.id)}
        design={gap ? undefined : `/cartridges/designer?from=${encodeURIComponent(c.id)}`}
        provenance={c.provenance}
        strip={
          <>
            <RecordFacts
              values={pressures}
              notes={pressures.map((v) => pressureStripNote(v, c.table, t))}
              standard={{
                table: c.table,
                date: { label: c.revised ? msg('Revised') : msg('Published'), value: date },
                countries: c.country ? parseCountries(c.country) : undefined,
              }}
              build={{
                caseType: c.caseType,
                method: c.pressureMethod && methodWording(c.pressureMethod),
              }}
            />
            {gap && <p className="record-gap">{t('No dimensions or pressures in this record')}</p>}
            {/* a shotshell's pressures and lengths by variant, across the page */}
            {matrix.rows.length > 0 && (
              <Panel
                id="record-variants"
                title={msg('Variants')}
                translated
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

/**
 * The cartridge record page: the page's HTML holds the head tags (the route's metadata) and this
 * loading state under the record's name; the content, drawing and print figures included, renders here
 * from the record's data file.
 */
export function CartridgeRecordPage({ id, name }: { id: string; name: string }) {
  const { t } = useTranslation()
  const { state, retry } = useRecord<CartridgeDetail>('cartridges', id)
  if (state.status === 'ok') return <Cartridge c={state.data} />
  if (state.status === 'notFound')
    return (
      <>
        <meta name="robots" content="noindex" />
        <PageNotFound />
      </>
    )
  return (
    <>
      <PageBar title={name} reserve />
      {state.status === 'error' ? (
        <DataError what="Cartridge" retry={retry} />
      ) : (
        <Loading what="cartridge" rows={6} />
      )}
      <noscript>
        <p>{t('The record is read and drawn by a script: this page needs JavaScript.')}</p>
      </noscript>
    </>
  )
}
