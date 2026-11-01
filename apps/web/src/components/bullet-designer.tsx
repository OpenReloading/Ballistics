'use client'

import { Anchor, Button, NativeSelect, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { face, type LengthUnit } from '@open-reloading/drawing'
import { bulletFigureModel, bulletSymbols } from '@open-reloading/drawing/bullet'
import { type Bullet, toSi, type UserBullet } from '@open-reloading/schema'
import { Camera } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { localizeDecimals } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
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
  fromRecord,
  fromUser,
  type Group,
  groups,
  implausible,
  newDesign,
  reduce,
} from '../lib/bullet-designer.ts'
import { bulletGuide } from '../lib/docs-url.ts'
import { fieldError } from '../lib/field-spec.ts'
import { fetchManufacturerNames, noManufacturerNames, productLabel } from '../lib/manufacturers.ts'
import { type FieldRow, rowLabel, rowValue } from '../lib/record-fields.ts'
import { rawWording } from '../lib/record-values.ts'
import { drawingLengthUnit, formatQuantity, type UnitSystem, withUnit } from '../lib/units.ts'
import { resolveBullet } from '../lib/variants.ts'
import { say } from '../lib/wording.ts'
import { description } from './bullet-drawing.tsx'
import { DesignerField } from './designer-field.tsx'
import { DesignerToolbar } from './designer-toolbar.tsx'
import { FieldTable } from './field-table.tsx'
import { FileMenu } from './file-menu.tsx'
import { focusBack } from './focus-back.ts'
import { ManufacturerInput } from './manufacturer-input.tsx'
import type { FieldFlag } from './number-field.tsx'
import { PageBar } from './page-bar.tsx'
import { PropertyGrid } from './property-grid.tsx'
import { DrawingNotes } from './record-actions.tsx'
import { RecordSearch } from './record-search.tsx'
import { TechnicalDrawing } from './technical-drawing.tsx'
import { UnitsIconButton } from './units-settings.tsx'
import { useDesigner } from './use-designer.ts'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import { useManufacturers } from './use-manufacturers.ts'
import { Workspace } from './workspace.tsx'

/** The photo tool, fetched when it is first opened: its image maths and the sample stay out of the designer's first load. */
const BulletPhoto = dynamic(() => import('./bullet-photo.tsx').then((m) => m.BulletPhoto), {
  ssr: false,
})

const choiceLabels: Record<ChoiceKey, [Message, Group]> = {
  'base.type': [msg('Base type'), 'base'],
  'ogive.form': [msg('Nose form'), 'nose'],
  'tip.type': [msg('Tip'), 'tip'],
}

/** Hollow bases get shorter names: the select is too narrow for the full type name. */
const shortLabels: Record<string, Message> = {
  'conical-hollow-base': msg('hollow cone'),
  'rounded-hollow-base': msg('hollow round'),
}

/** An option's name: a stored value the catalogue has is translated, English shows it with spaces. */
function optionLabel(o: string, t: Translator['t']) {
  if (o === '') return t('Not given')
  const short = shortLabels[o]
  if (short) return t(short)
  const word = say(t, rawWording(o))
  return word === o ? o.replaceAll('-', ' ') : word
}

/** The field's state line: where its value comes from. */
function stateText(s: DesignerSpec, state: FieldState, system: UnitSystem, t: Translator['t']) {
  const unit = system[s.quantity].symbol
  const value = (si: number) => `${formatQuantity(s.quantity, system, si)}${unit ? ` ${unit}` : ''}`
  switch (state.kind) {
    case 'record':
      return t('From the catalog record')
    case 'entered':
      if (!state.changed) return t('Entered')
      return state.record === undefined
        ? t('Changed; catalog value not given')
        : t('Changed; catalog {value}', { value: value(state.record) })
    case 'derived':
      return t('Derived: {value}', { value: value(state.si) })
    case 'assumed':
      return state.basis
        ? t('Assumed: {value} ({basis})', {
            value: value(state.si),
            basis: localizeDecimals(state.basis),
          })
        : t('Assumed: {value}', { value: value(state.si) })
    case 'empty':
      return t('Not given')
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
  chosen?: string | undefined
}) {
  const names = useManufacturerNames()
  const { t } = useTranslation()
  return (
    <RecordSearch<BulletSummary>
      kind="bullets"
      label={t('Start from a record')}
      chosen={chosen ?? t('Start from a record')}
      picked={chosen !== undefined}
      describe={(b) =>
        `${productLabel(b, names)}, ${withUnit('mass', system, toSi('mass', b.mass))}`
      }
      onSelect={(b) => start(b.id)}
      noneText={t('No bullet found')}
      unreachableText={t('The database is unreachable. The designer still works.')}
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
  error?: string | undefined
  dispatch: (a: Action) => void
}) {
  const { t } = useTranslation()
  return (
    // the message is the description (screen readers, the grid's help line) and the title: it moves nothing
    <div className="designer-field" data-error={error ? true : undefined}>
      <NativeSelect
        label={t(choiceLabels[k][0])}
        labelProps={{ title: error }}
        value={value}
        description={error}
        error={!!error}
        data={['', ...choiceOptions[k]].map((o) => ({ value: o, label: optionLabel(o, t) }))}
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
  k: 'name'
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

const fieldLabel = (key: string, t: Translator['t']) => {
  const label =
    designerSpecs.find((s) => s.key === key)?.label ??
    (key in choiceLabels ? choiceLabels[key as ChoiceKey][0] : undefined)
  return label ? t(label) : key
}

const changedText = (changed: DesignerSpec, design: Design, t: Translator['t']) => {
  const text = design.fields[changed.key]?.text
  return text
    ? t('{label} {value}. ', { label: t(changed.label), value: text })
    : t('{label} cleared. ', { label: t(changed.label) })
}

/** The polite line: the refusal, else the last change and that the drawing updated. */
const announcement = (
  refusal: { reason: string } | undefined,
  change: string | undefined,
  t: Translator['t'],
) =>
  refusal
    ? t('Drawing not updated: {reason}', { reason: refusal.reason })
    : `${change ?? ''}${t('Drawing updated.')}`

/** The Parameters panel's message for a locked, changed-base or started-from design. */
function designMessage(design: Design, t: Translator['t']) {
  if (design.locked) return t('Read only: {reason}', { reason: design.locked.reason })
  if (design.baseChanged)
    return t(
      'The base record {name} changed since this design was saved. Fields you did not change follow it; Save keeps the design against the new base.',
      { name: design.origin?.title ?? design.basedOn ?? '' },
    )
  return design.origin && t('Started from {name}.', { name: design.origin.title })
}

/** Whether a segment is drawn from an assumed shape, and the notes under the drawing. */
function drawingNotes(drawing: Drawing | undefined, t: Translator['t']) {
  if (!drawing) return { assumed: undefined, notes: [] }
  const { annotation, outline } = drawing.profile
  const symbols = [...annotation.dimensions, ...annotation.radii].map(
    (d) => `${d.symbol} ${bulletSymbols.find((s) => s.symbol === d.symbol)?.name ?? d.symbol}`,
  )
  const assumed = outline.segments.some((s) => s.approximate)
  const notes = [
    t('Entered and catalog values are dimensioned, derived and assumed values are not.'),
    ...(assumed
      ? [t('Dashed in the flag color: parts drawn from an assumed shape (see the notes).')]
      : []),
    ...(symbols.length > 0 ? [t('Symbols: {symbols}.', { symbols: symbols.join(', ') })] : []),
    ...outline.notes,
  ]
  return { assumed, notes }
}

/** Marks the drawn dimension of the field `t` is in (`data-symbol`), else none. */
function markDimension(box: HTMLElement | null, t: Element | null) {
  if (!box) return
  for (const el of box.querySelectorAll('.designer-drawing .is-hi')) el.classList.remove('is-hi')
  const symbol = t?.closest('.designer-field[data-symbol]')?.getAttribute('data-symbol')
  if (!symbol) return
  for (const el of box.querySelectorAll('.designer-drawing [data-symbol]'))
    if (el.getAttribute('data-symbol') === symbol) el.classList.add('is-hi')
}

/** The values of the print sheet: identity, choices and the entered fields. */
const printRows = (
  design: Design,
  manufacturer: string | undefined,
  t: Translator['t'],
): FieldRow[] => [
  ...(
    [
      [msg('Manufacturer'), manufacturer],
      [msg('Name'), design.name],
    ] as const
  ).flatMap(([label, text]): FieldRow[] => (text ? [{ label, text }] : [])),
  ...(Object.keys(choiceLabels) as ChoiceKey[]).flatMap((k): FieldRow[] =>
    design.choices[k]
      ? [{ label: choiceLabels[k][0], text: optionLabel(design.choices[k], t) }]
      : [],
  ),
  ...designerSpecs.flatMap((s): FieldRow[] => {
    const si = design.fields[s.key]?.si
    return si === undefined ? [] : [{ label: s.label, value: { quantity: s.quantity, si } }]
  }),
]

/**
 * The bullet designer: a property grid of the fields, a live technical drawing beside
 * it, undo and redo; the last valid drawing stays while the input is refused.
 */
export function BulletDesigner() {
  const { t } = useTranslation()
  const manufacturers = useManufacturers()
  const reloadManufacturers = manufacturers.reload
  const { system, history, design, dispatch, loading, fileMenu, start, begin, toolbarDispatch } =
    useDesigner<Design, Action>({
      reduce,
      init: newDesign,
      kind: 'bullet',
      fileData,
      load: async (id, system) => {
        const record = await fetchRecord<Bullet>('bullets', id)
        if (!record) throw new Error('No such bullet')
        // without names the design starts with an empty manufacturer
        const names = await fetchManufacturerNames().catch(() => noManufacturerNames)
        return fromRecord(record, system, names)
      },
      loadingText: msg('Loading the bullet…'),
      failText: msg('The bullet could not be loaded. The designer still works.'),
    })

  const [photoOpen, setPhotoOpen] = useState(false)
  const photoButton = useRef<HTMLButtonElement>(null)
  const e = useMemo(
    () => evaluate(design, system, history.last, t),
    [design, system, history.last, t],
  )
  const lastGood = useRef<Drawing | undefined>(undefined)
  if (e.drawing) lastGood.current = e.drawing
  const drawing = e.drawing ?? lastGood.current
  const printed = useDeferredValue(drawing)
  // one polite line 500 ms after the last change
  const changed = history.last && designerSpecs.find((s) => s.key === history.last)
  const message = announcement(e.refusal, changed && changedText(changed, design, t), t)
  const [announced] = useDebouncedValue(message, 500)

  const errorOf = (key: string) =>
    fieldError(
      designerSpecs.find((s) => s.key === key) as DesignerSpec,
      design.fields[key],
      system,
      t,
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
          const value = design.fields[s.key]
          if (!(state && value)) return null
          const changed = state.kind === 'entered' && state.changed
          // a soft flag: the value stays and the drawing follows it
          const check = implausible(s, value.si)
          const help = stateText(s, state, system, t)
          return (
            <DesignerField
              key={s.key}
              spec={s}
              system={system}
              value={value}
              help={check ? `${t('Check the unit.')} ${help}` : help}
              flag={check ? 'exceeded' : changed ? 'changed' : flagOf[state.kind]}
              changed={changed}
              error={errorOf(s.key)}
              symbol={bulletSymbols.find((b) => b.path === s.key)?.symbol}
              dispatch={dispatch}
            />
          )
        })}
    </div>
  )

  const labelOf = (d: Design) =>
    productLabel({ name: d.name, manufacturerName: manufacturers.nameOf(d.manufacturer) })
  const title = t('Outline, {name}', { name: labelOf(design) || t('new bullet') })
  const { assumed, notes } = drawingNotes(drawing, t)

  const root = useRef<HTMLDivElement>(null)
  const mark = (t: Element | null) => markDimension(root.current, t)
  // an edit draws the figure again: the focused field's mark again
  useEffect(() => mark(document.activeElement))

  // the File menu renders after an edit's drawing, from the deferred design
  const fileDesign = useDeferredValue(design)
  const fileValue = useMemo(() => fileData(fileDesign), [fileDesign])
  const openFile = useCallback(
    async (d: UserBullet) => {
      const [resolved, names] = await Promise.all([
        resolveBullet(d),
        fetchManufacturerNames().catch(() => noManufacturerNames),
      ])
      dispatch({ type: 'start', design: fromUser(d, resolved, system, names) })
      // the opened record may have brought its manufacturer along
      void reloadManufacturers()
    },
    [system, dispatch, reloadManufacturers],
  )

  // New bullet or cartridge starts a new record

  const toolbar = (
    <DesignerToolbar
      undo={history.past.length > 0}
      redo={history.future.length > 0}
      reset={design.origin !== undefined}
      newLabel={t('New bullet')}
      resetLabel={t('Reset to record')}
      system={system}
      dispatch={toolbarDispatch}
    />
  )
  const actions = (
    <>
      <Button
        ref={photoButton}
        variant="default"
        leftSection={<Camera aria-hidden="true" />}
        onClick={() => setPhotoOpen(true)}
        disabled={design.locked !== undefined}
      >
        {t('From a photo')}
      </Button>
      <FileMenu
        ref={fileMenu}
        kind="bullet"
        name={labelOf(fileDesign) || 'New bullet'}
        data={fileValue}
        problem={fileDesign.locked?.reason}
        onOpen={openFile}
        reportBox={t('Include the design')}
      />
      <UnitsIconButton />
    </>
  )

  const inputs = (
    // a design whose base is gone is shown, not edited
    <form noValidate onSubmit={(ev) => ev.preventDefault()}>
      <fieldset disabled={design.locked !== undefined} className="designer-fieldset">
        <PropertyGrid
          title={t('Parameters')}
          head={<StartSearch system={system} start={start} chosen={design.origin?.title} />}
          message={loading ?? designMessage(design, t)}
          sections={(Object.keys(groups) as Group[]).map((g) => ({
            key: g,
            title: t(groups[g]),
            content:
              g === 'identity' ? (
                <div className="prop-grid designer-grid">
                  <ManufacturerInput
                    label={t('Manufacturer')}
                    value={design.manufacturer}
                    manufacturers={manufacturers}
                    onChange={(value) => dispatch({ type: 'manufacturer', value })}
                  />
                  <TextField k="name" label={t('Name')} value={design.name} dispatch={dispatch} />
                </div>
              ) : g === 'shank' && bulletGuide ? (
                <>
                  {groupFields(g)}
                  <p className="note">
                    <Anchor href={bulletGuide} target="_blank" rel="noopener">
                      {t('How to measure bullet dimensions')}
                    </Anchor>
                  </p>
                </>
              ) : (
                groupFields(g)
              ),
          }))}
        />
      </fieldset>
    </form>
  )

  const computed =
    e.computed.length > 0
      ? t('Computed from the design: {values}.', {
          values: e.computed
            .map((r) => `${rowLabel(r, system, t)} ${rowValue(r, system, t)}`)
            .join(', '),
        })
      : ''

  // print: the drawing and the values, not the form
  const values = printRows(design, manufacturers.nameOf(design.manufacturer), t)

  const results = (
    <>
      {photoOpen && (
        <BulletPhoto
          opened
          onClose={() => {
            setPhotoOpen(false)
            // the tool is unmounted at once, so the modal's own return of the focus never runs
            focusBack(photoButton.current, '.page-bar .page-bar-toggle')
          }}
          system={system}
          record={design.origin}
          onOpen={begin}
        />
      )}
      <div className="page-panel-head designer-panel-head">
        <h2 className="page-panel-title record-heading">{t('Drawing')}</h2>
      </div>
      {/* a slot of its own: a refusal does not move the drawing */}
      <Text component="p" inherit fz="sm" m={0} className="stale-line" title={e.refusal?.reason}>
        {e.refusal &&
          t('Drawing for earlier inputs. Fix {field}: {reason}', {
            field: fieldLabel(e.refusal.field, t),
            reason: e.refusal.reason,
          })}
      </Text>
      {drawing && (
        <figure className="drawing-figure designer-drawing" data-stale={!e.drawing || undefined}>
          <TechnicalDrawing
            id="designer-drawing"
            title={title}
            desc={description(drawing.profile, drawingLengthUnit(system), t)}
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
              {assumed
                ? t(
                    'Dashed: drawn from an assumed shape. Derived and assumed values are not dimensioned.',
                  )
                : t('Derived and assumed values are not dimensioned.')}
            </span>
            <DrawingNotes notes={notes} />
            <span className="print-only">
              {t('Drawing of the design.')} {notes.join(' ')}
            </span>
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
        <FieldTable caption={msg('Values of the design')} groups={[{ rows: values }]} />
      </div>
    </>
  )

  return (
    <>
      <PageBar translated title={msg('Bullet designer')} fold={toolbar} actions={actions} />
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
