'use client'

import type { I18n, MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { Anchor, Button, NativeSelect, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { type Bullet, toSi, type UserBullet } from '@rangefoundry/schema'
import { face, type LengthUnit } from '@rangefoundry/svg-drawings'
import { bulletFigureModel, bulletSymbols } from '@rangefoundry/svg-drawings/bullet'
import { Camera } from 'lucide-react'
import dynamic from 'next/dynamic'
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { loadEnglish } from '../i18n/lingui.ts'
import { localizeDecimals } from '../i18n/number.ts'
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
import { photoText } from '../lib/bullet-photo-design.ts'
import { bulletGuide } from '../lib/docs-url.ts'
import { fieldError } from '../lib/field-error.ts'
import { fetchManufacturerNames, noManufacturerNames, productLabel } from '../lib/manufacturers.ts'
import { type FieldRow, rowLabel, rowValue } from '../lib/record-fields.ts'
import { rawWording } from '../lib/record-values.ts'
import { drawingLengthUnit, formatQuantity, type UnitSystem, withUnit } from '../lib/units.ts'
import { resolveBullet } from '../lib/variants.ts'
import { sayLingui, verbatim } from '../lib/wording.ts'
import englishMessages from '../locales/en/components/bullet-designer.json' with { type: 'json' }
import { description } from './bullet-drawing.tsx'
import { DesignerField, revertOf } from './designer-field.tsx'
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

loadEnglish(englishMessages)

/** The photo tool, fetched when it is first opened: its image maths and the sample stay out of the designer's first load. */
const BulletPhoto = dynamic(() => import('./bullet-photo.tsx').then((m) => m.BulletPhoto), {
  ssr: false,
})

const choiceLabels: Record<ChoiceKey, [MessageDescriptor, Group]> = {
  'base.type': [/*i18n*/ { id: 'bulletDesigner.baseType', message: 'Base type' }, 'base'],
  'ogive.form': [/*i18n*/ { id: 'bulletDesigner.noseForm', message: 'Nose form' }, 'nose'],
  'tip.type': [/*i18n*/ { id: 'bulletDesigner.tip', message: 'Tip' }, 'tip'],
}

/** Hollow bases get shorter names: the select is too narrow for the full type name. */
const shortLabels: Record<string, MessageDescriptor> = {
  'conical-hollow-base': /*i18n*/ { id: 'bulletDesigner.hollowCone', message: 'hollow cone' },
  'rounded-hollow-base': /*i18n*/ { id: 'bulletDesigner.hollowRound', message: 'hollow round' },
}

/** An option's name: a stored value the catalogue has is translated, English shows it with spaces. */
function optionLabel(o: string, i18n: I18n) {
  if (o === '') return i18n._({ id: 'bulletDesigner.notGiven', message: 'Not given' })
  const short = shortLabels[o]
  if (short) return i18n._(short)
  const word = sayLingui(i18n, rawWording(o))
  return word === o ? o.replaceAll('-', ' ') : word
}

/** The field's state line: where its value comes from. */
function stateText(s: DesignerSpec, state: FieldState, system: UnitSystem, i18n: I18n) {
  const unit = system[s.quantity].symbol
  const value = (si: number) => `${formatQuantity(s.quantity, system, si)}${unit ? ` ${unit}` : ''}`
  switch (state.kind) {
    case 'record':
      return i18n._({ id: 'bulletDesigner.fromCatalogRecord', message: 'From the catalog record' })
    case 'entered':
      if (!state.changed) return i18n._({ id: 'bulletDesigner.entered', message: 'Entered' })
      return state.record === undefined
        ? i18n._({
            id: 'bulletDesigner.changedCatalogValueNotGiven',
            message: 'Changed; catalog value not given',
          })
        : i18n._({
            id: 'bulletDesigner.changedCatalog',
            message: 'Changed; catalog {value}',
            values: { value: value(state.record) },
          })
    case 'derived':
      return i18n._({
        id: 'bulletDesigner.derived',
        message: 'Derived: {value}',
        values: { value: value(state.si) },
      })
    case 'assumed':
      return state.basis
        ? i18n._({
            id: 'bulletDesigner.assumedBasis',
            message: 'Assumed: {value} ({basis})',
            values: {
              value: value(state.si),
              basis: localizeDecimals(state.basis),
            },
          })
        : i18n._({
            id: 'bulletDesigner.assumed',
            message: 'Assumed: {value}',
            values: { value: value(state.si) },
          })
    case 'empty':
      return i18n._({ id: 'bulletDesigner.notGiven', message: 'Not given' })
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
  const { i18n } = useLingui()
  return (
    // pinned at the top of the Parameters while the fields scroll (globals.css)
    <div className="designer-start">
      <RecordSearch<BulletSummary>
        kind="bullets"
        label={i18n._({ id: 'bulletDesigner.startFromRecord', message: 'Start from a record' })}
        chosen={
          chosen ?? i18n._({ id: 'bulletDesigner.startFromRecord', message: 'Start from a record' })
        }
        picked={chosen !== undefined}
        describe={(b) =>
          `${productLabel(b, names)}, ${withUnit('mass', system, toSi('mass', b.mass))}`
        }
        onSelect={(b) => start(b.id)}
        noneText={i18n._({ id: 'bulletDesigner.noBulletFound', message: 'No bullet found' })}
        unreachableText={i18n._({
          id: 'bulletDesigner.databaseUnreachableDesignerStill',
          message: 'The database is unreachable. The designer still works.',
        })}
      />
    </div>
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
  const { i18n } = useLingui()
  return (
    // the message is the description (screen readers, the grid's help line) and the title: it moves nothing
    <div className="designer-field" data-error={error ? true : undefined}>
      <NativeSelect
        label={i18n._(choiceLabels[k][0])}
        labelProps={{ title: error }}
        value={value}
        description={error}
        error={!!error}
        data={['', ...choiceOptions[k]].map((o) => ({ value: o, label: optionLabel(o, i18n) }))}
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

const fieldLabel = (key: string, i18n: I18n) => {
  const label =
    designerSpecs.find((s) => s.key === key)?.label ??
    (key in choiceLabels ? choiceLabels[key as ChoiceKey][0] : undefined)
  return label ? i18n._(label) : key
}

const changedText = (changed: DesignerSpec, design: Design, i18n: I18n) => {
  const text = design.fields[changed.key]?.text
  return text
    ? i18n._({
        id: 'bulletDesigner.labelValue',
        message: '{label} {value}. ',
        values: { label: i18n._(changed.label), value: text },
      })
    : i18n._({
        id: 'bulletDesigner.cleared',
        message: '{label} cleared. ',
        values: { label: i18n._(changed.label) },
      })
}

/** The polite line: the refusal, else the last change and that the drawing updated. */
const announcement = (
  refusal: { reason: string } | undefined,
  change: string | undefined,
  i18n: I18n,
) =>
  refusal
    ? i18n._({
        id: 'bulletDesigner.drawingNotUpdated',
        message: 'Drawing not updated: {reason}',
        values: { reason: refusal.reason },
      })
    : `${change ?? ''}${i18n._({ id: 'bulletDesigner.drawingUpdated', message: 'Drawing updated.' })}`

/** The Parameters panel's message for a locked, changed-base or started-from design. */
function designMessage(design: Design, i18n: I18n) {
  if (design.locked)
    return i18n._({
      id: 'bulletDesigner.readOnly',
      message: 'Read only: {reason}',
      values: { reason: design.locked.reason },
    })
  if (design.baseChanged)
    return i18n._({
      id: 'bulletDesigner.baseRecordChangedSince',
      message:
        'The base record {name} changed since this design was saved. Fields you did not change follow it; Save keeps the design against the new base.',
      values: { name: design.origin?.title ?? design.basedOn ?? '' },
    })
  return (
    design.origin &&
    i18n._({
      id: 'bulletDesigner.startedFrom',
      message: 'Started from {name}.',
      values: { name: design.origin.title },
    })
  )
}

/** Whether a segment is drawn from an assumed shape, and the notes under the drawing. */
function drawingNotes(drawing: Drawing | undefined, i18n: I18n) {
  if (!drawing) return { assumed: undefined, notes: [] }
  const { annotation, outline } = drawing.profile
  const symbols = [...annotation.dimensions, ...annotation.radii].map(
    (d) => `${d.symbol} ${bulletSymbols.find((s) => s.symbol === d.symbol)?.name ?? d.symbol}`,
  )
  const assumed = outline.segments.some((s) => s.approximate)
  const notes = [
    i18n._({
      id: 'bulletDesigner.onlyEnteredCatalogDimensioned',
      message: 'Only entered and catalog values are dimensioned.',
    }),
    ...(assumed
      ? [
          i18n._({
            id: 'bulletDesigner.dashedFlagColorParts',
            message: 'Dashed in the flag color: parts drawn from an assumed shape (see the notes).',
          }),
        ]
      : []),
    ...(symbols.length > 0
      ? [
          i18n._({
            id: 'bulletDesigner.symbols',
            message: 'Symbols: {symbols}.',
            values: { symbols: symbols.join(', ') },
          }),
        ]
      : []),
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
const printRows = (design: Design, manufacturer: string | undefined, i18n: I18n): FieldRow[] => [
  ...(
    [
      [/*i18n*/ { id: 'bulletDesigner.manufacturer', message: 'Manufacturer' }, manufacturer],
      [/*i18n*/ { id: 'bulletDesigner.name', message: 'Name' }, design.name],
    ] as const
  ).flatMap(([label, text]): FieldRow[] =>
    text ? [{ label: verbatim(i18n._(label)), text }] : [],
  ),
  ...(Object.keys(choiceLabels) as ChoiceKey[]).flatMap((k): FieldRow[] =>
    design.choices[k]
      ? [
          {
            label: verbatim(i18n._(choiceLabels[k][0])),
            text: optionLabel(design.choices[k], i18n),
          },
        ]
      : [],
  ),
  ...designerSpecs.flatMap((s): FieldRow[] => {
    const si = design.fields[s.key]?.si
    return si === undefined
      ? []
      : [{ label: verbatim(i18n._(s.label)), value: { quantity: s.quantity, si } }]
  }),
]

/** The last valid drawing stays while the input is refused. */
export function BulletDesigner() {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const manufacturers = useManufacturers()
  const reloadManufacturers = manufacturers.reload
  const labelOf = (d: Design) =>
    productLabel({ name: d.name, manufacturerName: manufacturers.nameOf(d.manufacturer) })
  const {
    system,
    history,
    design,
    loading,
    fileMenu,
    dispatch,
    start,
    begin,
    opened,
    recordId,
    kept,
    toolbarDispatch,
  } = useDesigner<Design, Action, 'bullet'>({
    reduce,
    init: newDesign,
    kind: 'bullet',
    fileData,
    draftName: labelOf,
    fallbackName: 'New bullet',
    load: async (id, system) => {
      const record = await fetchRecord<Bullet>('bullets', id)
      if (!record) throw new Error('No such bullet')
      // without names the design starts with an empty manufacturer
      const names = await fetchManufacturerNames().catch(() => noManufacturerNames)
      return fromRecord(record, system, names)
    },
    loadingText: /*i18n*/ { id: 'bulletDesigner.loading', message: 'Loading the bullet…' },
    failText: /*i18n*/ {
      id: 'bulletDesigner.loadFailed',
      message: 'The bullet could not be loaded. The designer still works.',
    },
  })

  const [photoOpen, setPhotoOpen] = useState(false)
  const photoButton = useRef<HTMLButtonElement>(null)
  const e = useMemo(
    () => evaluate(design, system, history.last, t, i18n),
    [design, system, history.last, t, i18n],
  )
  const lastGood = useRef<Drawing | undefined>(undefined)
  if (e.drawing) lastGood.current = e.drawing
  const drawing = e.drawing ?? lastGood.current
  const printed = useDeferredValue(drawing)
  // one polite line 500 ms after the last change
  const changed = history.last && designerSpecs.find((s) => s.key === history.last)
  const message = announcement(e.refusal, changed && changedText(changed, design, i18n), i18n)
  const [announced] = useDebouncedValue(message, 500)

  // a changed field of a design from a record goes back to the record's value by its own button
  const revertTo = revertOf(design, dispatch)

  const errorOf = (key: string) =>
    fieldError(
      designerSpecs.find((s) => s.key === key) as DesignerSpec,
      design.fields[key],
      system,
      t,
      i18n,
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
          return (
            <DesignerField
              key={s.key}
              spec={s}
              system={system}
              value={value}
              help={stateText(s, state, system, i18n)}
              flag={changed ? 'changed' : flagOf[state.kind]}
              changed={changed}
              error={errorOf(s.key)}
              // a soft flag: the value stays and the drawing follows it
              implausible={implausible(s, value.si)}
              symbol={bulletSymbols.find((b) => b.path === s.key)?.symbol}
              revert={revertTo}
              dispatch={dispatch}
            />
          )
        })}
    </div>
  )

  const title = i18n._({
    id: 'bulletDesigner.outline',
    message: 'Outline, {name}',
    values: {
      name:
        labelOf(design) || i18n._({ id: 'bulletDesigner.newBulletName', message: 'new bullet' }),
    },
  })
  const { assumed, notes: drawn } = drawingNotes(drawing, i18n)
  const notes = design.photo ? [...drawn, ...photoText(design.photo, system, i18n)] : drawn

  const root = useRef<HTMLDivElement>(null)
  const mark = (t: Element | null) => markDimension(root.current, t)
  // an edit draws the figure again: the focused field's mark again
  useEffect(() => mark(document.activeElement))

  // the File menu renders after an edit's drawing, from the deferred design
  const fileDesign = useDeferredValue(design)
  const fileValue = useMemo(() => fileData(fileDesign), [fileDesign])
  const openFile = useCallback(
    async (d: UserBullet, _name: string, record: { id: string }) => {
      const [resolved, names] = await Promise.all([
        resolveBullet(d),
        fetchManufacturerNames().catch(() => noManufacturerNames),
      ])
      opened(record.id, fromUser(d, resolved, system, names))
      // the opened record may have brought its manufacturer along
      void reloadManufacturers()
    },
    [system, opened, reloadManufacturers],
  )

  const toolbar = (
    <DesignerToolbar
      undo={history.past.length > 0}
      redo={history.future.length > 0}
      reset={design.origin !== undefined}
      newLabel={i18n._({ id: 'bulletDesigner.newBullet', message: 'New bullet' })}
      resetLabel={i18n._({ id: 'bulletDesigner.resetRecord', message: 'Reset to record' })}
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
        {i18n._({ id: 'bulletDesigner.fromPhoto', message: 'From a photo' })}
      </Button>
      <FileMenu
        ref={fileMenu}
        kind="bullet"
        name={labelOf(fileDesign) || 'New bullet'}
        data={fileValue}
        autosaved={recordId}
        browserList
        kept={kept}
        problem={fileDesign.locked?.reason}
        onOpen={openFile}
        reportBox={i18n._({ id: 'bulletDesigner.includeDesign', message: 'Include the design' })}
      />
      <UnitsIconButton />
    </>
  )

  const inputs = (
    // a design whose base is gone is shown, not edited
    <form noValidate onSubmit={(ev) => ev.preventDefault()}>
      <fieldset disabled={design.locked !== undefined} className="designer-fieldset">
        <PropertyGrid
          title={i18n._({ id: 'bulletDesigner.parameters', message: 'Parameters' })}
          head={<StartSearch system={system} start={start} chosen={design.origin?.title} />}
          message={loading ?? designMessage(design, i18n)}
          sections={(Object.keys(groups) as Group[]).map((g) => ({
            key: g,
            title: i18n._(groups[g]),
            content:
              g === 'identity' ? (
                <div className="prop-grid designer-grid">
                  <ManufacturerInput
                    label={i18n._({ id: 'bulletDesigner.manufacturer', message: 'Manufacturer' })}
                    value={design.manufacturer}
                    manufacturers={manufacturers}
                    onChange={(value) => dispatch({ type: 'manufacturer', value })}
                    autosaved
                  />
                  <TextField
                    k="name"
                    label={i18n._({ id: 'bulletDesigner.name', message: 'Name' })}
                    value={design.name}
                    dispatch={dispatch}
                  />
                </div>
              ) : g === 'shank' && bulletGuide ? (
                <>
                  {groupFields(g)}
                  <p className="note">
                    <Anchor href={bulletGuide} target="_blank" rel="noopener">
                      {i18n._({
                        id: 'bulletDesigner.howMeasureBulletDimensions',
                        message: 'How to measure bullet dimensions',
                      })}
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
      ? i18n._({
          id: 'bulletDesigner.computedDesign',
          message: 'Computed from the design: {values}.',
          values: {
            values: e.computed
              .map((r) => `${rowLabel(r, system, i18n)} ${rowValue(r, system, i18n)}`)
              .join(', '),
          },
        })
      : ''

  // print: the drawing and the values, not the form
  const values = printRows(design, manufacturers.nameOf(design.manufacturer), i18n)

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
        <h2 className="page-panel-title record-heading">
          {i18n._({ id: 'bulletDesigner.drawing', message: 'Drawing' })}
        </h2>
      </div>
      {/* a slot of its own: a refusal does not move the drawing */}
      <Text component="p" inherit fz="sm" m={0} className="stale-line" title={e.refusal?.reason}>
        {e.refusal &&
          i18n._({
            id: 'bulletDesigner.drawingEarlierInputsFix',
            message: 'Drawing for earlier inputs. Fix {field}: {reason}',
            values: {
              field: fieldLabel(e.refusal.field, i18n),
              reason: e.refusal.reason,
            },
          })}
      </Text>
      {drawing && (
        <figure className="drawing-figure designer-drawing" data-stale={!e.drawing || undefined}>
          <TechnicalDrawing
            id="designer-drawing"
            title={title}
            desc={description(drawing.profile, drawingLengthUnit(system), i18n)}
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
                ? i18n._({
                    id: 'bulletDesigner.dashedDrawnAssumedShape',
                    message:
                      'Dashed: drawn from an assumed shape. Derived and assumed values are not dimensioned.',
                  })
                : i18n._({
                    id: 'bulletDesigner.derivedAssumedNotDimensioned',
                    message: 'Derived and assumed values are not dimensioned.',
                  })}
            </span>
            <DrawingNotes notes={notes} />
            <span className="print-only">
              {i18n._({ id: 'bulletDesigner.drawingDesign', message: 'Drawing of the design.' })}{' '}
              {notes.join(' ')}
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
        <FieldTable
          caption={/*i18n*/ { id: 'designer.values', message: 'Values of the design' }}
          groups={[{ rows: values }]}
        />
      </div>
    </>
  )

  return (
    <>
      <PageBar
        translated
        title={/*i18n*/ { id: 'page.bulletsDesigner', message: 'Bullet designer' }}
        fold={toolbar}
        actions={actions}
      />
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
