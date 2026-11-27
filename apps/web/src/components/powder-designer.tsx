'use client'

import type { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import {
  ActionIcon,
  Button,
  Checkbox,
  NativeSelect,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { FlaskConical, Plus, X } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import Link from '@/platform/link.tsx'
import { useTranslation } from '../i18n/language.ts'
import { loadEnglish, ungrouped } from '../i18n/lingui.ts'
import { fieldError, specText } from '../lib/field-spec.ts'
import { historyOf } from '../lib/history.ts'
import { newId } from '../lib/new-id.ts'
import {
  type Action,
  checkDesign,
  type Design,
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
import { fallbackName } from '../lib/powder-designs.ts'
import { rawWording } from '../lib/record-values.ts'
import { controlSize } from '../lib/theme.ts'
import { tunePowderHref } from '../lib/tune-href.ts'
import { namedKey } from '../lib/user-data.ts'
import { userRef } from '../lib/variants.ts'
import { sayLingui, verbatim } from '../lib/wording.ts'
import englishMessages from '../locales/en/components/powder-designer.json' with { type: 'json' }
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

loadEnglish(englishMessages)

/** The key of the empty draft: nothing to keep before the first edit. */
const blankKey = namedKey(fileData(newDesign()), '')

const provenanceText: Record<(typeof provenanceKinds)[number], MessageDescriptor> = {
  measured: /*i18n*/ { id: 'powderDesigner.measured', message: 'Measured' },
  published: /*i18n*/ { id: 'powderDesigner.published', message: 'Published' },
  derived: /*i18n*/ { id: 'powderDesigner.derived', message: 'Derived' },
  fitted: /*i18n*/ { id: 'powderDesigner.fittedData', message: 'Fitted to data' },
  computed: /*i18n*/ { id: 'powderDesigner.computedModel', message: 'Computed by a model' },
}

/** The fitted parameters' checkboxes: named apart from the fields of the same values. */
const fittedText: Record<(typeof fittedKeys)[number], MessageDescriptor> = {
  vivacity: /*i18n*/ {
    id: 'powderDesigner.vivacityMovedFit',
    message: 'Vivacity (moved by the fit)',
  },
  energy: /*i18n*/ {
    id: 'powderDesigner.specificEnergyMovedFit',
    message: 'Specific energy (moved by the fit)',
  },
  'form.a': /*i18n*/ { id: 'powderDesigner.formAMovedFit', message: 'Form a (moved by the fit)' },
}

/** The thermochemistry's ranges: the name in the record and the label of its row. */
const ranges = [
  [
    'flameTemperature',
    /*i18n*/ { id: 'powderDesigner.flameTemperature', message: 'Flame temperature' },
  ],
  ['impetus', /*i18n*/ { id: 'powderDesigner.impetus', message: 'Impetus' }],
  ['gamma', /*i18n*/ { id: 'powderDesigner.gamma', message: 'Gamma' }],
  ['molarMass', /*i18n*/ { id: 'powderDesigner.molarMass', message: 'Molar mass' }],
  ['covolume', /*i18n*/ { id: 'powderDesigner.covolume', message: 'Covolume' }],
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
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const status =
    'powder' in built
      ? built.powder.interior
        ? i18n._({
            id: 'powderDesigner.usableWorkbenchYourDesign',
            message: 'Usable in the workbench as {name} (your design).',
            values: { name },
          })
        : i18n._({
            id: 'powderDesigner.usableWorkbenchNoBurnLaw',
            message:
              'Usable in the workbench as {name} (your design). Without burn-law parameters it fills no model values.',
            values: { name },
          })
      : edited
        ? problems
            .filter((p) => !p.key)
            .map((p) => p.message)
            .join(' ') ||
          i18n._(
            'powderDesigner.fieldsToFix',
            { count: keyed },
            {
              message: '{count, plural, one {# field to fix.} other {# fields to fix.}}',
              formats: ungrouped,
            },
          )
        : ''
  // print: the values and the mark, not the form
  const values = powderSpecs.flatMap((s) => {
    const si = fieldAt(design, s.key).si
    return si === undefined
      ? []
      : [{ label: verbatim(specText(t, s.label, i18n)), value: { quantity: s.quantity, si } }]
  })
  const choices = [
    {
      label: /*i18n*/ { id: 'powderDesigner.provenance', message: 'Provenance' },
      text: design.provenanceKind && i18n._(provenanceText[design.provenanceKind]),
    },
    {
      label: /*i18n*/ { id: 'powderDesigner.grainForm', message: 'Grain form' },
      text: design.grainForm && sayLingui(i18n, rawWording(design.grainForm)),
    },
    {
      label: /*i18n*/ { id: 'powderDesigner.propellantBase', message: 'Propellant base' },
      text: design.propellantBase && sayLingui(i18n, rawWording(design.propellantBase)),
    },
  ].flatMap(({ label, text }) => (text ? [{ label: verbatim(i18n._(label)), text }] : []))
  return (
    <>
      <div className="page-panel-head designer-panel-head">
        <h2 className="page-panel-title record-heading">
          {i18n._({ id: 'powderDesigner.record', message: 'Record' })}
        </h2>
      </div>
      <Text component="p" inherit fz="sm" m={0} className="derived-line" title={status}>
        {status}
      </Text>
      {problems.length > 0 && edited ? (
        <Message
          severity="warning"
          title={i18n._({
            id: 'powderDesigner.stillNeededPowderRecord',
            message: 'Still needed for a powder record',
          })}
        >
          <ul className="powder-problems">
            {problems.map((p) => (
              <li key={`${p.key ?? ''}${p.message}`}>{p.message}</li>
            ))}
          </ul>
        </Message>
      ) : edited ? (
        <Message severity="info">
          {i18n._({
            id: 'powderDesigner.userDesignWorkbenchMarks',
            message: 'User design: the workbench marks every result computed with it.',
          })}
        </Message>
      ) : (
        <EmptyNote
          icon={<FlaskConical size={24} aria-hidden="true" />}
          title={i18n._({ id: 'powderDesigner.noPowderYet', message: 'No powder yet' })}
          description={i18n._({
            id: 'powderDesigner.enterNameValuesYou',
            message: 'Enter a name and the values you have.',
          })}
        />
      )}
      <div className="print-only">
        <p>
          {i18n._({
            id: 'powderDesigner.userDesignNotCatalogue',
            message: '{name} (user design, not a catalogue record)',
            values: { name },
          })}
        </p>
        <FieldTable
          caption={/*i18n*/ { id: 'designer.values', message: 'Values of the design' }}
          groups={[{ rows: [...choices, ...values] }]}
        />
      </div>
    </>
  )
}

/** The draft is kept in this browser on every change (a record of kind `powder`), and once it passes the schema the workbench's Powder card offers it; `?record=` opens a browser record, a Mine row's link. */
export function PowderDesigner() {
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

  const built = useMemo(() => checkDesign(design, recordId, t, i18n), [design, recordId, t, i18n])
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
      spec.help && specText(t, spec.help, i18n),
      // an empty extreme of a thermochemistry range is built as its value (`powderOf`)
      /^thermochemistry\..+\.(min|max)$/.test(spec.key) &&
        i18n._({ id: 'powderDesigner.emptySameValue', message: 'Empty: same as Value.' }),
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
        error={fieldError(spec, value, system, t, i18n) ?? shown(spec.key)}
        unit={text}
        dispatch={dispatch}
      />
    )
  }

  const head = (cells: string[]) => (
    <div className="powder-row powder-head" aria-hidden="true">
      {cells.map((c, i) => (
        // oxlint-disable-next-line react/no-array-index-key -- fixed header cells
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
    text: (o: string) => string = (o) =>
      o === ''
        ? i18n._({ id: 'powderDesigner.notStated', message: 'Not stated' })
        : sayLingui(i18n, rawWording(o)),
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
          {i18n._(label)}
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
        aria-label={i18n._({
          id: 'powderDesigner.ingredientName',
          message: 'Ingredient {n, decimal} name',
          values: { n: i + 1 },
        })}
        placeholder={i18n._({ id: 'powderDesigner.ingredient', message: 'Ingredient' })}
        value={r.name}
        onChange={(ev) =>
          dispatch({ type: 'ingredient', id: r.id, part: 'name', value: ev.currentTarget.value })
        }
      />
      <TextInput
        size={controlSize.row.input}
        aria-label={i18n._({
          id: 'powderDesigner.ingredientCasNumber',
          message: 'Ingredient {n, decimal} CAS number',
          values: { n: i + 1 },
        })}
        placeholder="CAS"
        value={r.cas}
        onChange={(ev) =>
          dispatch({ type: 'ingredient', id: r.id, part: 'cas', value: ev.currentTarget.value })
        }
      />
      {(['min', 'max'] as const).map((p) => {
        const label =
          p === 'min'
            ? /*i18n*/ {
                id: 'powderDesigner.ingredientMinPercent',
                message: 'Ingredient {n, decimal} min percent',
                values: { n: i + 1 },
              }
            : /*i18n*/ {
                id: 'powderDesigner.ingredientMaxPercent',
                message: 'Ingredient {n, decimal} max percent',
                values: { n: i + 1 },
              }
        const spec = { ...specOf(`comp.${r.id}.${p}`), label }
        return field(spec, 'none')
      })}
      <ActionIcon
        variant="subtle"
        aria-label={i18n._({
          id: 'powderDesigner.removeIngredient',
          message: 'Remove ingredient {n, decimal}',
          values: { n: i + 1 },
        })}
        title={i18n._({
          id: 'powderDesigner.removeIngredient',
          message: 'Remove ingredient {n, decimal}',
          values: { n: i + 1 },
        })}
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
      title: i18n._({ id: 'powderDesigner.powder', message: 'Powder' }),
      content: (
        <div className="prop-grid designer-grid">
          <TextInput
            label={i18n._({ id: 'powderDesigner.name', message: 'Name' })}
            value={design.name}
            maxLength={200}
            onChange={(ev) => dispatch({ type: 'name', value: ev.currentTarget.value })}
          />
          <Textarea
            label={i18n._({
              id: 'powderDesigner.aliasesOnePerLine',
              message: 'Aliases, one per line',
            })}
            rows={2}
            value={design.aliases}
            onChange={(ev) =>
              dispatch({ type: 'text', key: 'aliases', value: ev.currentTarget.value })
            }
          />
          {select(
            i18n._({ id: 'powderDesigner.grainForm', message: 'Grain form' }),
            design.grainForm,
            grainForms,
            (value) => ({
              type: 'grainForm',
              value: value as typeof design.grainForm,
            }),
          )}
          {select(
            i18n._({ id: 'powderDesigner.propellantBase', message: 'Propellant base' }),
            design.propellantBase,
            propellantBases,
            (value) => ({
              type: 'propellantBase',
              value: value as typeof design.propellantBase,
            }),
          )}
          {specsOf('properties').map((s) => field(s))}
          {select(
            i18n._({ id: 'powderDesigner.valuesCameAbout', message: 'Values came about by' }),
            design.provenanceKind,
            provenanceKinds,
            (value) => ({ type: 'provenanceKind', value: value as typeof design.provenanceKind }),
            shown('provenanceKind'),
            (o) =>
              o === ''
                ? i18n._({ id: 'powderDesigner.choose', message: 'Choose…' })
                : i18n._(provenanceText[o as keyof typeof provenanceText]),
          )}
          <Textarea
            label={i18n._({ id: 'powderDesigner.note', message: 'Note' })}
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
      title: i18n._({
        id: 'powderDesigner.compositionMassPercent',
        message: 'Composition, mass percent',
      }),
      content: (
        <div className="side-grid">
          {head([
            i18n._({ id: 'powderDesigner.ingredient', message: 'Ingredient' }),
            'CAS',
            i18n._({ id: 'powderDesigner.min', message: 'Min' }),
            i18n._({ id: 'powderDesigner.max', message: 'Max' }),
            '',
          ])}
          {ingredientRows}
          <Button
            variant="default"
            size={controlSize.row.button}
            leftSection={<Plus aria-hidden="true" />}
            onClick={() => dispatch({ type: 'addRow', id: rowId() })}
          >
            {i18n._({ id: 'powderDesigner.addIngredient', message: 'Add ingredient' })}
          </Button>
        </div>
      ),
    },
    {
      key: 'thermochemistry',
      title: i18n._({ id: 'powderDesigner.thermochemistry', message: 'Thermochemistry' }),
      content: (
        <>
          <div className="prop-grid designer-grid">
            {field(specOf('thermochemistry.loadingDensity.value'))}
          </div>
          <div className="side-grid">
            {head([
              '',
              i18n._({ id: 'powderDesigner.value', message: 'Value' }),
              i18n._({ id: 'powderDesigner.min', message: 'Min' }),
              i18n._({ id: 'powderDesigner.max', message: 'Max' }),
            ])}
            {rangeRows}
          </div>
        </>
      ),
    },
    {
      key: 'burn',
      title: i18n._({
        id: 'powderDesigner.burnLawInteriorModel',
        message: 'Burn law (interior model)',
      }),
      content: (
        <>
          <p className="note powder-fit-link">
            <Link href={tuneHref}>
              {i18n._({
                id: 'powderDesigner.fitPowderChronographStrings',
                message: 'Fit a powder from chronograph strings',
              })}
            </Link>
          </p>
          <div className="prop-grid designer-grid">
            <fieldset className="designer-checks" data-error={fittedError ? true : undefined}>
              <legend>
                {i18n._({
                  id: 'powderDesigner.parametersFitMoved',
                  message: 'Parameters the fit moved',
                })}
              </legend>
              {fittedKeys.map((k) => (
                <Checkbox
                  key={k}
                  label={i18n._(fittedText[k])}
                  checked={design.fitted.includes(k)}
                  onChange={(ev) =>
                    dispatch({ type: 'fitted', key: k, value: ev.currentTarget.checked })
                  }
                />
              ))}
              {fittedError && (
                <Text fz="sm" c="var(--error-text)">
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
      {linkFailure && <ErrorNote>{i18n._(linkFailure)}</ErrorNote>}
      <PropertyGrid
        title={i18n._({ id: 'powderDesigner.parameters', message: 'Parameters' })}
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
        title={/*i18n*/ { id: 'page.powdersDesigner', message: 'Powder designer' }}
        translated
        fold={
          <DesignerToolbar
            undo={history.past.length > 0}
            redo={history.future.length > 0}
            newLabel={i18n._({ id: 'powderDesigner.newPowder', message: 'New powder' })}
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
