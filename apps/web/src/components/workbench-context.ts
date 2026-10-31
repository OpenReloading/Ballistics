'use client'

import type { LoadNote, LoadNoteRule } from '@open-reloading/core'
import type { Powder, SessionRecord } from '@open-reloading/schema'
import type { Context, Dispatch, RefObject, SetStateAction } from 'react'
import { createContext, useContext } from 'react'
import type { InteriorResponse } from '../lib/api-types.ts'
import type { BulletValues } from '../lib/bullet.ts'
import type { FittedPowder, UnfittedPowder } from '../lib/burn-rate.ts'
import type { activeClick } from '../lib/firearm.ts'
import type { Lots } from '../lib/load-notes.ts'
import type { LadderDirection } from '../lib/seating-ladder.ts'
import type { UnitSystem } from '../lib/units.ts'
import type { ChartView } from './interior-chart.tsx'
import type { TrajectoryHandle } from './trajectory-form.tsx'
import type { BarrelStudy } from './use-barrel-study.ts'
import type { LotRows } from './use-lot-rows.ts'
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
  warnings: { text: string; name?: string | undefined }[] | undefined
  system: UnitSystem
  /** What a run still needs, shown in place of the readouts before the first result. */
  todo: { label: string; done: boolean; value?: string | undefined }[]
  /** The burn law of the chart: the powder record's fit, else the typed model parameters. */
  burn: FittedPowder | UnfittedPowder | undefined
  powder: Powder | undefined
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
  /** The Measurements tab's chronograph sessions: user records, which the load references. */
  chronoSessions: SessionRecord[]
  setChronoSessions: Dispatch<SetStateAction<SessionRecord[]>>
  /** The reference a typed device maker stands for: the manufacturer it names, else a new user one. */
  manufacturerRef: (typed: string) => string | undefined
  /** The sessions the load names, also those this browser does not answer. */
  sessionRefCount: number
  /** The store id of the chosen firearm when it is one of this browser. */
  ownFirearm: string | undefined
  /** Hands the load the run simulates to the powder tuning route, on its link. */
  handOffTune: () => void
  loadNotes: LoadNotesState
  /** The name of a manufacturer reference; empty for none or an unknown one. */
  manufacturerName: (ref: string | undefined) => string
  /** The Barrel length tab's range and rows; the report prints the same rows. */
  barrel: BarrelStudy
  /** The Ladder table tab's lot rows; the report prints the same rows. */
  lot: LotRows
  chartView: ChartView
  setChartView: (view: ChartView) => void
  /** Keeps the report's copy of the chart. */
  showChart: (copy: SVGSVGElement | undefined) => void
  /** The run's status line; the Run button sits in the page bar. */
  status: string
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
    muzzleVelocity?: number | undefined
    bullet?: string | undefined
    bulletValues?: BulletValues | undefined
    twist?: number | undefined
    sightHeight?: number | undefined
    zeroRange?: number | undefined
    zeroTemperature?: number | undefined
    zeroPressure?: number | undefined
    zeroHumidity?: number | undefined
    dragFactor?: number | undefined
    dragFactorSource?: string | undefined
  }
}
export const InputEcho = createContext<InputEchoState | null>(null)

/** The lots of the load and the notes on its sessions. */
export interface LoadNotesState {
  lots: Lots
  setLots: (lots: Lots) => void
  notes: LoadNote[]
  /** The name of a session reference. */
  sessionName: (ref: string) => string
  /** Dismisses the note of `rule` on `session`; it is kept with the load. */
  dismiss: (session: string, rule: LoadNoteRule) => void
}

/** A workbench context; throws outside its provider. */
function useWorkbenchContext<T>(context: Context<T | null>, name: string): T {
  const value = useContext(context)
  if (value === null) throw new Error(`${name} is read outside the workbench`)
  return value
}
export const useLoad = () => useWorkbenchContext(LoadContext, 'LoadContext')
export const useResult = () => useWorkbenchContext(ResultContext, 'ResultContext')
export const useInputEcho = () => useWorkbenchContext(InputEcho, 'InputEcho')
