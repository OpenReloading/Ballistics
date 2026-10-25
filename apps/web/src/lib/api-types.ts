/** The fields of API responses the pages read (`packages/api/src/catalogue/`, `packages/api/src/compute/`, `packages/api/src/routes/`). */
import type { InteriorResult } from '@open-reloading/core'
import type {
  Cartridge,
  CaseType,
  CatalogueCaseCapacity,
  Powder,
  Provenance,
} from '@open-reloading/schema'

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

/** A cartridge record, as `GET /cartridges/{id}` answers: its C.I.P. sheet, case type and case capacities. */
export interface CartridgeDetail extends Omit<Cartridge, 'aliases'> {
  aliases?: string[]
  caseType?: CaseType
  capacities: CatalogueCaseCapacity[]
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

export interface PowderSummary {
  id: string
  /** Id of the manufacturer record. */
  manufacturer: string
  name: string
  grainForm?: Powder['grainForm']
  propellantBase?: Powder['propellantBase']
  /** ISO 3166-1 alpha-2 code of the manufacturer's country. */
  country?: string
  /** The fitted model's fields the burn-rate curve needs. */
  interior?: Pick<
    NonNullable<Powder['interior']>,
    'vivacity' | 'pressureExponent' | 'referencePressure' | 'burnForm'
  >
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
      massFraction: number
      burnRateFraction: number
      temperatureKelvin: number
      startPressureFraction: number
    }
    cases: { maxPressure: number | null }[]
  }
  /** The sampled band of the run (`sampling`), `POST /interior`; `failed` is set by the web app when its request did not answer. */
  sampled?: SampledBand
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

/** The answer's `sampled`, or the web app's own `failed` for a sampling request that gave none. */
export type SampledBand =
  | { status: 'failed' }
  | {
      status: 'sampled' | 'overBudget' | 'invalid'
      samples: number
      seed: number
      failed: number
      budgetMs: number
      /** Peak breech pressure, Pa; with status `sampled`. */
      pressure?: SampledPercentiles
      /** Muzzle velocity, m/s; with status `sampled`. */
      velocity?: SampledPercentiles
    }

/** The 5th, 50th and 95th percentile of a sampled quantity. */
export interface SampledPercentiles {
  p05: number
  p50: number
  p95: number
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
