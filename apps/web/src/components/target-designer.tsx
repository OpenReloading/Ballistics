'use client'

import { ActionIcon, Button, Checkbox, NativeSelect, Text, TextInput } from '@mantine/core'
import { Plus, Target, X } from '@phosphor-icons/react'
import { type ReactNode, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { colourWord } from '../lib/face-words.ts'
import { fieldError } from '../lib/field-spec.ts'
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
import { DesignerField } from './designer-field.tsx'
import { DesignerToolbar } from './designer-toolbar.tsx'
import { FileMenu, type FileMenuHandle } from './file-menu.tsx'
import { PageBar } from './page-bar.tsx'
import { PropertyGrid } from './property-grid.tsx'
import { useShortcuts } from './shortcuts.tsx'
import { EmptyNote, ErrorNote } from './states.tsx'
import { TargetFaceFigure } from './target-face-drawing.tsx'
import { useUnits } from './units-settings.tsx'
import { useKeptDraft } from './use-kept-draft.ts'
import { recordLoadingText, useRecordLink } from './use-record-link.ts'
import { Workspace } from './workspace.tsx'

/** The record name of a face without a name. */
const fallbackName = 'Target design'

/** The key of the empty draft: nothing to keep before the first edit. */
const blankKey = namedKey(fileData(newDesign()), '')

const ruleOptions: { value: InnerRule; label: Message }[] = [
  { value: '', label: msg('Not stated') },
  { value: 'touch', label: msg('Touch counts') },
  { value: 'cover', label: msg('Cover counts') },
]

const colourOptions = (part: 'fill' | 'line', t: Translator['t']) => [
  { value: '', label: part === 'fill' ? t('Fill: not set') : t('Line: not set') },
  ...colours.map((c) => {
    const colour = colourWord(t, c)
    return {
      value: c,
      label: part === 'fill' ? t('Fill: {colour}', { colour }) : t('Line: {colour}', { colour }),
    }
  }),
]

/**
 * The target face designer: the rings, inner ten, black area and events of a face as fields, the
 * face drawn from them by `@open-reloading/drawing` while they change, the checks of the target
 * face schema at the fields. The draft is kept in this browser on every change (a record of kind
 * `targetFaceDesign`); a face that passes the schema is offered by the shot groups and hit
 * probability tools as the user's own. `?record=` opens a browser record, the link of a Mine row of
 * the target list.
 */
export function TargetDesigner() {
  const { t, tn } = useTranslation()
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
  const [linkFailure, setLinkFailure] = useState<Message>()
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

  const built = useMemo(() => faceOf(design, userFaceId(recordId), t), [design, recordId, t])
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

  const field = (fieldKey: string, label: string, help: string) => {
    const spec = { ...specOf(fieldKey), label }
    const value = fieldAt(design, fieldKey)
    return (
      <DesignerField
        key={fieldKey}
        spec={spec}
        system={system}
        value={value}
        help={help}
        changed={false}
        error={fieldError(spec, value, system, t) ?? (edited ? keyed.get(fieldKey) : undefined)}
        unit="none"
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
          t('Ring {n} value', { n: i + 1 }),
          t('The score of a hole in this ring.'),
        )}
        {field(
          `ring.${r.id}.diameter`,
          t('Ring {n} diameter', { n: i + 1 }),
          t('Width of the ring to the outside edge of its line.'),
        )}
        {field(
          `ring.${r.id}.height`,
          t('Ring {n} height', { n: i + 1 }),
          t('Height of an oval ring; empty for a circle.'),
        )}
        {remove(t('Remove ring {n}', { n: i + 1 }), { type: 'removeRing', id: r.id })}
      </div>
      <div className="face-colours">
        {(['fill', 'line'] as const).map((part) => (
          <NativeSelect
            key={part}
            size={controlSize.row.input}
            aria-label={
              part === 'fill' ? t('Ring {n} fill', { n: i + 1 }) : t('Ring {n} line', { n: i + 1 })
            }
            title={
              part === 'fill'
                ? t('Colour of the zone this ring line bounds on the outside.')
                : t('Colour of the ring line.')
            }
            data={colourOptions(part, t)}
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
        aria-label={t('Event {n} name', { n: i + 1 })}
        placeholder={t('Event name')}
        maxLength={200}
        value={e.name}
        error={edited && keyed.has(`event.${e.id}.name`)}
        title={edited ? keyed.get(`event.${e.id}.name`) : undefined}
        onChange={(ev) => dispatch({ type: 'eventName', id: e.id, value: ev.currentTarget.value })}
      />
      {field(
        `event.${e.id}.distance`,
        t('Event {n} distance', { n: i + 1 }),
        t('Shooting distance.'),
      )}
      {field(
        `event.${e.id}.gauge`,
        t('Event {n} gauge', { n: i + 1 }),
        t('Diameter of the scored hole.'),
      )}
      {remove(t('Remove event {n}', { n: i + 1 }), { type: 'removeEvent', id: e.id })}
    </div>
  ))

  const head = (cells: ReactNode[], row = 'face-row') => (
    <div className={`${row} face-head`} aria-hidden="true">
      {cells.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed header cells
        <span key={i}>{c}</span>
      ))}
    </div>
  )
  const mm = system.length.symbol

  const sections = [
    {
      key: 'face',
      title: t('Target'),
      content: (
        <div className="prop-grid designer-grid">
          <TextInput
            label={t('Name')}
            value={design.name}
            maxLength={200}
            onChange={(ev) => dispatch({ type: 'name', value: ev.currentTarget.value })}
          />
          {field(
            'black.diameter',
            t('Black area diameter'),
            t('Outside of the outermost black zone.'),
          )}
          {field('black.height', t('Black area height'), t('Height of an oval black area.'))}
          <Checkbox
            label={t('Decimal scoring')}
            checked={design.decimal}
            onChange={(ev) => dispatch({ type: 'decimal', value: ev.currentTarget.checked })}
          />
        </div>
      ),
    },
    {
      key: 'rings',
      title: t('Rings, outer to inner'),
      content: (
        <div className="side-grid">
          {head([
            t('Value'),
            t('Diameter, {unit}', { unit: mm }),
            t('Height, {unit}', { unit: mm }),
            '',
          ])}
          {ringRows}
          <Button
            variant="default"
            size={controlSize.row.button}
            leftSection={<Plus aria-hidden="true" />}
            onClick={() => dispatch({ type: 'addRing', id: rowId() })}
          >
            {t('Add ring')}
          </Button>
        </div>
      ),
    },
    {
      key: 'inner',
      title: t('Inner ten'),
      content: (
        <div className="prop-grid designer-grid">
          {field('inner.diameter', t('Inner ten diameter'), t('Width of the inner ten circle.'))}
          {field('inner.height', t('Inner ten height'), t('Height of an oval inner ten.'))}
          <NativeSelect
            label={t('Inner ten rule')}
            size={controlSize.row.input}
            data={ruleOptions.map((o) => ({ value: o.value, label: t(o.label) }))}
            value={design.rule}
            onChange={(e) => dispatch({ type: 'rule', value: e.currentTarget.value as InnerRule })}
          />
        </div>
      ),
    },
    {
      key: 'events',
      title: t('Events of the target'),
      content: (
        <div className="side-grid">
          {head(
            [
              t('Name'),
              t('Distance, {unit}', { unit: system.range.symbol }),
              t('Gauge, {unit}', { unit: mm }),
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
            {t('Add event')}
          </Button>
        </div>
      ),
    },
  ]

  const status =
    'face' in built
      ? t('Usable in the shot groups and hit probability tools as {owner} {name}.', {
          owner: userOrganization,
          name,
        })
      : edited
        ? general.join(' ') || tn(keyed.size, '{count} field to fix.', '{count} fields to fix.')
        : ''

  const inputs = (
    <form noValidate onSubmit={(ev) => ev.preventDefault()}>
      {linkFailure && <ErrorNote>{t(linkFailure)}</ErrorNote>}
      <PropertyGrid
        title={t('Parameters')}
        sections={sections}
        message={edited ? general[0] : undefined}
      />
    </form>
  )
  const results = (
    <>
      <div className="page-panel-head designer-panel-head">
        <h2 className="page-panel-title record-heading">{t('Drawing')}</h2>
      </div>
      <Text component="p" inherit fz="sm" m={0} className="derived-line" title={status}>
        {status}
      </Text>
      {shown ? (
        <div className="designer-drawing" data-stale={!shape || undefined}>
          <TargetFaceFigure
            shape={shown}
            label={tn(
              shown.rings.length,
              '{name}: {count} ring, {size} mm across',
              '{name}: {count} rings, {size} mm across',
              {
                name,
                size: shown.rings[0]?.diameter.value ?? 0,
              },
            )}
          />
        </div>
      ) : (
        <EmptyNote
          icon={<Target size={24} aria-hidden="true" />}
          title={t('No drawing yet')}
          description={t('Enter a ring diameter.')}
        />
      )}
    </>
  )

  return (
    <>
      <PageBar
        title={msg('Target designer')}
        translated
        actions={
          <>
            <DesignerToolbar
              undo={history.past.length > 0}
              redo={history.future.length > 0}
              newLabel={t('New target')}
              system={system}
              dispatch={toolbar}
            />
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
          </>
        }
      />
      <div className="designer face-designer">
        <Workspace inputs={inputs} results={results} bar={() => null} />
      </div>
    </>
  )
}
