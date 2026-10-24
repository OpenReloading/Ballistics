'use client'

import { NativeSelect, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { face, type LengthUnit } from '@open-reloading/drawing'
import { bulletFigureModel, bulletSymbols } from '@open-reloading/drawing/bullet'
import type { Bullet, BulletDesign } from '@open-reloading/schema'
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef } from 'react'
import { fetchRecord } from '../lib/api-fetch.ts'
import type { BulletSummary } from '../lib/api-types.ts'
import {
  type Action,
  type ChoiceKey,
  choiceOptions,
  type Design,
  type DesignerSpec,
  type Drawing,
  designerSpecs,
  evaluate,
  type FieldState,
  fieldInUse,
  fileData,
  fromFile,
  fromRecord,
  type Group,
  groups,
  newDesign,
  reduce,
} from '../lib/bullet-designer.ts'
import { fieldError } from '../lib/field-spec.ts'
import { fetchManufacturerNames, noManufacturerNames, productLabel } from '../lib/manufacturers.ts'
import { type FieldRow, rowLabel, rowValue } from '../lib/record-fields.ts'
import { drawingLengthUnit, formatQuantity, type UnitSystem, withUnit } from '../lib/units.ts'
import { description } from './bullet-drawing.tsx'
import { DesignerField } from './designer-field.tsx'
import { DesignerToolbar } from './designer-toolbar.tsx'
import { FieldTable } from './field-table.tsx'
import { FileMenu } from './file-menu.tsx'
import type { FieldFlag } from './number-field.tsx'
import { PageBar } from './page-bar.tsx'
import { PropertyGrid } from './property-grid.tsx'
import { DrawingNotes } from './record-actions.tsx'
import { RecordSearch } from './record-search.tsx'
import { TechnicalDrawing } from './technical-drawing.tsx'
import { useDesigner } from './use-designer.ts'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import { Workspace } from './workspace.tsx'

const choiceLabels: Record<ChoiceKey, [string, Group]> = {
  'base.type': ['Base type', 'base'],
  'ogive.form': ['Nose form', 'nose'],
  'tip.type': ['Tip', 'tip'],
}

/** Hollow bases get shorter names: the select is too narrow for the full type name. */
const shortLabels: Record<string, string> = {
  'conical-hollow-base': 'hollow cone',
  'rounded-hollow-base': 'hollow round',
}

const optionLabel = (o: string) =>
  o === '' ? 'Not given' : (shortLabels[o] ?? o.replaceAll('-', ' '))

/** The field's state line: where its value comes from. */
function stateText(s: DesignerSpec, state: FieldState, system: UnitSystem) {
  const unit = system[s.quantity].symbol
  const value = (si: number) => `${formatQuantity(s.quantity, system, si)}${unit ? ` ${unit}` : ''}`
  switch (state.kind) {
    case 'record':
      return 'From the catalog record'
    case 'entered':
      return state.changed
        ? `Changed; catalog ${state.record === undefined ? 'value not given' : value(state.record)}`
        : 'Entered'
    case 'derived':
      return `Derived: ${value(state.si)}`
    case 'assumed':
      return `Assumed: ${value(state.si)}${state.basis ? ` (${state.basis})` : ''}`
    case 'empty':
      return 'Not given'
  }
}

/** The flag of a field's state on its input's edge. */
const flagOf: Partial<Record<FieldState['kind'], FieldFlag['kind']>> = {
  record: 'record',
  derived: 'derived',
  assumed: 'derived',
}

const StartSearch = memo(function StartSearch({
  system,
  start,
  chosen,
}: {
  system: UnitSystem
  start: (id: string) => void
  /** The bullet the design started from, shown in the empty field. */
  chosen?: string
}) {
  const names = useManufacturerNames()
  return (
    <RecordSearch<BulletSummary>
      kind="bullets"
      label="Start from a record"
      chosen={chosen ?? 'Start from a record'}
      picked={chosen !== undefined}
      describe={(b) => `${productLabel(b, names)}, ${withUnit('mass', system, b.mass * 1e-3)}`}
      onSelect={(b) => start(b.id)}
      noneText="No bullet found"
      unreachableText="The database is unreachable. The designer still works."
    />
  )
})

const ChoiceSelect = memo(function ChoiceSelect({
  k,
  value,
  error,
  dispatch,
}: {
  k: ChoiceKey
  value: string
  error?: string
  dispatch: (a: Action) => void
}) {
  return (
    // the message is the description (screen readers, the grid's help line) and the title: it moves nothing
    <div className="designer-field" data-error={error ? true : undefined}>
      <NativeSelect
        label={choiceLabels[k][0]}
        labelProps={{ title: error }}
        value={value}
        description={error}
        error={!!error}
        data={['', ...choiceOptions[k]].map((o) => ({ value: o, label: optionLabel(o) }))}
        onChange={(ev) => dispatch({ type: 'choice', key: k, value: ev.currentTarget.value })}
      />
    </div>
  )
})

const TextField = memo(function TextField({
  k,
  label,
  value,
  dispatch,
}: {
  k: 'manufacturerName' | 'name'
  label: string
  value: string
  dispatch: (a: Action) => void
}) {
  return (
    <TextInput
      label={label}
      value={value}
      onChange={(ev) => dispatch({ type: 'text', key: k, value: ev.currentTarget.value })}
    />
  )
})

/** The hidden print drawing, laid out and drawn after the screen drawing (a deferred value). */
const PrintDrawing = memo(function PrintDrawing({
  profile,
  title,
  unit,
}: {
  profile: Drawing['profile']
  title: string
  unit: LengthUnit
}) {
  return (
    <TechnicalDrawing
      id="designer-drawing-print"
      title={title}
      describedBy="designer-drawing-desc"
      model={bulletFigureModel(profile, 'print', face.printEm, 0, unit)}
    />
  )
})

/**
 * The bullet designer: a property grid of the fields, a live technical drawing beside
 * it, undo and redo; the last valid drawing stays while the input is refused.
 */
export function BulletDesigner() {
  const { system, history, design, dispatch, loading, fileMenu, start, toolbarDispatch } =
    useDesigner<Design, Action>({
      reduce,
      init: newDesign,
      kind: 'bulletDesign',
      fileData,
      load: async (id, system) => {
        const record = await fetchRecord<Bullet>('bullets', id)
        if (!record) throw new Error('No such bullet')
        // without names the design starts with an empty manufacturer
        const names = await fetchManufacturerNames().catch(() => noManufacturerNames)
        return fromRecord(record, system, names)
      },
      loadingText: 'Loading the bullet…',
      failText: 'The bullet could not be loaded. The designer still works.',
    })

  const e = useMemo(() => evaluate(design, system, history.last), [design, system, history.last])
  const lastGood = useRef<Drawing | undefined>(undefined)
  if (e.drawing) lastGood.current = e.drawing
  const drawing = e.drawing ?? lastGood.current
  const printed = useDeferredValue(drawing)
  const label = (key: string) =>
    designerSpecs.find((s) => s.key === key)?.label ??
    (key in choiceLabels ? choiceLabels[key as ChoiceKey][0] : key)

  // one polite line 500 ms after the last change
  const changed = history.last && designerSpecs.find((s) => s.key === history.last)
  const message = e.refusal
    ? `Drawing not updated: ${e.refusal.reason}`
    : `${changed ? `${changed.label} ${design.fields[changed.key].text || 'cleared'}. ` : ''}Drawing updated.`
  const [announced] = useDebouncedValue(message, 500)

  const errorOf = (key: string) =>
    fieldError(
      designerSpecs.find((s) => s.key === key) as DesignerSpec,
      design.fields[key],
      system,
    ) ?? (e.refusal?.field === key ? e.refusal.reason : undefined)

  const groupFields = (g: Group) => (
    <div className="prop-grid designer-grid">
      {(Object.keys(choiceLabels) as ChoiceKey[])
        .filter((k) => choiceLabels[k][1] === g)
        .map((k) => (
          <ChoiceSelect
            key={k}
            k={k}
            value={design.choices[k]}
            error={e.refusal?.field === k ? e.refusal.reason : undefined}
            dispatch={dispatch}
          />
        ))}
      {designerSpecs
        .filter((s) => s.group === g && fieldInUse(s.key, design))
        .map((s) => {
          const state = e.states[s.key]
          const changed = state.kind === 'entered' && state.changed
          return (
            <DesignerField
              key={s.key}
              spec={s}
              system={system}
              value={design.fields[s.key]}
              help={stateText(s, state, system)}
              flag={changed ? 'changed' : flagOf[state.kind]}
              changed={changed}
              error={errorOf(s.key)}
              symbol={bulletSymbols.find((b) => b.path === s.key)?.symbol}
              dispatch={dispatch}
            />
          )
        })}
    </div>
  )

  const title = `Outline, ${productLabel(design) || 'new bullet'}`
  const symbols =
    drawing &&
    [...drawing.profile.annotation.dimensions, ...drawing.profile.annotation.radii].map(
      (d) => `${d.symbol} ${bulletSymbols.find((s) => s.symbol === d.symbol)?.name ?? d.symbol}`,
    )
  const assumed = drawing?.profile.outline.segments.some((s) => s.approximate)
  const notes = drawing
    ? [
        'Entered and catalog values are dimensioned, derived and assumed values are not.',
        ...(assumed
          ? ['Dashed in the flag color: parts drawn from an assumed shape (see the notes).']
          : []),
        ...(symbols && symbols.length > 0 ? [`Symbols: ${symbols.join(', ')}.`] : []),
        ...drawing.profile.outline.notes,
      ]
    : []

  const root = useRef<HTMLDivElement>(null)
  /** Marks the drawn dimension of the field `t` is in (`data-symbol`), else none. */
  const mark = (t: Element | null) => {
    const box = root.current
    if (!box) return
    for (const el of box.querySelectorAll('.designer-drawing .is-hi')) el.classList.remove('is-hi')
    const symbol = t?.closest('.designer-field[data-symbol]')?.getAttribute('data-symbol')
    if (symbol)
      for (const el of box.querySelectorAll('.designer-drawing [data-symbol]'))
        if (el.getAttribute('data-symbol') === symbol) el.classList.add('is-hi')
  }
  // an edit draws the figure again: the focused field's mark again
  useEffect(() => mark(document.activeElement))

  // the File menu renders after an edit's drawing, from the deferred design
  const fileDesign = useDeferredValue(design)
  const fileValue = useMemo(() => fileData(fileDesign), [fileDesign])
  const openFile = useCallback(
    (d: BulletDesign) => dispatch({ type: 'start', design: fromFile(d, system) }),
    [system, dispatch],
  )

  // New bullet or cartridge starts a new record

  const toolbar = (
    <>
      <DesignerToolbar
        undo={history.past.length > 0}
        redo={history.future.length > 0}
        reset={design.origin !== undefined}
        newLabel="New bullet"
        resetLabel="Reset to record"
        system={system}
        dispatch={toolbarDispatch}
      />
      <FileMenu
        ref={fileMenu}
        kind="bulletDesign"
        name={productLabel(fileDesign) || 'New bullet'}
        data={fileValue}
        onOpen={openFile}
        reportBox="Include the design"
      />
    </>
  )

  const inputs = (
    <form noValidate onSubmit={(ev) => ev.preventDefault()}>
      <PropertyGrid
        title="Parameters"
        head={<StartSearch system={system} start={start} chosen={design.origin?.title} />}
        message={loading ?? (design.origin && `Started from ${design.origin.title}.`)}
        sections={(Object.keys(groups) as Group[]).map((g) => ({
          key: g,
          title: groups[g],
          content:
            g === 'identity' ? (
              <div className="prop-grid designer-grid">
                <TextField
                  k="manufacturerName"
                  label="Manufacturer"
                  value={design.manufacturerName}
                  dispatch={dispatch}
                />
                <TextField k="name" label="Name" value={design.name} dispatch={dispatch} />
              </div>
            ) : (
              groupFields(g)
            ),
        }))}
      />
    </form>
  )

  const computed =
    e.computed.length > 0
      ? `Computed from the design: ${e.computed.map((r) => `${rowLabel(r, system)} ${rowValue(r, system)}`).join(', ')}.`
      : ''

  // print: the drawing and the values, not the form
  const values: FieldRow[] = [
    ...(['manufacturerName', 'name'] as const).flatMap((k): FieldRow[] =>
      design[k]
        ? [{ label: k === 'manufacturerName' ? 'Manufacturer' : 'Name', text: design[k] }]
        : [],
    ),
    ...(Object.keys(choiceLabels) as ChoiceKey[]).flatMap((k): FieldRow[] =>
      design.choices[k]
        ? [{ label: choiceLabels[k][0], text: optionLabel(design.choices[k]) }]
        : [],
    ),
    ...designerSpecs.flatMap((s): FieldRow[] => {
      const { si } = design.fields[s.key]
      return si === undefined ? [] : [{ label: s.label, value: { quantity: s.quantity, si } }]
    }),
  ]

  const results = (
    <>
      <div className="page-panel-head designer-panel-head">
        <h2 className="page-panel-title record-heading">Drawing</h2>
      </div>
      {/* a slot of its own: a refusal does not move the drawing */}
      <Text component="p" inherit fz="sm" m={0} className="stale-line" title={e.refusal?.reason}>
        {e.refusal &&
          `Drawing for earlier inputs. Fix ${label(e.refusal.field)}: ${e.refusal.reason}`}
      </Text>
      {drawing && (
        <figure className="drawing-figure designer-drawing" data-stale={!e.drawing || undefined}>
          <TechnicalDrawing
            id="designer-drawing"
            title={title}
            desc={description(drawing.profile, drawingLengthUnit(system))}
            model={drawing.screen}
            linked
          />
          {printed && (
            <PrintDrawing
              profile={printed.profile}
              title={title}
              unit={drawingLengthUnit(system)}
            />
          )}
          {/* on screen the legend line and the notes behind a button, in print every note */}
          <figcaption>
            <span className="screen-only designer-legend">
              {assumed ? 'Dashed: drawn from an assumed shape. ' : ''}Derived and assumed values are
              not dimensioned.
            </span>
            <DrawingNotes notes={notes} />
            <span className="print-only">Drawing of the design. {notes.join(' ')}</span>
          </figcaption>
        </figure>
      )}
      {/* two reserved lines, so the drawing keeps its height; all of it in the title */}
      <Text
        component="p"
        inherit
        fz="sm"
        m="0.25rem 0 0"
        className="derived-line"
        title={computed || undefined}
      >
        {computed}
      </Text>
      <div className="print-only">
        <FieldTable caption="Values of the design" groups={[{ rows: values }]} />
      </div>
    </>
  )

  return (
    <>
      <PageBar title="Bullet designer" actions={toolbar} />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: follows focus and hover of the fields inside, takes none itself */}
      <div
        ref={root}
        className="designer"
        onFocus={(ev) => mark(ev.target)}
        onBlur={() => mark(null)}
        onPointerOver={(ev) =>
          mark(
            (ev.target as Element).closest('.designer-field[data-symbol]') ??
              document.activeElement,
          )
        }
        onPointerLeave={() => mark(document.activeElement)}
      >
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
