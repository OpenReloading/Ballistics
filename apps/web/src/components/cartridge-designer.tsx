'use client'

import { NativeSelect, Table, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { chamberOf } from '@open-reloading/drawing/seating'
import type { UserCartridge } from '@open-reloading/schema'
import { Ruler } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import {
  memo,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber, localizeNumber } from '../i18n/number.ts'
import { msg, type Translator } from '../i18n/translate.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import type { CartridgeDetail, CartridgeSummary } from '../lib/api-types.ts'
import {
  type Action,
  type CartridgeFieldSpec,
  type Derived,
  type Design,
  designFileName,
  draws,
  type Evaluation,
  evaluate,
  type FieldState,
  fieldLabel,
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
import { groupLabel, meaningText, symbolText } from '../lib/cartridge-record.ts'
import { measuredWaterCapacitySpec } from '../lib/case-capacity.ts'
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
import { UnitsIconButton, useFieldUnits } from './units-settings.tsx'
import { useDesigner } from './use-designer.ts'
import { Workspace } from './workspace.tsx'

const SeatingPreview = dynamic(
  () => import('./seating-preview.tsx').then((m) => m.SeatingPreview),
  { ssr: false, loading: () => <Loading what="the preview" inline /> },
)

type Translate = Translator['t']

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
  notes: string[],
  t: Translate,
) {
  const value = (si: number) => valueText(s.quantity as Derived['quantity'], system, si)
  const from = (() => {
    switch (state.kind) {
      case 'record':
        return t('From the record')
      case 'entered':
        if (!state.changed) return t('Entered')
        return state.record === undefined
          ? t('Changed; record value not printed')
          : t('Changed; record {value}', { value: value(state.record) })
      case 'cleared':
        return t('Cleared; record {value}', { value: value(state.record) })
      case 'derived':
        return t('Derived by the drawing: {value}', { value: value(state.si) })
      case 'notPrinted':
        return t('Not printed in the record')
      case 'empty':
        return t('Not given')
    }
  })()
  const text = meaningText(s.meaning, t)
  const meaning = text.charAt(0).toUpperCase() + text.slice(1)
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
  const { t } = useTranslation()
  return (
    <RecordSearch<CartridgeSummary>
      kind="cartridges"
      label={t('Start from a record')}
      chosen={chosen ?? t('Start from a record')}
      picked={chosen !== undefined}
      describe={(c) => t('{name}, CIP table {table}', { name: c.name, table: c.table })}
      onSelect={(c) => start(c.id)}
      noneText={t('No cartridge found')}
      unreachableText={t('The database is unreachable. The designer still works.')}
    />
  )
})

/** The design's name: the file's name and the workbench's title of the design. */
const NameField = memo(function NameField({
  value,
  placeholder,
  dispatch,
}: {
  value: string
  /** The name saved while none is typed. */
  placeholder: string
  dispatch: (a: Action) => void
}) {
  const { t } = useTranslation()
  return (
    <TextInput
      label={t('Name')}
      maxLength={200}
      value={value}
      placeholder={placeholder}
      onChange={(ev) => dispatch({ type: 'name', value: ev.currentTarget.value })}
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
  const { t } = useTranslation()
  return (
    <NativeSelect
      label={t('Drawing rules of CIP table')}
      description={t('Table III draws a belt; the other tables draw the same outline.')}
      value={value}
      disabled={shotshell}
      data={(shotshell ? ['VII'] : tables).map((table) => ({
        value: table,
        label: t('Table {table}', { table }),
      }))}
      onChange={(ev) => dispatch({ type: 'table', value: ev.currentTarget.value })}
    />
  )
})

/** The derived values as a table of label and value; a row's title has the value's basis. */
function DerivedTable({ rows, system }: { rows: Derived[]; system: UnitSystem }) {
  const { t } = useTranslation()
  if (rows.length === 0) return null
  return (
    <Table
      className="derived-table"
      fz="sm"
      verticalSpacing={2}
      horizontalSpacing="xs"
      withRowBorders={false}
    >
      <Table.Caption>{t('Derived from the design')}</Table.Caption>
      <Table.Tbody>
        {rows.map((d) => (
          <Table.Tr key={d.key} title={d.basis}>
            <Table.Th scope="row">{d.label}</Table.Th>
            <Table.Td>{valueText(d.quantity, system, d.si)}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

const labelOf = (key: string, t: Translate) => {
  const s = fieldSpecs.find((f) => f.key === key)
  return s ? fieldLabel(s, t) : key
}

const isChanged = (state: FieldState) =>
  state.kind === 'cleared' || (state.kind === 'entered' && state.changed)

const seatMissing = (drawn: boolean, t: Translate) =>
  drawn
    ? t('Not given: the cartridge L3, which the seating needs.')
    : t('Not given: a drawing of the cartridge, which the seating needs.')

const staleText = (refusal: { field: string; reason: string }, drawn: boolean, t: Translate) => {
  const values = { label: labelOf(refusal.field, t), reason: refusal.reason }
  return drawn
    ? t('Drawing for earlier inputs. Fix {label}: {reason}', values)
    : t('Fix {label}: {reason}', values)
}

/** The polite line: the refusal, else the last change, that the drawing updated and the derived values. */
function announcement(
  e: Evaluation,
  changed: CartridgeFieldSpec | undefined | '',
  design: Design,
  derivedText: string,
  t: Translate,
) {
  if (e.refusal) return t('Drawing not updated: {reason}', { reason: e.refusal.reason })
  const text = changed && design.fields[changed.key]?.text
  const change = !changed
    ? ''
    : text
      ? t('{label} {value}.', { label: fieldLabel(changed, t), value: localizeNumber(text) })
      : t('{label} cleared.', { label: fieldLabel(changed, t) })
  const updated = derivedText
    ? t('Drawing updated. {derived}.', { derived: derivedText })
    : t('Drawing updated.')
  return change ? `${change} ${updated}` : updated
}

/** The Parameters panel's message for a locked, changed-base or started-from design. */
function designMessage(design: Design, t: Translate) {
  if (design.locked) return t('Read only: {reason}', { reason: design.locked.reason })
  if (design.baseChanged)
    return t(
      'The base record {name} changed since this design was saved. Fields you did not change follow it; Save keeps the design against the new base.',
      { name: design.origin?.title ?? design.basedOn ?? '' },
    )
  return (
    design.origin && t('Started from {name}.', { name: design.origin.title.replace(/\.$/, '') })
  )
}

function DrawingFigure({
  drawn,
  stale,
  refused,
  title,
  view,
  onView,
  controls,
  unit,
}: {
  drawn: Evaluation | undefined
  stale: boolean
  refused: boolean
  title: string
  view: View | undefined
  onView: (v: View) => void
  /** The panel header's slot for the view switch. */
  controls: HTMLElement | null
  unit: ReturnType<typeof drawingLengthUnit>
}) {
  const { t } = useTranslation()
  if (drawn?.spec)
    return (
      <div className="designer-drawing" data-stale={stale || undefined}>
        <CartridgeDrawing
          spec={drawn.spec}
          list={drawn.figures}
          heading={title}
          caption={t("Changed values are drawn as entered, without the record's tolerances.")}
          view={view}
          onView={onView}
          controls={controls}
          unit={unit}
        />
      </div>
    )
  if (refused) return null
  return (
    <EmptyNote
      icon={<Ruler size={24} aria-hidden="true" />}
      title={t('No drawing yet')}
      description={t(missingHint)}
    />
  )
}

/** The drawing a bullet can seat in: not a shotshell, and one whose values give a chamber. */
function seating(drawn: Evaluation | undefined) {
  const seatSpec = drawn?.spec?.table === 'VII' ? undefined : drawn?.spec
  return { seatSpec, canSeat: seatSpec !== undefined && chamberOf(seatSpec.values) !== undefined }
}

/** The instruction for a design missing its base values is not shown as a refusal. */
const withoutHint = (refusal: Evaluation['refusal'], t: Translate) =>
  refusal?.reason.endsWith(t(missingHint)) ? undefined : refusal

const fieldFlag = (state: FieldState) => (isChanged(state) ? 'changed' : flagOf[state.kind])

async function loadCartridge(id: string, system: UnitSystem) {
  const record = await fetchRecord<CartridgeDetail>('cartridges', id)
  if (!record) throw new Error('No such cartridge')
  if (!draws(record))
    return msg('This cartridge has no CIP record that draws. The designer still works.')
  return fromRecord(record, system)
}

function fieldErrorText(
  s: CartridgeFieldSpec,
  design: Design,
  system: UnitSystem,
  refusal: { field: string; reason: string } | undefined,
  e: Evaluation,
  t: Translate,
) {
  return (
    fieldError({ ...s, label: fieldLabel(s, t) }, design.fields[s.key], system, t) ??
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
  seat,
}: {
  start: (id: string) => void
  design: Design
  shotshell: boolean
  dispatch: (a: Action) => void
  unit: string
  /** The Seat a bullet block: the most used fields, before the long CIP groups. */
  seat: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <>
      <StartSearch start={start} chosen={design.origin?.title} />
      <div className="prop-grid designer-grid">
        <NameField
          value={design.name ?? ''}
          placeholder={design.origin?.title ?? t('Cartridge design')}
          dispatch={dispatch}
        />
        <TableSelect value={design.table} dispatch={dispatch} />
      </div>
      {shotshell ? (
        <p className="note">
          {t(
            'Shotshell dimensions (CIP table VII) are not edited in the designer; the drawing shows the record.',
          )}
        </p>
      ) : (
        <>
          <div className="designer-seat">
            <h3 className="prop-head">{t('Seat a bullet')}</h3>
            {seat}
          </div>
          {/* the unit once per column; screen readers have it in each field's name */}
          <div className="side-row side-head" aria-hidden="true">
            <span>{t('Symbol')}</span>
            <span>{t('Cartridge, {unit}', { unit })}</span>
            <span>{t('Chamber, {unit}', { unit })}</span>
          </div>
        </>
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
  const { t } = useTranslation()
  /** The view picked; Combined once both sides draw until one is picked. */
  const [view, setView] = useState<View>()
  // the view switch goes in the Drawing panel's header row
  const [viewSlot, setViewSlot] = useState<HTMLElement | null>(null)
  const { system, history, design, dispatch, loading, fileMenu, start, toolbarDispatch } =
    useDesigner<Design, Action>({
      reduce,
      init: () => newDesign(),
      kind: 'cartridge',
      fileData,
      load: loadCartridge,
      loadingText: msg('Loading the cartridge…'),
      failText: msg('The cartridge could not be loaded. The designer still works.'),
    })

  const e = useMemo(
    () => evaluate(design, system, history.last, t),
    [design, system, history.last, t],
  )
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
  const typed = design.name?.trim()
  const designName = typed
    ? typed
    : design.origin
      ? t('design from {name}', { name: design.origin.title })
      : t('new cartridge')
  const title = t('Outline, {name}', { name: designName })
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
  const message = history.past.length ? announcement(e, changed, design, derivedText, t) : ''
  const [announced] = useDebouncedValue(message, 500)
  // before the first edit a design missing its base values shows the instruction, not a refusal
  const refusal = history.past.length ? e.refusal : withoutHint(e.refusal, t)

  const errorOf = (s: CartridgeFieldSpec) => fieldErrorText(s, design, system, refusal, e, t)

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
        help={helpText(s, state, system, e.notes[s.key] ?? [], t)}
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
          <span className="prop-label" title={meaningText(r.meaning, t)}>
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
    async (d: UserCartridge, name: string) =>
      dispatch({
        type: 'start',
        design: { ...fromUser(d, await resolveCartridge(d), system), name },
      }),
    [system, dispatch],
  )

  // New bullet or cartridge starts a new record

  const toolbar = (
    <DesignerToolbar
      undo={history.past.length > 0}
      redo={history.future.length > 0}
      reset={design.origin !== undefined}
      newLabel={t('New cartridge')}
      resetLabel={t('Reset to record')}
      system={system}
      dispatch={toolbarDispatch}
    />
  )
  const actions = (
    <>
      <FileMenu
        ref={fileMenu}
        kind="cartridge"
        name={designFileName(fileDesign)}
        data={fileValue}
        problem={fileDesign.locked?.reason}
        onOpen={openFile}
        reportBox={t('Include the design')}
      />
      <UnitsIconButton />
    </>
  )

  const inputs = (
    <form noValidate onSubmit={(ev) => ev.preventDefault()}>
      {/* a design whose base is gone is shown, not edited */}
      <fieldset disabled={design.locked !== undefined} className="designer-fieldset">
        <PropertyGrid
          title={t('Parameters')}
          head={
            <ParameterHead
              start={start}
              design={design}
              shotshell={shotshell}
              dispatch={dispatch}
              unit={system.length.symbol}
              seat={
                canSeat ? (
                  <div ref={setSeatSlot} className="seating-slot" />
                ) : (
                  <p className="note">{seatMissing(drawn?.spec !== undefined, t)}</p>
                )
              }
            />
          }
          message={loading ?? designMessage(design, t)}
          sections={
            shotshell
              ? []
              : (Object.keys(groups) as Group[]).map((g) => ({
                  key: g,
                  title: groupLabel(groups[g], t),
                  content: groupFields(g),
                }))
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
      : [{ label: verbatim(fieldLabel(s, t)), value: { quantity: s.quantity, si } }]
  })

  const results = (
    <>
      <div className="page-panel-head designer-panel-head">
        <h2 className="page-panel-title record-heading">{t('Drawing')}</h2>
        <div ref={setViewSlot} className="designer-view-slot" />
      </div>
      {/* a slot of its own: a refusal does not move the drawing */}
      <Text component="p" inherit fz="sm" m={0} className="stale-line" title={refusal?.reason}>
        {refusal && staleText(refusal, drawn !== undefined, t)}
      </Text>
      <DrawingFigure
        drawn={drawn}
        stale={!e.spec}
        refused={refusal !== undefined}
        title={title}
        view={view}
        onView={setView}
        controls={viewSlot}
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
      <DerivedTable rows={drawn?.derived ?? []} system={system} />
      <div className="print-only">
        <FieldTable caption={msg('Values of the design')} groups={[{ rows: values }]} />
      </div>
    </>
  )

  return (
    <>
      <PageBar title={msg('Cartridge designer')} translated fold={toolbar} actions={actions} />
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
