'use client'

import { useForm } from '@mantine/form'
import { useMediaQuery, useNetwork } from '@mantine/hooks'
import {
  boreArea,
  bulletFits,
  bulletWindow,
  cartridgeBulletDiameterMm,
  cartridgeDiameters,
  cartridgeGrooveDiameterMm,
  gasVelocityFactor,
  overrideResistance,
  powderModelValues,
  recordResistance,
  ValueError,
} from '@open-reloading/core'
import {
  type Bullet,
  fromSi,
  type Load,
  type Powder,
  parseRef,
  type SessionRecord,
  toSi,
  type UserRecord,
  userRecord,
} from '@open-reloading/schema'
import { type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { apiFetch, fetchRecord } from '../lib/api-fetch.ts'
import type {
  BulletSummary,
  CartridgeDetail,
  ErrorBody,
  InteriorResponse,
  SampledBand,
} from '../lib/api-types.ts'
import { runBatch } from '../lib/batch.ts'
import { fitOf } from '../lib/bullet-fit.ts'
import { workbenchDesign } from '../lib/cartridge-designer.ts'
import { pagesBasePath } from '../lib/edition.ts'
import { errorText } from '../lib/error-text.ts'
import { loadExample } from '../lib/example-data.ts'
import { exampleFields } from '../lib/examples.ts'
import {
  type FieldSpec,
  type Fields,
  type FieldValue,
  fieldError,
  siValues,
} from '../lib/field-spec.ts'
import type { FigureView } from '../lib/figure-views.ts'
import { gunValues, sightOptions } from '../lib/firearm.ts'
import {
  cartridgeClass,
  type DefaultSources,
  type FollowKey,
  followKeys,
  type Suggestion,
  type Suggestions,
  suggestDefaults,
} from '../lib/input-defaults.ts'
import { burnFormError, interiorBody, interiorFields } from '../lib/interior-input.ts'
import {
  capacityOfRecord,
  capacityRecord,
  fromLoad,
  givenKeys,
  type LoadParts,
  measuredCapacityRef,
  savedCapacityRef,
  toApiLoad,
  toLoad,
} from '../lib/load-record.ts'
import { generatedName, loadName } from '../lib/load-tabs.ts'
import { type ManufacturerNames, productLabel } from '../lib/manufacturers.ts'
import { attachLoad, sessionRef } from '../lib/measurements.ts'
import { powderValues } from '../lib/powder-compare.ts'
import { unchangedFromRecord } from '../lib/powder-record.ts'
import {
  droppedIds,
  linkedId,
  linkedLoad,
  linkParams,
  queryFields,
  type RecordValues,
  recordValues,
} from '../lib/query.ts'
import {
  type LadderDirection,
  type RunnableLadderKind,
  runKindOf,
  type SeatingLengths,
  type SeatingStep,
  seatingLadder,
  temperatureLadder,
  temperatureLadderBlockReason,
} from '../lib/seating-ladder.ts'
import {
  exactFieldText,
  fixedFieldText,
  formatQuantity,
  type UnitSystem,
  waterVolume,
  withUnit,
} from '../lib/units.ts'
import { putRecords, storedRecord, storedRecords } from '../lib/user-store.ts'
import {
  catalogueIdOf,
  catalogueRef,
  resolveBullet,
  resolveCartridge,
  type UserBulletView,
  type UserCartridgeView,
  userBullets,
  userCartridges,
  userRef,
} from '../lib/variants.ts'
import {
  type InputPanel,
  lengthText,
  mmLength,
  type Status,
  shownLength,
  statusText,
} from '../lib/workbench.ts'
import {
  type DefaultKey,
  defaultKeys,
  defaultsText,
  parseDefaults,
  readDefaults,
  type WorkbenchDefaults,
} from '../lib/workbench-defaults.ts'
import type { FileMenuHandle } from './file-menu.tsx'
import type { ChartView } from './interior-chart.tsx'
import { usePrintEvents } from './print.ts'
import type { Seated } from './seating-preview.tsx'
import type { TrajectoryHandle } from './trajectory-form.tsx'
import { useFieldUnits, useUnits } from './units-settings.tsx'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import { useManufacturers } from './use-manufacturers.ts'
import {
  type CartridgeChoice,
  directionOf,
  emptyStep,
  firearmMassSpec,
  ladderSpec,
  maxLadderSteps,
  measuredWaterCapacitySpec,
  modelFields,
  powderMoreFields,
  requiredModelKeys,
  type SeatingSlotName,
  seatingSlotNames,
  seatingStepSpec,
  temperatureStepSpec,
} from './workbench-inputs.tsx'
import {
  atStep,
  derived,
  needsNetwork,
  notReached,
  type Outcome,
  type PreviewKey,
  previewKeys,
  resultLine,
  type Step,
  stepLoad,
  stepsOf,
} from './workbench-outcome.ts'
import { type ResultTab, resultTabs } from './workbench-results.tsx'
import type { WorkspaceHandle } from './workspace.tsx'

const interiorSpec = (key: string) =>
  interiorFields.find((s) => s.key === key) as (typeof interiorFields)[number]

type Seating = LoadParts['seating']

/** The seating of the seated bullet's values, none while no bullet is seated. */
function seatingOf(seated: Seated): Seating {
  const value = seated.mode && seated[seated.mode]
  // to 1 nm: the mm round trip of the preview leaves float noise that would mark an opened file changed
  return seated.mode && value !== undefined
    ? { by: seated.mode, value: Math.round(value * 1e9) / 1e9 }
    : undefined
}

/** The load's cartridge from its record: name, G1 and the bore's land and groove diameters. */
const cartridgeChoice = (c: CartridgeDetail): CartridgeChoice => ({
  id: c.id,
  name: c.name,
  g1: cartridgeBulletDiameterMm(c),
  ...cartridgeDiameters(c),
})

/** An answer of `POST /interior`: the response and its body, a result or an error body. */
type FirearmRecord = Extract<UserRecord, { kind: 'firearm' }>

type Answer = { res: Response; json: (InteriorResponse & ErrorBody) | undefined }

type Kind = 'cartridge' | 'bullet' | 'powder' | 'capacity'
type Asked = Partial<Record<Kind, { id: string; failed?: true }>>
type Groove = { id: string; z?: number; record?: CartridgeDetail }

/**
 * The chosen cartridge's loaded record: its groove diameter Z, m, the bore area Q, m2, an empty
 * Bore area takes first, and its CIP table.
 */
function grooveValues(cartridge: CartridgeChoice | undefined, groove: Groove | undefined) {
  const loaded = cartridge && groove?.id === cartridge.id ? groove : undefined
  if (!loaded) return { grooveM: undefined, qM: undefined, recordTable: undefined }
  const q = loaded.record?.values.find(
    (v) => v.side === 'chamber' && v.symbol === 'Q' && !v.variant,
  )
  return {
    grooveM: loaded.z ? toSi('length', loaded.z) : undefined,
    qM: toSi('area', q?.value ?? 0) || undefined,
    recordTable: loaded.record?.table,
  }
}

/** The example rifle's sight in round numbers of the shown units, 100 yd and 2 in, not 109 yd and 1.9685 in. */
function exampleSight<S extends { sightHeight: number; zeroRange: number }>(
  firearm: string | undefined,
  chosen: S | undefined,
  system: UnitSystem,
): S | undefined {
  if (firearm !== loadExample.firearm.id || !chosen) return chosen
  return {
    ...chosen,
    sightHeight: system.length.toSi(Math.round(system.length.fromSi(chosen.sightHeight))),
    zeroRange: system.range.toSi(chosen.zeroRange),
  }
}

/** The link's values of a record while the record is asked for, loading or missing. */
function pendingLink<L extends { id: string }>(
  record: unknown,
  askedId: string | undefined,
  linked: L | undefined,
) {
  return !record && askedId === linked?.id ? linked : undefined
}

/** Why a seating ladder cannot run: no seating, or a volume or travel typed over it. */
function seatingBlockOf(seatAt: SeatingLengths | undefined, typedKeys: readonly PreviewKey[]) {
  if (seatAt === undefined) return 'The seating ladder needs a cartridge and a bullet record.'
  if (typedKeys.length === 0) return
  return `${typedKeys.map((k) => interiorFields.find((f) => f.key === k)?.label).join(' and ')} typed: empty the field to follow the seating.`
}

function stepSpecOf(kind: RunnableLadderKind) {
  if (kind === 'seating') return seatingStepSpec
  if (kind === 'temperature') return temperatureStepSpec
  return ladderSpec
}

/** The step size field of the ladder kind: its spec and its value. */
function ladderStepField(
  kind: RunnableLadderKind,
  steps: { seat: Fields; temp: Fields; charge: Fields },
) {
  if (kind === 'seating') return [seatingStepSpec, steps.seat.seatStep] as const
  if (kind === 'temperature') return [temperatureStepSpec, steps.temp.tempStep] as const
  return [ladderSpec, steps.charge.ladderStep] as const
}

/**
 * The seating a file or link keeps, once one was stored or the user moved it away from its start
 * (the default start would mark an older file changed): the seated bullet's, else the one asked
 * for while it loads.
 */
function keptSeating(
  seated: Seated,
  start: Seating,
  initial: Seating | undefined,
  system: UnitSystem,
): Seating {
  const now = seatingOf(seated)
  // a move is a change of the seating field's text: the start typed back as shown is none (the
  // slider snaps back onto the start itself)
  const moved =
    start !== undefined &&
    (now?.by !== start.by ||
      exactFieldText('length', system, now.value) !== exactFieldText('length', system, start.value))
  return initial || moved ? (now ?? initial) : undefined
}

/** The cartridge asked for counts while its record loads or stays offline. */
function cartridgeKeyOf(
  cartridge: CartridgeChoice | undefined,
  design: UserCartridgeView | undefined,
  asked: Asked['cartridge'],
) {
  return cartridge?.id ?? design?.id ?? parseRef(asked?.id ?? '')?.id ?? asked?.id
}

/** The measured case capacity of the cartridge it was typed for, m3, when above 0. */
function measuredCapacityOf(
  typedFor: string | undefined,
  key: string | undefined,
  measured: Fields,
): number | undefined {
  const si = measured.measuredWaterCapacity.si
  return typedFor === key && (si ?? 0) > 0 ? si : undefined
}

/** The capacity of a catalogue record is chosen for the cartridge it belongs to. */
const chosenCapacityOf = (
  choice: { cartridge: string; id: string } | undefined,
  key: string | undefined,
) => (choice && choice.cartridge === key ? choice.id : undefined)

const mmToM = (mm: number | undefined) => (mm === undefined ? undefined : toSi('length', mm))
const mm2ToM2 = (mm2: number | undefined) => (mm2 === undefined ? undefined : toSi('area', mm2))

/** The case volume of the seated bullet's cartridge design, else the design's own approximate volume. */
function designCapacityOf(
  seated: Seated,
  designLoad: ReturnType<typeof workbenchDesign>,
  design: UserCartridgeView | undefined,
): Suggestion | undefined {
  if (seated.caseVolume !== undefined)
    return { si: seated.caseVolume, source: 'your measured case capacity, without the bullet' }
  if (designLoad?.caseVolume === undefined) return undefined
  return {
    si: designLoad.caseVolume,
    source: `outline of the user design ${design?.name} less a wall, approximate, without the bullet`,
  }
}

type CartridgeSource = {
  cartridge: CartridgeChoice | undefined
  design: UserCartridgeView | undefined
  designLoad: ReturnType<typeof workbenchDesign>
  recordTable: string | undefined
  specValue: (side: string | undefined, symbol: string) => number | undefined
  seated: Seated
  measuredCapacity: number | undefined
}

/** What the chosen cartridge, or its design, gives the defaults. */
function cartridgeSource(a: CartridgeSource): DefaultSources['cartridge'] {
  const { cartridge, design, designLoad, seated } = a
  if (design)
    return {
      name: design.name,
      design: true,
      boreDiameter: designLoad?.boreDiameter,
      capacity: designCapacityOf(seated, designLoad, design),
    }
  if (!cartridge) return undefined
  return {
    name: cartridge.name,
    class: cartridgeClass(a.recordTable),
    boreDiameter: mmToM(a.specValue('chamber', 'F')),
    boreArea: mm2ToM2(a.specValue('chamber', 'Q')),
    twist: mmToM(a.specValue('chamber', 'u')),
    capacity:
      seated.caseVolume === undefined
        ? undefined
        : {
            si: seated.caseVolume,
            source: a.measuredCapacity
              ? 'your measured case capacity, without the bullet'
              : `case capacity record of ${cartridge.name}, without the bullet`,
          },
  }
}

/** The mass of the bullet record, else of a user design that has a reference, kg. */
function bulletMassOf(
  bullet: Bullet | undefined,
  design: { id: string; mass?: number } | undefined,
) {
  if (bullet) return toSi('mass', bullet.mass.value)
  return design && userRef(design.id) ? design.mass : undefined
}

/** Whether the seating the load carries is the start's own: the barrel nobody typed. */
function seatingKeptOf(referenced: boolean, seated: Seated, suggestions: Suggestions) {
  if (!referenced) return false
  if (seated.barrel === undefined) return true
  return (
    Math.abs(seated.barrel - (suggestions.barrelLength?.si ?? Number.NaN)) <= 1e-9 * seated.barrel
  )
}

/** The `ladder` of a load file: the kind, step count, step and direction; none for a single charge. */
function ladderPartOf(
  steps: number,
  kind: RunnableLadderKind,
  step: number | undefined,
  direction: LadderDirection,
): LoadParts['ladder'] {
  if (steps < 2) return undefined
  return { kind, stepCount: steps, step, direction }
}

/** A new load with nothing chosen or typed: the start card replaces the cards. */
function isFresh(a: {
  chosen: unknown[]
  byHand: boolean
  fields: Fields
  defaulted: ReadonlySet<string>
}) {
  if (a.chosen.some(Boolean) || a.byHand) return false
  return Object.entries(a.fields).every(([k, v]) => a.defaulted.has(k) || v.text === '')
}

/** The card of the next open step, marked until the first result (as the checklist). */
function nextPanelOf(next: number, hasVolume: boolean): InputPanel | undefined {
  const panels = ['cartridge', 'bullet', 'powder', 'powder', hasVolume ? 'firearm' : 'cartridge']
  return panels[next] as InputPanel | undefined
}

const refOf = (record: { id: string } | undefined) => record && catalogueRef(record.id)

/** Whether the references the load keeps can all be written: a design or firearm whose id is no UUID cannot. */
function referencedOf(
  firearm: string | undefined,
  firearmRef: string | undefined | false,
  cartridgeDesign: UserCartridgeView | undefined,
  bulletDesign: { id: string } | undefined,
) {
  if (firearm && !firearmRef) return false
  if (cartridgeDesign && !userRef(cartridgeDesign.id)) return false
  return !bulletDesign || !!userRef(bulletDesign.id)
}

/** What a run still needs, in the order of the cards; the first open one is next. */
function todoOf(a: {
  cartridge: CartridgeChoice | undefined
  cartridgeDesign: UserCartridgeView | undefined
  bulletLabel: string | undefined
  bulletDesign: { name: string } | undefined
  powderLabel: string | undefined
  has: (keys: readonly string[]) => boolean
}) {
  const { cartridge, cartridgeDesign, has } = a
  return [
    {
      label: 'Cartridge (optional)',
      done: !!(cartridge || cartridgeDesign),
      value: cartridge?.name ?? (cartridgeDesign && `${cartridgeDesign.name} (your design)`),
    },
    {
      label: 'Bullet',
      done: has(['bulletMass']),
      value: a.bulletLabel ?? a.bulletDesign?.name,
    },
    {
      label: 'Powder or model parameters',
      done: has(requiredModelKeys),
      value: a.powderLabel,
    },
    { label: 'Charge', done: has(['charge']) },
    {
      label: 'Chamber volume, bullet travel and twist',
      done: has(['volume', 'travel', 'twist']),
    },
  ]
}

/** The ballistic coefficient the chart and the trajectory take: G7, else G1. */
const bcOf = (bullet: Bullet | undefined) =>
  bullet?.ballisticCoefficients?.find((c) => c.dragModel === 'G7') ??
  bullet?.ballisticCoefficients?.find((c) => c.dragModel === 'G1')

type LinkedBullet = NonNullable<RecordValues['bullet']> & { id: string }
type LinkedPowder = NonNullable<RecordValues['powder']> & { id: string }

/**
 * What Copy link carries of the bullet and powder records, SI, with their ids: the records'
 * values, else what the link that opened them carried.
 */
function recordLinkOf(a: {
  asked: Asked
  bullet: Bullet | undefined
  powder: Powder | undefined
  names: ManufacturerNames
  recordBore:
    | { boreFriction?: number; engravingPressure?: number; engravingLength?: number }
    | undefined
  linkedBullet: LinkedBullet | undefined
  linkedPowder: LinkedPowder | undefined
}) {
  const { asked, bullet, powder, names } = a
  return {
    bulletId: (asked.bullet?.id && catalogueIdOf(asked.bullet.id)) || bullet?.id,
    powderId: asked.powder?.id ?? powder?.id,
    values: {
      bullet: bullet
        ? {
            name: productLabel(bullet, names),
            length: bullet.length && toSi('length', bullet.length.value),
          }
        : a.linkedBullet,
      powder: powder
        ? {
            name: productLabel(powder, names),
            bulkDensity: powder.bulkDensity && toSi('density', powder.bulkDensity.value),
            ...a.recordBore,
          }
        : a.linkedPowder,
    } satisfies RecordValues,
  }
}

const labelOf = (record: Bullet | Powder | undefined, names: ManufacturerNames) =>
  record && productLabel(record, names)

const userRefOf = (id: string | undefined) => (id ? userRef(id) : undefined)

/** The gun weight when above 0: a weight of 0 or less is no weight. */
const usableWeight = (weight: FieldValue) => ((weight.si ?? 0) > 0 ? weight : emptyStep)

/** The bullet length a run reads, mm: the record's, else the link's. */
function bulletLengthOf(bullet: Bullet | undefined, linked: LinkedBullet | undefined) {
  return bullet?.length?.value ?? (linked?.length && fromSi('length', linked.length))
}

/** The bullets that fit the cartridge (`GET /bullets?cartridge`); all without its CIP values or with all diameters on. */
function bulletFilter(allDiameters: boolean, cartridge: CartridgeChoice | undefined) {
  const bulletFit = allDiameters ? undefined : fitOf(cartridge)
  const bulletParams =
    bulletFit && cartridge ? `&cartridge=${encodeURIComponent(cartridge.id)}` : ''
  return { bulletFit, bulletParams }
}

/** The measured capacity as a user record of its own, stored with the load, and the capacity reference the load keeps. */
function capacityRefsOf(
  cartridgeRef: string | undefined,
  measuredWaterCapacity: number | undefined,
  askedCapacity: string | undefined,
  chosenCapacity: string | undefined,
) {
  const measuredCapacity =
    measuredWaterCapacity !== undefined && cartridgeRef
      ? { cartridge: cartridgeRef, m3: measuredWaterCapacity }
      : undefined
  const capacityRef = savedCapacityRef(
    measuredCapacity && measuredCapacityRef(measuredCapacity.cartridge, measuredCapacity.m3),
    askedCapacity,
    chosenCapacity && catalogueRef(chosenCapacity),
  )
  return { measuredCapacity, capacityRef }
}

const resultLineOf = (outcome: Outcome, system: UnitSystem) =>
  outcome.kind === 'ok' ? resultLine(outcome, system) : undefined

/** The firearm the defaults read: its name, twist and barrel length. */
const gunSource = (
  gun: { name: string; data: { twist?: number; barrelLength?: number } } | undefined,
) => gun && { name: gun.name, twist: gun.data.twist, barrelLength: gun.data.barrelLength }

type PreviewFields = Partial<Record<PreviewKey, FieldValue>>

/**
 * What the seated bullet changes of volume and travel: the fields to write (empty, or still the
 * last seated value) and the values that follow it from now on.
 */
function followPlan(
  values: Seated,
  now: Fields,
  a: {
    followed: ReadonlySet<FollowKey>
    written: Partial<Record<FollowKey, number>>
    previewed: Partial<Record<PreviewKey, number>>
    field: (k: PreviewKey, v: number) => FieldValue
  },
) {
  const next: PreviewFields = {}
  const following: Partial<Record<PreviewKey, number>> = {}
  for (const k of previewKeys) {
    const v = values[k]
    const si = now[k]?.si
    if (v === undefined) continue
    const wasDefault = k === 'volume' && a.followed.has(k) && si === a.written.volume
    if (si !== undefined && Math.abs(si - v) <= 1e-9 * v) following[k] = si
    else if (si === undefined || si === a.previewed[k] || wasDefault) {
      following[k] = v
      next[k] = a.field(k, v)
    }
  }
  return { next, following }
}

/** `next` and the fields that already held the seated value, in the seating's text: same SI value. */
function seatedUpdate(next: PreviewFields, seatedText: PreviewFields, now: Fields) {
  const update: PreviewFields = { ...next }
  for (const k of previewKeys)
    if (!next[k] && seatedText[k]?.text !== now[k]?.text) update[k] = seatedText[k]
  return update
}

/** The start's own seating, with a barrel nobody typed, completes the start (no edit). */
const isStartSeating = (values: Seated, suggestions: Suggestions) =>
  values.atStart && (values.barrel === undefined || values.barrel === suggestions.barrelLength?.si)

type Form = Pick<
  ReturnType<typeof useForm<Fields>>,
  'getValues' | 'setFieldValue' | 'clearFieldError'
>

/**
 * The fields the previous powder record filled and the user did not edit go back to a new load's
 * state: the cited default, else empty. The keys that got a default.
 */
function revertRecordFill(
  form: Form,
  previous: Record<string, number>,
  defaults: WorkbenchDefaults,
  system: UnitSystem,
) {
  const back = new Set<string>()
  for (const key of unchangedFromRecord(previous, siValues(form.getValues()))) {
    const given = (defaultKeys as readonly string[]).includes(key)
      ? defaults[key as DefaultKey]
      : undefined
    const spec = interiorFields.find((s) => s.key === key) as FieldSpec
    form.setFieldValue(
      key,
      given === undefined
        ? emptyStep
        : { text: fixedFieldText(spec.quantity, system, given), si: given },
    )
    form.clearFieldError(key)
    if (given !== undefined) back.add(key)
  }
  return back
}

/** Writes the powder record's model parameters into the fields, except the `keep` ones; the keys written. */
function fillRecordValues(
  form: Form,
  values: Record<string, number>,
  keep: ReadonlySet<string>,
  system: UnitSystem,
) {
  const filled = Object.entries(values).filter(([key]) => !keep.has(key))
  for (const [key, si] of filled) {
    const spec = interiorFields.find((s) => s.key === key) as FieldSpec
    form.setFieldValue(key, { text: fixedFieldText(spec.quantity, system, si), si })
    form.clearFieldError(key)
  }
  return new Set(filled.map(([key]) => key))
}

/** The step size field's own error: invalid, or not above 0. */
function ownStepError(spec: FieldSpec, v: FieldValue, shown: UnitSystem) {
  return (
    fieldError(spec, v, shown) ??
    (v.si === undefined || v.si > 0 ? undefined : `${spec.label} must be above 0.`)
  )
}

/**
 * The bore resistance of a run: the record's law, else what a link carried of it, with what the
 * law could not apply.
 */
function resistanceFor(a: {
  chosen: Powder | undefined
  fromLink: LinkedPowder | undefined
  cartridge: CartridgeChoice | undefined
  groove: Groove | undefined
  body: ReturnType<typeof interiorBody>
  bulletLength: number | undefined
}) {
  const { chosen, fromLink, cartridge, groove, body } = a
  if (!chosen?.interior?.resistance)
    return {
      resistance:
        fromLink &&
        overrideResistance(undefined, {
          boreFriction: fromLink.boreFriction,
          engravingPressure: fromLink.engravingPressure,
          engravingLength: fromLink.engravingLength,
        }),
      missing: [],
    }
  if (cartridge && groove?.id !== cartridge.id)
    return { missing: ["the cartridge record's groove diameter (not loaded)"] }
  return recordResistance(chosen, {
    boreDiameter: body.load.chamber.boreDiameter,
    boreArea: body.load.chamber.boreArea,
    startPressure: body.load.startPressure,
    cartridge: cartridge && {
      g1: cartridge.g1,
      z: groove?.id === cartridge.id ? groove.z : undefined,
    },
    bulletLengthMm: a.bulletLength,
  })
}

const postInterior = (body: unknown, signal: AbortSignal) =>
  apiFetch('interior', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

/** The plan of a seating or temperature ladder: its steps, or why it cannot run. */
function plannedLadder<S, T>(
  steps: number,
  kind: RunnableLadderKind,
  plans: { seating: () => S; temperature: () => T; temperatureBlock: string | undefined },
) {
  if (steps < 2) return
  if (kind === 'seating') return plans.seating()
  if (kind !== 'temperature') return
  return plans.temperatureBlock ? { error: plans.temperatureBlock } : plans.temperature()
}

/** The per-step overrides of a planned ladder's steps. */
function planRows(kind: RunnableLadderKind, steps: SeatingStep[] | number[]): Partial<Step>[] {
  return kind === 'seating'
    ? (steps as SeatingStep[]).map((seating) => ({ seating }))
    : (steps as number[]).map((temperature) => ({ temperature }))
}

/** The request body: a charge ladder runs in the API, a planned ladder is sent step by step. */
function ladderRequest<B extends object>(
  body: B,
  plan: Partial<Step>[] | undefined,
  stepCount: number,
  chargeStep: number | undefined,
  direction: LadderDirection,
) {
  if (plan || stepCount < 2 || chargeStep === undefined) return body
  return { ...body, ladder: { chargeStep, stepCount, direction } }
}

/** The cartridge's CIP table, and the note for why a cartridge has none to read. */
async function tableOf(
  cartridge: CartridgeChoice | undefined,
  groove: Groove | undefined,
  recordTable: string | undefined,
  signal: AbortSignal,
) {
  // a record still loading is waited for
  const pending = !!cartridge && groove?.id !== cartridge.id
  const fetched = pending
    ? await fetchRecord<CartridgeDetail>('cartridges', cartridge.id, signal).catch(() => undefined)
    : undefined
  const table = pending ? fetched?.table : recordTable
  // the factor 1.75 of a cartridge with an id but no table: the note says why
  if (!cartridge || table !== undefined) return { table, gasFactorNote: undefined }
  const unloaded = pending && !fetched
  return {
    table,
    gasFactorNote: unloaded
      ? 'cartridge record not loaded'
      : 'cartridge record without a CIP table',
  }
}

const gasFactorOf = (table: string | undefined) =>
  cartridgeClass(table) === 'pistol' ? gasVelocityFactor.pistol : gasVelocityFactor.rifle

/** The rows of a planned ladder: the answers become steps, an error step keeps the API's message. */
function planSteps(plan: Partial<Step>[], answers: Answer[], charge: number): Step[] {
  return plan.map((row, i) => {
    const { res, json } = answers[i]
    if (res.ok && json !== undefined) return { charge, body: json, ...row }
    const message = json?.message ?? `The API answered ${res.status}.`
    return { charge, error: { message, reason: json?.reason }, ...row }
  })
}

/**
 * The answer a run stands for and its steps: the one request, or the planned ladder's steps with
 * at most 4 in flight. Nothing when a change aborted it.
 */
async function runRequest(
  plan: Partial<Step>[] | undefined,
  request: unknown,
  body: ReturnType<typeof interiorBody>,
  signal: AbortSignal,
) {
  const charge = body.load.charge
  if (!plan) {
    const res = await postInterior(request, signal)
    const json: Answer['json'] = await res.json().catch(() => undefined)
    // a change while the body was read aborted it; the shown result stays marked
    if (signal.aborted) return
    return { res, json, steps: res.ok && json !== undefined ? stepsOf(json, charge) : [] }
  }
  const answers: Answer[] = []
  await runBatch(plan, 4, signal, async (row, i) => {
    const res = await postInterior(
      { ...body, load: stepLoad(body.load, { charge, ...row }) },
      signal,
    )
    answers[i] = { res, json: await res.json().catch(() => undefined) }
  })
  if (signal.aborted) return
  // a busy API or a step past its deadline (503) is a failed request, not a model error; the first
  // answer stands for the run's status when no step has a result
  const shown =
    answers.find((a) => a.res.status === 503) ?? answers.find((a) => !a.res.ok) ?? answers[0]
  return { ...shown, steps: shown.res.status === 503 ? [] : planSteps(plan, answers, charge) }
}

/** The step a new run shows: the first with a result; a ladder around the charge its middle step. */
function firstStep(steps: Step[], around: boolean) {
  const middle = around ? (steps.length - 1) / 2 : -1
  return steps[middle]?.body ? middle : steps.findIndex((s) => s.body)
}

const ladderOf = (
  plan: Partial<Step>[] | undefined,
  kind: RunnableLadderKind,
  seatingBy: SeatingLengths['lengthKind'] | undefined,
) => ({
  kind: plan ? kind : ('charge' as const),
  seatingBy: plan && kind === 'seating' ? seatingBy : undefined,
})

type Named = { name?: string } | undefined

/** The names the printed sheet shows for the load's records. */
function identityOf(a: {
  cartridge: CartridgeChoice | undefined
  cartridgeDesign: { name: string } | undefined
  bulletLabel: string | undefined
  bulletDesign: Named
  linkedBullet: Named
  powderLabel: string | undefined
  linkedPowder: Named
}) {
  const design = a.cartridgeDesign && `${a.cartridgeDesign.name} (user design)`
  return {
    cartridge: a.cartridge?.name ?? design,
    bullet: a.bulletLabel ?? a.bulletDesign?.name ?? a.linkedBullet?.name,
    powder: a.powderLabel ?? a.linkedPowder?.name,
  }
}

/** The seated values still the ones the seating preview wrote. */
const fromSeatingOf = (
  seated: Seated,
  fields: Fields,
  previewed: Partial<Record<PreviewKey, number>>,
) => previewKeys.filter((k) => seated[k] !== undefined && fields[k]?.si === previewed[k])

/** A request that gives no band (busy, past its deadline, unreachable) is said so. */
function fetchBand(request: unknown, signal: AbortSignal): Promise<SampledBand> {
  const failed: SampledBand = { status: 'failed' }
  return postInterior(request, signal)
    .then((r) => (r.ok ? r.json() : undefined))
    .then((answer: { sampled?: SampledBand } | undefined) => answer?.sampled ?? failed)
    .catch(() => failed)
}

/** The outcome with the sampled band of the step shown first, when it is still the run's result. */
function withBand(o: Outcome | undefined, id: number, first: number, sampled: SampledBand) {
  if (o?.kind !== 'ok' || o.id !== id) return o
  return {
    ...o,
    body: o.selected === first ? { ...o.body, sampled } : o.body,
    steps: o.steps.map((s, i) =>
      i === first && s.body ? { ...s, body: { ...s.body, sampled } } : s,
    ),
  }
}

/** The error outcome of a run whose every step the model reports as invalid, with its status text. */
function failedRun(steps: Step[], res: Response, json: Answer['json']) {
  // a ladder shows the first step's error
  const error = steps[0]?.error
  const status = error ? 422 : res.status
  return {
    outcome: {
      kind: 'error' as const,
      status,
      body: error
        ? { statusCode: 422, notice: json?.notice, ...error }
        : (json as ErrorBody | undefined),
      retryAfter: res.headers.get('retry-after'),
    },
    text: `The API answered ${status}.`,
  }
}

/** The fields of a link's query, with the default of a defaulted field the link leaves out. */
function linkedFieldsOf(
  query: URLSearchParams,
  system: UnitSystem,
  defaults: WorkbenchDefaults,
  withDefaults: boolean,
) {
  const linked = queryFields(query, interiorFields, system, fixedFieldText)
  const missing = withDefaults ? defaultKeys.filter((k) => linked[k].si === undefined) : []
  for (const k of missing) {
    const spec = interiorFields.find((s) => s.key === k) as FieldSpec
    linked[k] = { text: fixedFieldText(spec.quantity, system, defaults[k]), si: defaults[k] }
  }
  return { linked, missing }
}

/** The error of every field whose typed value is outside its bounds. */
const fieldErrorsOf = (linked: Fields, system: UnitSystem) =>
  Object.fromEntries(
    interiorFields.flatMap((s) => {
      const error = linked[s.key].text && fieldError(s, linked[s.key], system)
      return error ? [[s.key, error]] : []
    }),
  )

/**
 * The ladder of a link's query, when it fits. The step is a length for a seating ladder, a
 * temperature difference for a temperature ladder, a charge otherwise; all travel as `ladderStep`.
 */
function queryLadder(query: URLSearchParams, system: UnitSystem) {
  const steps = Number(query.get('ladderSteps'))
  const direction = directionOf(query.get('ladderDirection'))
  const fits =
    Number.isInteger(steps) &&
    steps > 1 &&
    steps <= maxLadderSteps &&
    (direction !== 'around' || steps % 2 === 1)
  if (!fits) return
  const kind = runKindOf(query.get('ladderKind'))
  const spec = stepSpecOf(kind)
  const { ladderStep } = queryFields(
    query,
    [{ ...spec, key: 'ladderStep' }],
    system,
    fixedFieldText,
  )
  return { steps, kind, direction, ladderStep }
}

/** The seating a link asks for: the length key whose value is a positive number. */
const seatingKeyOf = (query: URLSearchParams) =>
  (['overallLength', 'baseToOgive'] as const).find((k) => {
    const x = Number(query.get(k))
    return Number.isFinite(x) && x > 0
  })

/** What a link carried of its bullet and powder records, under the ids it names. */
const carriedRecords = (
  carried: ReturnType<typeof recordValues>,
  bulletId: string | undefined,
  powderId: string | undefined,
) => ({
  ...(bulletId && carried.bullet && { bullet: { ...carried.bullet, id: bulletId } }),
  ...(powderId && carried.powder && { powder: { ...carried.powder, id: powderId } }),
})

const catalogueIdIn = (ref: unknown) => (typeof ref === 'string' ? catalogueIdOf(ref) : undefined)

/** The id of a firearm of this browser's library, from a load's firearm reference. */
function userFirearmOf(ref: string | undefined) {
  const target = ref && parseRef(ref)
  return target && target.scope === 'user' ? target.id : undefined
}

const userCartridgeOf = (ref: string | undefined) =>
  ref && parseRef(ref)?.scope === 'user' ? ref : undefined

/** The value a followed field takes: its default, or empty when the default goes and it still holds it. */
function followedValue(
  key: FollowKey,
  target: number | undefined,
  holdsWritten: boolean,
  system: UnitSystem,
): FieldValue | undefined {
  if (target !== undefined)
    return { text: fixedFieldText(interiorSpec(key).quantity, system, target), si: target }
  // a value the user or a gun gave stays
  return holdsWritten ? { text: '', si: undefined } : undefined
}

/** The writes a followed field's new default makes; `written` records the defaults put in. */
function followWrites(a: {
  followed: ReadonlySet<FollowKey>
  seatedVolume: boolean
  now: Fields
  suggestions: Suggestions
  written: Partial<Record<FollowKey, number>>
  system: UnitSystem
}) {
  const writes: [FollowKey, FieldValue][] = []
  for (const k of followKeys) {
    if (!a.followed.has(k) || (k === 'volume' && a.seatedVolume)) continue
    const target = a.suggestions[k]?.si
    const current = a.now[k]?.si
    if (target !== current) {
      const value = followedValue(k, target, current === a.written[k], a.system)
      if (!value) continue
      writes.push([k, value])
    }
    a.written[k] = target
  }
  return writes
}

/** The load workbench's state and actions: inputs, records, seating, ladder, run and result. */
export function useWorkbenchState() {
  const { choice, system } = useUnits()
  // a record fetched on mount arrives after the stored units apply: its fill reads the current ones
  const unitsNow = useRef(system)
  unitsNow.current = system
  // one rule for the page's life, reading the units through the ref: the form rebuilds its
  // validators on a new rule, and their closures kept every earlier render's result alive
  const validate = useCallback(
    (values: Fields) =>
      Object.fromEntries(
        interiorFields.map((s) => [
          s.key,
          fieldError(s, values[s.key], unitsNow.current) ??
            burnFormError(siValues(values), s.key) ??
            null,
        ]),
      ),
    [],
  )
  const form = useForm<Fields>({
    mode: 'controlled',
    initialValues: exampleFields(interiorFields, parseDefaults(null), system),
    validateInputOnBlur: true,
    validate,
  })
  const [cartridge, setCartridgeRecord] = useState<CartridgeChoice | undefined>(undefined)
  /**
   * The user cartridge chosen in place of a record: it fills what its resolved values give, no
   * limits, class or capacity record of its base.
   */
  const [cartridgeDesign, setCartridgeDesign] = useState<UserCartridgeView>()
  /** A catalogue cartridge replaces the design. */
  const setCartridge = (c: CartridgeChoice | undefined) => {
    setCartridgeRecord(c)
    if (c) setCartridgeDesign(undefined)
  }
  const [bullet, setBullet] = useState<Bullet | undefined>(undefined)
  const [powder, setPowder] = useState<Powder | undefined>(undefined)
  const names = useManufacturerNames()
  /** The chosen records as "<manufacturer name> <product name>". */
  const bulletLabel = labelOf(bullet, names)
  const powderLabel = labelOf(powder, names)
  /** SI values of the powder record's model parameters, the reference of the field marks. */
  const [origin, setOrigin] = useState<Record<string, number> | undefined>(undefined)
  const originNow = useRef(origin)
  originNow.current = origin
  /** Groove diameter Z of the chosen cartridge, mm, for the bore resistance of a fitted powder. */
  /** The chosen cartridge's record: its groove diameter and the values the figure draws. */
  const [groove, setGroove] = useState<Groove | undefined>(undefined)
  const { grooveM, qM, recordTable } = grooveValues(cartridge, groove)
  const [allDiameters, setAllDiameters] = useState(false)
  /** The browser's bullet designs that have a mass, resolved against the catalogue. */
  const [designs, setDesigns] = useState<UserBulletView[]>([])
  /** The browser's cartridge designs that draw a case and chamber. */
  const [cartridgeDesigns, setCartridgeDesigns] = useState<UserCartridgeView[]>([])
  /** The firearm library of this browser, for the Gun and barrel picker. */
  const [firearms, setFirearms] = useState<FirearmRecord[]>([])
  const [firearm, setFirearm] = useState<string>()
  /** An opened load's gun weight comes from its firearm, which is not read yet. */
  const gunPending = useRef(false)
  /** Counts the opened loads: the same firearm chosen again is no change of `firearm`. */
  const [opens, setOpens] = useState(0)
  /** The name the user typed; undefined: the generated name follows the load. */
  const [customName, setCustomName] = useState<string>()
  const [figureView, setFigureView] = useState<FigureView>('cartridge')
  /** The library, with the example's built-in rifle while the example is loaded. */
  const firearmList = (
    firearm === loadExample.firearm.id ? [loadExample.firearm, ...firearms] : firearms
  ).map((r) => ({ id: r.id, name: r.name, data: gunValues((r as FirearmRecord).data) }))
  /** The chosen firearm's active sight, for the Trajectory tab. */
  const chosenSight = sightOptions(
    [loadExample.firearm, ...firearms].filter((r) => r.id === firearm) as UserRecord[],
  )[0]?.fill
  const sight = exampleSight(firearm, chosenSight, system)
  /**
   * Where the seating preview puts its controls, by name: the cards register their slots, the
   * figure fills them.
   */
  const [seatingSlots, setSeatingSlots] = useState<Partial<Record<SeatingSlotName, HTMLElement>>>(
    {},
  )
  /** One ref per slot for the page's life, so a render does not detach and attach it again. */
  const slotRefs = useMemo(
    () =>
      Object.fromEntries(
        seatingSlotNames.map((name) => [
          name,
          (node: HTMLElement | null) =>
            setSeatingSlots((s) =>
              s[name] === (node ?? undefined) ? s : { ...s, [name]: node ?? undefined },
            ),
        ]),
      ) as Record<SeatingSlotName, (node: HTMLElement | null) => void>,
    [],
  )
  /** The result tab that holds the cartridge figure in a low window, while it is shown. */
  const [figureTab, setFigureTab] = useState<HTMLElement | null>(null)
  /** The card whose More popover is open; the model parameters drawer. */
  const [more, setMore] = useState<InputPanel>()
  /** The user bullet design that filled the bullet mass; an edit of the mass leaves it. */
  const [bulletDesign, setBulletDesign] = useState<{ id: string; name: string; mass?: number }>()
  /** The full form without a cartridge, chosen on the start card. */
  const [byHand, setByHand] = useState(false)
  /** The browser's bullet designs, read on load and again on focus. */
  const readDesigns = () =>
    storedRecords()
      .then(async ({ records }) => {
        const [bullets, cartridges] = await Promise.all([
          userBullets(records),
          userCartridges(records),
        ])
        // a design without a mass has nothing to fill
        setDesigns(bullets.filter((d) => d.si.mass !== undefined))
        setCartridgeDesigns(
          cartridges.filter(
            (d) => workbenchDesign(d.data, d.resolved, d.name, unitsNow.current) !== undefined,
          ),
        )
        setFirearms(records.filter((r): r is (typeof firearms)[number] => r.kind === 'firearm'))
      })
      .catch(() => {})
  // biome-ignore lint/correctness/useExhaustiveDependencies: once on mount
  useEffect(() => {
    void readDesigns()
  }, [])
  // the weight of the opened load's firearm, once the library has been read
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a new library or firearm only
  useEffect(() => {
    if (!gunPending.current) return
    const f = firearmList.find((r) => r.id === firearm)
    if (!f) return
    gunPending.current = false
    const mass = f.data.firearmMass
    if (mass === undefined) return
    gunFromFirearm.current = true
    setGunFields({
      firearmMass: { text: fixedFieldText('firearmMass', unitsNow.current, mass), si: mass },
    })
  }, [firearm, firearms, opens])
  /** A bullet design of this browser in place of a record; `fill` writes its mass into the Bullet mass field. */
  function takeBulletDesign(d: Pick<UserBulletView, 'id' | 'name' | 'si'>, fill = true) {
    picking.current.bullets?.abort()
    got('bullet')
    setBulletDesign({ id: d.id, name: d.name, mass: d.si.mass })
    setBullet(undefined)
    setBulletNote('')
    if (!fill) return
    markChanged()
    const mass = d.si.mass
    if (mass !== undefined)
      form.setFieldValue('bulletMass', { text: fixedFieldText('mass', system, mass), si: mass })
  }
  function chooseDesign(id: string) {
    const d = designs.find((r) => r.id === id)
    if (d) takeBulletDesign(d)
    else setBulletDesign(undefined)
  }
  /** A cartridge design of this browser in place of a record; an opened file's is no change. */
  function takeCartridgeDesign(d: UserCartridgeView, fill = true) {
    picking.current.cartridges?.abort()
    got('cartridge')
    if (fill) markChanged()
    setCartridgeRecord(undefined)
    setCartridgeDesign(d)
    setBulletNote('')
    // an opened file keeps the seating it holds
    if (!fill) return
    setPreviewInitial(undefined)
    setSeated({})
    setSeatingStart(undefined)
  }
  function chooseCartridgeDesign(id: string) {
    const d = cartridgeDesigns.find((r) => r.id === id)
    if (d) takeCartridgeDesign(d)
  }
  /** A firearm of the library: its twist fills the twist, its barrel length the seating's. */
  function chooseFirearm(id: string | null) {
    const f = firearmList.find((r) => r.id === id)
    setFirearm(f?.id)
    if (!f) {
      // cleared: the weight the firearm gave goes with it
      if (gunFromFirearm.current) {
        gunFromFirearm.current = false
        setGunFields({ firearmMass: emptyStep })
      }
      return
    }
    markChanged()
    const twist = f.data.twist
    if (twist !== undefined)
      form.setFieldValue('twist', { text: fixedFieldText('twist', system, twist), si: twist })
    const mass = f.data.firearmMass
    if (mass !== undefined) {
      gunFromFirearm.current = true
      setGunFields({
        firearmMass: { text: fixedFieldText('firearmMass', system, mass), si: mass },
      })
    } else if (gunFromFirearm.current) {
      // the weight of the firearm before: no other gun's weight under this firearm's recoil
      gunFromFirearm.current = false
      setGunFields({ firearmMass: emptyStep })
    }
  }
  /** Names a Bullet record cleared by a cartridge change. */
  const [bulletNote, setBulletNote] = useState('')
  const [pending, setPending] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | undefined>(undefined)
  /** Inputs changed after the shown outcome was computed. */
  const [changed, setChanged] = useState(false)
  /** Counts the edits of the inputs: a print waiting for the barrel length study is tied to one. */
  const [edits, setEdits] = useState(0)
  const [status, setStatus] = useState<Status>('')
  // remounts the cartridge search so it drops an earlier query when a preset chooses the cartridge
  const [searchKey, setSearchKey] = useState(0)
  const [previewInitial, setPreviewInitial] = useState<{
    bullet?: string
    barrel?: number
    seating?: Seating
  }>()
  /** SI values the preview wrote into the fields. */
  const [previewed, setPreviewed] = useState<Partial<Record<PreviewKey, number>>>({})
  /** The seated bullet's values, SI, none while no bullet is seated: an emptied field takes them again. */
  const [seated, setSeated] = useState<Seated>({})
  /** The seating the preview first reported: a file or link keeps a seating that differs. */
  const [seatingStart, setSeatingStart] = useState<Seating>()
  const [tab, setTab] = useState<ResultTab>('results')
  /** Counts the File menu's store writes: the Groups tab reads the new id and its sheet again. */
  const [storedTick, setStoredTick] = useState(0)
  // tabs that compute or load code mount when first opened and stay; print mounts them all
  const [seen, setSeen] = useState<ReadonlySet<ResultTab>>(() => new Set(['results']))
  const [printing, setPrinting] = useState(false)
  const printMedia = useMediaQuery('print')
  // the server edition runs the interior in the API: offline, the run bar says so; a run still goes
  // out, since a server on this machine answers without a network. The Pages edition runs it here.
  const online = useNetwork().online || pagesBasePath !== undefined
  // every tab renders for the print snapshot
  usePrintEvents(
    () => flushSync(() => setPrinting(true)),
    () => setPrinting(false),
  )
  // stable while nothing it reads changes, so the memoized result side keeps it
  const opened = useCallback(
    (v: ResultTab) => printing || printMedia || seen.has(v),
    [printing, printMedia, seen],
  )
  /** The report's copy of the chart: taken after each draw, also in a hidden tab; a new run or step clears it. */
  const reportCopy = useRef<SVGSVGElement | undefined>(undefined)
  const reportChart = useRef<HTMLDivElement | null>(null)
  const showChart = useCallback((copy: SVGSVGElement | undefined) => {
    reportCopy.current = copy
    reportChart.current?.replaceChildren(...(copy ? [copy] : []))
  }, [])
  // the report mounts after the chart may have drawn: its slot takes the last copy
  const chartSlot = useCallback((slot: HTMLDivElement | null) => {
    reportChart.current = slot
    if (slot && reportCopy.current) slot.replaceChildren(reportCopy.current)
  }, [])
  const [notes, setNotes] = useState('')
  /**
   * The Measurements tab's chronograph sessions: user records of this browser, stored as they
   * change. The load keeps their references (`sessionRefs`, in order, also those the store did not
   * answer); links do not carry them.
   */
  const [chronoSessions, setSessionsState] = useState<SessionRecord[]>([])
  const [sessionRefs, setSessionRefs] = useState<string[]>([])
  const sessionsNow = useRef<SessionRecord[]>([])
  const sessionsOpened = useRef(0)
  const manufacturers = useManufacturers()
  const { ensure: ensureManufacturer, newId: freshId } = manufacturers
  const manufacturerRef = useCallback(
    (typed: string) => ensureManufacturer(typed, freshId()),
    [ensureManufacturer, freshId],
  )
  /** Replaces the sessions; the records that changed are stored, a removed one stays in the store. */
  const setChronoSessions = useCallback((update: SetStateAction<SessionRecord[]>) => {
    const before = sessionsNow.current
    const next = typeof update === 'function' ? update(before) : update
    sessionsNow.current = next
    setSessionsState(next)
    const had = new Set(before.map((r) => r.id))
    const has = new Set(next.map((r) => r.id))
    const added = next.filter((r) => !had.has(r.id)).map((r) => sessionRef(r.id))
    const removed = new Set(before.filter((r) => !has.has(r.id)).map((r) => sessionRef(r.id)))
    setSessionRefs((refs) => [...refs.filter((r) => !removed.has(r)), ...added])
    const changed = next.filter((r) => !before.includes(r))
    if (changed.length > 0) {
      const saved = new Date().toISOString()
      // a store that refuses leaves the reference to be reported as missing on the next open
      putRecords(changed.map((r) => ({ ...r, saved }))).catch(() => {})
    }
  }, [])
  const [csvCopied, setCsvCopied] = useState<boolean | 'failed'>(false)
  /** Phones: the model parameters stand open on request. */
  const [modelShown, setModelShown] = useState(false)
  /** The defaults the current load started from, and the fields still holding them. */
  const [defaults, setDefaults] = useState<WorkbenchDefaults>(() => parseDefaults(null))
  const [defaulted, setDefaulted] = useState<ReadonlySet<string>>(() => new Set(defaultKeys))
  /**
   * The fields that follow their default (`input-defaults.ts`) until typed: all of them in a new load,
   * none in an opened file. The value the default wrote last, to tell it from a typed one.
   */
  const [followed, setFollowed] = useState<ReadonlySet<FollowKey>>(() => new Set(followKeys))
  const written = useRef<Partial<Record<FollowKey, number>>>({})
  /** Charge ladder inputs; share links and load files carry them. */
  const [ladderSteps, setLadderSteps] = useState(1)
  /** The steps field's text while it is edited: an emptied field stays empty until blur. */
  const [stepsDraft, setStepsDraft] = useState<string | number>()
  const [ladder, setLadder] = useState<Fields>({ ladderStep: emptyStep })
  /** What the ladder varies, the seating ladder's step size and the seating the preview reports. */
  const [ladderKind, setLadderKind] = useState<RunnableLadderKind>('charge')
  const [seatStep, setSeatStep] = useState<Fields>({ seatStep: emptyStep })
  /** The temperature ladder's step size, a difference of temperatures. */
  const [tempStep, setTempStep] = useState<Fields>({ tempStep: emptyStep })
  const [seatAt, setSeatAt] = useState<SeatingLengths>()
  /** The measured case capacity typed in the Cartridge card, kept for the cartridge it was typed for. */
  const [measured, setMeasured] = useState<Fields>({ measuredWaterCapacity: emptyStep })
  const [measuredFor, setMeasuredFor] = useState<string>()
  /** The catalogue capacity record the user chose in the Cartridge card, kept for the cartridge it belongs to. */
  const [capacityChoice, setCapacityChoice] = useState<{ cartridge: string; id: string }>()
  /** The user capacity reference of the load being opened: a slower read than a newer open leaves alone. */
  const openingCapacity = useRef<string>(undefined)
  /** The Gun and barrel card's gun weight (free recoil only); the load's typed values and links carry it. */
  const [gunFields, setGunFields] = useState<Fields>({ firearmMass: emptyStep })
  const gunWeight = gunFields.firearmMass
  /** The weight came from a firearm of the library, not from the keyboard, a link or a file. */
  const gunFromFirearm = useRef(false)
  const setGunWeight = (v: FieldValue) => {
    gunFromFirearm.current = false
    setGunFields({ firearmMass: v })
  }
  /** A weight of 0 or less is no weight: the field shows its error, the run, files and links skip it. */
  const gunWeightUsed = usableWeight(gunWeight)
  const [ladderError, setLadderError] = useState<string | undefined>()
  const [direction, setDirection] = useState<LadderDirection>('up')
  const [chartView, setChartView] = useState<ChartView>({ x: 'travel', quantity: 'all' })
  const framed = useMediaQuery('screen and (min-width: 62em)')
  const running = useRef<AbortController | null>(null)
  // the sampled band request of the shown result: an edit leaves it running, a new run ends it
  const bandRequest = useRef<AbortController | null>(null)
  /** Bullet and powder record requests; only the latest of each kind may set its record. */
  const picking = useRef<Partial<Record<'cartridges' | 'bullets' | 'powders', AbortController>>>({})
  const runs = useRef(0)
  /** Warnings of the last result, so only a new set is announced. */
  const lastWarnings = useRef('')
  const inputs = useRef<HTMLFormElement>(null)
  const workspace = useRef<WorkspaceHandle>(null)
  // setValues clears the errors; a unit switch keeps them, those of the update queue so far (a
  // link's errors set in the same flush are not in this render's `form.errors` yet)
  useFieldUnits(
    interiorFields,
    system,
    (update) => {
      let errors = {}
      form.setErrors((current) => (errors = current))
      form.setValues((fields) => withSeatedText(update(fields)))
      form.setErrors(() => errors)
    },
    fixedFieldText,
  )
  useFieldUnits([ladderSpec], system, (update) => setLadder((f) => update(f)), fixedFieldText)
  useFieldUnits(
    [seatingStepSpec],
    system,
    (update) => setSeatStep((f) => update(f)),
    fixedFieldText,
  )
  useFieldUnits(
    [temperatureStepSpec],
    system,
    (update) => setTempStep((f) => update(f)),
    fixedFieldText,
  )
  useFieldUnits(
    [measuredWaterCapacitySpec],
    system,
    (update) => setMeasured((f) => update(f)),
    fixedFieldText,
  )
  useFieldUnits(
    [firearmMassSpec],
    system,
    (update) => setGunFields((f) => update(f)),
    fixedFieldText,
  )
  const fields = form.values

  /**
   * Writes that complete the start of a new load (the defaults, the first seating) are no edit: a
   * load nothing was changed in, with no record yet, stays unchanged for the File menu.
   */
  function keepClean(complete: boolean | undefined, write: () => void) {
    const menu = fileMenu.current
    const clean = complete && menu && menu.id() === undefined && !menu.snapshot().unsaved
    write()
    if (clean) menu.restore({ ...menu.snapshot(), initial: undefined, unsaved: false })
  }

  /** An input changed: a running request stops, a shown result is marked. */
  function markChanged() {
    if (running.current && !running.current.signal.aborted) {
      running.current.abort()
      setStatus('')
    }
    setChanged(true)
    setEdits((n) => n + 1)
  }

  /**
   * The seated bullet changed: volume and travel follow it while they are empty or still hold its
   * last value (or already its new one, as the example's); a typed value stays.
   */
  function follow(values: Seated) {
    setSeated(values)
    // the first seating reported is the start, also when the bullet seats without volume or travel;
    // the preview reseating itself (a new bullet shape or range) starts again there
    const reported = seatingOf(values)
    if (reported) setSeatingStart((s) => (values.atStart ? reported : (s ?? reported)))
    // no bullet seated for now (a record loading): what follows the seating keeps following it
    if (values.volume === undefined && values.travel === undefined) return
    const now = form.getValues()
    const { next, following } = followPlan(values, now, {
      followed,
      written: written.current,
      previewed,
      field: seatedField,
    })
    if (Object.keys(next).length > 0) markChanged()
    // a value that already was the seated one (the example's) takes the seating's text: same SI value
    const seatedText = withSeatedText(now, following)
    const update = seatedUpdate(next, seatedText, now)
    // setValues clears every field's error: only when a field changes
    if (Object.keys(update).length > 0)
      keepClean(isStartSeating(values, suggestions), () => form.setValues(update))
    setPreviewed(following)
  }

  // the display decimals, travel in the workbench decimals, so a seated value fits
  // its field; the SI value stays exact
  const seatedField = (k: PreviewKey, v: number): FieldValue => ({
    text: k === 'volume' ? formatQuantity('capacity', system, v) : lengthText('travel', system, v),
    si: v,
  })

  /** `fields` with volume and travel that follow the seated bullet in the seating's text. */
  const withSeatedText = <F extends Partial<Record<PreviewKey, FieldValue>>>(
    fields: F,
    seatedValues = previewed,
  ): F => {
    const next = { ...fields }
    for (const k of previewKeys) {
      const si = fields[k]?.si
      if (si !== undefined && si === seatedValues[k]) next[k] = seatedField(k, si) as F[PreviewKey]
    }
    return next
  }

  /** A typed volume or travel takes the seated bullet's value again and follows it from then on. */
  function takeSeated(k: PreviewKey) {
    const v = seated[k]
    if (v === undefined) return
    markChanged()
    form.setFieldValue(k, seatedField(k, v))
    form.clearFieldError(k)
    setPreviewed((p) => ({ ...p, [k]: v }))
  }

  /** Shows ladder step `i` in the readouts, warnings and chart; a step without a result is skipped. */
  const select = useCallback(
    (i: number) => {
      if (outcome?.kind === 'ok' && outcome.steps[i]?.body) {
        showChart(undefined)
        const shown = { ...atStep(outcome, i), announce: false }
        setOutcome(shown)
        setStatus({ prefix: '' })
      }
    },
    [outcome, showChart],
  )

  /** A new request for a record kind; aborts the one before. */
  function pick(kind: 'cartridges' | 'bullets' | 'powders') {
    picking.current[kind]?.abort()
    const controller = new AbortController()
    picking.current[kind] = controller
    return controller.signal
  }

  /**
   * Record ids asked for and not loaded yet, or not reachable (`failed`): the load keeps them, so
   * a Save never drops an id only because its record could not be fetched.
   */
  const [asked, setAsked] = useState<Asked>({})
  const want = (k: Kind, id: string) => setAsked((a) => ({ ...a, [k]: { id } }))
  const got = (k: Kind) =>
    setAsked((a) => {
      const { [k]: _, ...rest } = a
      return rest
    })
  const lost = (k: Kind, id: string) =>
    setAsked((a) => (a[k]?.id === id ? { ...a, [k]: { id, failed: true } } : a))
  /** The record ids of the link the schema refuses, left out of the load (`droppedIds`). */
  const [dropped, setDropped] = useState<string[]>([])
  /** What a link carried of its bullet and powder records, with their ids. */
  const [linked, setLinked] = useState<{ bullet?: LinkedBullet; powder?: LinkedPowder }>({})
  // the link's values while its record is asked for, loading or missing
  const linkedBullet = pendingLink(bullet, asked.bullet?.id, linked.bullet)
  const linkedPowder = pendingLink(powder, asked.powder?.id, linked.powder)
  /** The bullet length a run reads, mm: the record's, else the link's. */
  const bulletLength = bulletLengthOf(bullet, linkedBullet)

  function reset() {
    setCustomName(undefined)
    setAsked({})
    setDropped([])
    setLinked({})
    setByHand(false)
    running.current?.abort()
    bandRequest.current?.abort()
    picking.current.cartridges?.abort()
    picking.current.bullets?.abort()
    picking.current.powders?.abort()
    form.reset()
    setFirearm(undefined)
    const d = readDefaults()
    setDefaults(d)
    setDefaulted(new Set(defaultKeys))
    setFollowed(new Set(followKeys))
    written.current = {}
    form.setValues(exampleFields(interiorFields, d, system, fixedFieldText))
    setCartridgeRecord(undefined)
    setCartridgeDesign(undefined)
    setBullet(undefined)
    setBulletDesign(undefined)
    setBulletNote('')
    setAllDiameters(false)
    setPowder(undefined)
    setOrigin(undefined)
    setOutcome(undefined)
    showChart(undefined)
    setChanged(false)
    setStatus('')
    setPreviewInitial(undefined)
    setSeated({})
    setSeatingStart(undefined)
    setPreviewed({})
    setMeasured({ measuredWaterCapacity: emptyStep })
    setMeasuredFor(undefined)
    setCapacityChoice(undefined)
    openingCapacity.current = undefined
    setGunFields({ firearmMass: emptyStep })
    gunFromFirearm.current = false
    gunPending.current = false
    setSearchKey((k) => k + 1)
    setLadderSteps(1)
    setLadder({ ladderStep: emptyStep })
    setLadderKind('charge')
    setSeatStep({ seatStep: emptyStep })
    setTempStep({ tempStep: emptyStep })
    setLadderError(undefined)
    setDirection('up')
    sessionsOpened.current++
    sessionsNow.current = []
    setSessionsState([])
    setSessionRefs([])
    lastWarnings.current = ''
  }

  const fileMenu = useRef<FileMenuHandle>(null)
  const trajectory = useRef<TrajectoryHandle>(null)
  /** Runs `f`, which starts a new load, once the File menu has started a new record. */
  const asNewLoad = (f: () => unknown) => () => {
    if (!fileMenu.current) return f()
    fileMenu.current.startNew(undefined, f)
  }

  function fillExample() {
    reset()
    form.setValues(exampleFields(interiorFields, loadExample.interior, system, fixedFieldText))
    setDefaulted(new Set())
    setFollowed(new Set())
    setCartridge(loadExample.cartridge)
    void chooseBullet(loadExample.bulletId, false)
    // the example's fields already hold the record's model parameters: no refill
    void choosePowder(loadExample.powderId, false)
    setFirearm(loadExample.firearm.id)
    gunFromFirearm.current = true
    setGunFields({
      firearmMass: {
        text: fixedFieldText('firearmMass', system, loadExample.firearmMass),
        si: loadExample.firearmMass,
      },
    })
    setLadderSteps(loadExample.ladder.steps)
    setLadder({
      ladderStep: {
        text: fixedFieldText('charge', system, loadExample.ladder.step),
        si: loadExample.ladder.step,
      },
    })
    setDirection(loadExample.ladder.direction)
    setPreviewInitial(loadExample.seating)
    setMeasured({
      measuredWaterCapacity: {
        text: fixedFieldText('capacity', system, loadExample.waterCapacity),
        si: loadExample.waterCapacity,
      },
    })
    setMeasuredFor(loadExample.cartridge.id)
    setSeatStep({
      seatStep: {
        text: fixedFieldText('length', system, loadExample.seatStep),
        si: loadExample.seatStep,
      },
    })
  }

  function chooseCartridge(c: CartridgeChoice) {
    // a cartridge still loading for a link or file is not the load's any more
    picking.current.cartridges?.abort()
    got('cartridge')
    markChanged()
    setCartridge(c)
    setBulletNote('')
    const fit = fitOf(c)
    if (bullet && fit && !bulletFits(bullet.diameter.value, fit)) {
      setBullet(undefined)
      setBulletNote(
        `Bullet record ${productLabel(bullet, names)} cleared: its diameter ${mmLength(system, bullet.diameter.value)} does not fit ${c.name} (over ${mmLength(system, bulletWindow(fit).above)}, up to G1 ${mmLength(system, fit.g1)}); the bullet mass stays as typed.`,
      )
    }
    // the earlier cartridge's seating is gone; fields that followed it take the new one's. The same
    // cartridge keeps its preview and its initial seating, so it keeps the seating and its start
    if (c.id !== cartridge?.id) {
      setPreviewInitial(undefined)
      setSeated({})
      setSeatingStart(undefined)
    }
  }

  /** Loads a cartridge record as the load's cartridge (a cartridge record page's link). */
  function loadCartridge(id: string) {
    const signal = pick('cartridges')
    want('cartridge', id)
    return fetchRecord<CartridgeDetail>('cartridges', id, signal)
      .then((c) => {
        if (signal.aborted) return
        if (!c) return lost('cartridge', id)
        chooseCartridge(cartridgeChoice(c))
      })
      .catch(() => {
        if (!signal.aborted) lost('cartridge', id)
      })
  }

  /** Loads a bullet record; `fill` writes its mass into the Bullet mass field. */
  function chooseBullet(id: string, fill = true) {
    const signal = pick('bullets')
    want('bullet', id)
    return fetchRecord<Bullet>('bullets', id, signal)
      .then((b) => {
        if (signal.aborted) return
        if (!b) return lost('bullet', id)
        got('bullet')
        setBullet(b)
        setBulletDesign(undefined)
        setBulletNote('')
        if (!fill) return
        markChanged()
        const mass = toSi('mass', b.mass.value)
        form.setFieldValue('bulletMass', {
          text: fixedFieldText('mass', unitsNow.current, mass),
          si: mass,
        })
      })
      .catch(() => {
        if (signal.aborted) return
        lost('bullet', id)
        setStatus(notReached)
      })
  }

  /**
   * Loads a powder record; `fill` writes its model parameters into the fields, except the `keep`
   * ones (the values an opened load carries).
   */
  function choosePowder(id: string, fill = true, keep: ReadonlySet<string> = new Set()) {
    const signal = pick('powders')
    want('powder', id)
    return fetchRecord<Powder>('powders', id, signal)
      .then((p) => {
        if (signal.aborted) return
        if (!p) return lost('powder', id)
        got('powder')
        markChanged()
        setPowder(p)
        const values = powderModelValues(p)
        const previous = originNow.current
        setOrigin(values)
        if (fill && !values && previous) {
          // a record without model parameters: what the previous record filled and the user did not
          // edit goes back to a new load's state (the cited default, else empty)
          const back = revertRecordFill(form, previous, defaults, unitsNow.current)
          setDefaulted((s) => new Set([...s, ...back]))
        }
        if (!fill || !values) return
        const filledKeys = fillRecordValues(form, values, keep, unitsNow.current)
        setDefaulted((s) => new Set([...s].filter((k) => !filledKeys.has(k))))
      })
      .catch(() => {
        if (signal.aborted) return
        lost('powder', id)
        setStatus(notReached)
      })
  }

  /** Why a seating ladder cannot run: no seating, or a volume or travel typed over it. */
  const typedKeys = previewKeys.filter(
    (k) => seated[k] !== undefined && fields[k]?.si !== previewed[k],
  )
  const seatingBlock = seatingBlockOf(seatAt, typedKeys)

  /** The steps of the seating ladder from the seating field, or what stops it, in the shown units. */
  function seatingPlan(shown = system) {
    const start = seatAt && seated[seatAt.lengthKind]
    const step = seatStep.seatStep.si
    if (!seatAt || step === undefined)
      return { error: seatingBlock ?? `${seatingStepSpec.label} is empty.` }
    const show = (m: number) => withUnit('length', shown, m)
    return seatingLadder(seatAt, start, step, ladderSteps, direction, show)
  }

  /** Why a temperature ladder cannot run: the powder record has no temperature sensitivity. */
  const temperatureBlock = temperatureLadderBlockReason(
    powderLabel,
    powder?.temperatureSensitivity !== undefined,
  )

  /** The propellant temperatures of the temperature ladder from the Powder temperature field, or what stops it. */
  function temperaturePlan(shown = system) {
    const step = tempStep.tempStep.si
    if (step === undefined) return { error: `${temperatureStepSpec.label} is empty.` }
    return temperatureLadder(fields.propellantTemperature.si, step, ladderSteps, direction, (k) =>
      withUnit('temperature', shown, k),
    )
  }

  /** The ladder step size's error; none while the charge runs alone. */
  function stepError(shown = system) {
    if (ladderSteps < 2) return
    const [spec, v] = ladderStepField(ladderKind, {
      seat: seatStep,
      temp: tempStep,
      charge: ladder,
    })
    const own = ownStepError(spec, v, shown)
    if (own || ladderKind === 'charge') return own
    const blocked = ladderKind === 'temperature' ? temperatureBlock : seatingBlock
    if (blocked) return blocked
    const plan = ladderKind === 'temperature' ? temperaturePlan(shown) : seatingPlan(shown)
    return 'error' in plan ? plan.error : undefined
  }

  /** Validates and sends; false when a field is invalid (it then gets focus). */
  function run() {
    let invalid = false
    flushSync(() => {
      const { hasErrors, errors } = form.validate()
      // an invalid model parameter on a phone: the group opens, so focus can reach it
      if (modelFields.some((k) => errors[k])) setModelShown(true)
      if (powderMoreFields.some((k) => errors[k])) setMore('powder')
      const ladderInvalid = stepError()
      setLadderError(ladderInvalid)
      // the seating ladder's reasons are about the seating, not about one field: the status line names them too
      if (ladderInvalid && ladderKind !== 'charge') setStatus(ladderInvalid)
      invalid = hasErrors || ladderInvalid !== undefined
      // on phones the field sits in the Load tab, which is hidden while Results is open
      if (invalid) workspace.current?.showInputs()
    })
    if (invalid) {
      const focus = () =>
        inputs.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      focus()
      // a panel opening with motion stays display:none until Mantine's collapse starts in a frame
      // callback; two frames later it has started, whatever order the callbacks were queued in
      requestAnimationFrame(() => requestAnimationFrame(focus))
      return false
    }
    void send()
    return true
  }

  /**
   * The `POST /interior` body of the fields with the powder record's bore resistance, its bulk
   * density (g/cm3) and the resistance parameters it lacks; throws on an invalid field. The Run and
   * the charge target dialog both read it, so both simulate the same load. `as` is the load with
   * another powder record chosen (its model parameters over the fields, as `choosePowder` writes
   * them) and optionally another charge (kg): the Powders tab's runs. The chosen powder itself keeps
   * the fields as they stand (edited or opened parameters). `recordInputs` lists what the records'
   * bore resistance reads besides the body: the key of the Powders tab's rows.
   */
  function loadRequest(as?: { powder: Powder; charge?: number }) {
    const chosen = as?.powder ?? powder
    const values = powderValues(siValues(fields), powder, as)
    const body = interiorBody(
      { ...values, boreArea: values.boreArea ?? qM },
      cartridge?.id,
      grooveM,
    )
    // a missing powder record: the bulk density (kg/m3) and the bore resistance its link carried
    const fromLink = as ? undefined : linkedPowder
    const bulkDensity = chosen?.bulkDensity
      ? toSi('density', chosen.bulkDensity.value)
      : fromLink?.bulkDensity
    const { resistance, missing } = resistanceFor({
      chosen,
      fromLink,
      cartridge,
      groove,
      body,
      bulletLength,
    })
    // the typed friction and engraving values replace the record's terms
    const applied = overrideResistance(resistance, values)
    if (applied) body.load.resistance = applied
    const sensitivity = chosen?.temperatureSensitivity
    if (sensitivity)
      body.load.propellant.temperatureSensitivity = {
        reference: sensitivity.reference.value,
        cold: sensitivity.cold.value,
        hot: sensitivity.hot.value,
      }
    const resistanceMissing =
      chosen && missing.length > 0 ? { powder: productLabel(chosen, names), missing } : undefined
    const recordInputs = [
      powder?.id,
      bulletLength,
      cartridge?.g1,
      groove?.id === cartridge?.id ? groove?.z : undefined,
    ]
    return { body, bulkDensity, resistanceMissing, recordInputs }
  }

  /** Writes a charge (kg) into the charge field, as typed. */
  function applyCharge(si: number) {
    markChanged()
    form.setFieldValue('charge', { text: fixedFieldText('charge', unitsNow.current, si), si })
    form.clearFieldError('charge')
  }

  /** Shows what stopped a run before it was sent: the field a value error names, else the text. */
  function loadFailed(err: unknown) {
    // engraving values that need each other: the empty one shows the message
    if (err instanceof ValueError) {
      form.setFieldError(err.field, err.message)
      if ((powderMoreFields as readonly string[]).includes(err.field)) setMore('powder')
    }
    setOutcome(undefined)
    setStatus(errorText(err))
  }

  /** Shows the first step with a result and starts the request for its sampled band. */
  function showOk(a: {
    body: ReturnType<typeof interiorBody>
    steps: Step[]
    first: number
    plan: Partial<Step>[] | undefined
    bulkDensity: number | undefined
    resistanceMissing: Extract<Outcome, { kind: 'ok' }>['resistanceMissing']
    table: string | undefined
    gasFactorNote: string | undefined
  }) {
    const { body, steps, first, plan } = a
    runs.current += 1
    const ok = {
      kind: 'ok' as const,
      body: steps[first].body as InteriorResponse,
      load: stepLoad(body.load, steps[first]),
      steps,
      selected: first,
      direction,
      ladder: ladderOf(plan, ladderKind, seatAt?.lengthKind),
      at: new Date().toLocaleTimeString('en-GB'),
      id: runs.current,
      bulkDensity: a.bulkDensity,
      cartridge: body.cartridge,
      powderChosen: powder !== undefined || linkedPowder !== undefined,
      resistanceMissing: a.resistanceMissing,
      design: bulletDesign?.name,
      cartridgeDesign: cartridgeDesign?.name,
      identity: identityOf({
        cartridge,
        cartridgeDesign,
        bulletLabel,
        bulletDesign,
        linkedBullet,
        powderLabel,
        linkedPowder,
      }),
      printed: {
        seated,
        firearm: firearmList.find((f) => f.id === firearm)?.name,
        firearmMass: gunWeightUsed.si,
        gasFactor: gasFactorOf(a.table),
        gasFactorNote: a.gasFactorNote,
        fromSeating: fromSeatingOf(seated, fields, previewed),
      },
      announce: false,
    }
    const warnings = derived(ok).warnings.join('\n')
    ok.announce = warnings !== '' && warnings !== lastWarnings.current
    lastWarnings.current = warnings
    showChart(undefined)
    setOutcome(ok)
    setStatus({ prefix: 'Simulation done. ' })
    // the sampled band of the step shown first follows the result: it takes up to its time budget
    const bandController = new AbortController()
    bandRequest.current = bandController
    void fetchBand(
      { ...body, load: stepLoad(body.load, steps[first]), sampling: {} },
      bandController.signal,
    ).then((sampled) => {
      if (!bandController.signal.aborted) setOutcome((o) => withBand(o, ok.id, first, sampled))
    })
  }

  async function send() {
    running.current?.abort()
    bandRequest.current?.abort()
    let req: ReturnType<typeof loadRequest>
    try {
      req = loadRequest()
    } catch (err) {
      loadFailed(err)
      return
    }
    const { body } = req
    // a seating or temperature ladder is one single run per step, each with its own volume and
    // travel, or its own propellant temperature
    const planned = plannedLadder(ladderSteps, ladderKind, {
      seating: seatingPlan,
      temperature: temperaturePlan,
      temperatureBlock,
    })
    if (planned && 'error' in planned) {
      setOutcome(undefined)
      setStatus(planned.error)
      return
    }
    const plan = planned && planRows(ladderKind, planned.steps)
    const request = ladderRequest(body, plan, ladderSteps, ladder.ladderStep.si, direction)
    const controller = new AbortController()
    running.current = controller
    setPending(true)
    setStatus('Simulating')
    try {
      await simulate(req, plan, request, controller.signal)
    } catch {
      if (!controller.signal.aborted) showUnreached()
    } finally {
      if (running.current === controller) setPending(false)
    }
  }

  /** Sends the run's request or ladder and shows the first step with a result, or the error. */
  async function simulate(
    req: ReturnType<typeof loadRequest>,
    plan: Partial<Step>[] | undefined,
    request: unknown,
    signal: AbortSignal,
  ) {
    const { body } = req
    // the free recoil's gas factor needs the cartridge's CIP table: wait for a record still loading
    const { table, gasFactorNote } = await tableOf(cartridge, groove, recordTable, signal)
    if (signal.aborted) return
    const answer = await runRequest(plan, request, body, signal)
    if (!answer) return
    setChanged(false)
    const { res, json, steps } = answer
    const first = firstStep(steps, direction === 'around')
    if (first >= 0) {
      showOk({ ...req, steps, first, plan, table, gasFactorNote })
      return
    }
    const failed = failedRun(steps, res, json)
    setOutcome(failed.outcome)
    setStatus(failed.text)
  }

  /** A request that never got an answer: the API is unreachable, or the browser is offline. */
  function showUnreached() {
    setChanged(false)
    const offline = !navigator.onLine
    setOutcome({ kind: 'error', status: 502, body: undefined, retryAfter: null, offline })
    setStatus(offline ? needsNetwork : notReached)
  }

  // the cartridge record's groove diameter, for the bore resistance of a fitted powder
  useEffect(() => {
    const id = cartridge?.id
    if (!id) return
    const controller = new AbortController()
    fetchRecord<CartridgeDetail>('cartridges', id, controller.signal)
      .then(
        (c) =>
          c &&
          setGroove({
            id,
            z: cartridgeGrooveDiameterMm(c),
            record: c,
          }),
      )
      .catch(() => {})
    return () => controller.abort()
  }, [cartridge?.id])

  // a run asked for by the link, after the render that holds the filled values
  const [runWhenFilled, setRunWhenFilled] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the link asked for it
  useEffect(() => {
    // a record arriving later marks the load changed and would abort the run: wait for them all
    const loading = Object.values(asked).some((a) => a && !a.failed)
    // the run keeps the seated figure the chart's barrel strip draws; the example seats its bullet
    if (!runWhenFilled || fields.charge.si === undefined || loading || !seated.figure) return
    setRunWhenFilled(false)
    run()
  }, [runWhenFilled, fields, asked, seated.figure])

  /**
   * The shown result of a load that comes back in its tab: put back once the records of the
   * load have arrived, since each arriving record marks the load changed.
   */
  const restoring = useRef<{ outcome: Outcome | undefined; changed: boolean }>(undefined)
  const restoreResult = (outcome: Outcome | undefined, wasChanged: boolean) => {
    restoring.current = { outcome, changed: wasChanged }
  }
  useEffect(() => {
    const r = restoring.current
    if (!r || Object.values(asked).some((a) => a && !a.failed)) return
    restoring.current = undefined
    setOutcome(r.outcome)
    setChanged(r.changed)
  }, [asked])

  // a copied link fills the form once
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on mount only
  useEffect(() => {
    const query = linkParams(window.location)
    const link = linkedLoad(query)
    setDropped(droppedIds(query))
    // a link with `tab` opens that result tab (the Trajectory tab's inputs follow under `tab.`)
    const linked = resultTabs.find(([v]) => v === query.get('tab'))?.[0]
    if (linked) {
      setTab(linked)
      setSeen((s) => new Set([...s, linked]))
    }
    // /workbench?preset=example opens the example, &run=1 runs it once filled (quick testing)
    if (query.get('preset') === 'example' && loadExample) {
      asNewLoad(fillExample)()
      if (query.get('run') === '1') setRunWhenFilled(true)
    }
    // a linked load is the record the page starts with, not unsaved work
    else if (link?.kind === 'values') asNewLoad(() => fill(query))()
    // "Use in workbench" on a record page: a new load with the cartridge, filled from the bullet's
    // mass and the powder's model parameters, unsaved only after edits to what the records filled
    else if (link?.kind === 'records')
      asNewLoad(() => {
        fill(new URLSearchParams())
        return Promise.all([
          link.cartridge && loadCartridge(link.cartridge),
          link.bullet && chooseBullet(link.bullet),
          link.powder && choosePowder(link.powder),
        ])
      })()
    else startFromDefaults()
  }, [])

  // a copied link pasted into this tab changes the fragment only, which loads no page: reload it
  useEffect(() => {
    const open = () => {
      if (new URLSearchParams(window.location.hash.slice(1)).has('units')) window.location.reload()
    }
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [])

  /** Tuned defaults start a new record, so a fresh page holds no unsaved work. */
  function startFromDefaults() {
    const d = readDefaults()
    if (defaultsText(d) === undefined) return
    asNewLoad(() => {
      setDefaults(d)
      form.setValues(exampleFields(interiorFields, d, system, fixedFieldText))
    })()
  }

  /**
   * Fills the form and the cartridge from a link's query or an opened file; a defaulted field a link
   * leaves out gets the default, a file opens as saved.
   */
  function fill(query: URLSearchParams, withDefaults = true) {
    const d = readDefaults()
    const { linked, missing } = linkedFieldsOf(query, system, d, withDefaults)
    setDefaults(d)
    setDefaulted(new Set(missing))
    // a link follows the defaults of the fields it leaves out; a file opens as saved
    setFollowed(new Set(withDefaults ? followKeys.filter((k) => linked[k].si === undefined) : []))
    form.setValues(linked)
    // a linked value outside its bounds shows as written with its error
    form.setErrors(fieldErrorsOf(linked, system))
    const queried = queryLadder(query, system)
    if (queried) applyLadder(queried)
    fillGunAndSeating(query)
    fillRecords(query)
  }

  /** The ladder a link carries: its step count, kind, step size and direction. */
  function applyLadder(l: NonNullable<ReturnType<typeof queryLadder>>) {
    setLadderSteps(l.steps)
    setLadderKind(l.kind)
    if (l.kind === 'seating') setSeatStep({ seatStep: l.ladderStep })
    else if (l.kind === 'temperature') setTempStep({ tempStep: l.ladderStep })
    else setLadder({ ladderStep: l.ladderStep })
    setDirection(l.direction)
  }

  /**
   * The firearm, the measured case capacity and the seating of a link; the seated bullet takes the
   * seating once its records load.
   */
  function fillGunAndSeating(query: URLSearchParams) {
    // an id longer than the load file allows would make Save write a file Open rejects
    const firearmId = query.get('firearm')
    if (firearmId && firearmId.length <= 64) setFirearm(firearmId)
    gunFromFirearm.current = false
    const { firearmMass } = queryFields(query, [firearmMassSpec], system, fixedFieldText)
    setGunFields({ firearmMass: (firearmMass.si ?? 0) > 0 ? firearmMass : emptyStep })
    const own = queryFields(query, [measuredWaterCapacitySpec], system, fixedFieldText)
    if ((own.measuredWaterCapacity.si ?? 0) > 0) {
      setMeasured(own)
      setMeasuredFor(linkedId(query.get('cartridge')))
    }
    const by = seatingKeyOf(query)
    if (by) setPreviewInitial({ seating: { by, value: Number(query.get(by)) } })
  }

  /**
   * The records of a link come without their fills: the linked values stay, and what the link
   * carried of the records stands in for one that is missing.
   */
  function fillRecords(query: URLSearchParams) {
    // an id that does not fit the schema is dropped, else every Save fails on it
    const bulletId = linkedId(query.get('bullet'))
    if (bulletId) void chooseBullet(bulletId, false)
    const powderId = linkedId(query.get('powder'))
    if (powderId) void choosePowder(powderId, false)
    setLinked(carriedRecords(recordValues(query), bulletId, powderId))
    const id = linkedId(query.get('cartridge'))
    if (!id) return
    const signal = pick('cartridges')
    want('cartridge', id)
    fetchRecord<CartridgeDetail>('cartridges', id, signal)
      .then((c) => {
        if (signal.aborted) return
        if (!c) return lost('cartridge', id)
        got('cartridge')
        setCartridge(cartridgeChoice(c))
      })
      .catch(() => {
        if (!signal.aborted) lost('cartridge', id)
      })
  }

  /** The cartridge design `ref` (`user:<id>`) of an opened file; kept in the load, as asked, when it does not resolve. */
  function openCartridgeDesign(ref: string) {
    const signal = pick('cartridges')
    want('cartridge', ref)
    const id = parseRef(ref)?.id ?? ''
    storedRecord(id)
      .then(async (raw) => {
        const r = userRecord.safeParse(raw)
        const resolved =
          r.success && r.data.kind === 'cartridge' && (await resolveCartridge(r.data.data, signal))
        if (signal.aborted) return
        if (!r.success || r.data.kind !== 'cartridge' || !resolved) return lost('cartridge', ref)
        const d = { id, name: r.data.name, data: r.data.data, resolved }
        if (workbenchDesign(d.data, resolved, d.name, unitsNow.current))
          takeCartridgeDesign(d, false)
        else lost('cartridge', ref)
      })
      .catch(() => {
        if (!signal.aborted) lost('cartridge', ref)
      })
  }

  /** The bullet design `ref` (`user:<id>`) of an opened load; `fill` writes its mass into the Bullet mass field. */
  function openBulletDesign(ref: string, fill: boolean) {
    const signal = pick('bullets')
    want('bullet', ref)
    const id = parseRef(ref)?.id ?? ''
    storedRecord(id)
      .then(async (raw) => {
        const r = userRecord.safeParse(raw)
        const resolved =
          r.success && r.data.kind === 'bullet' && (await resolveBullet(r.data.data, signal))
        if (signal.aborted) return
        if (!r.success || r.data.kind !== 'bullet' || !resolved || resolved.problem)
          return lost('bullet', ref)
        const mass = resolved.record.mass && toSi('mass', resolved.record.mass.value)
        takeBulletDesign({ id, name: r.data.name, si: { mass } }, fill)
      })
      .catch(() => {
        if (!signal.aborted) lost('bullet', ref)
      })
  }

  /**
   * The case capacity `ref` of an opened load for the cartridge reference `forCartridge`: a
   * catalogue record is chosen in the figure, a user record of that cartridge is the measured
   * capacity and fills its field. A user record the store does not answer, or one of another
   * cartridge, stays in the load as asked.
   */
  function openCapacity(ref: string, forCartridge: string | undefined) {
    const target = parseRef(ref)
    if (!target) return
    const cartridgeId = forCartridge && parseRef(forCartridge)?.id
    if (!cartridgeId) {
      // no cartridge to apply it to: the request stays in the load
      want('capacity', ref)
      return lost('capacity', ref)
    }
    if (target.scope === 'catalogue')
      return setCapacityChoice({ cartridge: cartridgeId, id: target.id })
    openingCapacity.current = ref
    want('capacity', ref)
    storedRecord(target.id)
      .then((raw) => {
        if (openingCapacity.current !== ref) return
        const grams = capacityOfRecord(raw, forCartridge)
        if (grams === undefined) return lost('capacity', ref)
        const si = waterVolume(grams)
        setMeasured({
          measuredWaterCapacity: { text: fixedFieldText('capacity', unitsNow.current, si), si },
        })
        setMeasuredFor(cartridgeId)
        got('capacity')
      })
      .catch(() => {
        if (openingCapacity.current === ref) lost('capacity', ref)
      })
  }

  /** A capacity chosen in the figure replaces the one the opened load still asks for. */
  function chooseCapacity(choice: { cartridge: string; id: string }) {
    openingCapacity.current = undefined
    got('capacity')
    setCapacityChoice(choice)
  }

  /**
   * A measured capacity typed in the field replaces the one the opened load still asks for; while
   * the text is not a number yet the request stays in the load as not loaded.
   */
  function typeMeasured(value: FieldValue) {
    openingCapacity.current = undefined
    if (value.si !== undefined || value.text.trim() === '') got('capacity')
    else setAsked((a) => (a.capacity ? { ...a, capacity: { id: a.capacity.id, failed: true } } : a))
    setMeasured({ measuredWaterCapacity: value })
  }

  /**
   * The sessions `refs` of an opened load, read from the store. The load keeps every reference, so
   * a Save never drops one only because its record is not in this browser (a catalogue session, or
   * a session of another browser).
   */
  function openSessions(refs: string[]) {
    setSessionRefs(refs)
    const token = ++sessionsOpened.current
    Promise.all(
      refs.map(async (ref) => {
        const target = parseRef(ref)
        if (target?.scope !== 'user') return
        const r = userRecord.safeParse(await storedRecord(target.id).catch(() => undefined))
        return r.success && r.data.kind === 'session' ? r.data : undefined
      }),
    )
      .then((found) => {
        if (sessionsOpened.current !== token) return
        const list = found.filter((r) => r !== undefined)
        // a file read while the store answered stays
        const added = sessionsNow.current.filter((r) => !list.some((x) => x.id === r.id))
        sessionsNow.current = [...list, ...added]
        setSessionsState(sessionsNow.current)
      })
      .catch(() => {})
  }

  /**
   * An opened load: the form from its typed values, the records it names from their own. A value
   * the load does not carry follows the Settings, the records, the gun and the seating.
   */
  function openLoad(d: Load) {
    reset()
    const { query, typed, sessions } = fromLoad(d)
    const cartridgeId = catalogueIdIn(d.cartridge)
    if (cartridgeId) query.set('cartridge', cartridgeId)
    const firearmKey = userFirearmOf(d.firearm)
    if (firearmKey) query.set('firearm', firearmKey)
    fill(query)
    // the weight of a firearm of the library comes from the firearm once it is read
    gunPending.current = firearmKey !== undefined && !typed.has('firearmMass')
    setOpens((n) => n + 1)
    // a user cartridge or bullet is a record of this browser, read and resolved here
    const userCartridge = userCartridgeOf(d.cartridge)
    if (userCartridge) openCartridgeDesign(userCartridge)
    if (d.capacity) openCapacity(d.capacity, d.cartridge)
    openBullet(d.bullet, !typed.has('bulletMass'))
    const powderId = catalogueIdIn(d.powder)
    if (powderId) void choosePowder(powderId, true, typed)
    setNotes(d.note ?? '')
    openSessions(sessions)
  }

  /** The bullet of an opened load: a catalogue record is chosen, a design of this browser is read. */
  function openBullet(ref: unknown, fillMass: boolean) {
    const bulletRef = typeof ref === 'string' ? ref : undefined
    const id = bulletRef && catalogueIdOf(bulletRef)
    if (id) void chooseBullet(id, fillMass)
    else if (bulletRef) openBulletDesign(bulletRef, fillMass)
  }

  const seating = keptSeating(seated, seatingStart, previewInitial?.seating, system)
  const cartridgeKey = cartridgeKeyOf(cartridge, cartridgeDesign, asked.cartridge)
  const measuredWaterCapacity = measuredCapacityOf(measuredFor, cartridgeKey, measured)
  const chosenCapacity = chosenCapacityOf(capacityChoice, cartridgeKey)

  const activeStep = ladderStepField(ladderKind, {
    seat: seatStep,
    temp: tempStep,
    charge: ladder,
  })[1]
  /**
   * The reference a load keeps: the record being loaded (`asked`, kept too when it did not resolve),
   * else a user design of this browser, else the catalogue record `id`.
   */
  const savedRef = (
    asked: string | undefined,
    design: string | undefined,
    id: string | undefined,
  ) =>
    asked ? catalogueRef(asked) : (design && userRef(design)) || (id ? catalogueRef(id) : undefined)
  const opening = useRef(openLoad)
  opening.current = openLoad
  /** An opened load: `name` is the stored name of a record, kept as the typed one. */
  const onOpenFile = useCallback((d: Load, name?: string) => {
    opening.current(d)
    setCustomName(name)
  }, [])
  const onStored = useCallback(() => setStoredTick((n) => n + 1), [])
  const unresolved = (['cartridge', 'bullet', 'powder', 'capacity'] as const).flatMap((k) =>
    asked[k]?.failed ? [`${k} ${asked[k].id}`] : [],
  )

  /** A field's value with the display decimals, for the record lines; undefined when not valid. */
  const shown = (key: string, q: Parameters<typeof formatQuantity>[0]) => {
    const si = fields[key]?.si
    if (si === undefined || !Number.isFinite(si)) return
    return q === 'length' ? shownLength('travel', system, si) : withUnit(q, system, si)
  }

  const generated = generatedName({
    cartridge: cartridge?.name ?? cartridgeDesign?.name,
    bullet: bulletLabel ?? bulletDesign?.name,
    powder: powderLabel,
    charge: shown('charge', 'mass'),
  })
  /** The load's name: the typed one, else the generated one; Save names the record and the file by it. */
  const name = loadName(customName, generated)

  /** The bullets that fit the cartridge (`GET /bullets?cartridge`); all without its CIP values or with all diameters on. */
  const { bulletFit, bulletParams } = bulletFilter(allDiameters, cartridge)
  const describeBullet = (b: BulletSummary) =>
    `${productLabel(b, names)}, ${withUnit('mass', system, toSi('mass', b.mass))}, ${withUnit('length', system, toSi('length', b.diameter))}`

  const specValue = (side: string | undefined, symbol: string) =>
    cartridge && groove?.id === cartridge.id
      ? groove.record?.values.find((v) => v.side === side && v.symbol === symbol && !v.variant)
          ?.value
      : undefined
  const mmText = (mm: number | undefined) =>
    mm === undefined ? undefined : shownLength('diameter', system, toSi('length', mm))
  const pmax = specValue(undefined, 'Pmax')

  // the defaults of volume, bore diameter, twist and barrel length from what is chosen
  const gun = firearmList.find((f) => f.id === firearm)
  /** What the chosen cartridge design gives; the design's own values only. */
  const designLoad = useMemo(
    () =>
      cartridgeDesign &&
      workbenchDesign(cartridgeDesign.data, cartridgeDesign.resolved, cartridgeDesign.name, system),
    [cartridgeDesign, system],
  )
  const suggestions: Suggestions = suggestDefaults({
    firearm: gunSource(gun),
    cartridge: cartridgeSource({
      cartridge,
      design: cartridgeDesign,
      designLoad,
      recordTable,
      specValue,
      seated,
      measuredCapacity: measuredWaterCapacity,
    }),
    bullet: bullet && {
      name: productLabel(bullet, names),
      diameter: toSi('length', bullet.diameter.value),
    },
    settingsBarrelLength: defaults.barrelLength,
  })
  // the references the load keeps; one that cannot be written (a design or firearm whose id is no
  // UUID) leaves what it gives in the load as typed values
  const firearmRef = userRefOf(firearm)
  const powderId = asked.powder?.id ?? powder?.id
  const referenced = referencedOf(firearm, firearmRef, cartridgeDesign, bulletDesign)
  const fieldValues: Record<string, number | undefined> = {
    ...Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.si])),
    firearmMass: gunWeightUsed.si,
  }
  const given = givenKeys(fieldValues, {
    origin,
    bulletMass: bulletMassOf(bullet, bulletDesign),
    defaults,
    defaulted,
    followed,
    suggestions: Object.fromEntries(
      followKeys.map((k) => [k, referenced ? suggestions[k]?.si : undefined]),
    ),
    previewed,
    seatingKept: seatingKeptOf(referenced, seated, suggestions),
    gunMass: gunFromFirearm.current && !!firearmRef,
  })
  const cartridgeRef = savedRef(asked.cartridge?.id, cartridgeDesign?.id, cartridge?.id)
  // the measured capacity is a user record of its own, stored with the load (`storeLoad`); a
  // reference asked for and not loaded stays until a capacity is typed or chosen
  const { measuredCapacity, capacityRef } = capacityRefsOf(
    cartridgeRef,
    measuredWaterCapacity,
    asked.capacity?.id,
    chosenCapacity,
  )
  /** Save's browser copy: the load with the capacity record it names. */
  const storeLoad = useCallback(
    async (record: UserRecord) => {
      const c = measuredCapacity
      // the strings mapped to a charge name this load, once it has an id the schema accepts as a reference
      const ref = userRef(record.id)
      const attached = sessionsNow.current.map((s) => attachLoad(s, ref))
      const changed = attached.filter((s, i) => s !== sessionsNow.current[i])
      await putRecords([
        ...(c ? [capacityRecord(c.cartridge, c.m3, new Date())] : []),
        ...changed,
        record,
      ])
      // edits made while the store wrote are kept; the strings they mapped name the load too
      const latest = sessionsNow.current.map((s) => attachLoad(s, ref))
      const late = latest.filter((s, i) => s !== sessionsNow.current[i])
      sessionsNow.current = latest
      setSessionsState(latest)
      if (late.length > 0) await putRecords(late)
      return true
    },
    [measuredCapacity],
  )
  const loadParts: LoadParts = {
    values: fieldValues,
    given,
    cartridge: cartridgeRef,
    firearm: firearmRef,
    bullet: savedRef(asked.bullet?.id, bulletDesign?.id, bullet?.id),
    powder: powderId && catalogueRef(powderId),
    notes,
    capacity: capacityRef,
    seating,
    ladder: ladderPartOf(ladderSteps, ladderKind, activeStep.si, direction),
    sessions: sessionRefs,
  }
  const loadFile = toLoad(loadParts)
  // the file for the API: every value of the moment typed, the catalogue records only
  const apiFile = toApiLoad(loadParts, {
    cartridge: refOf(cartridge),
    bullet: refOf(bullet),
    powder: refOf(powder),
  })
  // the File menu's props stay the same objects while the load is unchanged, so its memo holds and
  // its window listeners keep no earlier render, and with it no earlier result, alive
  const fileKey = JSON.stringify(loadFile)
  const fileData = useMemo(() => JSON.parse(fileKey) as Load, [fileKey])
  const apiKey = JSON.stringify(apiFile)
  const apiData = useMemo(() => JSON.parse(apiKey) as Load, [apiKey])
  /** A followed field's default while it is the field's value; the seating owns the volume once a bullet is seated. */
  const defaultOf = (key: string) => {
    const k = followKeys.find((x) => x === key)
    if (!k || !followed.has(k) || (k === 'volume' && seated.volume !== undefined)) return
    const given = suggestions[k]
    return given && !given.fromFirearm && fields[key]?.si === given.si ? given : undefined
  }
  const suggestionKey = JSON.stringify(followKeys.map((k) => suggestions[k]?.si))
  const seatedVolume = seated.volume !== undefined
  // a followed field takes its default when it changes; what was typed is not in `followed`
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a change of a default or of what follows
  useEffect(() => {
    const writes = followWrites({
      followed,
      seatedVolume,
      now: form.getValues(),
      suggestions,
      written: written.current,
      system,
    })
    if (writes.length > 0)
      keepClean(true, () => {
        for (const [k, value] of writes) {
          form.setFieldValue(k, value)
          form.clearFieldError(k)
        }
      })
  }, [suggestionKey, followed, seatedVolume])
  const bc = bcOf(bullet)

  /** A new load with nothing chosen or typed: the start card replaces the cards. */
  const fresh = isFresh({
    chosen: [cartridge, cartridgeDesign, bullet, bulletDesign, powder, outcome],
    byHand,
    fields,
    defaulted,
  })
  const has = (keys: readonly string[]) => keys.every((k) => fields[k]?.si !== undefined)
  /** What a run still needs, in the order of the cards; the first open one is next. */
  const todo = todoOf({ cartridge, cartridgeDesign, bulletLabel, bulletDesign, powderLabel, has })
  const next = todo.findIndex((s) => !s.done)
  /** The card of the next open step, marked until the first result (as the checklist). */
  const nextPanel = outcome ? undefined : nextPanelOf(next, has(['volume']))

  /**
   * The bore resistance the powder record's law gives for the fields as they stand, under the keys
   * of the fields that can replace it: their placeholders. Undefined without the law, a loaded
   * cartridge record or a bore diameter and start pressure.
   */
  const recordBore = (() => {
    const [d, start] = [fields.boreDiameter?.si, fields.startPressure?.si]
    if (!powder?.interior?.resistance || d === undefined || start === undefined) return
    if (cartridge && groove?.id !== cartridge.id) return
    const { resistance } = recordResistance(powder, {
      boreDiameter: d,
      boreArea: boreArea({
        area: fields.boreArea?.si ?? qM,
        boreDiameter: d,
        grooveDiameter: grooveM,
      }),
      startPressure: start,
      cartridge: cartridge && { g1: cartridge.g1, z: groove?.z },
      bulletLengthMm: bulletLength,
    })
    return {
      boreFriction: resistance?.friction,
      engravingPressure: resistance?.engraving?.[0]?.pressure,
      engravingLength: resistance?.engraving?.at(-1)?.travel,
    }
  })()

  const recordLink = recordLinkOf({
    asked,
    bullet,
    powder,
    names,
    recordBore,
    linkedBullet,
    linkedPowder,
  })

  return {
    allDiameters,
    bc,
    bulletFit,
    bulletParams,
    describeBullet,
    bulletLabel,
    powderLabel,
    fresh,
    mmText,
    nextPanel,
    pmax,
    shown,
    specValue,
    todo,
    asNewLoad,
    bullet,
    bulletDesign,
    bulletNote,
    cartridge,
    cartridgeDesign,
    cartridgeDesigns,
    chooseCartridgeDesign,
    designLoad,
    changed,
    chartSlot,
    chartView,
    choice,
    chooseBullet,
    chooseCartridge,
    chooseDesign,
    chooseFirearm,
    applyCharge,
    choosePowder,
    csvCopied,
    defaulted,
    defaultOf,
    grooveDiameter: grooveM,
    cartridgeBoreArea: qM,
    defaults,
    designs,
    direction,
    fields,
    figureView,
    figureTab,
    setFigureTab,
    apiData,
    fileData,
    fileMenu,
    fillExample,
    generated,
    customName,
    name,
    setCustomName,
    firearm,
    firearmList,
    firearms,
    follow,
    form,
    gunWeight,
    gunWeightUsed,
    setGunWeight,
    framed,
    groove,
    inputs,
    ladder,
    ladderError,
    ladderKind,
    ladderSteps,
    loadRequest,
    markChanged,
    measured,
    measuredFor,
    modelShown,
    more,
    notes,
    chronoSessions,
    onOpenFile,
    onStored,
    online,
    opened,
    origin,
    outcome,
    measuredWaterCapacity,
    capacityId: chosenCapacity,
    setCapacityChoice: chooseCapacity,
    storeLoad,
    pending,
    powder,
    previewInitial,
    previewed,
    printMedia,
    printing,
    setPrinting,
    edits,
    readDesigns,
    reset,
    restoreResult,
    run,
    searchKey,
    seated,
    seatAt,
    seating,
    select,
    setAllDiameters,
    setBulletDesign,
    setByHand,
    setChartView,
    setCsvCopied,
    setDefaulted,
    setFollowed,
    setDirection,
    setFigureView,
    setLadder,
    setLadderError,
    setLadderKind,
    setSeatAt,
    setSeatStep,
    setTempStep,
    seatingBlock,
    seatStep,
    tempStep,
    temperatureBlock,
    setLadderSteps,
    setMeasured,
    typeMeasured,
    setMeasuredFor,
    setModelShown,
    setMore,
    seatingSlots,
    slotRefs,
    recordBore,
    recordLink,
    linkedBullet,
    linkedPowder,
    setNotes,
    setChronoSessions,
    manufacturerRef,
    manufacturerName: manufacturers.nameOf,
    sessionRefCount: sessionRefs.length,
    setSeen,
    setStepsDraft,
    setTab,
    showChart,
    sight,
    suggestions,
    status: statusText(status, outcome && resultLineOf(outcome, system)),
    stepError,
    stepsDraft,
    storedTick,
    system,
    tab,
    takeSeated,
    trajectory,
    unresolved,
    dropped,
    workspace,
  }
}

export type UseWorkbenchStateResult = ReturnType<typeof useWorkbenchState>
