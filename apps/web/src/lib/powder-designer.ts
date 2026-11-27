/** The powder designer: the draft, its file data, the powder it builds and the problems it reports. */

import type { I18n, MessageDescriptor } from '@lingui/core'
import {
  fromSi,
  type Powder,
  type QuantityKind,
  toSi,
  type UserPowder,
  type UserPowderFit,
} from '@rangefoundry/schema'
import { linguiOf, loadEnglish } from '../i18n/lingui.ts'
import { untranslated } from '../i18n/number.ts'
import type { Translator } from '../i18n/translate.ts'
import englishMessages from '../locales/en/lib/powder-designer.json' with { type: 'json' }
import {
  type FieldSpec,
  type Fields,
  type FieldValue,
  fieldOf,
  specText,
  switchFields,
} from './field-spec.ts'
import {
  editHistory,
  type History,
  historyOf,
  mapHistory,
  pushHistory,
  redo,
  undo,
} from './history.ts'
import { type Issue, powderOf } from './powder-designs.ts'
import type { Quantity, UnitSystem } from './units.ts'
import { roundedFieldText } from './units.ts'

loadEnglish(englishMessages)

type FittedKey = NonNullable<Powder['interior']>['fitted'][number]

/** How the values of the powder came about: the kind of the provenance the record is built with. */
export type ProvenanceKind = NonNullable<Powder['provenance']>['kind']

/** The choices of the grain form, the propellant base and the provenance kind, from the schema. */
export const grainForms = [
  'ball',
  'extruded',
  'flake',
  'other',
] as const satisfies readonly NonNullable<Powder['grainForm']>[]
export const propellantBases = [
  'single',
  'double',
  'triple',
] as const satisfies readonly NonNullable<Powder['propellantBase']>[]
export const provenanceKinds = [
  'measured',
  'published',
  'derived',
  'fitted',
  'computed',
] as const satisfies readonly ProvenanceKind[]

/** The parameters the fit of the burn law moved, as the record names them. */
export const fittedKeys = ['vivacity', 'energy', 'form.a'] as const satisfies readonly FittedKey[]

/** A numeric field of the draft: where it is in the record, its quantity in the form and its stored kind. */
export interface PowderSpec extends FieldSpec {
  /** The stored quantity of the schema. */
  kind: QuantityKind
  group: 'properties' | 'thermochemistry' | 'burn'
}

const spec = (
  key: string,
  label: MessageDescriptor,
  quantity: Quantity,
  kind: QuantityKind,
  group: PowderSpec['group'],
  help?: MessageDescriptor,
): PowderSpec => ({ key, label, quantity, kind, group, help })

/** A field of the burn law; without a quantity it is a plain number. */
const burn = (
  key: string,
  label: MessageDescriptor,
  help: MessageDescriptor,
  quantity: Quantity = 'ratio',
  kind: QuantityKind = 'dimensionless',
): PowderSpec => spec(key, label, quantity, kind, 'burn', help)

/** The three numbers of a computed range of the thermochemistry, labeled value, min and max. */
const range = (
  name: string,
  labels: readonly [MessageDescriptor, MessageDescriptor, MessageDescriptor],
  quantity: Quantity,
  kind: QuantityKind,
  help: MessageDescriptor,
): PowderSpec[] =>
  (['value', 'min', 'max'] as const).map((part, i) =>
    spec(
      `thermochemistry.${name}.${part}`,
      labels[i] ?? { id: part },
      quantity,
      kind,
      'thermochemistry',
      help,
    ),
  )

/** The fields of a powder record with a number that the designer offers, in stored units. */
export const powderSpecs: readonly PowderSpec[] = [
  spec(
    'bulkDensity.value',
    /*i18n*/ { id: 'powderDesigner.bulkDensity', message: 'Bulk density' },
    'density',
    'density',
    'properties',
    /*i18n*/ {
      id: 'powderDesigner.massPerVolumeLoose',
      message: 'Mass per volume of loose powder, voids included.',
    },
  ),
  spec(
    'thermochemistry.loadingDensity.value',
    /*i18n*/ { id: 'powderDesigner.loadingDensity', message: 'Loading density' },
    'density',
    'density',
    'thermochemistry',
    /*i18n*/ {
      id: 'powderDesigner.loadingDensityConstantVolume',
      message: 'Loading density of the constant-volume burn the values below apply to.',
    },
  ),
  ...range(
    'flameTemperature',
    [
      /*i18n*/ { id: 'powderDesigner.flameTemperatureValue', message: 'Flame temperature value' },
      /*i18n*/ { id: 'powderDesigner.flameTemperatureMin', message: 'Flame temperature min' },
      /*i18n*/ { id: 'powderDesigner.flameTemperatureMax', message: 'Flame temperature max' },
    ],
    'temperature',
    'absoluteTemperature',
    /*i18n*/ {
      id: 'powderDesigner.constantVolumeMinMax',
      message: 'At constant volume; min and max over the composition ranges.',
    },
  ),
  ...range(
    'impetus',
    [
      /*i18n*/ { id: 'powderDesigner.impetusValue', message: 'Impetus value' },
      /*i18n*/ { id: 'powderDesigner.impetusMin', message: 'Impetus min' },
      /*i18n*/ { id: 'powderDesigner.impetusMax', message: 'Impetus max' },
    ],
    'specificEnergy',
    'specificEnergy',
    /*i18n*/ {
      id: 'powderDesigner.impetusBurningExtremes',
      message: 'Impetus of the burning, with its extremes.',
    },
  ),
  ...range(
    'gamma',
    [
      /*i18n*/ { id: 'powderDesigner.gammaValue', message: 'Gamma value' },
      /*i18n*/ { id: 'powderDesigner.gammaMin', message: 'Gamma min' },
      /*i18n*/ { id: 'powderDesigner.gammaMax', message: 'Gamma max' },
    ],
    'ratio',
    'dimensionless',
    /*i18n*/ {
      id: 'powderDesigner.frozenRatioSpecificHeats',
      message: 'Frozen ratio of specific heats at the flame temperature.',
    },
  ),
  ...range(
    'molarMass',
    [
      /*i18n*/ { id: 'powderDesigner.molarMassValue', message: 'Molar mass value' },
      /*i18n*/ { id: 'powderDesigner.molarMassMin', message: 'Molar mass min' },
      /*i18n*/ { id: 'powderDesigner.molarMassMax', message: 'Molar mass max' },
    ],
    'molarMass',
    'molarMass',
    /*i18n*/ {
      id: 'powderDesigner.meanMolarMassCombustion',
      message: 'Mean molar mass of the combustion gas.',
    },
  ),
  ...range(
    'covolume',
    [
      /*i18n*/ { id: 'powderDesigner.covolumeValue', message: 'Covolume value' },
      /*i18n*/ { id: 'powderDesigner.covolumeMin', message: 'Covolume min' },
      /*i18n*/ { id: 'powderDesigner.covolumeMax', message: 'Covolume max' },
    ],
    'covolume',
    'specificVolume',
    /*i18n*/ {
      id: 'powderDesigner.covolumeCombustionGasExtremes',
      message: 'Covolume of the combustion gas, with its extremes.',
    },
  ),
  {
    ...burn(
      'interior.vivacity.value',
      /*i18n*/ { id: 'powderDesigner.vivacity', message: 'Vivacity' },
      /*i18n*/ {
        id: 'powderDesigner.burnRateScaleVivacity',
        message: 'Burn rate scale of the vivacity law at the reference pressure.',
      },
      'vivacity',
      'burnRate',
    ),
    positive: true,
  },
  burn(
    'interior.energy.value',
    /*i18n*/ { id: 'powderDesigner.specificEnergy', message: 'Specific energy' },
    /*i18n*/ { id: 'powderDesigner.constantVolume', message: 'At constant volume.' },
    'specificEnergy',
    'specificEnergy',
  ),
  burn(
    'interior.gamma',
    /*i18n*/ { id: 'powderDesigner.gamma', message: 'Gamma' },
    /*i18n*/ {
      id: 'powderDesigner.ratioSpecificHeatsGas',
      message: 'Ratio of specific heats of the gas; above 1.',
    },
  ),
  burn(
    'interior.covolume.value',
    /*i18n*/ { id: 'powderDesigner.covolume', message: 'Covolume' },
    /*i18n*/ { id: 'powderDesigner.covolumeGas', message: 'Covolume of the gas.' },
    'covolume',
    'specificVolume',
  ),
  burn(
    'interior.density.value',
    /*i18n*/ { id: 'powderDesigner.grainDensity', message: 'Grain density' },
    /*i18n*/ { id: 'powderDesigner.solidDensityGrains', message: 'Solid density of the grains.' },
    'density',
    'density',
  ),
  burn(
    'interior.pressureExponent',
    /*i18n*/ { id: 'powderDesigner.pressureExponent', message: 'Pressure exponent' },
    /*i18n*/ {
      id: 'powderDesigner.exponentPressureBurnLaw',
      message: 'Exponent of the pressure in the burn law.',
    },
  ),
  burn(
    'interior.referencePressure.value',
    /*i18n*/ { id: 'powderDesigner.referencePressure', message: 'Reference pressure' },
    /*i18n*/ {
      id: 'powderDesigner.pressureWhichVivacityHolds',
      message: 'Pressure at which the vivacity holds.',
    },
    'pressure',
    'pressure',
  ),
  burn(
    'interior.ignitionPressure.value',
    /*i18n*/ { id: 'powderDesigner.ignitionPressure', message: 'Ignition pressure' },
    /*i18n*/ {
      id: 'powderDesigner.pressureWhichGrainsStart',
      message: 'Pressure at which the grains start to burn.',
    },
    'pressure',
    'pressure',
  ),
  burn(
    'interior.startPressure.value',
    /*i18n*/ { id: 'powderDesigner.startPressure', message: 'Start pressure' },
    /*i18n*/ {
      id: 'powderDesigner.pressureWhichBulletStarts',
      message: 'Pressure at which the bullet starts to move. Empty: solver default.',
    },
    'pressure',
    'pressure',
  ),
  burn(
    'interior.propellantTemperature.value',
    /*i18n*/ { id: 'powderDesigner.propellantTemperature', message: 'Propellant temperature' },
    /*i18n*/ {
      id: 'powderDesigner.temperatureParametersWereFitted',
      message: 'Temperature the parameters were fitted at.',
    },
    'temperature',
    'temperature',
  ),
  burn(
    'interior.burnForm.a.value',
    /*i18n*/ { id: 'powderDesigner.formA', message: 'Form a' },
    /*i18n*/ {
      id: 'powderDesigner.formParameterATwo',
      message: 'Form parameter a of the two-stage burn form.',
    },
  ),
  burn(
    'interior.burnForm.m',
    /*i18n*/ { id: 'powderDesigner.formM', message: 'Form m' },
    /*i18n*/ {
      id: 'powderDesigner.formParameterMTwo',
      message: 'Form parameter m of the two-stage burn form.',
    },
  ),
  burn(
    'interior.burnForm.q',
    /*i18n*/ { id: 'powderDesigner.formQ', message: 'Form q' },
    /*i18n*/ {
      id: 'powderDesigner.formParameterQTwo',
      message: 'Form parameter q of the two-stage burn form; not negative.',
    },
  ),
  burn(
    'interior.burnForm.z1',
    /*i18n*/ { id: 'powderDesigner.formZ1', message: 'Form z1' },
    /*i18n*/ {
      id: 'powderDesigner.burntFractionWhichFirst',
      message: 'Burnt fraction at which the first stage ends; above 0, at most 1.',
    },
  ),
]

const specByKey = new Map(powderSpecs.map((s) => [s.key, s]))

/** The spec of the field `key`: a listed number, or the mass percent of an ingredient (`comp.<id>.min|max`). */
export function specOf(key: string): PowderSpec {
  const own = specByKey.get(key)
  if (own) return own
  const label = key.endsWith('.max')
    ? /*i18n*/ { id: 'powderDesigner.massPercentMax', message: 'Mass percent max' }
    : /*i18n*/ { id: 'powderDesigner.massPercentMin', message: 'Mass percent min' }
  return spec(key, label, 'percent', 'massFraction', 'properties')
}

/** An ingredient row; its numbers are `comp.<id>.min` and `comp.<id>.max`. */
interface Ingredient {
  id: string
  name: string
  cas: string
}

/** The draft: texts and choices as entered, numbers as fields. */
export interface Design {
  name: string
  provenanceKind: ProvenanceKind | ''
  grainForm: NonNullable<Powder['grainForm']> | ''
  propellantBase: NonNullable<Powder['propellantBase']> | ''
  /** One alias per line. */
  aliases: string
  note: string
  fitted: FittedKey[]
  rows: Ingredient[]
  fields: Fields
  /** The burn-law fields of an opened record that the designer has no input for, kept as they were. */
  unoffered: Tree
  /** The temperature sensitivity of an opened record, which the designer has no input for, kept as it was. */
  temperatureSensitivity?: Tree | undefined
  /** The fit of an opened record saved from a fit, with the SI values of its fitted fields then. */
  fit?: { block: UserPowderFit; values: Record<string, number | undefined> } | undefined
}

/** The fields that hold the values a fit frees, by its parameter name. */
const fitFields = { burnRate: 'interior.vivacity.value', energy: 'interior.energy.value' } as const

/** The fit of the opened record while no value it fitted was edited; an edited one drops it. */
const keptFit = (d: Design) =>
  d.fit && Object.values(fitFields).every((k) => fieldAt(d, k).si === d.fit?.values[k])
    ? d.fit.block
    : undefined

let counter = 0
/** A row id, unique in this page: the actions that add a row carry one, so the reducer stays pure. */
export const rowId = () => `i${++counter}`

const blank: FieldValue = { text: '', si: undefined }
/** The value of the field `key`, empty where it was never typed. */
export const fieldAt = (d: Design, key: string): FieldValue => d.fields[key] ?? blank

/** The empty draft. */
export const newDesign = (): Design => ({
  name: '',
  provenanceKind: '',
  grainForm: '',
  propellantBase: '',
  aliases: '',
  note: '',
  fitted: [],
  rows: [{ id: rowId(), name: '', cas: '' }],
  fields: {},
  unoffered: {},
})

const rowKeys = (id: string) => [`comp.${id}.min`, `comp.${id}.max`]
const blankRow = (d: Design, r: Ingredient) =>
  r.name.trim() === '' &&
  r.cas.trim() === '' &&
  rowKeys(r.id).every((k) => fieldAt(d, k).text.trim() === '')
/** The ingredient rows with something entered: the others are not part of the record. */
const liveRows = (d: Design) => d.rows.filter((r) => !blankRow(d, r))

/** The number `si` in the stored unit of `s`, without the noise of the unit conversion. */
const storedOf = (s: PowderSpec, si: number) => Number(fromSi(s.kind, si).toPrecision(12))

type Tree = Record<string, unknown>

function setPath(tree: Tree, path: string[], value: unknown) {
  const [head, ...rest] = path
  if (head === undefined) return
  if (rest.length === 0) tree[head] = value
  else {
    const next = (tree[head] ?? {}) as Tree
    tree[head] = next
    setPath(next, rest, value)
  }
}

function getPath(tree: unknown, path: string[]): unknown {
  let at = tree
  for (const k of path) {
    if (typeof at !== 'object' || at === null) return undefined
    at = (at as Tree)[k]
  }
  return at
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

/** None while nothing of it is entered. */
function interiorOf(entered: Tree | undefined, fitted: readonly FittedKey[]): Tree | undefined {
  if (entered === undefined && fitted.length === 0) return undefined
  const burnForm = entered?.burnForm as Tree | undefined
  return {
    ...entered,
    model: 'm3',
    ...(burnForm && { burnForm: { ...burnForm, kind: 'twoStage' } }),
    ...(fitted.length > 0 && { fitted: [...fitted] }),
  }
}

/** The record data of a design: what is entered, each number in its stored unit. */
export function fileData(d: Design): UserPowder {
  const draft: Tree = {}
  for (const s of powderSpecs) {
    const si = fieldAt(d, s.key).si
    if (si !== undefined) setPath(draft, s.key.split('.'), storedOf(s, si))
  }
  if (d.grainForm) draft.grainForm = d.grainForm
  if (d.propellantBase) draft.propellantBase = d.propellantBase
  const aliases = lines(d.aliases)
  if (aliases.length > 0) draft.aliases = aliases
  if (d.note.trim()) draft.note = d.note.trim()
  const rows = liveRows(d).map((r) => {
    const [min, max] = rowKeys(r.id).map((k) => {
      const si = fieldAt(d, k).si
      return si === undefined ? undefined : storedOf(specOf(k), si)
    })
    return {
      ...(r.name.trim() && { name: r.name.trim() }),
      ...(r.cas.trim() && { cas: r.cas.trim() }),
      ...(min !== undefined && { min }),
      ...(max !== undefined && { max }),
    }
  })
  if (rows.length > 0) draft.composition = rows
  const interior = interiorOf(draft.interior as Tree | undefined, d.fitted)
  if (interior) draft.interior = { ...interior, ...d.unoffered }
  if (d.temperatureSensitivity) draft.temperatureSensitivity = d.temperatureSensitivity
  const fit = keptFit(d)
  return {
    origin: 'user',
    ...(d.provenanceKind && { provenanceKind: d.provenanceKind }),
    ...(Object.keys(draft).length > 0 && { draft: draft as NonNullable<UserPowder['draft']> }),
    ...(fit && { fit }),
  }
}

const unofferedKeys = ['resistance', 'trainingRows', 'trainingCartridges'] as const

const unofferedOf = (interior: Tree | undefined): Tree =>
  Object.fromEntries(
    unofferedKeys.flatMap((k) => (interior?.[k] === undefined ? [] : [[k, interior[k]]])),
  )

/** The draft's text fields as the form shows them, empty where the draft has none. */
function draftTexts(
  data: UserPowder,
): Pick<Design, 'provenanceKind' | 'grainForm' | 'propellantBase' | 'aliases' | 'note' | 'fitted'> {
  const draft = data.draft
  return {
    provenanceKind: data.provenanceKind ?? '',
    grainForm: draft?.grainForm ?? '',
    propellantBase: draft?.propellantBase ?? '',
    aliases: (draft?.aliases ?? []).join('\n'),
    note: draft?.note ?? '',
    fitted: [...(draft?.interior?.fitted ?? [])],
  }
}

/** The draft of record data `data` named `name`, its numbers shown in `system`. */
export function fromFile(data: UserPowder, name: string, system: UnitSystem): Design {
  const fields: Fields = {}
  const put = (s: PowderSpec, stored: unknown) => {
    if (typeof stored === 'number') fields[s.key] = fieldOf(system, s, toSi(s.kind, stored))
  }
  for (const s of powderSpecs) put(s, getPath(data.draft, s.key.split('.')))
  const draft = data.draft
  const rows = (draft?.composition ?? []).map((c) => {
    const id = rowId()
    put(specOf(`comp.${id}.min`), c.min)
    put(specOf(`comp.${id}.max`), c.max)
    return { id, name: c.name ?? '', cas: c.cas ?? '' }
  })
  return {
    name,
    ...draftTexts(data),
    rows: rows.length > 0 ? rows : [{ id: rowId(), name: '', cas: '' }],
    fields,
    unoffered: unofferedOf(draft?.interior as Tree | undefined),
    ...(draft?.temperatureSensitivity && {
      temperatureSensitivity: draft.temperatureSensitivity as Tree,
    }),
    ...(data.fit && {
      fit: {
        block: data.fit,
        values: Object.fromEntries(Object.values(fitFields).map((k) => [k, fields[k]?.si])),
      },
    }),
  }
}

/** A reason the draft is no powder: the field it belongs to, else it is about the record as a whole. */
export interface Problem {
  key?: string | undefined
  /** A sentence that names its field, so the list of problems reads without the form. */
  message: string
}

/** The message of a missing value in the powder schema. */
const required = /received undefined/

/** The sentences the problems share. */
const texts = {
  enter: /*i18n*/ { id: 'powderDesigner.enterLabel', message: 'Enter {label}.' },
  enterNumber: /*i18n*/ {
    id: 'powderDesigner.enterNumberFor',
    message: 'Enter a number for {label}.',
  },
  addIngredient: /*i18n*/ {
    id: 'powderDesigner.addOneIngredient',
    message: 'Add at least one ingredient.',
  },
  setFitted: /*i18n*/ {
    id: 'powderDesigner.setFittedData',
    message: 'Set Values came about by to Fitted to data.',
  },
  tickFitted: /*i18n*/ {
    id: 'powderDesigner.tickFittedParameter',
    message: 'Tick at least one fitted parameter.',
  },
  aboveZero: /*i18n*/ {
    id: 'powderDesigner.greaterThanZero',
    message: '{label} must be greater than 0{unit}.',
  },
  minPercent: /*i18n*/ {
    id: 'powderDesigner.ingredientMinPercent',
    message: 'Ingredient {n, decimal} min percent',
  },
  maxPercent: /*i18n*/ {
    id: 'powderDesigner.ingredientMaxPercent',
    message: 'Ingredient {n, decimal} max percent',
  },
} satisfies Record<string, MessageDescriptor>

/** The texts of the schema's own rules (`packages/schema/src/powder.ts`), in plain words. */
const ruleTexts: Record<string, MessageDescriptor> = {
  'needs min <= value <= max': /*i18n*/ {
    id: 'powderDesigner.betweenMinMax',
    message: '{label} must lie between Min and Max.',
  },
  'needs min <= max': /*i18n*/ {
    id: 'powderDesigner.minNotAboveMax',
    message: '{label}: Min must not be above Max.',
  },
  'needs 1 + a z1 > 0, and q < 1 when z1 < 1': /*i18n*/ {
    id: 'powderDesigner.burnFormRule',
    message: 'Burn form: 1 + a × z1 must be above 0, and Form q below 1 where Form z1 is below 1.',
  },
  'the ranges admit no composition summing to 100 %': /*i18n*/ {
    id: 'powderDesigner.compositionSumRule',
    message:
      'Composition: the Min percentages must add up to 100 or less, and the Max percentages to 100 or more.',
  },
  'needs a composition': texts.addIngredient,
  'needs a fitted source': texts.setFitted,
  'needs a source with fields country': /*i18n*/ {
    id: 'powderDesigner.sourceCountry',
    message: 'Add a source that gives the country.',
  },
  'needs a source with fields listedCartridges': /*i18n*/ {
    id: 'powderDesigner.sourceCartridges',
    message: 'Add a source that gives the cartridges the powder is listed for.',
  },
}

/** The name of the place of an issue at `path`, in the words of the form. */
function labelOf(d: Design, path: PropertyKey[], t: Translator['t'], i18n: I18n): string {
  const [head, index, part] = path
  const row = typeof index === 'number' ? liveRows(d)[index] : undefined
  if (head === 'composition' && row) {
    // numbered as the form numbers its rows, blank ones included
    const values = { n: d.rows.indexOf(row) + 1 }
    if (part === 'name')
      return i18n._({
        id: 'powderDesigner.ingredientName',
        message: 'Ingredient {n, decimal} name',
        values,
      })
    if (part === 'cas')
      return i18n._({
        id: 'powderDesigner.ingredientCasNumber',
        message: 'Ingredient {n, decimal} CAS number',
        values,
      })
    if (part === 'min') return i18n._({ ...texts.minPercent, values })
    if (part === 'max') return i18n._({ ...texts.maxPercent, values })
    return i18n._({
      id: 'powderDesigner.ingredientNumber',
      message: 'Ingredient {n, decimal}',
      values,
    })
  }
  const key = path.join('.')
  const spec = specByKey.get(key) ?? specByKey.get(`${key}.value`)
  if (spec) return specText(t, spec.label, i18n)
  const section = typeof head === 'string' ? sectionLabels[head] : undefined
  return section ? i18n._(section) : key
}

/** An issue without its own sentence names its field only: zod's English stays out of the interface. */
export function issueText(issue: Issue, label: string, i18n: I18n = linguiOf('en')): string {
  const values = { label }
  const rule = ruleTexts[issue.message]
  if (rule) return i18n._({ ...rule, values })
  if (required.test(issue.message))
    return i18n._({ ...(issue.expected === 'string' ? texts.enter : texts.enterNumber), values })
  if (issue.code === 'too_small' && issue.origin === 'string')
    return i18n._({ ...texts.enter, values })
  if (issue.origin === 'number') {
    const bounded = boundText(issue, label, i18n)
    if (bounded) return bounded
  }
  if (issue.code === 'invalid_format')
    return i18n._({
      id: 'powderDesigner.casDigits',
      message: '{label}: write the CAS number as digits and hyphens, as 9004-70-0.',
      values,
    })
  if (issue.code === 'too_small' && issue.origin === 'array')
    return issue.path[0] === 'composition'
      ? i18n._(texts.addIngredient)
      : i18n._({
          id: 'powderDesigner.addOneEntry',
          message: '{label}: add at least one entry.',
          values,
        })
  console.debug('powder designer: unmapped schema issue', issue)
  return i18n._({
    id: 'powderDesigner.notAccepted',
    message: '{label}: not accepted by the powder record.',
    values,
  })
}

/** A number below or above a bound of the schema, with the bound; undefined for another issue. */
function boundText(issue: Issue, label: string, i18n: I18n): string | undefined {
  if (issue.code === 'too_small') {
    const min = Number(issue.minimum)
    if (issue.inclusive)
      return i18n._({
        id: 'powderDesigner.atLeast',
        message: '{label} must be at least {min, decimal}{unit}.',
        values: { label, min, unit: '' },
      })
    return min === 0
      ? i18n._({ ...texts.aboveZero, values: { label, unit: '' } })
      : i18n._({
          id: 'powderDesigner.above',
          message: '{label} must be above {min, decimal}.',
          values: { label, min },
        })
  }
  if (issue.code === 'too_big') {
    const max = Number(issue.maximum)
    return issue.inclusive
      ? i18n._({
          id: 'powderDesigner.atMost',
          message: '{label} must be at most {max, decimal}{unit}.',
          values: { label, max, unit: '' },
        })
      : i18n._({
          id: 'powderDesigner.below',
          message: '{label} must be below {max, decimal}.',
          values: { label, max },
        })
  }
}

const sectionLabels: Record<string, MessageDescriptor> = {
  composition: /*i18n*/ { id: 'powderDesigner.composition', message: 'Composition' },
  thermochemistry: /*i18n*/ { id: 'powderDesigner.thermochemistry', message: 'Thermochemistry' },
  interior: /*i18n*/ { id: 'powderDesigner.burnLaw', message: 'Burn law' },
  aliases: /*i18n*/ { id: 'powderDesigner.aliases', message: 'Aliases' },
  bulkDensity: /*i18n*/ { id: 'powderDesigner.bulkDensity', message: 'Bulk density' },
  country: /*i18n*/ { id: 'powderDesigner.country', message: 'Country' },
  listedCartridges: /*i18n*/ { id: 'powderDesigner.cartridges', message: 'Cartridges' },
}

/** All at once, because the schema checks cross-part rules only once every part passes; the rules stay the schema's. */
function draftProblems(d: Design, data: UserPowder, i18n: I18n): Problem[] {
  const draft = data.draft
  const problems: Problem[] = []
  if (draft?.interior) {
    if (d.fitted.length === 0) problems.push({ key: 'fitted', message: i18n._(texts.tickFitted) })
    if (d.provenanceKind !== 'fitted')
      problems.push({ key: 'provenanceKind', message: i18n._(texts.setFitted) })
  }
  if (draft?.thermochemistry && !draft.composition)
    problems.push({ message: i18n._(texts.addIngredient) })
  const vivacity = fieldAt(d, 'interior.vivacity.value').si
  if (vivacity !== undefined && vivacity <= 0)
    problems.push({
      key: 'interior.vivacity.value',
      message: i18n._({
        ...texts.aboveZero,
        values: {
          label: i18n._({ id: 'powderDesigner.vivacity', message: 'Vivacity' }),
          unit: '',
        },
      }),
    })
  return problems
}

/** A value the record needs is reported at each empty field below its place. */
function problemsOf(d: Design, issues: Issue[], t: Translator['t'], i18n: I18n): Problem[] {
  const live = liveRows(d)
  return issues.flatMap((issue): Problem[] => {
    const key = keyOf(live, issue.path)
    if (key === 'provenanceKind')
      return [
        {
          key,
          message:
            issue.path[0] === 'interior'
              ? i18n._(texts.setFitted)
              : i18n._({
                  id: 'powderDesigner.chooseValuesCameAbout',
                  message: 'Choose an entry for Values came about by.',
                }),
        },
      ]
    if (key === 'fitted') return [{ key, message: i18n._(texts.tickFitted) }]
    if (key) return [{ key, message: issueText(issue, labelOf(d, issue.path, t, i18n), i18n) }]
    if (issue.message === 'needs a composition') return [{ message: i18n._(texts.addIngredient) }]
    const prefix = `${issue.path.join('.')}.`
    // an empty Min or Max of a thermochemistry range is built as its value: only the value is asked for
    const empty = powderSpecs.filter(
      (s) =>
        s.key.startsWith(prefix) &&
        !/^thermochemistry\..+\.(min|max)$/.test(s.key) &&
        fieldAt(d, s.key).text.trim() === '',
    )
    if (required.test(issue.message) && empty.length > 0)
      return empty.map((s) => ({
        key: s.key,
        message: i18n._({ ...texts.enterNumber, values: { label: specText(t, s.label, i18n) } }),
      }))
    return [{ message: issueText(issue, labelOf(d, issue.path, t, i18n), i18n) }]
  })
}

/** The key of the field an issue at `path` belongs to; undefined for an issue about the record or a section. */
function keyOf(live: readonly Ingredient[], path: PropertyKey[]): string | undefined {
  const [head, index, part] = path
  // a rule across the two percentages of an ingredient is shown at its minimum
  if (head === 'composition') {
    const row = typeof index === 'number' ? live[index] : undefined
    return row && `comp.${row.id}.${part === 'max' ? 'max' : 'min'}`
  }
  // the burn law needs a fitted source, which the provenance kind gives
  if (head === 'provenance' || (head === 'interior' && path.length === 1)) return 'provenanceKind'
  if (head === 'interior' && index === 'fitted') return 'fitted'
  const key = path.join('.')
  // a range that needs min <= value <= max is reported at its value
  return specByKey.has(key) ? key : specByKey.has(`${key}.value`) ? `${key}.value` : undefined
}

/** The powder the draft builds as the tools use it, or the problems with the draft in the language of `t`. */
export function checkDesign(
  d: Design,
  id: string,
  t: Translator['t'] = untranslated(),
  i18n: I18n = linguiOf('en'),
): { powder: Powder } | { problems: Problem[] } {
  const data = fileData(d)
  const built = powderOf(data, d.name, id)
  // a typed text that reads as no number is left out of the record, so the record is not done
  const labelled = (key: string) => {
    const [, row, part] = key.split('.')
    if (!key.startsWith('comp.')) return specText(t, specOf(key).label, i18n)
    const values = { n: d.rows.findIndex((r) => r.id === row) + 1 }
    return i18n._({ ...(part === 'max' ? texts.maxPercent : texts.minPercent), values })
  }
  const unread = Object.entries(d.fields)
    .filter(([, v]) => v.text.trim() !== '' && v.si === undefined)
    .map(([key]) => ({
      key,
      message: i18n._({ ...texts.enterNumber, values: { label: labelled(key) } }),
    }))
  const own = [...unread, ...draftProblems(d, data, i18n)]
  if ('powder' in built) return own.length > 0 ? { problems: own } : built
  // a rule the draft's own check reports already is not said twice
  const said = new Set(own.map((p) => `${p.key ?? ''} ${p.message}`))
  const schema = problemsOf(d, built.issues, t, i18n).filter(
    (p) => !said.has(`${p.key ?? ''} ${p.message}`),
  )
  return { problems: [...own, ...schema] }
}

export type Action =
  | { type: 'field'; key: string; value: FieldValue }
  | { type: 'name'; value: string }
  | { type: 'text'; key: 'aliases' | 'note'; value: string }
  | { type: 'provenanceKind'; value: ProvenanceKind | '' }
  | { type: 'grainForm'; value: Design['grainForm'] }
  | { type: 'propellantBase'; value: Design['propellantBase'] }
  | { type: 'fitted'; key: FittedKey; value: boolean }
  | { type: 'ingredient'; id: string; part: 'name' | 'cas'; value: string }
  | { type: 'addRow'; id: string }
  | { type: 'removeRow'; id: string }
  | { type: 'start'; design: Design }
  | { type: 'new' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'units'; system: UnitSystem }

/** The history after `a`: a run of edits to one field is one undo step. */
export function reduce(h: History<Design>, a: Action): History<Design> {
  const d = h.present
  switch (a.type) {
    case 'field':
      return editHistory(h, { ...d, fields: { ...d.fields, [a.key]: a.value } }, a.key)
    case 'name':
      return editHistory(h, { ...d, name: a.value }, 'name')
    case 'text':
      return editHistory(h, { ...d, [a.key]: a.value }, a.key)
    case 'provenanceKind':
      return pushHistory(h, { ...d, provenanceKind: a.value }, 'provenanceKind')
    case 'grainForm':
      return pushHistory(h, { ...d, grainForm: a.value }, 'grainForm')
    case 'propellantBase':
      return pushHistory(h, { ...d, propellantBase: a.value }, 'propellantBase')
    case 'fitted':
      return pushHistory(
        h,
        {
          ...d,
          fitted: a.value
            ? fittedKeys.filter((k) => k === a.key || d.fitted.includes(k))
            : d.fitted.filter((k) => k !== a.key),
        },
        `fitted.${a.key}`,
      )
    case 'ingredient':
      return editHistory(
        h,
        { ...d, rows: d.rows.map((r) => (r.id === a.id ? { ...r, [a.part]: a.value } : r)) },
        `comp.${a.id}.${a.part}`,
      )
    case 'addRow':
      return pushHistory(h, { ...d, rows: [...d.rows, { id: a.id, name: '', cas: '' }] })
    case 'removeRow': {
      const gone = rowKeys(a.id)
      return pushHistory(h, {
        ...d,
        rows: d.rows.filter((r) => r.id !== a.id),
        fields: Object.fromEntries(Object.entries(d.fields).filter(([k]) => !gone.includes(k))),
      })
    }
    case 'start':
      return historyOf(a.design)
    case 'new':
      return historyOf(newDesign())
    case 'undo':
      return undo(h)
    case 'redo':
      return redo(h)
    case 'units':
      return mapHistory(h, (x) => ({
        ...x,
        fields: switchFields(
          x.fields,
          Object.keys(x.fields).map(specOf),
          a.system,
          roundedFieldText,
        ),
      }))
  }
}
