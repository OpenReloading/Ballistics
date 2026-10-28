'use client'

import { NativeSelect, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { chamberOf } from '@open-reloading/drawing/seating'
import type { UserCartridge } from '@open-reloading/schema'
import { Ruler } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { formatNumber } from '../i18n/number.ts'
import { msg } from '../i18n/translate.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import type { CartridgeDetail, CartridgeSummary } from '../lib/api-types.ts'
import {
  type Action,
  type CartridgeFieldSpec,
  type Derived,
  type Design,
  draws,
  type Evaluation,
  evaluate,
  type FieldState,
  fieldSpecs,
  fileData,
  fromRecord,
  fromUser,
  type Group,
  groups,
  missingHint,
  newDesign,
  reduce,
  tables,
} from '../lib/cartridge-designer.ts'
import { symbolText } from '../lib/cartridge-record.ts'
import { type FieldValue, fieldError } from '../lib/field-spec.ts'
import type { FieldRow } from '../lib/record-fields.ts'
import { drawingLengthUnit, fixedFieldText, formatQuantity, type UnitSystem } from '../lib/units.ts'
import { resolveCartridge } from '../lib/variants.ts'
import { verbatim } from '../lib/wording.ts'
import { CartridgeDrawing, type View } from './cartridge-drawing.tsx'
import { DesignerField } from './designer-field.tsx'
import { DesignerToolbar } from './designer-toolbar.tsx'
import { FieldTable } from './field-table.tsx'
import { FileMenu } from './file-menu.tsx'
import type { FieldFlag } from './number-field.tsx'
import { PageBar } from './page-bar.tsx'
import { PropertyGrid } from './property-grid.tsx'
import { RecordSearch } from './record-search.tsx'
import { EmptyNote, Loading } from './states.tsx'
import { useFieldUnits } from './units-settings.tsx'
import { useDesigner } from './use-designer.ts'
import { measuredWaterCapacitySpec } from './workbench-inputs.tsx'
import { Workspace } from './workspace.tsx'

const SeatingPreview = dynamic(
  () => import('./seating-preview.tsx').then((m) => m.SeatingPreview),
  { ssr: false, loading: () => <Loading what="the preview" inline /> },
)

const noSeated = () => {}
const noCapacity: FieldValue = { text: '', si: undefined }

const valueText = (q: Derived['quantity'], system: UnitSystem, si: number) => {
  const { symbol, fromSi } = system[q]
  // a body taper is a fraction of a degree: angles with 2 decimals
  const text = q === 'angle' ? formatNumber(fromSi(si), 2) : formatQuantity(q, system, si)
  return `${text}${symbol ? ` ${symbol}` : ''}`
}

/** The field's help: the symbol's meaning, where its value comes from, then its outline notes. */
function helpText(
  s: CartridgeFieldSpec,
  state: FieldState,
  system: UnitSystem,
  notes: string[] = [],
) {
  const value = (si: number) => valueText(s.quantity as Derived['quantity'], system, si)
  const from = (() => {
    switch (state.kind) {
      case 'record':
        return 'From the record'
      case 'entered':
        return state.changed
          ? `Changed; record ${state.record === undefined ? 'value not printed' : value(state.record)}`
          : 'Entered'
      case 'cleared':
        return `Cleared; record ${value(state.record)}`
      case 'derived':
        return `Derived by the drawing: ${value(state.si)}`
      case 'notPrinted':
        return 'Not printed in the record'
      case 'empty':
        return 'Not given'
    }
  })()
  const meaning = s.meaning.charAt(0).toUpperCase() + s.meaning.slice(1)
  return [`${meaning}. ${from}.`, ...notes].join(' ')
}

/** The flag of a field's state on its input's edge. */
const flagOf: Partial<Record<FieldState['kind'], FieldFlag['kind']>> = {
  record: 'record',
  cleared: 'changed',
  derived: 'derived',
}

/** The grid's rows: one per symbol of a group, its cartridge and chamber fields side by side. */
const rowsOf = (g: Group) => {
  const rows: {
    symbol: string
    meaning: string
    sides: Partial<Record<string, CartridgeFieldSpec>>
  }[] = []
  for (const s of fieldSpecs.filter((f) => f.group === g)) {
    const last = rows.at(-1)
    if (last?.symbol === s.symbol) last.sides[s.side] = s
    else rows.push({ symbol: s.symbol, meaning: s.meaning, sides: { [s.side]: s } })
  }
  return rows
}

const StartSearch = memo(function StartSearch({
  start,
  chosen,
}: {
  start: (id: string) => void
  /** The record the design started from, shown in the empty field. */
  chosen?: string | undefined
}) {
  return (
    <RecordSearch<CartridgeSummary>
      kind="cartridges"
      label="Start from a record"
      chosen={chosen ?? 'Start from a record'}
      picked={chosen !== undefined}
      describe={(c) => `${c.name}, CIP table ${c.table}`}
      onSelect={(c) => start(c.id)}
      noneText="No cartridge found"
      unreachableText="The database is unreachable. The designer still works."
    />
  )
})

const TableSelect = memo(function TableSelect({
  value,
  dispatch,
}: {
  value: string
  dispatch: (a: Action) => void
}) {
  // a table VII record keeps its own table: its shotshell symbols are not edited here
  const shotshell = value === 'VII'
  return (
    <NativeSelect
      label="Drawing rules of CIP table"
      description="Table III draws a belt; the other tables draw the same outline."
      value={value}
      disabled={shotshell}
      data={(shotshell ? ['VII'] : tables).map((t) => ({ value: t, label: `Table ${t}` }))}
      onChange={(ev) => dispatch({ type: 'table', value: ev.currentTarget.value })}
    />
  )
})

/** The derived values in two reserved lines; each value with its basis is in the line's title. */
function DerivedLine({ rows, system }: { rows: Derived[]; system: UnitSystem }) {
  const value = (d: Derived) => `${d.label} ${valueText(d.quantity, system, d.si)}`
  return (
    <Text
      component="p"
      inherit
      fz="sm"
      m="0.25rem 0 0"
      className="derived-line"
      title={rows.map((d) => `${value(d)}: ${d.basis}`).join('\n') || undefined}
    >
      {rows.length > 0 && `Derived from the design: ${rows.map(value).join(', ')}.`}
    </Text>
  )
}

const fieldLabel = (key: string) => fieldSpecs.find((s) => s.key === key)?.label ?? key

const isChanged = (state: FieldState) =>
  state.kind === 'cleared' || (state.kind === 'entered' && state.changed)

const seatMissing = (drawn: boolean) =>
  drawn
    ? 'Not given: the cartridge L3, which the seating needs.'
    : 'Not given: a drawing of the cartridge, which the seating needs.'

const staleText = (refusal: { field: string; reason: string }, drawn: boolean) =>
  `${drawn ? 'Drawing for earlier inputs. ' : ''}Fix ${fieldLabel(refusal.field)}: ${refusal.reason}`

/** The polite line: the refusal, else the last change, that the drawing updated and the derived values. */
function announcement(
  e: Evaluation,
  changed: CartridgeFieldSpec | undefined | '',
  design: Design,
  derivedText: string,
) {
  if (e.refusal) return `Drawing not updated: ${e.refusal.reason}`
  const change = changed
    ? `${changed.label} ${design.fields[changed.key]?.text || 'cleared'}. `
    : ''
  return `${change}Drawing updated.${derivedText ? ` ${derivedText}.` : ''}`
}

/** The Parameters panel's message for a locked, changed-base or started-from design. */
function designMessage(design: Design) {
  if (design.locked) return `Read only: ${design.locked.reason}`
  if (design.baseChanged)
    return `The base record ${design.origin?.title ?? design.basedOn} changed since this design was saved. Fields you did not change follow it; Save keeps the design against the new base.`
  return design.origin && `Started from ${design.origin.title.replace(/\.?$/, '.')}`
}

function DrawingFigure({
  drawn,
  stale,
  refused,
  title,
  view,
  onView,
  unit,
}: {
  drawn: Evaluation | undefined
  stale: boolean
  refused: boolean
  title: string
  view: View | undefined
  onView: (v: View) => void
  unit: ReturnType<typeof drawingLengthUnit>
}) {
  if (drawn?.spec)
    return (
      <div className="designer-drawing" data-stale={stale || undefined}>
        <CartridgeDrawing
          spec={drawn.spec}
          list={drawn.figures}
          heading={title}
          caption="Changed values are drawn as entered, without the record's tolerances."
          view={view}
          onView={onView}
          unit={unit}
        />
      </div>
    )
  if (refused) return null
  return (
    <EmptyNote
      icon={<Ruler size={24} aria-hidden="true" />}
      title="No drawing yet"
      description={missingHint}
    />
  )
}

/** The drawing a bullet can seat in: not a shotshell, and one whose values give a chamber. */
function seating(drawn: Evaluation | undefined) {
  const seatSpec = drawn?.spec?.table === 'VII' ? undefined : drawn?.spec
  return { seatSpec, canSeat: seatSpec !== undefined && chamberOf(seatSpec.values) !== undefined }
}

/** The instruction for a design missing its base values is not shown as a refusal. */
const withoutHint = (refusal: Evaluation['refusal']) =>
  refusal?.reason.endsWith(missingHint) ? undefined : refusal

const fieldFlag = (state: FieldState) => (isChanged(state) ? 'changed' : flagOf[state.kind])

async function loadCartridge(id: string, system: UnitSystem) {
  const record = await fetchRecord<CartridgeDetail>('cartridges', id)
  if (!record) throw new Error('No such cartridge')
  if (!draws(record))
    return 'This cartridge has no CIP record that draws. The designer still works.'
  return fromRecord(record, system)
}

function fieldErrorText(
  s: CartridgeFieldSpec,
  design: Design,
  system: UnitSystem,
  refusal: { field: string; reason: string } | undefined,
  e: Evaluation,
) {
  return (
    fieldError(s, design.fields[s.key], system) ??
    (refusal?.field === s.key ? refusal.reason : undefined) ??
    e.checks[s.key]?.join(' ')
  )
}

function ParameterHead({
  start,
  design,
  shotshell,
  dispatch,
  unit,
}: {
  start: (id: string) => void
  design: Design
  shotshell: boolean
  dispatch: (a: Action) => void
  unit: string
}) {
  return (
    <>
      <StartSearch start={start} chosen={design.origin?.title} />
      <div className="prop-grid designer-grid">
        <TableSelect value={design.table} dispatch={dispatch} />
      </div>
      {shotshell ? (
        <p className="note">
          Shotshell dimensions (CIP table VII) are not edited in the designer; the drawing shows the
          record.
        </p>
      ) : (
        // the unit once per column; screen readers have it in each field's name
        <div className="side-row side-head" aria-hidden="true">
          <span>Symbol</span>
          <span>Cartridge, {unit}</span>
          <span>Chamber, {unit}</span>
        </div>
      )}
    </>
  )
}

/**
 * The cartridge designer: a Symbol, Cartridge and Chamber grid of the CIP symbols, the
 * cartridge page's drawing on the design beside it, checks at the fields, derived values, undo and
 * redo; the last valid drawing stays while the input is refused.
 */
export function CartridgeDesigner() {
  /** The view picked; Combined once both sides draw until one is picked. */
  const [view, setView] = useState<View>()
  const { system, history, design, dispatch, loading, fileMenu, start, toolbarDispatch } =
    useDesigner<Design, Action>({
      reduce,
      init: () => newDesign(),
      kind: 'cartridge',
      fileData,
      load: loadCartridge,
      loadingText: 'Loading the cartridge…',
      failText: 'The cartridge could not be loaded. The designer still works.',
    })

  const e = useMemo(() => evaluate(design, system, history.last), [design, system, history.last])
  const lastGood = useRef<Evaluation | undefined>(undefined)
  if (e.spec) lastGood.current = e
  // the drawing lays out after the fields have taken the input
  const drawn = useDeferredValue(e.spec ? e : lastGood.current)

  // the bullet seats in the drawing shown, its values the case and chamber; the controls portal
  // into the Seat a bullet section, the user's measured capacity stays here through a redraw
  const [seatSlot, setSeatSlot] = useState<HTMLElement | null>(null)
  const [capacity, setCapacity] = useState<FieldValue>(noCapacity)
  useFieldUnits(
    [measuredWaterCapacitySpec],
    system,
    (update) => setCapacity((f) => update({ measuredWaterCapacity: f }).measuredWaterCapacity ?? f),
    fixedFieldText,
  )
  const designName = design.origin ? `design from ${design.origin.title}` : 'new cartridge'
  const title = `Outline, ${designName}`
  const { seatSpec, canSeat } = seating(drawn)
  const draft = useMemo(
    () => (seatSpec && canSeat ? { spec: seatSpec, title: designName } : undefined),
    [seatSpec, canSeat, designName],
  )

  // one polite line 500 ms after the last change, with the derived values
  const changed = history.last && fieldSpecs.find((s) => s.key === history.last)
  const derivedText = e.derived
    .map((d) => `${d.label} ${valueText(d.quantity, system, d.si)}`)
    .join(', ')
  // nothing to announce before the first change or start
  const message = history.past.length ? announcement(e, changed, design, derivedText) : ''
  const [announced] = useDebouncedValue(message, 500)
  // before the first edit a design missing its base values shows the instruction, not a refusal
  const refusal = history.past.length ? e.refusal : withoutHint(e.refusal)

  const errorOf = (s: CartridgeFieldSpec) => fieldErrorText(s, design, system, refusal, e)

  const shotshell = design.table === 'VII'
  const field = (s: CartridgeFieldSpec) => {
    const state = e.states[s.key]
    const value = design.fields[s.key]
    if (!(state && value)) return null
    const changed = isChanged(state)
    return (
      <DesignerField
        key={s.key}
        spec={s}
        system={system}
        value={value}
        help={helpText(s, state, system, e.notes[s.key])}
        flag={fieldFlag(state)}
        changed={changed}
        error={errorOf(s)}
        // the column header names the length unit; an angle keeps its own
        unit={s.quantity === 'length' ? 'none' : 'text'}
        dispatch={dispatch}
      />
    )
  }
  const groupFields = (g: Group) => (
    <div className="side-grid">
      {rowsOf(g).map((r) => (
        <div key={r.symbol} className="side-row">
          <span className="prop-label" title={r.meaning}>
            {symbolText(r.symbol)}
          </span>
          {(['cartridge', 'chamber'] as const).map((side) => {
            const s = r.sides[side]
            return s ? field(s) : <span key={side} />
          })}
        </div>
      ))}
    </div>
  )

  // the File menu renders after an edit's drawing, from the deferred design
  const fileDesign = useDeferredValue(design)
  const fileValue = useMemo(() => fileData(fileDesign), [fileDesign])
  const openFile = useCallback(
    async (d: UserCartridge) =>
      dispatch({ type: 'start', design: fromUser(d, await resolveCartridge(d), system) }),
    [system, dispatch],
  )

  // New bullet or cartridge starts a new record

  const toolbar = (
    <>
      <DesignerToolbar
        undo={history.past.length > 0}
        redo={history.future.length > 0}
        reset={design.origin !== undefined}
        newLabel="New cartridge"
        resetLabel="Reset to record"
        system={system}
        dispatch={toolbarDispatch}
      />
      <FileMenu
        ref={fileMenu}
        kind="cartridge"
        name={fileDesign.origin?.title ?? 'Cartridge design'}
        data={fileValue}
        problem={fileDesign.locked?.reason}
        onOpen={openFile}
        reportBox="Include the design"
      />
    </>
  )

  const inputs = (
    <form noValidate onSubmit={(ev) => ev.preventDefault()}>
      {/* a design whose base is gone is shown, not edited */}
      <fieldset disabled={design.locked !== undefined} className="designer-fieldset">
        <PropertyGrid
          title="Parameters"
          head={
            <ParameterHead
              start={start}
              design={design}
              shotshell={shotshell}
              dispatch={dispatch}
              unit={system.length.symbol}
            />
          }
          message={loading ?? designMessage(design)}
          sections={
            shotshell
              ? []
              : [
                  ...(Object.keys(groups) as Group[]).map((g) => ({
                    key: g,
                    title: groups[g],
                    content: groupFields(g),
                  })),
                  {
                    key: 'seat',
                    title: 'Seat a bullet',
                    content: canSeat ? (
                      <div ref={setSeatSlot} className="seating-slot" />
                    ) : (
                      <p className="note">{seatMissing(drawn?.spec !== undefined)}</p>
                    ),
                  },
                ]
          }
        />
      </fieldset>
    </form>
  )

  // print: the drawing and the values, not the form
  const values = fieldSpecs.flatMap((s): FieldRow[] => {
    const si = design.fields[s.key]?.si
    return si === undefined
      ? []
      : [{ label: verbatim(s.label), value: { quantity: s.quantity, si } }]
  })

  const results = (
    <>
      <div className="page-panel-head designer-panel-head">
        <h2 className="page-panel-title record-heading">Drawing</h2>
      </div>
      {/* a slot of its own: a refusal does not move the drawing */}
      <Text component="p" inherit fz="sm" m={0} className="stale-line" title={refusal?.reason}>
        {refusal && staleText(refusal, drawn !== undefined)}
      </Text>
      <DrawingFigure
        drawn={drawn}
        stale={!e.spec}
        refused={refusal !== undefined}
        title={title}
        view={view}
        onView={setView}
        unit={drawingLengthUnit(system)}
      />
      {draft && (
        <SeatingPreview
          draft={draft}
          system={system}
          view="combined"
          slots={{ cartridge: seatSlot, gun: null }}
          onSeated={noSeated}
          measuredWaterCapacity={capacity}
          onMeasuredWaterCapacity={setCapacity}
        />
      )}
      {/* of the drawing shown: a refusal keeps them with the earlier drawing */}
      <DerivedLine rows={drawn?.derived ?? []} system={system} />
      <div className="print-only">
        <FieldTable caption={msg('Values of the design')} groups={[{ rows: values }]} />
      </div>
    </>
  )

  return (
    <>
      <PageBar title="Cartridge designer" actions={toolbar} />
      <div className="designer">
        {/* outside the tabs: the results panel is hidden on the phone Inputs tab */}
        <p role="status" className="status visually-hidden">
          {announced}
        </p>
        {/* on a phone the drawing stays above the fields, no tabs */}
        <Workspace inputs={inputs} results={results} bar={() => null} />
      </div>
    </>
  )
}
