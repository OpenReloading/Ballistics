/** The record kinds the Import entry reads from a table and the fields each one maps. */
import type { QuantityKind } from '@open-reloading/schema'
import { fromSi } from '@open-reloading/schema'
import { type Unit, unitsOf } from '../units.ts'

export type TableKind = 'bullet' | 'powder' | 'cartridge'

export const tableKinds: readonly TableKind[] = ['bullet', 'powder', 'cartridge']

export const kindNames: Record<TableKind, string> = {
  bullet: 'bullets',
  powder: 'powders',
  cartridge: 'cartridges',
}

/** A unit a column can be in: its symbol and the conversion into the stored unit of the field. */
export interface ColumnUnit {
  id: string
  symbol: string
  toStored: (x: number) => number
}

const converted = (kind: QuantityKind, unit: Unit): ColumnUnit => ({
  id: unit.symbol,
  symbol: unit.symbol,
  toStored: (x) => fromSi(kind, unit.toSi(x)),
})

const lengthUnits = [
  converted('length', unitsOf.length.mm),
  converted('length', unitsOf.length.in),
  converted('length', unitsOf.lineOfSightOffset.cm),
]
const massUnits = [converted('mass', unitsOf.mass.g), converted('mass', unitsOf.mass.gr)]
const coefficientUnits = [
  converted('ballisticCoefficient', unitsOf.ballisticCoefficient['lb/in2']),
  converted('ballisticCoefficient', unitsOf.sectionalDensity['kg/m2']),
]
const densityUnits = [converted('density', unitsOf.density['g/cm3'])]
const pressureUnits = [
  converted('pressure', unitsOf.pressure.bar),
  converted('pressure', unitsOf.pressure.psi),
]

/** One mappable field of a kind. `range` is the usual span in the stored unit: outside it is a warning. */
export interface FieldSpec {
  key: string
  label: string
  /** Words a header may use, lower case without accents. */
  aliases: string[]
  /** Share of the kind score: the core fields of a kind add up to 1, the others are a bonus on top. */
  weight: number
  required?: boolean
  /** A number field: its units (the first is stored) and usual range; a text field has none. */
  units?: ColumnUnit[]
  range?: [number, number]
  /** The span most values fall in, in the stored unit: it tells a unit apart when several fit the range. */
  typical?: [number, number]
  /** An enumerated text field: spelling to stored value. */
  choices?: Record<string, string>
}

const name: FieldSpec = {
  key: 'name',
  label: 'Name',
  aliases: [
    'name',
    'bullet',
    'powder',
    'cartridge',
    'description',
    'product',
    'item',
    'bezeichnung',
  ],
  weight: 0.2,
  required: true,
}
const maker: FieldSpec = {
  key: 'maker',
  label: 'Maker',
  aliases: ['maker', 'manufacturer', 'brand', 'make', 'hersteller'],
  weight: 0.05,
}

export const fieldSpecs: Record<TableKind, FieldSpec[]> = {
  bullet: [
    name,
    maker,
    {
      key: 'caliber',
      label: 'Caliber',
      aliases: ['caliber', 'calibre', 'cal', 'kaliber'],
      weight: 0.05,
    },
    {
      key: 'diameter',
      label: 'Diameter',
      aliases: ['diameter', 'dia', 'durchmesser'],
      weight: 0.4,
      required: true,
      units: lengthUnits,
      range: [3, 25],
      typical: [4, 12],
    },
    {
      key: 'mass',
      label: 'Mass',
      aliases: ['mass', 'weight', 'wt', 'grains', 'gr', 'gewicht', 'masse'],
      weight: 0.4,
      required: true,
      units: massUnits,
      range: [0.5, 60],
      typical: [1, 30],
    },
    {
      key: 'length',
      label: 'Length',
      aliases: ['length', 'len', 'oal', 'laenge'],
      weight: 0.05,
      units: lengthUnits,
      range: [5, 80],
    },
    {
      key: 'bcG1',
      label: 'BC G1',
      aliases: ['g1', 'bcg1', 'bc1'],
      weight: 0.05,
      units: coefficientUnits,
      range: [0.05, 1.5],
    },
    {
      key: 'bcG7',
      label: 'BC G7',
      aliases: ['g7', 'bcg7', 'bc7'],
      weight: 0.05,
      units: coefficientUnits,
      range: [0.05, 1.5],
    },
  ],
  powder: [
    name,
    maker,
    {
      key: 'grainForm',
      label: 'Grain form',
      aliases: ['grainform', 'form', 'shape', 'grain', 'kornform'],
      weight: 0.3,
      choices: {
        ball: 'ball',
        spherical: 'ball',
        extruded: 'extruded',
        stick: 'extruded',
        tubular: 'extruded',
        flake: 'flake',
        flattened: 'flake',
        other: 'other',
      },
    },
    {
      key: 'propellantBase',
      label: 'Propellant base',
      aliases: ['base', 'propellantbase', 'basis'],
      weight: 0.25,
      choices: {
        single: 'single',
        'single-base': 'single',
        double: 'double',
        'double-base': 'double',
        triple: 'triple',
        'triple-base': 'triple',
      },
    },
    {
      key: 'bulkDensity',
      label: 'Bulk density',
      aliases: ['bulkdensity', 'density', 'bulk', 'schuettdichte'],
      weight: 0.25,
      units: densityUnits,
      range: [0.3, 1.3],
    },
  ],
  cartridge: [
    name,
    {
      key: 'caseLength',
      label: 'Case length',
      aliases: ['caselength', 'l3', 'case', 'huelsenlaenge'],
      weight: 0.3,
      units: lengthUnits,
      range: [10, 120],
      typical: [15, 90],
    },
    {
      key: 'overallLength',
      label: 'Overall length',
      aliases: ['overalllength', 'coal', 'oal', 'l6', 'cartridgelength'],
      weight: 0.1,
      units: lengthUnits,
      range: [15, 150],
      typical: [25, 120],
    },
    {
      key: 'bulletDiameter',
      label: 'Bullet diameter',
      aliases: ['bulletdiameter', 'g1', 'diameter', 'dia'],
      weight: 0.25,
      units: lengthUnits,
      range: [3, 25],
      typical: [4, 12],
    },
    {
      key: 'maxPressure',
      label: 'Max pressure',
      aliases: ['maxpressure', 'pmax', 'pressure', 'maxpress'],
      weight: 0.25,
      units: pressureUnits,
      range: [300, 6500],
    },
  ],
}

/** The field of `kind` called `key`. */
export const fieldOf = (kind: TableKind, key: string) => fieldSpecs[kind].find((f) => f.key === key)
