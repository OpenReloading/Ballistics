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
import { type ReactNode, useEffect, useMemo, useReducer, useState } from 'react'
import { fieldError } from '../lib/field-spec.ts'
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
  problemLabel,
  propellantBases,
  provenanceKinds,
  reduce,
  rowId,
  specOf,
} from '../lib/powder-designer.ts'
import { controlSize } from '../lib/theme.ts'
import { namedKey } from '../lib/user-data.ts'
import { DesignerField } from './designer-field.tsx'
import { DesignerToolbar } from './designer-toolbar.tsx'
import { FieldTable } from './field-table.tsx'
import { FileMenu } from './file-menu.tsx'
import { PageBar } from './page-bar.tsx'
import { PropertyGrid } from './property-grid.tsx'
import { useShortcuts } from './shortcuts.tsx'
import { EmptyNote, Message } from './states.tsx'
import { useUnits } from './units-settings.tsx'
import { useKeptDraft } from './use-kept-draft.ts'
import { Workspace } from './workspace.tsx'

/** The key of the empty draft: nothing to keep before the first edit. */
const blankKey = namedKey(fileData(newDesign()), '')

const optionLabel = (o: string) => (o === '' ? 'Not stated' : o)

const provenanceText: Record<(typeof provenanceKinds)[number], string> = {
  measured: 'Measured',
  published: 'Published',
  derived: 'Derived',
  fitted: 'Fitted to data',
  computed: 'Computed by a model',
}

const fittedText: Record<(typeof fittedKeys)[number], string> = {
  vivacity: 'Vivacity',
  energy: 'Specific energy',
  'form.a': 'Form a',
}

/** The thermochemistry's ranges: the name in the record and the label of its row. */
const ranges = [
  ['flameTemperature', 'Flame temperature'],
  ['impetus', 'Impetus'],
  ['gamma', 'Gamma'],
  ['molarMass', 'Molar mass'],
  ['covolume', 'Covolume'],
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
  const status =
    'powder' in built
      ? `Usable in the workbench as ${name} (your design).${
          built.powder.interior ? '' : ' Without burn-law parameters it fills no model values.'
        }`
      : edited
        ? problems
            .filter((p) => !p.key)
            .map((p) => p.message)
            .join(' ') || `${keyed} ${keyed === 1 ? 'field' : 'fields'} to fix.`
        : ''
  // print: the values and the mark, not the form
  const values = powderSpecs.flatMap((s) => {
    const si = fieldAt(design, s.key).si
    return si === undefined ? [] : [{ label: s.label, value: { quantity: s.quantity, si } }]
  })
  const choices = [
    ['Provenance', design.provenanceKind && provenanceText[design.provenanceKind]],
    ['Grain form', design.grainForm],
    ['Propellant base', design.propellantBase],
  ].flatMap(([label, text]) => (label && text ? [{ label, text }] : []))
  return (
    <>
      <div className="page-panel-head designer-panel-head">
        <h2 className="page-panel-title record-heading">Record</h2>
      </div>
      <Text component="p" inherit fz="sm" m={0} className="derived-line" title={status}>
        {status}
      </Text>
      {problems.length > 0 && edited ? (
        <Message severity="warning" title="The record does not pass the powder schema yet">
          <ul className="powder-problems">
            {problems.map((p) => (
              <li key={`${p.key ?? ''}${p.message}`}>
                {p.key ? `${problemLabel(p.key)}: ` : ''}
                {p.message}
              </li>
            ))}
          </ul>
        </Message>
      ) : edited ? (
        <Message severity="info">
          User design: the workbench marks every result computed with it.
        </Message>
      ) : (
        <EmptyNote
          icon={<Flask size={24} aria-hidden="true" />}
          title="No powder yet"
          description="Enter a name and the values you have. The checks run as you type."
        />
      )}
      <div className="print-only">
        <p>{name} (user design, not a catalogue record)</p>
        <FieldTable caption="Values of the design" groups={[{ rows: [...choices, ...values] }]} />
      </div>
    </>
  )
}

/**
 * The powder designer: the fields of a powder record (name, aliases, grain form, propellant base,
 * composition, thermochemistry and the burn law of the interior model) with the provenance kind
 * the design is built with, the checks of the powder schema at the fields. The draft is kept in
 * this browser on every change (a record of kind `powder`); a draft that passes the schema is
 * offered by the workbench's Powder card as the user's own design.
 */
export function PowderDesigner() {
  const { system } = useUnits()
  const [history, dispatch] = useReducer(reduce, undefined, () => historyOf(newDesign()))
  const design = history.present
  useShortcuts({
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
  })
  useEffect(() => dispatch({ type: 'units', system }), [system])

  const [recordId, setRecordId] = useState(newId)
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

  const built = useMemo(() => checkDesign(design, recordId), [design, recordId])
  const problems = 'problems' in built ? built.problems : []
  const keyed = new Map(problems.flatMap((p) => (p.key ? [[p.key, p.message] as const] : [])))
  const general = problems.filter((p) => !p.key).map((p) => p.message)
  const name = design.name.trim() || fallbackName

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
    return (
      <DesignerField
        key={spec.key}
        spec={spec}
        system={system}
        value={value}
        help={spec.help ?? ''}
        changed={false}
        error={fieldError(spec, value, system) ?? shown(spec.key)}
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
    text: (o: string) => string = optionLabel,
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
          {label}
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
        aria-label={`Ingredient ${i + 1} name`}
        placeholder="Ingredient"
        value={r.name}
        onChange={(ev) =>
          dispatch({ type: 'ingredient', id: r.id, part: 'name', value: ev.currentTarget.value })
        }
      />
      <TextInput
        size={controlSize.row.input}
        aria-label={`Ingredient ${i + 1} CAS number`}
        placeholder="CAS"
        value={r.cas}
        onChange={(ev) =>
          dispatch({ type: 'ingredient', id: r.id, part: 'cas', value: ev.currentTarget.value })
        }
      />
      {(['min', 'max'] as const).map((p) => {
        const spec = { ...specOf(`comp.${r.id}.${p}`), label: `Ingredient ${i + 1} ${p} percent` }
        return field(spec, 'none')
      })}
      <ActionIcon
        variant="subtle"
        aria-label={`Remove ingredient ${i + 1}`}
        title={`Remove ingredient ${i + 1}`}
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
      title: 'Powder',
      content: (
        <div className="prop-grid designer-grid">
          <TextInput
            label="Name"
            value={design.name}
            maxLength={200}
            onChange={(ev) => dispatch({ type: 'name', value: ev.currentTarget.value })}
          />
          <Textarea
            label="Aliases, one per line"
            rows={2}
            value={design.aliases}
            onChange={(ev) =>
              dispatch({ type: 'text', key: 'aliases', value: ev.currentTarget.value })
            }
          />
          {select('Grain form', design.grainForm, grainForms, (value) => ({
            type: 'grainForm',
            value: value as typeof design.grainForm,
          }))}
          {select('Propellant base', design.propellantBase, propellantBases, (value) => ({
            type: 'propellantBase',
            value: value as typeof design.propellantBase,
          }))}
          {specsOf('properties').map((s) => field(s))}
          {select(
            'Values came about by',
            design.provenanceKind,
            provenanceKinds,
            (value) => ({ type: 'provenanceKind', value: value as typeof design.provenanceKind }),
            shown('provenanceKind'),
            (o) => (o === '' ? 'Choose…' : provenanceText[o as keyof typeof provenanceText]),
          )}
          <Textarea
            label="Note"
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
      title: 'Composition, mass percent',
      content: (
        <div className="side-grid">
          {head(['Ingredient', 'CAS', 'Min', 'Max', ''])}
          {ingredientRows}
          <Button
            variant="default"
            size={controlSize.row.button}
            leftSection={<Plus aria-hidden="true" />}
            onClick={() => dispatch({ type: 'addRow', id: rowId() })}
          >
            Add ingredient
          </Button>
        </div>
      ),
    },
    {
      key: 'thermochemistry',
      title: 'Thermochemistry',
      content: (
        <>
          <div className="prop-grid designer-grid">
            {field(specOf('thermochemistry.loadingDensity.value'))}
          </div>
          <div className="side-grid">
            {head(['', 'Value', 'Min', 'Max'])}
            {rangeRows}
          </div>
        </>
      ),
    },
    {
      key: 'burn',
      title: 'Burn law (interior model)',
      content: (
        <div className="prop-grid designer-grid">
          <fieldset className="designer-checks" data-error={fittedError ? true : undefined}>
            <legend>Parameters the fit moved</legend>
            {fittedKeys.map((k) => (
              <Checkbox
                key={k}
                label={fittedText[k]}
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
      ),
    },
  ]

  const inputs = (
    <form noValidate onSubmit={(ev) => ev.preventDefault()}>
      <PropertyGrid
        title="Parameters"
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
        title="Powder designer"
        actions={
          <>
            <DesignerToolbar
              undo={history.past.length > 0}
              redo={history.future.length > 0}
              newLabel="New powder"
              system={system}
              dispatch={toolbar}
            />
            <FileMenu
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
          </>
        }
      />
      <div className="designer powder-designer">
        <Workspace inputs={inputs} results={results} bar={() => null} />
      </div>
    </>
  )
}
