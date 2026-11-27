'use client'

import type { I18n, MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { ActionIcon, Button, Checkbox, NativeSelect, Text, TextInput } from '@mantine/core'
import { Plus, Target, X } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { loadEnglish, ungrouped } from '../i18n/lingui.ts'
import { colourWord } from '../lib/face-words.ts'
import { fieldError } from '../lib/field-error.ts'
import { historyOf } from '../lib/history.ts'
import { newId } from '../lib/new-id.ts'
import {
  type Action,
  colours,
  faceOf,
  fieldAt,
  fileData,
  fromFile,
  type InnerRule,
  newDesign,
  reduce,
  rowId,
  shapeOf,
  specOf,
} from '../lib/target-designer.ts'
import { controlSize } from '../lib/theme.ts'
import { namedKey } from '../lib/user-data.ts'
import { userFaceId, userOrganization } from '../lib/user-faces.ts'
import englishMessages from '../locales/en/components/target-designer.json' with { type: 'json' }
import { DesignerField } from './designer-field.tsx'
import { DesignerToolbar } from './designer-toolbar.tsx'
import { FileMenu, type FileMenuHandle } from './file-menu.tsx'
import { PageBar } from './page-bar.tsx'
import { PropertyGrid } from './property-grid.tsx'
import { useShortcuts } from './shortcuts.tsx'
import { EmptyNote, ErrorNote } from './states.tsx'
import { TargetFaceFigure } from './target-face-drawing.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'
import { useKeptDraft } from './use-kept-draft.ts'
import { recordLoadingText, useRecordLink } from './use-record-link.ts'
import { Workspace } from './workspace.tsx'

loadEnglish(englishMessages)

/** The record name of a face without a name. */
const fallbackName = 'Target design'

/** The key of the empty draft: nothing to keep before the first edit. */
const blankKey = namedKey(fileData(newDesign()), '')

const ruleOptions: { value: InnerRule; label: MessageDescriptor }[] = [
  { value: '', label: /*i18n*/ { id: 'targetDesigner.notStated', message: 'Not stated' } },
  { value: 'touch', label: /*i18n*/ { id: 'targetDesigner.touchCounts', message: 'Touch counts' } },
  { value: 'cover', label: /*i18n*/ { id: 'targetDesigner.coverCounts', message: 'Cover counts' } },
]

const colourOptions = (part: 'fill' | 'line', i18n: I18n) => [
  {
    value: '',
    label:
      part === 'fill'
        ? i18n._({ id: 'targetDesigner.fillNotSet', message: 'Fill: not set' })
        : i18n._({ id: 'targetDesigner.lineNotSet', message: 'Line: not set' }),
  },
  ...colours.map((c) => {
    const colour = colourWord(i18n, c)
    return {
      value: c,
      label:
        part === 'fill'
          ? i18n._({
              id: 'targetDesigner.fillColor',
              message: 'Fill: {colour}',
              values: { colour },
            })
          : i18n._({
              id: 'targetDesigner.lineColor',
              message: 'Line: {colour}',
              values: { colour },
            }),
    }
  }),
]

/** The face is drawn by `@rangefoundry/svg-drawings` while its fields change; the draft is kept in this browser on every change (a record of kind `targetFaceDesign`), and once it passes the schema the shot groups and hit probability tools offer it; `?record=` opens a browser record, a Mine row's link. */
export function TargetDesigner() {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const { system } = useUnits()
  const [history, dispatch] = useReducer(reduce, undefined, () => historyOf(newDesign()))
  const design = history.present
  useShortcuts({
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
  })
  useEffect(() => dispatch({ type: 'units', system }), [system])

  const [recordId, setRecordId] = useState(newId)
  const menu = useRef<FileMenuHandle>(null)
  const [linkFailure, setLinkFailure] = useState<MessageDescriptor>()
  useRecordLink('targetFaceDesign', menu, (m) =>
    setLinkFailure(m === recordLoadingText ? undefined : m),
  )
  const data = useMemo(() => fileData(design), [design])
  const key = namedKey(data, design.name)
  const edited = key !== blankKey

  const { kept, flush, drop, stored } = useKeptDraft(
    'targetFaceDesign',
    fallbackName,
    blankKey,
    recordId,
    design.name,
    data,
    key,
  )

  const built = useMemo(() => faceOf(design, userFaceId(recordId), i18n), [design, recordId, i18n])
  const problems = 'problems' in built ? built.problems : []
  const keyed = new Map(problems.flatMap((p) => (p.key ? [[p.key, p.message] as const] : [])))
  const general = problems.filter((p) => !p.key).map((p) => p.message)
  const shape = useMemo(() => shapeOf(design), [design])
  const lastShape = useRef(shape)
  if (shape) lastShape.current = shape
  const shown = shape ?? lastShape.current
  const name = design.name.trim() || fallbackName

  const toolbar = (a: { type: string }) => {
    if (a.type === 'new') {
      flush()
      setRecordId(newId())
      stored.current = { key: blankKey, written: false }
    }
    dispatch(a as Action)
  }

  /** `none` in the ring and event tables, whose column headers name the unit. */
  const field = (
    fieldKey: string,
    label: MessageDescriptor,
    help: MessageDescriptor,
    unit: 'switch' | 'none' = 'none',
  ) => {
    const spec = { ...specOf(fieldKey), label }
    const value = fieldAt(design, fieldKey)
    return (
      <DesignerField
        key={fieldKey}
        spec={spec}
        system={system}
        value={value}
        help={i18n._(help)}
        changed={false}
        error={
          fieldError(spec, value, system, t, i18n) ?? (edited ? keyed.get(fieldKey) : undefined)
        }
        unit={unit}
        dispatch={dispatch}
      />
    )
  }
  const remove = (label: string, action: Action) => (
    <ActionIcon variant="subtle" aria-label={label} title={label} onClick={() => dispatch(action)}>
      <X aria-hidden="true" />
    </ActionIcon>
  )

  const ringRows = design.rows.map((r, i) => (
    <div key={r.id} className="face-ring">
      <div className="face-row">
        {field(
          `ring.${r.id}.value`,
          /*i18n*/ {
            id: 'targetDesigner.ringNValue',
            message: 'Ring {n} value',
            values: { n: i + 1 },
          },
          /*i18n*/ {
            id: 'targetDesigner.ringValueHelp',
            message: 'The score of a hole in this ring.',
          },
        )}
        {field(
          `ring.${r.id}.diameter`,
          /*i18n*/ {
            id: 'targetDesigner.ringNDiameter',
            message: 'Ring {n} diameter',
            values: { n: i + 1 },
          },
          /*i18n*/ {
            id: 'targetDesigner.ringDiameterHelp',
            message: 'Width of the ring to the outside edge of its line.',
          },
        )}
        {field(
          `ring.${r.id}.height`,
          /*i18n*/ {
            id: 'targetDesigner.ringNHeight',
            message: 'Ring {n} height',
            values: { n: i + 1 },
          },
          /*i18n*/ { id: 'targetDesigner.ovalHelp', message: 'For an oval; empty for a circle.' },
        )}
        {remove(
          i18n._({
            id: 'targetDesigner.removeRingN',
            message: 'Remove ring {n}',
            values: { n: i + 1 },
          }),
          { type: 'removeRing', id: r.id },
        )}
      </div>
      <div className="face-colours">
        {(['fill', 'line'] as const).map((part) => (
          <NativeSelect
            key={part}
            size={controlSize.row.input}
            aria-label={
              part === 'fill'
                ? i18n._({
                    id: 'targetDesigner.ringNFill',
                    message: 'Ring {n} fill',
                    values: { n: i + 1 },
                  })
                : i18n._({
                    id: 'targetDesigner.ringNLine',
                    message: 'Ring {n} line',
                    values: { n: i + 1 },
                  })
            }
            title={
              part === 'fill'
                ? i18n._({
                    id: 'targetDesigner.fillHelp',
                    message: 'Color of the zone this ring line bounds on the outside.',
                  })
                : undefined
            }
            data={colourOptions(part, i18n)}
            value={r[part]}
            onChange={(e) =>
              dispatch({ type: 'colour', id: r.id, part, value: e.currentTarget.value })
            }
          />
        ))}
      </div>
    </div>
  ))

  const eventRows = design.events.map((e, i) => (
    <div key={e.id} className="face-row face-event">
      <TextInput
        size={controlSize.row.input}
        aria-label={i18n._({
          id: 'targetDesigner.eventNName',
          message: 'Event {n} name',
          values: { n: i + 1 },
        })}
        placeholder={i18n._({ id: 'targetDesigner.eventName', message: 'Event name' })}
        maxLength={200}
        value={e.name}
        error={edited && keyed.has(`event.${e.id}.name`)}
        title={edited ? keyed.get(`event.${e.id}.name`) : undefined}
        onChange={(ev) => dispatch({ type: 'eventName', id: e.id, value: ev.currentTarget.value })}
      />
      {field(
        `event.${e.id}.distance`,
        /*i18n*/ {
          id: 'targetDesigner.eventNDistance',
          message: 'Event {n} distance',
          values: { n: i + 1 },
        },
        /*i18n*/ { id: 'targetDesigner.distanceHelp', message: 'Shooting distance.' },
      )}
      {field(
        `event.${e.id}.gauge`,
        /*i18n*/ {
          id: 'targetDesigner.eventNGauge',
          message: 'Event {n} gauge',
          values: { n: i + 1 },
        },
        /*i18n*/ { id: 'targetDesigner.gaugeHelp', message: 'Diameter of the scored hole.' },
      )}
      {remove(
        i18n._({
          id: 'targetDesigner.removeEventN',
          message: 'Remove event {n}',
          values: { n: i + 1 },
        }),
        { type: 'removeEvent', id: e.id },
      )}
    </div>
  ))

  const head = (cells: ReactNode[], row = 'face-row') => (
    <div className={`${row} face-head`} aria-hidden="true">
      {cells.map((c, i) => (
        // oxlint-disable-next-line react/no-array-index-key -- fixed header cells
        <span key={i}>{c}</span>
      ))}
    </div>
  )
  const mm = system.length.symbol

  const sections = [
    {
      key: 'face',
      title: i18n._({ id: 'targetDesigner.target', message: 'Target' }),
      content: (
        <div className="prop-grid designer-grid">
          <TextInput
            label={i18n._({ id: 'targetDesigner.name', message: 'Name' })}
            value={design.name}
            maxLength={200}
            onChange={(ev) => dispatch({ type: 'name', value: ev.currentTarget.value })}
          />
          {field(
            'black.diameter',
            /*i18n*/ { id: 'targetDesigner.blackAreaDiameter', message: 'Black area diameter' },
            /*i18n*/ {
              id: 'targetDesigner.blackDiameterHelp',
              message: 'Outside of the outermost black zone.',
            },
            'switch',
          )}
          {field(
            'black.height',
            /*i18n*/ { id: 'targetDesigner.blackAreaHeight', message: 'Black area height' },
            /*i18n*/ { id: 'targetDesigner.ovalHelp', message: 'For an oval; empty for a circle.' },
            'switch',
          )}
          <Checkbox
            label={i18n._({ id: 'targetDesigner.decimalScoring', message: 'Decimal scoring' })}
            checked={design.decimal}
            onChange={(ev) => dispatch({ type: 'decimal', value: ev.currentTarget.checked })}
          />
        </div>
      ),
    },
    {
      key: 'rings',
      title: i18n._({ id: 'targetDesigner.ringsOuterToInner', message: 'Rings, outer to inner' }),
      content: (
        <div className="side-grid">
          {head([
            i18n._({ id: 'targetDesigner.value', message: 'Value' }),
            i18n._({
              id: 'targetDesigner.diameterUnit',
              message: 'Diameter, {unit}',
              values: { unit: mm },
            }),
            i18n._({
              id: 'targetDesigner.heightUnit',
              message: 'Height, {unit}',
              values: { unit: mm },
            }),
            '',
          ])}
          {ringRows}
          <Button
            variant="default"
            size={controlSize.row.button}
            leftSection={<Plus aria-hidden="true" />}
            onClick={() => dispatch({ type: 'addRing', id: rowId() })}
          >
            {i18n._({ id: 'targetDesigner.addRing', message: 'Add ring' })}
          </Button>
        </div>
      ),
    },
    {
      key: 'inner',
      title: i18n._({ id: 'targetDesigner.innerTen', message: 'Inner ten' }),
      content: (
        <div className="prop-grid designer-grid">
          {field(
            'inner.diameter',
            /*i18n*/ { id: 'targetDesigner.innerTenDiameter', message: 'Inner ten diameter' },
            /*i18n*/ {
              id: 'targetDesigner.innerTenDiameterHelp',
              message: 'Width of the inner ten circle.',
            },
            'switch',
          )}
          {field(
            'inner.height',
            /*i18n*/ { id: 'targetDesigner.innerTenHeight', message: 'Inner ten height' },
            /*i18n*/ { id: 'targetDesigner.ovalHelp', message: 'For an oval; empty for a circle.' },
            'switch',
          )}
          <NativeSelect
            label={i18n._({ id: 'targetDesigner.innerTenRule', message: 'Inner ten rule' })}
            size={controlSize.row.input}
            data={ruleOptions.map((o) => ({ value: o.value, label: i18n._(o.label) }))}
            value={design.rule}
            onChange={(e) => dispatch({ type: 'rule', value: e.currentTarget.value as InnerRule })}
          />
        </div>
      ),
    },
    {
      key: 'events',
      title: i18n._({ id: 'targetDesigner.events', message: 'Events of the target' }),
      content: (
        <div className="side-grid">
          {head(
            [
              i18n._({ id: 'targetDesigner.name', message: 'Name' }),
              i18n._({
                id: 'targetDesigner.distanceUnit',
                message: 'Distance, {unit}',
                values: { unit: system.range.symbol },
              }),
              i18n._({
                id: 'targetDesigner.gaugeUnit',
                message: 'Gauge, {unit}',
                values: { unit: mm },
              }),
              '',
            ],
            'face-row face-event',
          )}
          {eventRows}
          <Button
            variant="default"
            size={controlSize.row.button}
            leftSection={<Plus aria-hidden="true" />}
            onClick={() => dispatch({ type: 'addEvent', id: rowId() })}
          >
            {i18n._({ id: 'targetDesigner.addEvent', message: 'Add event' })}
          </Button>
        </div>
      ),
    },
  ]

  const status =
    'face' in built
      ? i18n._({
          id: 'targetDesigner.usableAs',
          message: 'Usable in the shot groups and hit probability tools as {owner} {name}.',
          values: { owner: userOrganization, name },
        })
      : edited
        ? general.join(' ') ||
          i18n._(
            'targetDesigner.fieldsToFix',
            { count: keyed.size },
            {
              message: '{count, plural, one {# field to fix.} other {# fields to fix.}}',
              formats: ungrouped,
            },
          )
        : ''

  const inputs = (
    <form noValidate onSubmit={(ev) => ev.preventDefault()}>
      {linkFailure && <ErrorNote>{i18n._(linkFailure)}</ErrorNote>}
      <PropertyGrid
        title={i18n._({ id: 'targetDesigner.parameters', message: 'Parameters' })}
        sections={sections}
        message={edited ? general[0] : undefined}
      />
    </form>
  )
  const results = (
    <>
      <div className="page-panel-head designer-panel-head">
        <h2 className="page-panel-title record-heading">
          {i18n._({ id: 'targetDesigner.drawing', message: 'Drawing' })}
        </h2>
      </div>
      <Text component="p" inherit fz="sm" m={0} className="derived-line" title={status}>
        {status}
      </Text>
      {shown ? (
        <div className="designer-drawing" data-stale={!shape || undefined}>
          <TargetFaceFigure
            shape={shown}
            label={i18n._(
              'targetDesigner.drawingLabel',
              { count: shown.rings.length, name, size: shown.rings[0]?.diameter.value ?? 0 },
              {
                message:
                  '{count, plural, one {{name}: # ring, {size, decimal} mm across} other {{name}: # rings, {size, decimal} mm across}}',
                formats: ungrouped,
              },
            )}
          />
        </div>
      ) : (
        <EmptyNote
          icon={<Target size={24} aria-hidden="true" />}
          title={i18n._({ id: 'targetDesigner.noDrawingYet', message: 'No drawing yet' })}
          description={i18n._({
            id: 'targetDesigner.enterRingDiameter',
            message: 'Enter a ring diameter.',
          })}
        />
      )}
    </>
  )

  return (
    <>
      <PageBar
        title={/*i18n*/ { id: 'page.targetsDesigner', message: 'Target designer' }}
        translated
        fold={
          <DesignerToolbar
            undo={history.past.length > 0}
            redo={history.future.length > 0}
            newLabel={i18n._({ id: 'targetDesigner.newTarget', message: 'New target' })}
            system={system}
            dispatch={toolbar}
          />
        }
        actions={
          <>
            <FileMenu
              ref={menu}
              kind="targetFaceDesign"
              name={name}
              nameKey={design.name}
              data={data}
              autosaved={recordId}
              browserList
              kept={kept}
              onOpen={(opened, openedName, record) => {
                // the file menu stored the opened record already: an older draft of the same id must not overwrite it
                if (record.id === recordId) drop()
                else flush()
                setRecordId(record.id)
                const next = fromFile(opened, openedName, system)
                // the draft as the designer keeps it, so opening a record is no change to save
                stored.current = { key: namedKey(fileData(next), next.name), written: true }
                dispatch({ type: 'start', design: next })
              }}
            />
            <UnitsIconButton />
          </>
        }
      />
      <div className="designer face-designer">
        <Workspace inputs={inputs} results={results} bar={() => null} />
      </div>
    </>
  )
}
