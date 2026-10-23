'use client'

import type { Context, Dispatch, RefObject, SetStateAction } from 'react'
import { createContext, useContext } from 'react'
import type { InteriorResponse, PowderRecord } from '../lib/api-types.ts'
import type { FittedPowder, UnfittedPowder } from '../lib/burn-rate.ts'
import type { activeClick } from '../lib/firearm.ts'
import type { IdentifiedSeries } from '../lib/measurements.ts'
import type { LadderDirection } from '../lib/seating-ladder.ts'
import type { UnitSystem } from '../lib/units.ts'
import type { ChartView } from './interior-chart.tsx'
import type { TrajectoryHandle } from './trajectory-form.tsx'
import type { BarrelStudy } from './use-barrel-study.ts'
import type { UseWorkbenchStateResult } from './use-workbench-load.ts'
import type { Outcome, ShownStep } from './workbench-outcome.ts'
import type { ResultTab } from './workbench-results.tsx'

/** The load: fields, records, seating, ladder and the actions; read by the input cards. */
export const LoadContext = createContext<UseWorkbenchStateResult | null>(null)

/**
 * What the result side shows: the outcome, its steps, the step choice and the chart view. Its
 * value stays the same object while a keystroke changes no part of it, so the memoized results do
 * not render again.
 */
export type ResultState = {
  ok: Extract<Outcome, { kind: 'ok' }> | undefined
  outcome: Outcome | undefined
  /** The load of the shown result: cartridge, bullet, mass, powder with charge. */
  identity: string[] | undefined
  stale: boolean
  /** A run is on its way: the shown values are the previous run's. */
  pending: boolean
  /** The warnings of the shown step in the page's units. */
  warnings: { text: string; name?: string }[] | undefined
  system: UnitSystem
  /** What a run still needs, shown in place of the readouts before the first result. */
  todo: { label: string; done: boolean; value?: string }[]
  /** The burn law of the chart: the powder record's fit, else the typed model parameters. */
  burn: FittedPowder | UnfittedPowder | undefined
  powder: PowderRecord | undefined
  /** The powder record as "<manufacturer name> <product name>". */
  powderLabel: string | undefined
  /** Where the shown run starts, peaks and leaves the barrel on the burnt-fraction axis. */
  runMarks: { z: number; label: string }[] | undefined
  steps: ShownStep[]
  /** The flag of the one step. */
  oneFlag: string | undefined
  /** A step's seating length, or its charge. */
  stepValue: (s: ShownStep) => string
  velocity: (r: InteriorResponse['result']) => string
  /** Shows ladder step `i`. */
  select: (i: number) => void
  tab: ResultTab
  setTab: (tab: ResultTab) => void
  setSeen: Dispatch<SetStateAction<ReadonlySet<ResultTab>>>
  /** The tab was opened once, or the page prints. */
  opened: (v: ResultTab) => boolean
  /** `failed`: the browser refused the clipboard. */
  csvCopied: boolean | 'failed'
  setCsvCopied: (copied: boolean | 'failed') => void
  /** The File menu's record id: set by Save and Open. */
  fileId: string | undefined
  /** Counts the File menu's store writes. */
  storedTick: number
  /** The active optic of the chosen firearm. */
  optic: ReturnType<typeof activeClick>
  /** The bullet record's diameter, m. */
  bulletDiameter: number | undefined
  trajectory: RefObject<TrajectoryHandle | null>
  notes: string
  setNotes: (notes: string) => void
  /** The Measurements tab's chronograph files, saved with the load. */
  chronoSeries: IdentifiedSeries[]
  setChronoSeries: Dispatch<SetStateAction<IdentifiedSeries[]>>
  /** The Barrel length tab's range and rows; the report prints the same rows. */
  barrel: BarrelStudy
  chartView: ChartView
  setChartView: (view: ChartView) => void
  /** Keeps the report's copy of the chart. */
  showChart: (copy: SVGSVGElement | undefined) => void
  /** The run's status line; the Run button sits in the page bar. */
  status: string
  online: boolean
}
export const ResultContext = createContext<ResultState | null>(null)

/** Input values the result side shows; apart, so a keystroke reaches only the parts that show it. */
type InputEchoState = {
  /** The charge of the shown result, else of the field. */
  chargeText: string
  /** The load's charge ladder, as the API runs it, for the Groups tab. */
  groupsLadder:
    | { charge: number; step: number; steps: number; direction: LadderDirection }
    | undefined
  /** The load the Trajectory tab starts from. */
  trajectoryLoad: {
    muzzleVelocity?: number
    bullet?: string
    twist?: number
    sightHeight?: number
    zeroRange?: number
    zeroTemperature?: number
    zeroPressure?: number
    zeroHumidity?: number
    dragFactor?: number
    dragFactorSource?: string
  }
}
export const InputEcho = createContext<InputEchoState | null>(null)

/** A workbench context; throws outside its provider. */
function useWorkbenchContext<T>(context: Context<T | null>, name: string): T {
  const value = useContext(context)
  if (value === null) throw new Error(`${name} is read outside the workbench`)
  return value
}
export const useLoad = () => useWorkbenchContext(LoadContext, 'LoadContext')
export const useResult = () => useWorkbenchContext(ResultContext, 'ResultContext')
export const useInputEcho = () => useWorkbenchContext(InputEcho, 'InputEcho')
