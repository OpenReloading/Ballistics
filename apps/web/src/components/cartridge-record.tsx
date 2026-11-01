'use client'

import {
  SegmentedControl,
  Select,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Tooltip,
} from '@mantine/core'
import type { SpecValue } from '@open-reloading/schema'
import { Crosshair, Cylinder, Gauge, Ruler } from '@phosphor-icons/react'
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg } from '../i18n/translate.ts'
import {
  type CombinedRow,
  clearanceLine,
  clearanceMeaning,
  converted,
  defaultVariantIndex,
  groupLabel,
  type MatrixRow,
  rowGroups,
  sideHint,
  signedLength,
  specValueText,
  toleranceText,
} from '../lib/cartridge-record.ts'
import { caseTypeText } from '../lib/list-values.ts'
import { controlSize, tipEvents } from '../lib/theme.ts'
import { drawingLengthUnit, type UnitSystem } from '../lib/units.ts'
import { say, type Wording } from '../lib/wording.ts'
import { Countries } from './countries.tsx'
import { Fact, FactCard, FactCards, Label, Sized, slotUnits } from './fact-cards.tsx'
import { arrowStops, Noted, SymbolStop } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { ScrollRegion } from './scroll-region.tsx'
import { LengthOverride, useUnits } from './units-settings.tsx'

/** The unit after a number; lengths carry theirs in the column head. */
const unitAfter = (q: string, system: UnitSystem) =>
  converted(q) && q !== 'length' ? ` ${system[q].symbol}` : ''

/** A value, then its tolerance and limit, muted (or the text as printed where nothing is stored); the unit is in its row's label. */
function Value({ v, system }: { v: SpecValue; system: UnitSystem }) {
  if (v.value === undefined) return <>{v.raw}</>
  const tolerance = toleranceText(v, system)
  return (
    <>
      {specValueText(v.quantity, v.value, system)}
      {tolerance && <span className="tolerance"> {tolerance}</span>}
    </>
  )
}

/** The slot's two notes: the tolerance or limit, then the clearance (chamber rows that are a fit). */
const slotNotes = (v: SpecValue, clearance: number | undefined, system: UnitSystem) => [
  toleranceText(v, system),
  clearance === undefined ? '' : signedLength(clearance, system),
]

/** The clearance note: hover (and the symbol's hint for the keyboard), a screen reader reads "Clearance"; a negative one is red. */
function Clearance({ text, negative }: { text: string; negative: boolean }) {
  const { t } = useTranslation()
  return (
    <Tooltip label={clearanceLine(t(clearanceMeaning), t)} events={tipEvents}>
      <span
        className={negative ? 'clearance conflict' : 'clearance'}
        role="note"
        aria-label={t('Clearance {value}', { value: text })}
      >
        {text}
      </span>
    </Tooltip>
  )
}

/**
 * A Dimensions row's two cells: the value right-aligned in a fixed width, then, in a column of its
 * own, a fixed slot for its tolerance or limit and, in the chamber table, the clearance, so the
 * decimals of a column line up and a unit switch moves nothing.
 */
function SlotCells({
  v,
  clearance,
  system,
}: {
  v: SpecValue | undefined
  clearance?: number | undefined
  system: UnitSystem
}) {
  const text = (u: UnitSystem) =>
    v?.value === undefined
      ? ''
      : `${specValueText(v.quantity, v.value, u)}${unitAfter(v.quantity, u)}`
  const [tolerance, gap] = v?.value === undefined ? [] : slotNotes(v, clearance, system)
  return (
    <>
      <TableTd className="num">
        {v && (
          <span className="dim-value">
            {v.value === undefined ? (
              v.raw
            ) : (
              <Sized now={text(system)} also={slotUnits.map(text)} />
            )}
          </span>
        )}
      </TableTd>
      <TableTd className="dim-slot-cell">
        <span className="dim-slot tolerance">
          {tolerance}
          {tolerance && gap && ' '}
          {gap && <Clearance text={gap} negative={(clearance ?? 0) < 0} />}
        </span>
      </TableTd>
    </>
  )
}

/** The record's own length unit (the switch beside the facts), the shotshell variant shown, and their setters. */
const RecordView = createContext<{
  unit?: 'mm' | 'in' | undefined
  setUnit: (u: 'mm' | 'in') => void
  variant: number
  setVariant: (k: number) => void
}>({ setUnit: () => {}, variant: 0, setVariant: () => {} })

/** A mark's two ends: the symbol and the part of the page whose elements carry it. */
interface Link {
  symbol: string
  scope: Element
}

/** The link at `t`: its symbol and its own panel (else the whole scope). */
function linkIn(box: HTMLElement | null, t: EventTarget | null): Link | undefined {
  const symbol = t instanceof Element && t.closest('[data-symbol]')?.getAttribute('data-symbol')
  if (!box || !symbol) return undefined
  return { symbol, scope: (t as Element).closest('.side-panel') ?? box }
}

/** Marks the table row and the drawn dimension of `link`, nothing for none. */
function markLink(box: HTMLElement | null, link: Link | undefined) {
  if (!box) return
  for (const el of box.querySelectorAll('.is-hi')) el.classList.remove('is-hi')
  if (!link) return
  // the whole symbol: "delta L" is one, not "delta" and "L"
  const ends = [...link.scope.querySelectorAll('[data-symbol]')].filter(
    (el) => el.getAttribute('data-symbol') === link.symbol,
  )
  // a row and a drawn dimension, else nothing to link
  if (ends.some((el) => el.tagName === 'TR') && ends.some((el) => el.tagName !== 'TR'))
    for (const el of ends) el.classList.add('is-hi')
}

/** A click on the pinned link again drops it, else the link is pinned. */
function pinnedAfter(pinned: Link | undefined, link: Link | undefined) {
  const same = link && pinned?.symbol === link.symbol && pinned.scope === link.scope
  return link && !same ? link : undefined
}

/** Keeps the rows of the pinned link marked. */
function pinRows(pinned: Link | undefined) {
  if (!pinned) return
  for (const el of pinned.scope.querySelectorAll('tr[data-symbol]'))
    if (el.getAttribute('data-symbol') === pinned.symbol) el.classList.add('is-pin')
}

/**
 * A record page's client scope (cartridge, bullet): the length unit of the strip, the drawings and the
 * tables (not stored; it starts at the Settings unit and follows a change there), the shotshell
 * variant, and the linked hover. A table row and the drawn dimension of the same side with the same
 * `data-symbol` are marked together on hover and focus, within their own panel (the cartridge's R1
 * does not mark the chamber's); a click, Enter or Space keeps the mark, a second one or Escape drops
 * it. A row whose symbol the drawing does not show links nothing. The marks are classes set on the
 * elements, so nothing re-renders.
 */
export function RecordScope({
  variants = [],
  children,
}: {
  /** The shotshell case length variants; the select starts on `defaultVariantIndex`. */
  variants?: string[]
  children: ReactNode
}) {
  const { choice } = useUnits()
  const [unit, setUnit] = useState<'mm' | 'in'>()
  const [variant, setVariant] = useState(() => defaultVariantIndex(variants))
  // a change in Settings wins over the switch
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on every new Settings choice
  useEffect(() => setUnit(undefined), [choice])
  const root = useRef<HTMLDivElement>(null)
  const pinned = useRef<Link>(undefined)
  // a touch on a table symbol opens its notes and marks nothing: any change to the page after the
  // tap closes the notes again (the browser's emulated hover leaves); a tapped drawing dimension marks
  const touch = useRef(false)
  const linkAt = (t: EventTarget | null) => linkIn(root.current, t)
  const mark = (link: Link | undefined) => markLink(root.current, link)
  const pin = (link: Link | undefined) => {
    pinned.current = pinnedAfter(pinned.current, link)
    for (const el of root.current?.querySelectorAll('tr.is-pin') ?? [])
      el.classList.remove('is-pin')
    pinRows(pinned.current)
    mark(pinned.current)
  }
  return (
    <RecordView value={{ unit, setUnit, variant, setVariant }}>
      <LengthOverride unit={unit}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: follows hover and focus of the symbols inside, takes none itself */}
        <div
          ref={root}
          role="presentation"
          className="record-scope"
          onPointerDown={(e) => {
            touch.current = e.pointerType === 'touch'
          }}
          onPointerOver={(e) => {
            if (e.pointerType !== 'touch') mark(linkAt(e.target) ?? pinned.current)
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== 'touch') mark(pinned.current)
          }}
          onFocus={(e) => {
            if (!touch.current) mark(linkAt(e.target) ?? pinned.current)
          }}
          onBlur={() => {
            if (!touch.current) mark(pinned.current)
          }}
          onClick={(e) => {
            const link = linkAt(e.target)
            if (!link || (touch.current && e.target instanceof Element && e.target.closest('tr')))
              return
            pin(link)
          }}
          // in the capture phase: a tooltip open on the focused symbol takes Escape for itself
          onKeyDownCapture={(e) => {
            if (e.key === 'Escape' && pinned.current) pin(pinned.current)
          }}
          // Enter and Space on a symbol click it
          onKeyDown={() => {
            touch.current = false
          }}
        >
          {children}
        </div>
      </LengthOverride>
    </RecordView>
  )
}

/** The record's mm or inch switch, named by `label` where a page has more than one. */
export function UnitSwitch({ label }: { label?: string | undefined }) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const { setUnit } = useContext(RecordView)
  return (
    <SegmentedControl
      aria-label={label ?? t('Length unit')}
      size={controlSize.row.toggle}
      data={[
        { label: 'mm', value: 'mm' },
        { label: 'in', value: 'in' },
      ]}
      value={drawingLengthUnit(system)}
      onChange={(v) => setUnit(v as 'mm' | 'in')}
    />
  )
}

/** The names of a record's two sides, with the labels built on them: whole messages, as word order differs. */
const sideTitle = { cartridge: msg('Cartridge'), chamber: msg('Chamber') } as const
const sideUnitLabel = {
  cartridge: msg('Cartridge length unit'),
  chamber: msg('Chamber length unit'),
} as const
const sideDimensions = {
  cartridge: msg('Cartridge dimensions'),
  chamber: msg('Chamber dimensions'),
} as const

/**
 * The record's two sides (after the CIP data sheets): a panel for the
 * cartridge and one for the chamber, both always shown, each its drawing beside its table. A table
 * lists the symbol and the side's value with its tolerance in a fixed slot (cartridge maximum,
 * chamber minimum) in the unit of the record (Settings or the switch), the chamber's also the
 * clearance as a note after the value where both sides give one; what a symbol stands for is its hover. Rows follow the
 * drawing from the mouth to the head. Every row carries `data-symbol` for the linked hover. A
 * shotshell's drawings are those of the variant chosen in `VariantSelect`.
 */
export function CartridgeSides({
  pairs,
  rows,
  table,
  drawn,
}: {
  pairs: { variant?: string | undefined; cartridge: ReactNode; chamber: ReactNode }[]
  rows: CombinedRow[]
  table?: string | undefined
  /** The sides with a drawing; a panel without one takes its table's width, the reason under it. */
  drawn: ('cartridge' | 'chamber')[]
}) {
  const { variant } = useContext(RecordView)
  return (
    <div className="cartridge-sides">
      {(['cartridge', 'chamber'] as const).map((side) => (
        <SidePanel
          key={side}
          side={side}
          undrawn={!drawn.includes(side)}
          rows={rows.filter((r) => r[side])}
          table={table}
          figures={pairs.map((p, i) => (
            <div
              key={p.variant ?? i}
              className="figure-variant"
              data-shown={i === variant || undefined}
            >
              {p[side]}
            </div>
          ))}
        />
      ))}
    </div>
  )
}

function SidePanel({
  side,
  undrawn,
  rows,
  table,
  figures,
}: {
  side: 'cartridge' | 'chamber'
  undrawn: boolean
  rows: CombinedRow[]
  table?: string | undefined
  figures: ReactNode
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const id = `record-${side}`
  const length = system.length.symbol
  const limit = (unit: string) =>
    side === 'cartridge' ? t('Max ({unit})', { unit }) : t('Min ({unit})', { unit })
  const slotTitle = side === 'cartridge' ? t('Tolerance') : t('Tolerance, clearance')
  // the characters of the longest tolerance or limit with its clearance in either unit: the slot of every row
  const slot = Math.max(
    0,
    ...rows.flatMap((r) => {
      const v = r[side]
      return v
        ? slotUnits.map(
            (u) =>
              slotNotes(v, side === 'chamber' ? r.clearance : undefined, u)
                .filter(Boolean)
                .join(' ').length,
          )
        : []
    }),
  )
  // one tab stop per table, the arrow keys move between the symbols (the symbol last focused)
  const [active, setActive] = useState(rows[0]?.key)
  const groups = rows.reduce<CombinedRow[][]>((all, r) => {
    const last = all.at(-1)
    if (last?.[0]?.group === r.group) last.push(r)
    else all.push([r])
    return all
  }, [])
  return (
    <Panel
      id={id}
      title={t(sideTitle[side])}
      className={undrawn ? 'side-panel side-undrawn' : 'side-panel'}
      // the record's one length unit: both panels switch it
      controls={<UnitSwitch label={t(sideUnitLabel[side])} />}
    >
      <div className="side-body">
        <ScrollRegion label={t(sideDimensions[side])}>
          <Table
            className="cartridge-values side-values"
            aria-label={t(sideDimensions[side])}
            stickyHeader
            style={{ '--slot': slot } as CSSProperties}
            onFocus={(e) => {
              const key = (e.target as Element).closest('tr[data-row]')?.getAttribute('data-row')
              if (key) setActive(key)
            }}
            onKeyDown={(e) => arrowStops(e, 'tbody th [tabindex]')}
          >
            <TableThead>
              <TableTr>
                <TableTh scope="col" className="dim-symbol">
                  {t('Symbol')}
                </TableTh>
                <TableTh scope="col" className="num">
                  <Sized now={limit(length)} also={slotUnits.map((u) => limit(u.length.symbol))} />
                </TableTh>
                <TableTh scope="col" className="dim-slot-cell">
                  <span className="dim-slot-head">{slotTitle}</span>
                </TableTh>
              </TableTr>
            </TableThead>
            {/* a group per tbody: named for a screen reader, a heavier rule above it on screen */}
            {groups.map((group) => (
              <TableTbody
                key={group[0]?.group}
                aria-label={groupLabel(
                  rowGroups.find(([g]) => g === group[0]?.group)?.[1] ?? '',
                  t,
                )}
              >
                {group.map((r) => (
                  <SideRow
                    key={r.key}
                    row={r}
                    side={side}
                    table={table}
                    tabbable={r.key === active}
                    system={system}
                  />
                ))}
              </TableTbody>
            ))}
          </Table>
        </ScrollRegion>
        <div className="side-figure">{figures}</div>
      </div>
    </Panel>
  )
}

function SideRow({
  row: r,
  side,
  table,
  tabbable,
  system,
}: {
  row: CombinedRow
  side: 'cartridge' | 'chamber'
  table?: string | undefined
  tabbable: boolean
  system: UnitSystem
}) {
  const { t } = useTranslation()
  const hint = sideHint(r, side, table, t)
  const value = r[side]
  const tabIndex = tabbable ? 0 : -1
  return (
    <TableTr data-symbol={r.storedSymbol} data-row={r.key}>
      <TableTh scope="row" className="dim-symbol">
        {hint.length > 0 ? (
          <Noted value={r.symbol} notes={hint} inline tabIndex={tabIndex} />
        ) : (
          <SymbolStop tabIndex={tabIndex}>{r.symbol}</SymbolStop>
        )}
      </TableTh>
      <SlotCells
        v={value}
        clearance={side === 'chamber' ? r.clearance : undefined}
        system={system}
      />
    </TableTr>
  )
}

const matrixText = (v: SpecValue, system: UnitSystem) =>
  v.value === undefined
    ? (v.raw ?? '')
    : `${specValueText(v.quantity, v.value, system)} ${toleranceText(v, system)}`.trim()

const matrixLabel = (r: MatrixRow, system: UnitSystem) =>
  `${r.label}${converted(r.quantity) ? ` (${system[r.quantity].symbol})` : ''}`

/** A table VII record's values by case length variant: a row per value, a column per variant. */
export function VariantMatrix({
  variants,
  rows,
  labelledBy,
}: {
  variants: string[]
  rows: MatrixRow[]
  labelledBy: string
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const { variant } = useContext(RecordView)
  return (
    <ScrollRegion label={t('Variants table')}>
      <Table className="cartridge-values variant-matrix" aria-labelledby={labelledBy}>
        <TableThead>
          <TableTr>
            <TableTh scope="col">{t('Value')}</TableTh>
            {variants.map((v, i) => (
              <TableTh key={v} scope="col" className="num" data-shown={i === variant || undefined}>
                {v}
              </TableTh>
            ))}
          </TableTr>
        </TableThead>
        <TableTbody>
          {rows.map((r) => (
            <TableTr key={r.key}>
              <TableTh scope="row">
                <Sized
                  now={<Label text={matrixLabel(r, system)} notes={r.notes} />}
                  also={slotUnits.map((u) => matrixLabel(r, u))}
                />
              </TableTh>
              {r.cells.map((c, i) => (
                <TableTd key={variants[i]} className="num" data-shown={i === variant || undefined}>
                  {c && (
                    <Sized
                      now={<Value v={c} system={system} />}
                      also={slotUnits.map((u) => matrixText(c, u))}
                    />
                  )}
                </TableTd>
              ))}
            </TableTr>
          ))}
        </TableTbody>
      </Table>
    </ScrollRegion>
  )
}

/** A strip value as its number and unit in one unit system; text as printed where nothing is stored. */
function factParts(v: SpecValue, system: UnitSystem) {
  if (v.value === undefined) return { number: v.raw ?? '', unit: '', tolerance: '' }
  return {
    number: specValueText(v.quantity, v.value, system),
    unit: converted(v.quantity) ? system[v.quantity].symbol : '',
    tolerance: toleranceText(v, system),
  }
}

/** The hover help of the facts that are not symbols of the record. */
const factMeanings = {
  table: msg('Table: the CIP table of the record, I to XI, by cartridge class'),
  case: msg('Case: the case type, derived from the record'),
  method: msg('Method: the pressure measuring method'),
}

/**
 * The record's facts as cards under the page bar: Pressure (Pmax, PK, PE), Test barrel (M, EE),
 * Dimensions (the cartridge's L3, L6 and G1) and Case (derived case type), each fact a label over
 * its value, in the preset's units, what a symbol stands for on hover; then `children` (the link to
 * the fitting bullets). A card without facts is left out. Every fact keeps a fixed minimum width,
 * so the preset applying after mounting moves nothing. The standard's table, date, country and
 * measuring method are in the Sources panel (`StandardFacts`).
 */
export function RecordFacts({
  values,
  notes,
  caseType,
  children,
}: {
  values: SpecValue[]
  notes: string[][]
  caseType?: string | undefined
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const items = values.map((v, i) => ({ v, notes: notes[i] ?? [] }))
  const pressures = items.filter(({ v }) => !v.side && v.quantity === 'pressure')
  const test = items.filter(({ v }) => !v.side && v.quantity !== 'pressure')
  const sized = items.filter(({ v }) => v.side)
  const fact = ({ v, notes }: (typeof items)[number], lead = false) => {
    const now = factParts(v, system)
    const also = slotUnits.map((u) => factParts(v, u))
    const text = (p: typeof now) => `${p.number}${p.tolerance ? ` ${p.tolerance}` : ''}`
    return (
      <Fact
        key={`${v.side ?? ''} ${v.symbol}`}
        label={v.symbol}
        notes={notes}
        lead={lead}
        unit={{ now: now.unit, also: also.map((p) => p.unit) }}
      >
        <Sized
          now={
            <>
              <span className="fact-number">{now.number}</span>
              {now.tolerance && <span className="tolerance"> {now.tolerance}</span>}
            </>
          }
          also={also.map(text)}
        />
      </Fact>
    )
  }
  return (
    <FactCards>
      {pressures.length > 0 && (
        <FactCard icon={Gauge}>{pressures.map((p, i) => fact(p, i === 0))}</FactCard>
      )}
      {test.length > 0 && <FactCard icon={Crosshair}>{test.map((t) => fact(t))}</FactCard>}
      {sized.length > 0 && <FactCard icon={Ruler}>{sized.map((d) => fact(d))}</FactCard>}
      {caseType && (
        <FactCard icon={Cylinder}>
          <Fact label={t('Case')} notes={[t(factMeanings.case)]}>
            {caseTypeText(t, caseType)}
          </Fact>
        </FactCard>
      )}
      {children && <div className="fact-link">{children}</div>}
    </FactCards>
  )
}

/**
 * The standard's facts over the sources of a cartridge record: the CIP table, the revision (else
 * publication) date, the country and the pressure measuring method, each named, those without a
 * value left out.
 */
export function StandardFacts({
  table,
  date,
  countries,
  method,
}: {
  table?: string | undefined
  date?: { label: Message; value: string } | undefined
  countries?: { name: string; code?: string | undefined }[] | undefined
  method?: Wording | undefined
}) {
  const { t } = useTranslation()
  if (!table && !date && !countries && !method) return null
  return (
    <dl className="standard-facts">
      {table && (
        <div>
          <dt>
            <Label text={t('Table')} notes={[t(factMeanings.table)]} />
          </dt>
          <dd>{table}</dd>
        </div>
      )}
      {date && (
        <div>
          <dt>{t(date.label)}</dt>
          <dd>{date.value}</dd>
        </div>
      )}
      {countries && (
        <div>
          <dt>{t('Country')}</dt>
          <dd>
            <Countries items={countries} as="span" />
          </dd>
        </div>
      )}
      {method && (
        <div>
          <dt>
            <Label text={t('Method')} notes={[t(factMeanings.method)]} />
          </dt>
          <dd>{say(t, method)}</dd>
        </div>
      )}
    </dl>
  )
}

/** A shotshell's case length variant whose drawings show, in the Variants title row (every variant stays in the page and prints). */
export function VariantSelect({ variants }: { variants: string[] }) {
  const { t } = useTranslation()
  const { variant, setVariant } = useContext(RecordView)
  return (
    <Select
      aria-label={t('Variant')}
      size={controlSize.row.input}
      w="8.5rem"
      allowDeselect={false}
      data={variants}
      {...(variants[variant] !== undefined && { value: variants[variant] })}
      onChange={(v) => setVariant(Math.max(0, variants.indexOf(v ?? '')))}
    />
  )
}
