'use client'

import {
  ActionIcon,
  Button,
  Checkbox,
  NativeSelect,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { Flask, Plus, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { type ReactNode, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { type Message as Marked, msg } from '../i18n/translate.ts'
import { fieldError, specText } from '../lib/field-spec.ts'
import { historyOf } from '../lib/history.ts'
import { newId } from '../lib/new-id.ts'
import {
  type Action,
  checkDesign,
  type Design,
  fallbackName,
  fieldAt,
  fileData,
  fittedKeys,
  fromFile,
  grainForms,
  newDesign,
  type PowderSpec,
  type Problem,
  powderSpecs,
  propellantBases,
  provenanceKinds,
  reduce,
  rowId,
  specOf,
} from '../lib/powder-designer.ts'
import { rawWording } from '../lib/record-values.ts'
import { controlSize } from '../lib/theme.ts'
import { tunePowderHref } from '../lib/tune-href.ts'
import { namedKey } from '../lib/user-data.ts'
import { userRef } from '../lib/variants.ts'
import { say, verbatim } from '../lib/wording.ts'
import { DesignerField } from './designer-field.tsx'
import { DesignerToolbar } from './designer-toolbar.tsx'
import { FieldTable } from './field-table.tsx'
import { FileMenu, type FileMenuHandle } from './file-menu.tsx'
import { PageBar } from './page-bar.tsx'
import { PropertyGrid } from './property-grid.tsx'
import { useShortcuts } from './shortcuts.tsx'
import { EmptyNote, ErrorNote, Message } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'
import { useKeptDraft } from './use-kept-draft.ts'
import { recordLoadingText, useRecordLink } from './use-record-link.ts'
import { Workspace } from './workspace.tsx'

/** The key of the empty draft: nothing to keep before the first edit. */
const blankKey = namedKey(fileData(newDesign()), '')

const provenanceText: Record<(typeof provenanceKinds)[number], Marked> = {
  measured: msg('Measured'),
  published: msg('Published'),
  derived: msg('Derived'),
  fitted: msg('Fitted to data'),
  computed: msg('Computed by a model'),
}

/** The fitted parameters' checkboxes: named apart from the fields of the same values. */
const fittedText: Record<(typeof fittedKeys)[number], Marked> = {
  vivacity: msg('Vivacity (moved by the fit)'),
  energy: msg('Specific energy (moved by the fit)'),
  'form.a': msg('Form a (moved by the fit)'),
}

/** The thermochemistry's ranges: the name in the record and the label of its row. */
const ranges = [
  ['flameTemperature', msg('Flame temperature')],
  ['impetus', msg('Impetus')],
  ['gamma', msg('Gamma')],
  ['molarMass', msg('Molar mass')],
  ['covolume', msg('Covolume')],
] as const

const specsOf = (group: PowderSpec['group']) => powderSpecs.filter((s) => s.group === group)

/** The results side: the status line, the problems of the draft and what prints. */
function RecordPanel({
  design,
  built,
  edited,
  name,
  problems,
  keyed,
}: {
  design: Design
  built: ReturnType<typeof checkDesign>
  edited: boolean
  name: string
  problems: Problem[]
  /** The number of problems that belong to a field. */
  keyed: number
}) {
  const { t, tn } = useTranslation()
  const status =
    'powder' in built
      ? built.powder.interior
        ? t('Usable in the workbench as {name} (your design).', { name })
        : t(
            'Usable in the workbench as {name} (your design). Without burn-law parameters it fills no model values.',
            { name },
          )
      : edited
        ? problems
            .filter((p) => !p.key)
            .map((p) => p.message)
            .join(' ') || tn(keyed, '{count} field to fix.', '{count} fields to fix.')
        : ''
  // print: the values and the mark, not the form
  const values = powderSpecs.flatMap((s) => {
    const si = fieldAt(design, s.key).si
    return si === undefined
      ? []
      : [{ label: verbatim(specText(t, s.label)), value: { quantity: s.quantity, si } }]
  })
  const choices = [
    {
      label: msg('Provenance'),
      text: design.provenanceKind && t(provenanceText[design.provenanceKind]),
    },
    { label: msg('Grain form'), text: design.grainForm && say(t, rawWording(design.grainForm)) },
    {
      label: msg('Propellant base'),
      text: design.propellantBase && say(t, rawWording(design.propellantBase)),
    },
  ].flatMap(({ label, text }) => (text ? [{ label: verbatim(t(label)), text }] : []))
  return (
    <>
      <div className="page-panel-head designer-panel-head">
        <h2 className="page-panel-title record-heading">{t('Record')}</h2>
      </div>
      <Text component="p" inherit fz="sm" m={0} className="derived-line" title={status}>
        {status}
      </Text>
      {problems.length > 0 && edited ? (
        <Message severity="warning" title={t('Still needed for a powder record')}>
          <ul className="powder-problems">
            {problems.map((p) => (
              <li key={`${p.key ?? ''}${p.message}`}>{p.message}</li>
            ))}
          </ul>
        </Message>
      ) : edited ? (
        <Message severity="info">
          {t('User design: the workbench marks every result computed with it.')}
        </Message>
      ) : (
        <EmptyNote
          icon={<Flask size={24} aria-hidden="true" />}
          title={t('No powder yet')}
          description={t('Enter a name and the values you have.')}
        />
      )}
      <div className="print-only">
        <p>{t('{name} (user design, not a catalogue record)', { name })}</p>
        <FieldTable
          caption={msg('Values of the design')}
          groups={[{ rows: [...choices, ...values] }]}
        />
      </div>
    </>
  )
}

/**
 * The powder designer: the fields of a powder record (name, aliases, grain form, propellant base,
 * composition, thermochemistry and the burn law of the interior model) with the provenance kind
 * the design is built with, the checks of the powder schema at the fields. The draft is kept in
 * this browser on every change (a record of kind `powder`); a draft that passes the schema is
 * offered by the workbench's Powder card as the user's own design. `?record=` opens a browser
 * record, the link of a Mine row of the powder list.
 */
export function PowderDesigner() {
  const { t } = useTranslation()
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
  const [linkFailure, setLinkFailure] = useState<Marked>()
  useRecordLink('powder', menu, (m) => setLinkFailure(m === recordLoadingText ? undefined : m))
  const data = useMemo(() => fileData(design), [design])
  const key = namedKey(data, design.name)
  const edited = key !== blankKey
  const { kept, flush, drop, stored } = useKeptDraft(
    'powder',
    fallbackName,
    blankKey,
    recordId,
    design.name,
    data,
    key,
  )

  const built = useMemo(() => checkDesign(design, recordId, t), [design, recordId, t])
  const problems = 'problems' in built ? built.problems : []
  const keyed = new Map(problems.flatMap((p) => (p.key ? [[p.key, p.message] as const] : [])))
  const general = problems.filter((p) => !p.key).map((p) => p.message)
  const name = design.name.trim() || fallbackName
  const saved = edited ? userRef(recordId) : undefined
  const tuneHref = saved ? tunePowderHref(saved) : '/powders/tune'

  const toolbar = (a: { type: string }) => {
    if (a.type === 'new') {
      flush()
      setRecordId(newId())
      stored.current = { key: blankKey, written: false }
    }
    dispatch(a as Action)
  }

  const shown = (k: string) => (edited ? keyed.get(k) : undefined)

  const field = (spec: PowderSpec, text: 'text' | 'none' = 'text') => {
    const value = fieldAt(design, spec.key)
    const help = [
      spec.help && specText(t, spec.help),
      // an empty extreme of a thermochemistry range is built as its value (`powderOf`)
      /^thermochemistry\..+\.(min|max)$/.test(spec.key) && t('Empty: same as Value.'),
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <DesignerField
        key={spec.key}
        spec={spec}
        system={system}
        value={value}
        help={help}
        changed={false}
        error={fieldError(spec, value, system, t) ?? shown(spec.key)}
        unit={text}
        dispatch={dispatch}
      />
    )
  }

  const head = (cells: string[]) => (
    <div className="powder-row powder-head" aria-hidden="true">
      {cells.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed header cells
        <span key={i}>{c}</span>
      ))}
    </div>
  )

  const select = (
    label: string,
    value: string,
    options: readonly string[],
    action: (v: string) => Action,
    error?: string,
    text: (o: string) => string = (o) => (o === '' ? t('Not stated') : say(t, rawWording(o))),
  ) => (
    <div className="designer-field" data-error={error ? true : undefined}>
      <NativeSelect
        label={label}
        labelProps={{ title: error }}
        value={value}
        description={error}
        error={!!error}
        data={['', ...options].map((o) => ({ value: o, label: text(o) }))}
        onChange={(ev) => dispatch(action(ev.currentTarget.value))}
      />
    </div>
  )

  const rangeRows = ranges.map(([part, label]) => {
    const unit = specOf(`thermochemistry.${part}.value`)
    return (
      <div key={part} className="powder-row">
        <span className="powder-label">
          {t(label)}
          {system[unit.quantity].symbol ? `, ${system[unit.quantity].symbol}` : ''}
        </span>
        {(['value', 'min', 'max'] as const).map((p) =>
          field(specOf(`thermochemistry.${part}.${p}`), 'none'),
        )}
      </div>
    )
  })

  const ingredientRows = design.rows.map((r, i) => (
    <div key={r.id} className="powder-row powder-ingredient">
      <TextInput
        size={controlSize.row.input}
        aria-label={t('Ingredient {n} name', { n: i + 1 })}
        placeholder={t('Ingredient')}
        value={r.name}
        onChange={(ev) =>
          dispatch({ type: 'ingredient', id: r.id, part: 'name', value: ev.currentTarget.value })
        }
      />
      <TextInput
        size={controlSize.row.input}
        aria-label={t('Ingredient {n} CAS number', { n: i + 1 })}
        placeholder="CAS"
        value={r.cas}
        onChange={(ev) =>
          dispatch({ type: 'ingredient', id: r.id, part: 'cas', value: ev.currentTarget.value })
        }
      />
      {(['min', 'max'] as const).map((p) => {
        const label =
          p === 'min'
            ? t('Ingredient {n} min percent', { n: i + 1 })
            : t('Ingredient {n} max percent', { n: i + 1 })
        const spec = { ...specOf(`comp.${r.id}.${p}`), label }
        return field(spec, 'none')
      })}
      <ActionIcon
        variant="subtle"
        aria-label={t('Remove ingredient {n}', { n: i + 1 })}
        title={t('Remove ingredient {n}', { n: i + 1 })}
        onClick={() => dispatch({ type: 'removeRow', id: r.id })}
      >
        <X aria-hidden="true" />
      </ActionIcon>
    </div>
  ))

  const fittedError = shown('fitted')

  const sections: { key: string; title: string; content: ReactNode }[] = [
    {
      key: 'identity',
      title: t('Powder'),
      content: (
        <div className="prop-grid designer-grid">
          <TextInput
            label={t('Name')}
            value={design.name}
            maxLength={200}
            onChange={(ev) => dispatch({ type: 'name', value: ev.currentTarget.value })}
          />
          <Textarea
            label={t('Aliases, one per line')}
            rows={2}
            value={design.aliases}
            onChange={(ev) =>
              dispatch({ type: 'text', key: 'aliases', value: ev.currentTarget.value })
            }
          />
          {select(t('Grain form'), design.grainForm, grainForms, (value) => ({
            type: 'grainForm',
            value: value as typeof design.grainForm,
          }))}
          {select(t('Propellant base'), design.propellantBase, propellantBases, (value) => ({
            type: 'propellantBase',
            value: value as typeof design.propellantBase,
          }))}
          {specsOf('properties').map((s) => field(s))}
          {select(
            t('Values came about by'),
            design.provenanceKind,
            provenanceKinds,
            (value) => ({ type: 'provenanceKind', value: value as typeof design.provenanceKind }),
            shown('provenanceKind'),
            (o) => (o === '' ? t('Choose…') : t(provenanceText[o as keyof typeof provenanceText])),
          )}
          <Textarea
            label={t('Note')}
            rows={2}
            value={design.note}
            onChange={(ev) =>
              dispatch({ type: 'text', key: 'note', value: ev.currentTarget.value })
            }
          />
        </div>
      ),
    },
    {
      key: 'composition',
      title: t('Composition, mass percent'),
      content: (
        <div className="side-grid">
          {head([t('Ingredient'), 'CAS', t('Min'), t('Max'), ''])}
          {ingredientRows}
          <Button
            variant="default"
            size={controlSize.row.button}
            leftSection={<Plus aria-hidden="true" />}
            onClick={() => dispatch({ type: 'addRow', id: rowId() })}
          >
            {t('Add ingredient')}
          </Button>
        </div>
      ),
    },
    {
      key: 'thermochemistry',
      title: t('Thermochemistry'),
      content: (
        <>
          <div className="prop-grid designer-grid">
            {field(specOf('thermochemistry.loadingDensity.value'))}
          </div>
          <div className="side-grid">
            {head(['', t('Value'), t('Min'), t('Max')])}
            {rangeRows}
          </div>
        </>
      ),
    },
    {
      key: 'burn',
      title: t('Burn law (interior model)'),
      content: (
        <>
          <p className="note powder-fit-link">
            <Link href={tuneHref}>{t('Fit a powder from chronograph strings')}</Link>
          </p>
          <div className="prop-grid designer-grid">
            <fieldset className="designer-checks" data-error={fittedError ? true : undefined}>
              <legend>{t('Parameters the fit moved')}</legend>
              {fittedKeys.map((k) => (
                <Checkbox
                  key={k}
                  label={t(fittedText[k])}
                  checked={design.fitted.includes(k)}
                  onChange={(ev) =>
                    dispatch({ type: 'fitted', key: k, value: ev.currentTarget.checked })
                  }
                />
              ))}
              {fittedError && (
                <Text fz="sm" c="var(--error-fg)">
                  {fittedError}
                </Text>
              )}
            </fieldset>
            {specsOf('burn').map((s) => field(s))}
          </div>
        </>
      ),
    },
  ]

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
    <RecordPanel
      design={design}
      built={built}
      edited={edited}
      name={name}
      problems={problems}
      keyed={keyed.size}
    />
  )

  return (
    <>
      <PageBar
        title={msg('Powder designer')}
        translated
        fold={
          <DesignerToolbar
            undo={history.past.length > 0}
            redo={history.future.length > 0}
            newLabel={t('New powder')}
            system={system}
            dispatch={toolbar}
          />
        }
        actions={
          <>
            <FileMenu
              ref={menu}
              kind="powder"
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
      <div className="designer powder-designer">
        <Workspace inputs={inputs} results={results} bar={() => null} />
      </div>
    </>
  )
}
