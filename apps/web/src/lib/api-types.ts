/** The fields of API responses the pages read (`packages/api/src/db/`, `packages/api/src/compute/`, `packages/api/src/routes/`). */
import type { InteriorResult } from '@openreloading/core'
import type { QuantityValue } from '@openreloading/schema'

/** A source of a record or of some of its fields. */
export interface Source {
  title: string
  publisher?: string
  edition?: string
  page?: string
  url?: string
  retrieved?: string
  sha256?: string
  license?: string
  terms?: string
  note?: string
  /** Who published it: `manufacturer`, `public` or `community`. */
  origin?: string
  /** Overrides the record's provenance kind, as `fitted`. */
  kind?: string
  /** Record paths this source covers; none for the whole record. */
  fields?: string[]
}

export interface Provenance {
  kind: string
  sources: Source[]
  note?: string
}

/** The case head derived from the cartridge R1, P1 and R3 (`caseType` of the API). */
export const caseTypes = ['rimless', 'semi-rimmed', 'rimmed', 'rebated', 'belted'] as const
type CaseType = (typeof caseTypes)[number]

export interface CartridgeSummary {
  id: string
  name: string
  aliases: string[]
  /** C.I.P. table of the cartridge's sheet. */
  table: string
  /** Cartridge-side G1 of the C.I.P. sheet, mm. */
  maxBulletDiameter?: number
  /** Chamber-side F (land diameter) of the sheet, mm. */
  boreDiameter?: number
  /** Chamber-side Z (groove diameter) of the sheet, mm. */
  grooveDiameter?: number
  /** Cartridge-side L3 of the sheet, mm. */
  caseLength?: number
  /** Cartridge-side L6 (maximum cartridge length) of the sheet, mm. */
  cartridgeLength?: number
  /** Highest Pmax of the sheet, bar. */
  pmax?: number
  /** The case head from the cartridge R1, P1 and R3. */
  caseType?: CaseType
  /** The country as the sheet prints it. */
  country?: string
}

export interface SpecValue {
  side?: 'cartridge' | 'chamber'
  symbol: string
  quantity: string
  value?: number
  raw?: string
  limit?: 'max' | 'min'
  tolerance?: { lower?: number; upper?: number }
  variant?: string
  basic?: boolean
  footnotes?: string[]
}

/** A cartridge record, as `GET /cartridges/{id}` answers: its C.I.P. sheet and case capacities. */
export interface CartridgeDetail {
  id: string
  name: string
  aliases?: string[]
  table: string
  country?: string
  published: string
  revised?: string
  pressureMethod?: string
  verification: 'verified' | 'unverified'
  exceptions?: { finding: string; note: string }[]
  values: SpecValue[]
  provenance: Provenance
  caseType?: CaseType
  capacities: CaseCapacity[]
}

/** A water capacity record, g (`packages/schema/src/case-capacity.ts`). */
export interface CaseCapacity {
  id: string
  waterCapacity: { value: number }
  /** Id of the manufacturer record of the case. */
  caseManufacturer?: string
  caseCondition?: string
  provenance: Provenance
}

/** A manufacturer as `GET /manufacturers` lists it. */
export interface ManufacturerSummary {
  id: string
  name: string
  aliases?: string[]
  website?: string
}

export interface BulletSummary {
  id: string
  /** Id of the manufacturer record. */
  manufacturer: string
  name: string
  diameter: number
  mass: number
  /** mm; null without a length. */
  length: number | null
  /** The record's first G1 and G7 coefficients (lb/in²), null without one. */
  ballisticCoefficientG1: number | null
  ballisticCoefficientG7: number | null
  /** ISO 3166-1 alpha-2 code of the manufacturer's country. */
  country?: string
  /** The tip type of the record. */
  tipType?: string
  /** The construction structure of the record, else "<core material>-core". */
  construction?: string
}

/** A bullet record (`packages/schema/src/bullet.ts`): lengths mm, mass g, velocity m/s. */
export interface BulletRecord {
  id: string
  /** Id of the manufacturer record. */
  manufacturer: string
  productNumber?: string
  name: string
  /** ISO 3166-1 alpha-2 code of the manufacturer's country, as a source names it. */
  country?: string
  productLine?: string
  caliber?: string
  diameter: QuantityValue
  mass: QuantityValue
  length?: QuantityValue
  noseLength?: QuantityValue
  baseToOgive?: QuantityValue
  bearingLength?: QuantityValue
  base?: {
    type?: 'flat' | 'boat-tail' | 'rebated-boat-tail'
    length?: QuantityValue
    diameter?: QuantityValue
    angle?: QuantityValue
  }
  ogive?: { form?: string; radius?: QuantityValue; radiusRatio?: QuantityValue }
  tip?: { type: string; length?: QuantityValue; mouthDiameter?: QuantityValue }
  meplatDiameter?: QuantityValue
  construction?: {
    raw: string
    structure?: string
    core?: { material: string }
    jacket?: { material?: string }
    surface?: string[]
    unmapped?: true
  }
  ballisticCoefficients?: {
    dragModel: 'G1' | 'G7'
    value: number
    minVelocity?: QuantityValue
    note?: string
  }[]
  recommendedTwist?: QuantityValue
  slowestTwist?: QuantityValue
  note?: string
  provenance: Provenance
}

export interface PowderSummary {
  id: string
  /** Id of the manufacturer record. */
  manufacturer: string
  name: string
  grainForm?: PowderRecord['grainForm']
  propellantBase?: PowderRecord['propellantBase']
  /** ISO 3166-1 alpha-2 code of the manufacturer's country. */
  country?: string
  /** The fitted model's fields the burn-rate curve needs. */
  interior?: Pick<
    NonNullable<PowderRecord['interior']>,
    'vivacity' | 'pressureExponent' | 'referencePressure' | 'burnForm'
  >
}

/** Computed value at the mean composition with min and max over the composition ranges. */
export interface ComputedRange {
  value: number
  min: number
  max: number
}

/** A powder record: bulk density g/cm³, composition in mass %, thermochemistry in SI units. */
export interface PowderRecord {
  id: string
  /** Id of the manufacturer record. */
  manufacturer: string
  name: string
  aliases?: string[]
  /** ISO 3166-1 alpha-2 code of the manufacturer's country, as a source names it. */
  country?: string
  grainForm?: 'ball' | 'extruded' | 'flake' | 'other'
  propellantBase?: 'single' | 'double' | 'triple'
  bulkDensity?: QuantityValue
  composition?: { name: string; cas?: string; min: number; max: number; raw?: string }[]
  thermochemistry?: {
    loadingDensity: QuantityValue
    flameTemperature: ComputedRange
    impetus: ComputedRange
    gamma: ComputedRange
    molarMass: ComputedRange
    covolume: ComputedRange
  }
  /** Fitted M3 parameters (`packages/schema/src/powder.ts`), only the fields the web app reads. */
  interior?: {
    fitted: string[]
    vivacity: { value: number; standardUncertainty?: number }
    energy: { value: number; standardUncertainty?: number }
    gamma: number
    covolume: QuantityValue
    density: QuantityValue
    pressureExponent: number
    referencePressure: QuantityValue
    ignitionPressure: QuantityValue
    startPressure?: QuantityValue
    /** Propellant temperature of the fit. */
    propellantTemperature: QuantityValue
    burnForm: {
      kind: 'twoStage'
      a: { value: number; standardUncertainty?: number }
      m: number
      q: number
      z1: number
    }
    /** Bore-resistance constants of the fit: stress in bar, oversize per percent, engraving fraction. */
    resistance?: { stress: QuantityValue; oversize: number; engraving: number }
    trainingRows?: number
    trainingCartridges?: number
  }
  note?: string
  provenance: Provenance
}

export interface ListOf<T> {
  total: number
  items: T[]
}

/** `POST /interior` 200 response with `model: 'm3'` (`packages/api/src/compute/interior-run.ts`). */
export interface InteriorResponse {
  notice: string
  /** Core's result as the API sends it: every point field. */
  result: Pick<
    Extract<InteriorResult, { valid: true }>,
    | 'points'
    | 'peakBreechPressure'
    | 'maxPressureTime'
    | 'maxPressureTravel'
    | 'muzzleVelocity'
    | 'muzzleEnergy'
    | 'muzzleTime'
    | 'muzzleBreechPressure'
    | 'tenPercentPressureTime'
    | 'muzzleBurntFraction'
    | 'shotStartTime'
    | 'barrelTime'
    | 'burnout'
    | 'efficiency'
    | 'energy'
  >
  pressureRange: {
    nominalPressure: number
    lowPressure: number
    highPressure: number
    complete: boolean
    tolerances: {
      chargeFraction: number
      volumeFraction: number
      burnRateFraction: number
      temperatureKelvin: number
      startPressureFraction: number
    }
    cases: { maxPressure: number | null }[]
  }
  limits?: {
    cartridge: string
    /** Date of the sheet revision, `revised` or else `published`. */
    revised: string
    symbol: string
    method: string | null
    variant?: string
    pressure?: number
    compared: boolean
    reason?: string
    exceeded?: boolean
    nominalExceeded?: boolean
  }[]
  /** `spec`: the id of the C.I.P. sheet of a limit warning, `symbol`, `variant`, `method`: its limit. */
  warnings: {
    code: string
    message: string
    spec?: string
    symbol?: string
    variant?: string
    method?: string | null
  }[]
  resolved?: {
    cartridge?: {
      id: string
      name: string
      provenance: Provenance
    }
  }
}

/**
 * A step of a charge ladder answer: the fields of a single
 * answer at `charge`, or the `error` of a result the model reports as invalid.
 */
type InteriorLadderStep = { charge: number } & (
  | Pick<InteriorResponse, 'result' | 'pressureRange' | 'limits' | 'warnings'>
  | { error: { message: string; reason?: string; field?: string } }
)

/** The answer to a request with `ladder`: the shared fields once, then the steps. */
export type InteriorLadderResponse = Omit<
  InteriorResponse,
  'result' | 'pressureRange' | 'limits' | 'warnings'
> & { ladderSteps: InteriorLadderStep[] }

/** Error bodies of the API and of the forwarding route. */
export interface ErrorBody {
  statusCode: number
  error?: string
  message?: string
  notice?: string
  reason?: string
  field?: string
  issues?: { path: (string | number)[]; message: string }[]
}
