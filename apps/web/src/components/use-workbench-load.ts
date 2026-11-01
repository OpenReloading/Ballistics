'use client'

import { useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import {
  boreArea,
  bulletFits,
  bulletWindow,
  cartridgeBulletDiameterMm,
  cartridgeDiameters,
  cartridgeGrooveDiameterMm,
  gasVelocityFactor,
  type InteriorLoad,
  recordBoreArea,
  recordResistance,
  ValueError,
} from '@open-reloading/core'
import {
  type Bullet,
  type Firearm,
  fromSi,
  type Load,
  type Powder,
  parseRef,
  type SessionRecord,
  type SessionSnapshot,
  toSi,
  type UserRecord,
  userRecord,
} from '@open-reloading/schema'
import { type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from '../i18n/language.ts'
import { english, msg, type Translator } from '../i18n/translate.ts'
import { apiFetch, fetchRecord } from '../lib/api-fetch.ts'
import type {
  BulletSummary,
  CartridgeDetail,
  ErrorBody,
  InteriorResponse,
  SampledBand,
} from '../lib/api-types.ts'
import { runBatch } from '../lib/batch.ts'
import {
  type BulletValues,
  baseTypeKey,
  diameterMm,
  recordBulletValues,
  typedBaseType,
} from '../lib/bullet.ts'
import { lessBullet } from '../lib/bullet-below-mouth.ts'
import { fitOf } from '../lib/bullet-fit.ts'
import { workbenchDesign } from '../lib/cartridge-designer.ts'
import { measuredWaterCapacitySpec } from '../lib/case-capacity.ts'
import { type OwnCase, ownCases } from '../lib/case-group.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { timeText } from '../lib/dates.ts'
import { errorText } from '../lib/error-text.ts'
import { loadExample } from '../lib/example-data.ts'
import { exampleFields } from '../lib/examples.ts'
import {
  type FieldSpec,
  type Fields,
  type FieldValue,
  fieldError,
  siValues,
  specText,
} from '../lib/field-spec.ts'
import type { FigureView } from '../lib/figure-views.ts'
import { gunValues, sightOptions, storedOf } from '../lib/firearm.ts'
import {
  cartridgeClass,
  type DefaultSources,
  type FollowKey,
  followKeys,
  isFollowKey,
  type Suggestion,
  type Suggestions,
  suggestDefaults,
  volumeMeasured,
} from '../lib/input-defaults.ts'
import {
  bulletFields,
  burnFormError,
  type interiorBody,
  interiorFields,
} from '../lib/interior-input.ts'
import { interiorRequest } from '../lib/interior-request.ts'
import {
  dismissed,
  effectiveSnapshots,
  type Lots,
  lotsFrom,
  noLots,
  notesOf,
} from '../lib/load-notes.ts'
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
import { nth } from '../lib/nth.ts'
import { powderValues, recordFill } from '../lib/powder-compare.ts'
import { type PowderDesign, powderDesigns, powderOf } from '../lib/powder-designer.ts'
import { unchangedFromRecord } from '../lib/powder-record.ts'
import { writeTuneLoad } from '../lib/powder-tune.ts'
import {
  droppedIds,
  linkedId,
  linkedLoad,
  linkParams,
  queryFields,
  type RecordValues,
  recordValues,
} from '../lib/query.ts'
import { withStoredSessions } from '../lib/range-entry.ts'
import { changedFromRecord, recordValuesOf } from '../lib/record-changes.ts'
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
import { startPressureDefault } from '../lib/start-pressure.ts'
import {
  exactFieldText,
  fixedFieldText,
  formatQuantity,
  lengthText,
  mmLength,
  shownLength,
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
import { type InputPanel, type Status, statusText } from '../lib/workbench.ts'
import {
  type DefaultKey,
  defaultKeys,
  defaultsText,
  parseDefaults,
  readAutoRun,
  readDefaults,
  type WorkbenchDefaults,
} from '../lib/workbench-defaults.ts'
import type { FileMenuHandle } from './file-menu.tsx'
import type { ChartView } from './interior-chart.tsx'
import { usePrintEvents } from './print.ts'
import { resetToRecord } from './record-reset.ts'
import type { Seated } from './seating-preview.tsx'
import type { TrajectoryHandle } from './trajectory-form.tsx'
import { useFieldUnits, useUnits } from './units-settings.tsx'
import { useBulletValues } from './use-bullet-values.ts'
import { useCommit } from './use-commit.ts'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import { useManufacturers } from './use-manufacturers.ts'
import type { LoadNotesState } from './workbench-context.ts'
import {
  type CartridgeChoice,
  cardKeys,
  directionOf,
  emptyStep,
  firearmMassSpec,
  ladderSpec,
  maxLadderSteps,
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
  needsNetwork,
  notReached,
  type Outcome,
  type PreviewKey,
  previewKeys,
  resultLine,
  type Step,
  stepLoad,
  stepsOf,
  unlistedCartridge,
  warningsText,
} from './workbench-outcome.ts'
import { type ResultTab, resultTabs } from './workbench-results.tsx'
import type { WorkspaceHandle } from './workspace.tsx'

const interiorSpec = (key: string) =>
  interiorFields.find((s) => s.key === key) as (typeof interiorFields)[number]

type Seating = LoadParts['seating']

/** What the note of a bullet record cleared by a cartridge change names: record, cartridge, mm values. */
type ClearedBullet = {
  record: string
  cartridge: string
  diameter: number
  above: number
  g1: number
}

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
type Groove = { id: string; z?: number | undefined; record?: CartridgeDetail }

/**
 * The chosen cartridge's loaded record: its groove diameter Z, m, the bore area Q, m2, an empty
 * Bore area takes first, and its CIP table.
 */
function grooveValues(cartridge: CartridgeChoice | undefined, groove: Groove | undefined) {
  const loaded = cartridge && groove?.id === cartridge.id ? groove : undefined
  if (!loaded)
    return { grooveM: undefined, qM: undefined, landM: undefined, recordTable: undefined }
  const chamber = (symbol: string) =>
    loaded.record?.values.find((v) => v.side === 'chamber' && v.symbol === symbol && !v.variant)
  return {
    grooveM: loaded.z ? toSi('length', loaded.z) : undefined,
    qM: toSi('area', chamber('Q')?.value ?? 0) || undefined,
    landM: mmToM(chamber('F')?.value),
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
function seatingBlockOf(
  seatAt: SeatingLengths | undefined,
  typedKeys: readonly PreviewKey[],
  t: Translator['t'],
) {
  if (seatAt === undefined) return t('The seating ladder needs a cartridge and a bullet record.')
  if (typedKeys.length === 0) return
  const [first = '', second] = typedKeys.map((k) => specText(t, interiorSpec(k).label))
  return second === undefined
    ? t('{label} typed: empty the field to follow the seating.', { label: first })
    : t('{first} and {second} typed: empty the field to follow the seating.', { first, second })
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
  if (kind === 'seating') return [seatingStepSpec, steps.seat.seatStep ?? emptyStep] as const
  if (kind === 'temperature')
    return [temperatureStepSpec, steps.temp.tempStep ?? emptyStep] as const
  return [ladderSpec, steps.charge.ladderStep ?? emptyStep] as const
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
  const si = measured.measuredWaterCapacity?.si
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
  t: Translator['t'],
): Suggestion | undefined {
  if (seated.caseVolume !== undefined)
    return {
      si: seated.caseVolume,
      source: t('your measured case capacity, without the bullet'),
    }
  if (designLoad?.caseVolume === undefined) return undefined
  return {
    si: designLoad.caseVolume,
    source: t('outline of the user design {name} less a wall, approximate, without the bullet', {
      name: design?.name ?? '',
    }),
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
  /** The bore diameter field's value now, SI. */
  boreDiameter: number | undefined
}

/** What the chosen cartridge, or its design, gives the defaults. */
function cartridgeSource(
  a: CartridgeSource,
  system: UnitSystem,
  t: Translator['t'],
): DefaultSources['cartridge'] {
  const { cartridge, design, designLoad, seated } = a
  const show = {
    text: (si: number) => formatQuantity('capacity', system, si),
    unit: system.capacity.symbol,
  }
  if (design)
    return {
      name: design.name,
      design: true,
      boreDiameter: designLoad?.boreDiameter,
      capacity: lessBullet(
        designCapacityOf(seated, designLoad, design, t),
        seated.unseated,
        show,
        t,
      ),
    }
  if (!cartridge) return undefined
  return {
    name: cartridge.name,
    class: cartridgeClass(a.recordTable),
    boreDiameter: mmToM(a.specValue('chamber', 'F')),
    // Q describes the record's land diameter F: a typed other bore diameter leaves no record area
    boreArea: recordBoreArea(
      mm2ToM2(a.specValue('chamber', 'Q')),
      mmToM(a.specValue('chamber', 'F')),
      a.boreDiameter,
    ),
    twist: mmToM(a.specValue('chamber', 'u')),
    capacity: lessBullet(
      seated.caseVolume === undefined
        ? undefined
        : {
            si: seated.caseVolume,
            source: a.measuredCapacity
              ? t('your measured case capacity, without the bullet')
              : t('case capacity record of {name}, without the bullet', { name: cartridge.name }),
          },
      seated.unseated,
      show,
      t,
    ),
  }
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
  t: Translator['t']
}) {
  const { cartridge, cartridgeDesign, has, t } = a
  return [
    {
      label: msg('Cartridge (optional)'),
      done: !!(cartridge || cartridgeDesign),
      value:
        cartridge?.name ??
        (cartridgeDesign && t('{name} (your design)', { name: cartridgeDesign.name })),
    },
    {
      label: msg('Bullet'),
      done: has(['bulletMass']),
      value: a.bulletLabel ?? a.bulletDesign?.name,
    },
    {
      label: msg('Powder or model parameters'),
      done: has(requiredModelKeys),
      value: a.powderLabel,
    },
    { label: msg('Charge'), done: has(['charge']) },
    {
      label: msg('Chamber volume, bullet travel and twist'),
      done: has(['volume', 'travel', 'twist']),
    },
  ]
}

/** The ballistic coefficient the chart and the trajectory take: G7, else G1. */
const bcOf = (bullet: Partial<Bullet> | undefined) =>
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
    | {
        boreFriction?: number | undefined
        engravingPressure?: number | undefined
        engravingLength?: number | undefined
      }
    | undefined
  linkedBullet: LinkedBullet | undefined
  linkedPowder: LinkedPowder | undefined
}) {
  const { asked, bullet, powder, names } = a
  return {
    bulletId: (asked.bullet?.id && catalogueIdOf(asked.bullet.id)) || bullet?.id,
    powderId: (asked.powder?.id && catalogueIdOf(asked.powder.id)) || powder?.id,
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
const usableWeight = (weight: FieldValue | undefined) =>
  weight && (weight.si ?? 0) > 0 ? weight : emptyStep

/** The bullet length a run reads, mm: the typed one or the record's, else the link's. */
function bulletLengthOf(values: BulletValues, linked: LinkedBullet | undefined) {
  const si = values.bulletLength ?? linked?.length
  return si === undefined ? undefined : fromSi('length', si)
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

const resultLineOf = (outcome: Outcome, system: UnitSystem, t: Translator['t']) =>
  outcome.kind === 'ok' ? resultLine(outcome, system, t) : undefined

/** The firearm the defaults read: its name, twist and barrel length. */
const gunSource = (
  gun:
    | { name: string; data: { twist?: number | undefined; barrelLength?: number | undefined } }
    | undefined,
) => gun && { name: gun.name, twist: gun.data.twist, barrelLength: gun.data.barrelLength }

type PreviewFields = Partial<Record<PreviewKey, FieldValue | undefined>>

/**
 * What the seated bullet changes of volume and travel: the fields to write (empty, or still the
 * last seated value; a volume that followed a seating without one is emptied) and the values that
 * follow it from now on.
 */
export function followPlan(
  values: Seated,
  now: Fields,
  a: {
    followed: ReadonlySet<FollowKey>
    written: Partial<Record<FollowKey, number | undefined>>
    previewed: Partial<Record<PreviewKey, number>>
    field: (k: PreviewKey, v: number) => FieldValue
  },
) {
  const next: PreviewFields = {}
  const following: Partial<Record<PreviewKey, number>> = {}
  for (const k of previewKeys) {
    const v = values[k]
    const si = now[k]?.si
    if (v === undefined) {
      // a case volume but none behind the bullet (not seated): the earlier seating's volume goes
      const unseated = k === 'volume' && values.caseVolume !== undefined
      if (unseated && si !== undefined && si === a.previewed[k])
        next[k] = { text: '', si: undefined }
      continue
    }
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

/**
 * The seating owns the volume: its seated value, or none when the bullet is seated in a case of
 * known volume but leaves no valid volume behind it. The case volume default fills it only without
 * a seating.
 */
export const seatingOwnsVolume = (s: Seated) =>
  s.volume !== undefined || (s.overallLength !== undefined && s.caseVolume !== undefined)

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

/** The API's largest tolerance of the chamber volume (`packages/api/src/compute/interior-schema.ts`). */
const maxVolumeFraction = 0.2

/** The range tolerance of a chamber volume that still is the approximate default, with its interval: none for a typed or measured one. */
export function approximateVolumeTolerance(
  suggestion: Suggestion | undefined,
  value: number | undefined,
  followed: ReadonlySet<FollowKey>,
): number | undefined {
  if (!suggestion?.halfWidth || value !== suggestion.si || !followed.has('volume')) return undefined
  return Math.min(suggestion.halfWidth, maxVolumeFraction)
}

/** `base` with the start pressure default: the barrel of the seating, else the start's own, and the bullet's construction. */
function withStartPressure(
  base: Suggestions,
  a: {
    barrel: number | undefined
    construction: Parameters<typeof startPressureDefault>[0]['construction']
    current: number
    system: UnitSystem
    t: Translator['t']
  },
): Suggestions {
  const { barrel, construction, current, system, t } = a
  const show = {
    text: (si: number) => formatQuantity('pressure', system, si),
    unit: system.pressure.symbol,
  }
  return {
    ...base,
    startPressure: startPressureDefault({
      barrel: barrel ?? base.barrelLength?.si,
      construction,
      current,
      show,
      t,
    }),
  }
}

/** The defaults a reference gives again on opening: not the start pressure by construction (the approximate one), which a load file and the API do not know, so it is saved as a value. */
function savedSuggestions(s: Suggestions): Suggestions {
  if (!s.startPressure?.approximate) return s
  const { startPressure: _byConstruction, ...rest } = s
  return rest
}

/** The run's `noCoefficient`: a powder record with a model and no temperature coefficient, at the temperature of its fit. */
export function noCoefficientOf(powder: Powder | undefined) {
  const i = powder?.interior
  if (!i || powder.temperatureSensitivity) return
  return {
    noCoefficient: { reference: toSi('temperature', i.propellantTemperature.value) },
  }
}

/** The followed fields with the start pressure added when `follow`. */
const followingStart = (s: ReadonlySet<FollowKey>, follow: boolean): ReadonlySet<FollowKey> =>
  follow ? new Set([...s, 'startPressure']) : s

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
function ownStepError(spec: FieldSpec, v: FieldValue, shown: UnitSystem, t: Translator['t']) {
  return (
    fieldError(spec, v, shown, t) ??
    (v.si === undefined || v.si > 0
      ? undefined
      : t('{label} must be above 0.', { label: specText(t, spec.label) }))
  )
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
    const { res, json } = nth(answers, i)
    if (res.ok && json !== undefined) return { charge, body: json, ...row }
    const message = json?.message ?? `Error ${res.status}.`
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
    answers.find((a) => a.res.status === 503) ?? answers.find((a) => !a.res.ok) ?? nth(answers, 0)
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

type Named = { name?: string | undefined } | undefined

/** The names the printed sheet shows for the load's records. */
function identityOf(a: {
  cartridge: CartridgeChoice | undefined
  cartridgeDesign: { name: string } | undefined
  bulletLabel: string | undefined
  bulletDesign: Named
  linkedBullet: Named
  powderLabel: string | undefined
  powderDesign: Named
  linkedPowder: Named
}) {
  const design = a.cartridgeDesign && `${a.cartridgeDesign.name} (user design)`
  return {
    cartridge: a.cartridge?.name ?? design,
    bullet: a.bulletLabel ?? a.bulletDesign?.name ?? a.linkedBullet?.name,
    powder: a.powderDesign
      ? `${a.powderLabel} (user design)`
      : (a.powderLabel ?? a.linkedPowder?.name),
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

/**
 * The error outcome of a run without a result, with its status text: a refusal when the model
 * reports every step as invalid, else the failed request's status.
 */
export function failedRun(steps: Step[], res: Response, json: Answer['json']) {
  // a ladder shows the first step's error; a step of a failed request (500) is no refusal
  const error = res.ok || res.status === 422 ? steps[0]?.error : undefined
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
    text:
      status === 422
        ? 'The model refused the load. The error panel gives the reason.'
        : `Error ${status}.`,
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
  const missing = withDefaults ? defaultKeys.filter((k) => linked[k]?.si === undefined) : []
  for (const k of missing) {
    const spec = interiorFields.find((s) => s.key === k) as FieldSpec
    linked[k] = { text: fixedFieldText(spec.quantity, system, defaults[k]), si: defaults[k] }
  }
  return { linked, missing }
}

/**
 * The bullet values a link's query or an opened file types: the fields it holds, none for the rest,
 * and the base form (a text) when it names one.
 */
const typedBulletOf = (query: URLSearchParams, system: UnitSystem): Fields => {
  const typed = Object.fromEntries(
    Object.entries(queryFields(query, bulletFields, system, fixedFieldText)).filter(
      ([, f]) => f.si !== undefined,
    ),
  )
  const base = query.get(baseTypeKey) ?? ''
  return typedBaseType({ [baseTypeKey]: { text: base } })
    ? { ...typed, [baseTypeKey]: { text: base, si: undefined } }
    : typed
}

/** The error of every field whose typed value is outside its bounds. */
const fieldErrorsOf = (linked: Fields, system: UnitSystem) =>
  Object.fromEntries(
    interiorFields.flatMap((s) => {
      // stored English: a field shows the message again in the language and units shown
      const error = linked[s.key]?.text && fieldError(s, linked[s.key], system, english.t)
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
  const { ladderStep = emptyStep } = queryFields(
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

/** The `catalogue:` reference of a record id, none for no id. */
const catalogueRefIn = (id: string | undefined) => (id ? catalogueRef(id) : undefined)
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
export function followWrites(a: {
  followed: ReadonlySet<FollowKey>
  seatedVolume: boolean
  now: Fields
  suggestions: Suggestions
  written: Partial<Record<FollowKey, number | undefined>>
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

/** How many of the card's `keys` the user changed over their record, the base form of the Bullet card included. */
const changedCount = (
  panel: InputPanel,
  keys: readonly string[],
  changes: Record<string, number>,
  baseChanged: boolean,
) =>
  keys.filter((k) => changes[k] !== undefined).length + (panel === 'bullet' && baseChanged ? 1 : 0)

/** The load workbench's state and actions: inputs, records, seating, ladder, run and result. */
export function useWorkbenchState() {
  const { choice, system } = useUnits()
  const { t } = useTranslation()
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
          // stored English: a field shows the message again in the language and units shown
          fieldError(s, values[s.key], unitsNow.current, english.t) ??
            burnFormError(siValues(values), s.key, english.t) ??
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
  /** The user powder design whose values the fields took; the powder record is then none. */
  const [powderDesign, setPowderDesign] = useState<PowderDesign>()
  /** The powder the run reads: the record, else the design's. */
  const chosenPowder = powder ?? powderDesign?.powder
  const names = useManufacturerNames()
  /** The chosen records as "<manufacturer name> <product name>". */
  const bulletLabel = labelOf(bullet, names)
  const powderLabel = labelOf(powder, names) ?? powderDesign?.name
  /** SI values of the powder record's model parameters, the reference of the field marks. */
  const [origin, setOrigin] = useState<Record<string, number> | undefined>(undefined)
  const originNow = useRef(origin)
  originNow.current = origin
  /** Groove diameter Z of the chosen cartridge, mm, for the bore resistance of a fitted powder. */
  /** The chosen cartridge's record: its groove diameter and the values the figure draws. */
  const [groove, setGroove] = useState<Groove | undefined>(undefined)
  const { grooveM, qM, landM, recordTable } = grooveValues(cartridge, groove)
  const [allDiameters, setAllDiameters] = useState(false)
  /** The browser's bullet designs that have a mass, resolved against the catalogue. */
  const [designs, setDesigns] = useState<UserBulletView[]>([])
  /** The browser's cartridge designs that draw a case and chamber. */
  const [cartridgeDesigns, setCartridgeDesigns] = useState<UserCartridgeView[]>([])
  /** The browser's powder designs that build a valid powder. */
  const [powderDesignList, setPowderDesignList] = useState<PowderDesign[]>([])
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
  /** The library, then the example's built-in rifle (`gunPicker`). */
  const firearmList = [...firearms, loadExample.firearm].map((r) => ({
    id: r.id,
    name: r.name,
    data: gunValues((r as FirearmRecord).data),
  }))
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
  const [bulletDesign, setBulletDesign] = useState<{
    id: string
    name: string
    /** The design resolved against its base: the values the Bullet card shows and the run reads. */
    record?: Partial<Bullet> | undefined
  }>()
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
        setPowderDesignList(powderDesigns(records))
        setFirearms(records.filter((r): r is (typeof firearms)[number] => r.kind === 'firearm'))
        setCases(ownCases(records))
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
  function takeBulletDesign(
    d: Pick<UserBulletView, 'id' | 'name' | 'si' | 'resolved'>,
    fill = true,
    keepTyped = false,
  ) {
    picking.current.bullets?.abort()
    got('bullet')
    setBulletDesign({ id: d.id, name: d.name, record: d.resolved.record })
    setBullet(undefined)
    setBulletNote(undefined)
    if (!fill) return
    if (!keepTyped) setTypedBullet({})
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
    setBulletNote(undefined)
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
  /** The Bullet record a cartridge change cleared, with the values its note names, mm. */
  const [clearedBullet, setBulletNote] = useState<ClearedBullet>()
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
    bullet?: string | undefined
    barrel?: number
    seating?: Seating
  }>()
  /** SI values the preview wrote into the fields. */
  const [previewed, setPreviewed] = useState<Partial<Record<PreviewKey, number>>>({})
  /** The seated bullet's values, SI, none while no bullet is seated: an emptied field takes them again. */
  const [seated, setSeatedState] = useState<Seated>({})
  // the seating reports run in transitions: `seated` lags them, so an effect that must not write
  // over a seated volume reads this mirror, which is current at once
  const seatedNow = useRef(seated)
  const setSeated = useCallback((values: Seated) => {
    seatedNow.current = values
    setSeatedState(values)
  }, [])
  /** The seating the preview first reported: a file or link keeps a seating that differs. */
  const [seatingStart, setSeatingStart] = useState<Seating>()
  const [tab, setTab] = useState<ResultTab>('results')
  /** Counts the File menu's store writes: the Groups tab reads the new id and its sheet again. */
  const [storedTick, setStoredTick] = useState(0)
  // tabs that compute or load code mount when first opened and stay; print mounts them all
  const [seen, setSeen] = useState<ReadonlySet<ResultTab>>(() => new Set(['results']))
  const [printing, setPrinting] = useState(false)
  const printMedia = useMediaQuery('print')
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
  /** The lots of the load and what it was at each session (`Load.snapshots`). */
  const [lots, setLots] = useState<Lots>(noLots)
  const [snapshots, setSnapshots] = useState<SessionSnapshot[]>([])
  /** The snapshots of the last committed render, the stored ones or the load as it is: what Save writes. */
  const snapshotsNow = useRef<SessionSnapshot[]>([])
  const sessionsNow = useRef<SessionRecord[]>([])
  /** The session references the load was opened or last saved with: what another tab's additions are told from. */
  const openedRefs = useRef<string[]>([])
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
  /** The catalogue capacity record the user chose in the pinned row, kept for the cartridge it belongs to. */
  const [capacityChoice, setCapacityChoice] = useState<{ cartridge: string; id: string }>()
  /** The catalogue case record the user chose in the pinned row, kept for the cartridge it belongs to. */
  const [caseChoice, setCaseChoice] = useState<{ cartridge: string; id: string }>()
  /** The id of the catalogue primer the user chose in the pinned row. */
  const [primerChoice, setPrimerChoice] = useState<string>()
  /** The user's cases of this browser, and the group of them the user chose for the cartridge it belongs to. */
  const [cases, setCases] = useState<OwnCase[]>([])
  const [ownCaseChoice, setOwnCaseChoice] = useState<{ cartridge: string; id: string }>()
  /** The user capacity reference of the load being opened: a slower read than a newer open leaves alone. */
  const openingCapacity = useRef<string>(undefined)
  /** Whether the measured capacity field holds the value a chosen group of cases named, not a typed or loaded one. */
  const measuredFromGroup = useRef(false)
  /**
   * The Bullet card's diameter, length and BCs the user typed over the record's, by key. An entry
   * stays while its field is edited (also empty); a field without one shows the record's value.
   */
  const [typedBulletFields, setTypedBullet] = useState<Fields>({})
  /** The card whose changed values a record pick replaced, and how many: its one-line note. */
  const [replaced, setReplaced] = useState<{ panel: InputPanel; count: number }>()
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
  useFieldUnits(bulletFields, system, (update) => setTypedBullet((f) => update(f)), fixedFieldText)
  useFieldUnits(
    [firearmMassSpec],
    system,
    (update) => setGunFields((f) => update(f)),
    fixedFieldText,
  )
  const fields = form.values
  /** The record's bore area Q while the bore diameter is the land diameter it describes. */
  const qUsed = recordBoreArea(qM, landM, fields.boreDiameter?.si)

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
    if (values.overallLength === undefined) return
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
  const withSeatedText = <F extends Partial<Record<PreviewKey, FieldValue | undefined>>>(
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
  const [linked, setLinked] = useState<{
    bullet?: LinkedBullet | undefined
    powder?: LinkedPowder | undefined
  }>({})
  // the link's values while its record is asked for, loading or missing
  const linkedBullet = pendingLink(bullet, asked.bullet?.id, linked.bullet)
  const linkedPowder = pendingLink(powder, asked.powder?.id, linked.powder)
  /** The record or design the card shows, the values a run reads (SI, one source for every reader) and the record with them in place. */
  const {
    record: bulletRecord,
    values: bulletValues,
    baseType: bulletBaseType,
    baseChanged,
    savedBaseType,
    now: bulletNow,
    given: bulletGiven,
  } = useBulletValues(
    bullet,
    bulletDesign,
    // a design the load cannot name is not a reference that gives its values again
    bulletDesign && userRef(bulletDesign.id) !== undefined,
    fields.bulletMass?.si,
    typedBulletFields,
  )
  /** The bullet length a run reads, mm: the typed one or the record's, else the link's. */
  const bulletLength = bulletLengthOf(bulletValues, linkedBullet)

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
    setTypedBullet({})
    setBulletNote(undefined)
    setAllDiameters(false)
    setPowder(undefined)
    setPowderDesign(undefined)
    setOrigin(undefined)
    setReplaced(undefined)
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
    setCaseChoice(undefined)
    setPrimerChoice(undefined)
    setOwnCaseChoice(undefined)
    openingCapacity.current = undefined
    measuredFromGroup.current = false
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
    openedRefs.current = []
    setLots(noLots)
    setSnapshots([])
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
    setCaseChoice({ cartridge: loadExample.cartridge.id, id: loadExample.caseId })
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
    setBulletNote(undefined)
    const fit = fitOf(c)
    const diameter = diameterMm(bulletValues)
    if (bullet && fit && diameter !== undefined && !bulletFits(diameter, fit)) {
      setBullet(undefined)
      // the typed values belong to the record that goes
      setTypedBullet({})
      setBulletNote({
        record: productLabel(bullet, names),
        cartridge: c.name,
        diameter,
        above: bulletWindow(fit).above,
        g1: fit.g1,
      })
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

  /**
   * Loads a bullet record; `fill` writes its mass into the Bullet mass field and, unless `keepTyped`
   * (an opened load's own values), ends the diameter, length and BC typed over the earlier record.
   */
  function chooseBullet(id: string, fill = true, keepTyped = false) {
    const signal = pick('bullets')
    want('bullet', id)
    return fetchRecord<Bullet>('bullets', id, signal)
      .then((b) => {
        if (signal.aborted) return
        if (!b) return lost('bullet', id)
        got('bullet')
        setBullet(b)
        setBulletDesign(undefined)
        setBulletNote(undefined)
        if (!fill) return
        if (!keepTyped) setTypedBullet({})
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
        setStatus({ say: (t) => t(notReached) })
      })
  }

  /**
   * `p`, a powder record or the powder a user design builds (`design`), in place of the earlier
   * one; `fill` writes its model parameters into the fields, except the `keep` ones.
   */
  function takePowder(
    p: Powder,
    design: PowderDesign | undefined,
    fill: boolean,
    keep: ReadonlySet<string>,
  ) {
    markChanged()
    setPowder(design ? undefined : p)
    setPowderDesign(design)
    const values = recordFill(p)
    const previous = originNow.current
    setOrigin(values)
    if (fill && !values && previous) {
      // a record without model parameters: what the previous record filled and the user did not
      // edit goes back to a new load's state (the cited default, else empty)
      const back = revertRecordFill(form, previous, defaults, unitsNow.current)
      setDefaulted((s) => new Set([...s, ...back]))
      setFollowed((s) => followingStart(s, back.has('startPressure')))
    }
    if (!fill || !values) return
    const filledKeys = fillRecordValues(form, values, keep, unitsNow.current)
    setDefaulted((s) => new Set([...s].filter((k) => !filledKeys.has(k))))
    // a start pressure the record or the opened load gives stays; else the field follows its default
    const given = !!p.interior?.startPressure || keep.has('startPressure')
    setFollowed((s) => followingStart(new Set([...s].filter((k) => !filledKeys.has(k))), !given))
  }

  /** A powder design of this browser in place of a record. */
  function takePowderDesign(d: PowderDesign, fill = true, keep: ReadonlySet<string> = new Set()) {
    picking.current.powders?.abort()
    got('powder')
    takePowder(d.powder, d, fill, keep)
  }
  function choosePowderDesign(id: string) {
    const d = powderDesignList.find((r) => r.id === id)
    if (d) takePowderDesign(d)
  }

  /** The powder design `ref` (`user:<id>`) of an opened load; `keep` are the values the load carries. */
  function openPowderDesign(ref: string, keep: ReadonlySet<string>) {
    const signal = pick('powders')
    want('powder', ref)
    const id = parseRef(ref)?.id ?? ''
    storedRecord(id)
      .then((raw) => {
        const r = userRecord.safeParse(raw)
        const built =
          r.success && r.data.kind === 'powder' && powderOf(r.data.data, r.data.name, id)
        if (signal.aborted) return
        if (!r.success || r.data.kind !== 'powder' || !built || !('powder' in built))
          return lost('powder', ref)
        takePowderDesign({ id, name: r.data.name, powder: built.powder }, true, keep)
      })
      .catch(() => {
        if (!signal.aborted) lost('powder', ref)
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
        takePowder(p, undefined, fill, keep)
      })
      .catch(() => {
        if (signal.aborted) return
        lost('powder', id)
        setStatus({ say: (t) => t(notReached) })
      })
  }

  /** Why a seating ladder cannot run: no seating, or a volume or travel typed over it. */
  const typedKeys = previewKeys.filter(
    (k) => seated[k] !== undefined && fields[k]?.si !== previewed[k],
  )
  const seatingBlock = seatingBlockOf(seatAt, typedKeys, t)

  /** The steps of the seating ladder from the seating field, or what stops it, in the shown units. */
  function seatingPlan(shown = system) {
    const start = seatAt && seated[seatAt.lengthKind]
    const step = seatStep.seatStep?.si
    if (!seatAt || step === undefined)
      return {
        error:
          seatingBlock ?? t('{label} is empty.', { label: specText(t, seatingStepSpec.label) }),
      }
    const show = (m: number) => withUnit('length', shown, m)
    return seatingLadder(seatAt, start, step, ladderSteps, direction, show, t)
  }

  /** Why a temperature ladder cannot run: the powder record has no temperature sensitivity. */
  const temperatureBlock = temperatureLadderBlockReason(
    powderLabel,
    powder?.temperatureSensitivity !== undefined,
    t,
  )

  /** The propellant temperatures of the temperature ladder from the Powder temperature field, or what stops it. */
  function temperaturePlan(shown = system) {
    const step = tempStep.tempStep?.si
    if (step === undefined)
      return { error: t('{label} is empty.', { label: specText(t, temperatureStepSpec.label) }) }
    return temperatureLadder(
      fields.propellantTemperature?.si,
      step,
      ladderSteps,
      direction,
      (k) => withUnit('temperature', shown, k),
      t,
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
    const own = ownStepError(spec, v, shown, t)
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
    const chosen = as?.powder ?? chosenPowder
    const { body, bulkDensity, missing } = interiorRequest({
      values: powderValues(siValues(fields), chosenPowder, as),
      powder: chosen,
      // a missing powder record: the bulk density and the bore resistance its link carried
      linked: as ? undefined : linkedPowder,
      cartridge,
      groove,
      boreArea: qUsed,
      grooveDiameter: grooveM,
      bulletLength,
    })
    const resistanceMissing =
      chosen && missing.length > 0 ? { powder: productLabel(chosen, names), missing } : undefined
    const volumeTolerance = approximateVolumeTolerance(
      suggestions.volume,
      fields.volume?.si,
      followed,
    )
    const recordInputs = [
      chosenPowder?.id,
      bulletLength,
      cartridge?.g1,
      groove?.id === cartridge?.id ? groove?.z : undefined,
    ]
    return {
      body: volumeTolerance ? { ...body, tolerances: { volumeFraction: volumeTolerance } } : body,
      bulkDensity,
      resistanceMissing,
      recordInputs,
    }
  }

  /**
   * The Measurements tab's tuning link: the load this run simulates, handed to the route for the
   * strings of this saved load; an unsaved edit hands over nothing, so no stale load is fitted.
   */
  function handTuneLoad() {
    const menu = fileMenu.current
    const id = menu?.id()
    const ref = id && userRef(id)
    if (!ref) return
    let load: InteriorLoad | undefined
    try {
      if (!menu?.snapshot().unsaved) load = loadRequest().body.load
    } catch {}
    // a record still loading: the tuning route fetches its table; before the first answer only the
    // catalogue id asked for is known (a user design's is not fetched)
    const asking =
      !cartridge && !cartridgeDesign && asked.cartridge?.id
        ? catalogueIdOf(asked.cartridge.id)
        : undefined
    const pending = cartridge ? (groove?.id !== cartridge.id ? cartridge.id : undefined) : asking
    writeTuneLoad(ref, load, chosenPowder, recordTable, pending)
  }
  const tuning = useRef(handTuneLoad)
  tuning.current = handTuneLoad
  const handOffTune = useCallback(() => tuning.current(), [])

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
    const message = errorText(err)
    setStatus({ say: (t) => translateMessage(message, t) })
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
      body: nth(steps, first).body as InteriorResponse,
      load: stepLoad(body.load, nth(steps, first)),
      steps,
      selected: first,
      direction,
      ladder: ladderOf(plan, ladderKind, seatAt?.lengthKind),
      at: timeText(new Date()),
      id: runs.current,
      bulkDensity: a.bulkDensity,
      cartridge: body.cartridge,
      unlisted: unlistedCartridge(powder, cartridge),
      powderChosen: chosenPowder !== undefined || linkedPowder !== undefined,
      resistanceMissing: a.resistanceMissing,
      ...noCoefficientOf(chosenPowder),
      design: bulletDesign?.name,
      cartridgeDesign: cartridgeDesign?.name,
      volumeMeasured: volumeMeasured({
        measuredCapacity: measuredWaterCapacity,
        volume: fields.volume?.si,
        // an estimated default is no measured capacity
        derived: [
          suggestions.volume?.approximate ? undefined : suggestions.volume?.si,
          seated.volume,
        ],
      }),
      powderDesign: powderDesign?.name,
      identity: identityOf({
        cartridge,
        cartridgeDesign,
        bulletLabel,
        bulletDesign,
        linkedBullet,
        powderLabel,
        powderDesign,
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
    // compared as English text, so a change of language announces nothing again
    const warnings = warningsText(ok, english.t)
    ok.announce = warnings !== '' && warnings !== lastWarnings.current
    lastWarnings.current = warnings
    showChart(undefined)
    setOutcome(ok)
    setStatus({ prefix: (t) => t('Simulation done. ') })
    // the sampled band of the step shown first follows the result: it takes up to its time budget
    const bandController = new AbortController()
    bandRequest.current = bandController
    void fetchBand(
      { ...body, load: stepLoad(body.load, nth(steps, first)), sampling: {} },
      bandController.signal,
    ).then((sampled) => {
      if (!bandController.signal.aborted) setOutcome((o) => withBand(o, ok.id, first, sampled))
    })
  }

  async function send() {
    clearTimeout(autoTimer.current)
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
    const request = ladderRequest(body, plan, ladderSteps, ladder.ladderStep?.si, direction)
    const controller = new AbortController()
    running.current = controller
    setPending(true)
    setStatus({ say: (t) => t('Simulating') })
    try {
      await simulate(req, plan, request, controller.signal)
    } catch {
      if (!controller.signal.aborted) showUnreached()
    } finally {
      // a finished run is no longer running: the next input change keeps its status line
      if (running.current === controller) {
        setPending(false)
        running.current = null
      }
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
    const message = failed.text
    setStatus({ say: (t) => translateMessage(message, t) })
  }

  /** A request that never got an answer: the API is unreachable, or the browser is offline. */
  function showUnreached() {
    setChanged(false)
    const offline = !navigator.onLine
    setOutcome({ kind: 'error', status: 502, body: undefined, retryAfter: null, offline })
    setStatus({ say: (t) => t(offline ? needsNetwork : notReached) })
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
    if (!runWhenFilled || fields.charge?.si === undefined || loading || !seated.figure) return
    setRunWhenFilled(false)
    run()
  }, [runWhenFilled, fields, asked, seated.figure])

  /** Runs a changed load once it is complete and valid; an invalid value shows its error only. */
  function autoRun() {
    const loading = Object.values(asked).some((a) => a && !a.failed)
    // a value is checked on blur: one still being typed has no shown error yet
    const invalid =
      Object.values(form.errors).some(Boolean) ||
      !form.isValid() ||
      (gunWeight !== undefined &&
        fieldError(firearmMassSpec, gunWeight, system, t) !== undefined) ||
      stepError() !== undefined
    if (!changed || loading || invalid) return
    try {
      loadRequest()
    } catch (err) {
      if (err instanceof ValueError) form.setFieldError(err.field, err.message)
      return
    }
    void send()
  }
  const autoRunNow = useRef(autoRun)
  autoRunNow.current = autoRun
  const autoTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // each input change starts the wait again; Run clears it, the switch is read when it ends
  useEffect(() => {
    if (edits === 0 || !readAutoRun()) return
    autoTimer.current = setTimeout(() => {
      if (readAutoRun()) autoRunNow.current()
    }, 600)
    return () => clearTimeout(autoTimer.current)
  }, [edits])

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
    setFollowed(new Set(withDefaults ? followKeys.filter((k) => linked[k]?.si === undefined) : []))
    form.setValues(linked)
    setTypedBullet(typedBulletOf(query, system))
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
    const { firearmMass = emptyStep } = queryFields(
      query,
      [firearmMassSpec],
      system,
      fixedFieldText,
    )
    setGunFields({ firearmMass: (firearmMass.si ?? 0) > 0 ? firearmMass : emptyStep })
    const own = queryFields(query, [measuredWaterCapacitySpec], system, fixedFieldText)
    if ((own.measuredWaterCapacity?.si ?? 0) > 0) {
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
        takeBulletDesign({ id, name: r.data.name, si: { mass }, resolved }, fill, true)
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
  function openCapacity(ref: string, forCartridge: string | undefined, fromGroup = false) {
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
        measuredFromGroup.current = fromGroup
        got('capacity')
      })
      .catch(() => {
        if (openingCapacity.current === ref) lost('capacity', ref)
      })
  }

  /**
   * The case `ref` of an opened load is chosen for the cartridge it names: a catalogue product, or
   * a group of the user's cases. The group's measured capacity comes with the load's own capacity.
   */
  function openCase(ref: string | undefined, forCartridge: string | undefined) {
    const target = ref ? parseRef(ref) : undefined
    const cartridgeId = forCartridge && parseRef(forCartridge)?.id
    if (!target || !cartridgeId) return
    if (target.scope === 'catalogue') setCaseChoice({ cartridge: cartridgeId, id: target.id })
    else setOwnCaseChoice({ cartridge: cartridgeId, id: target.id })
  }

  /** A catalogue case product chosen in the figure replaces a group of the user's cases. */
  function chooseCase(choice: { cartridge: string; id: string } | undefined) {
    setOwnCaseChoice(undefined)
    setCaseChoice(choice)
  }

  /**
   * A group of the user's cases chosen in the figure: its measured capacity fills the measured
   * capacity field, where it replaces the record's value and shows as measured.
   */
  function chooseOwnCase(id: string | undefined) {
    const cartridgeId = cartridge?.id
    if (!cartridgeId) return
    setOwnCaseChoice(id ? { cartridge: cartridgeId, id } : undefined)
    if (!id) return
    setCaseChoice(undefined)
    const capacity = cases.find((c) => c.id === id)?.capacity
    if (capacity) return openCapacity(capacity, `catalogue:${cartridgeId}`, true)
    // a group without a measured capacity leaves none of the previous group's in the field
    openingCapacity.current = undefined
    if (!measuredFromGroup.current) return
    measuredFromGroup.current = false
    setMeasured({ measuredWaterCapacity: emptyStep })
    setMeasuredFor(undefined)
    got('capacity')
  }

  /** A capacity chosen in the figure replaces the one the opened load still asks for. */
  function chooseCapacity(choice: { cartridge: string; id: string } | undefined) {
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
    measuredFromGroup.current = false
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
    openedRefs.current = refs
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
    openCase(d.case?.record, d.cartridge)
    setPrimerChoice(catalogueIdIn(d.primer?.record))
    openBullet(d.bullet, !typed.has('bulletMass'))
    openPowder(d.powder, typed)
    setNotes(d.note ?? '')
    setLots(lotsFrom(d))
    setSnapshots(d.snapshots ?? [])
    openSessions(sessions)
  }

  /** The powder of an opened load: a catalogue record is chosen, a design of this browser is read. */
  function openPowder(ref: unknown, keep: ReadonlySet<string>) {
    const powderRef = typeof ref === 'string' ? ref : undefined
    const id = powderRef && catalogueIdOf(powderRef)
    if (id) void choosePowder(id, true, keep)
    else if (powderRef) openPowderDesign(powderRef, keep)
  }

  /** The bullet of an opened load: a catalogue record is chosen, a design of this browser is read. */
  function openBullet(ref: unknown, fillMass: boolean) {
    const bulletRef = typeof ref === 'string' ? ref : undefined
    const id = bulletRef && catalogueIdOf(bulletRef)
    if (id) void chooseBullet(id, fillMass, true)
    else if (bulletRef) openBulletDesign(bulletRef, fillMass)
  }

  const seating = keptSeating(seated, seatingStart, previewInitial?.seating, system)
  const cartridgeKey = cartridgeKeyOf(cartridge, cartridgeDesign, asked.cartridge)
  const measuredWaterCapacity = measuredCapacityOf(measuredFor, cartridgeKey, measured)
  const chosenCapacity = chosenCapacityOf(capacityChoice, cartridgeKey)
  const chosenCase = chosenCapacityOf(caseChoice, cartridgeKey)
  const chosenOwnCase = chosenCapacityOf(ownCaseChoice, cartridgeKey)
  // one list per cartridge and library read, so the brass field's matches last while they do
  const cartridgeCases = useMemo(
    () => (cartridge ? cases.filter((c) => c.cartridge === `catalogue:${cartridge.id}`) : []),
    [cartridge, cases],
  )

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
  // a saved load keeps each session's snapshot as it was then, not as the load becomes
  const onStored = useCallback(() => {
    setSnapshots(snapshotsNow.current)
    setStoredTick((n) => n + 1)
  }, [])
  const unresolvedText = {
    cartridge: (id: string) => t('cartridge {id}', { id }),
    bullet: (id: string) => t('bullet {id}', { id }),
    powder: (id: string) => t('powder {id}', { id }),
    capacity: (id: string) => t('capacity {id}', { id }),
  }
  const unresolved = (['cartridge', 'bullet', 'powder', 'capacity'] as const).flatMap((k) =>
    asked[k]?.failed ? [unresolvedText[k](asked[k].id)] : [],
  )

  /** A field's value with the display decimals, for the record lines; undefined when not valid. */
  const shown = (key: string, q: Parameters<typeof formatQuantity>[0]) => {
    const si = fields[key]?.si
    if (si === undefined || !Number.isFinite(si)) return
    return q === 'length' ? shownLength('travel', system, si) : withUnit(q, system, si)
  }

  const generated = generatedName(
    {
      cartridge: cartridge?.name ?? cartridgeDesign?.name,
      bullet: bulletLabel ?? bulletDesign?.name,
      powder: powderLabel,
      charge: shown('charge', 'mass'),
    },
    t,
  )
  /** The load's name: the typed one, else the generated one; Save names the record and the file by it. */
  const name = loadName(customName, generated)

  /** The bullets that fit the cartridge (`GET /bullets?cartridge`); all without its CIP values or with all diameters on. */
  const { bulletFit, bulletParams } = bulletFilter(allDiameters, cartridge)
  const describeBullet = (b: BulletSummary) =>
    `${productLabel(b, names)}, ${withUnit('mass', system, toSi('mass', b.mass))}${b.diameter === null ? '' : `, ${withUnit('length', system, toSi('length', b.diameter))}`}`

  const specValue = (side: string | undefined, symbol: string) =>
    cartridge && groove?.id === cartridge.id
      ? groove.record?.values.find((v) => v.side === side && v.symbol === symbol && !v.variant)
          ?.value
      : undefined
  const siLength = (si: number | undefined) =>
    si === undefined ? undefined : shownLength('diameter', system, si)
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
  const baseSuggestions = suggestDefaults(
    {
      firearm: gunSource(gun),
      cartridge: cartridgeSource(
        {
          cartridge,
          design: cartridgeDesign,
          designLoad,
          recordTable,
          specValue,
          seated,
          measuredCapacity: measuredWaterCapacity,
          boreDiameter: fields.boreDiameter?.si,
        },
        system,
        t,
      ),
      bullet:
        bullet && bulletValues.bulletDiameter !== undefined
          ? { name: productLabel(bullet, names), diameter: bulletValues.bulletDiameter }
          : undefined,
      settingsBarrelLength: defaults.barrelLength,
    },
    t,
  )
  const suggestions = withStartPressure(baseSuggestions, {
    barrel: seated.barrel,
    construction: bulletRecord?.construction,
    current: defaults.startPressure,
    system,
    t,
  })
  // the references the load keeps; one that cannot be written (a design or firearm whose id is no
  // UUID) leaves what it gives in the load as typed values
  const firearmRef = userRefOf(firearm)
  const referenced = referencedOf(firearm, firearmRef, cartridgeDesign, bulletDesign)
  const fieldValues: Record<string, number | undefined> = {
    ...Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.si])),
    ...bulletValues,
    firearmMass: gunWeightUsed.si,
  }
  const given = givenKeys(fieldValues, {
    origin,
    bullet: bulletGiven,
    defaults,
    defaulted,
    followed,
    suggestions: Object.fromEntries(
      followKeys.map((k) => [k, referenced ? savedSuggestions(suggestions)[k]?.si : undefined]),
    ),
    previewed,
    seatingKept: seatingKeptOf(referenced, seated, suggestions),
    gunMass: gunFromFirearm.current && !!firearmRef,
  })
  /** What the user changed over the records, with each record's value; the one source of the marks and resets. */
  const changes = changedFromRecord(
    fieldValues,
    recordValuesOf({
      origin,
      bullet: recordBulletValues(bulletRecord),
      suggestions,
      seatingOwnsVolume: seatingOwnsVolume(seated),
      firearmMass: gun?.data.firearmMass,
    }),
    given,
  )
  /** Gives the changed values among `keys` their record's value again; how many it reset. */
  const resetKeys = (keys: readonly string[]) => {
    const n = resetToRecord(keys, {
      changes,
      system,
      bulletKeys: new Set(bulletFields.map((s) => s.key)),
      baseChanged,
      setField: form.setFieldValue,
      clearError: form.clearFieldError,
      unsetTypedBullet: (drop) =>
        setTypedBullet((f) =>
          Object.fromEntries(Object.entries(f).filter(([k]) => !drop.includes(k))),
        ),
      follow: (add) => setFollowed((f) => new Set([...f, ...add])),
      setGunWeight: (v) => {
        gunFromFirearm.current = true
        setGunFields({ firearmMass: v })
      },
    })
    if (n > 0) {
      markChanged()
      setReplaced(undefined)
    }
    return n
  }
  /** Notes that a record pick replaces the changed values among `keys` of the card. */
  const noteReplaced = (panel: InputPanel, keys: readonly string[] = cardKeys[panel]) => {
    const count = changedCount(panel, keys, changes, baseChanged)
    setReplaced(count > 0 ? { panel, count } : undefined)
  }
  /** A new cartridge takes the Cartridge card's changed values: they follow the record again. */
  const dropCartridgeChanges = () => {
    const keys = cardKeys.cartridge.filter((k) => changes[k] !== undefined)
    noteReplaced('cartridge')
    for (const k of keys) form.setFieldValue(k, emptyStep)
    setFollowed((f) => new Set([...f, ...keys.filter(isFollowKey)]))
  }
  /** The record pickers of the cards: each notes the changed values the new record replaces. */
  const pickBullet = (id: string) => {
    noteReplaced('bullet')
    return chooseBullet(id)
  }
  const pickDesign = (id: string) => {
    noteReplaced('bullet')
    chooseDesign(id)
  }
  const pickCartridge = (c: CartridgeChoice) => {
    if (c.id !== cartridge?.id) dropCartridgeChanges()
    chooseCartridge(c)
  }
  const pickCartridgeDesign = (id: string) => {
    dropCartridgeChanges()
    chooseCartridgeDesign(id)
  }
  const pickPowder = (id: string) => {
    noteReplaced('powder')
    return choosePowder(id)
  }
  const pickPowderDesign = (id: string) => {
    noteReplaced('powder')
    choosePowderDesign(id)
  }
  const pickFirearm = (id: string | null) => {
    const f = firearmList.find((r) => r.id === id)
    noteReplaced('firearm', [
      ...(f?.data.twist === undefined ? [] : ['twist']),
      ...(f?.data.firearmMass === undefined ? [] : ['firearmMass']),
    ])
    chooseFirearm(id)
  }
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
      // a session another tab (the range page) added to the stored load since this one opened it stays
      const stored = await storedRecord(record.id).catch(() => undefined)
      const merged = withStoredSessions(record, stored, openedRefs.current)
      await putRecords([
        ...(c ? [capacityRecord(c.cartridge, c.m3, new Date())] : []),
        ...changed,
        merged,
      ])
      // the page does not show a session another tab added: it stays unknown here, so every Save
      // keeps it until the load is opened again
      openedRefs.current = record.kind === 'load' ? (record.data.sessions ?? []) : []
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
  const firearmData: Firearm | undefined = firearms.find((f) => f.id === firearm)?.data
  const effective = effectiveSnapshots(sessionRefs, snapshots, {
    lots,
    seating: seating && { by: seating.by, value: storedOf('length', seating.value).value },
    roundCount: firearmData?.roundCount,
  })
  useCommit(snapshotsNow, effective)
  const noteList = notesOf(
    sessionRefs,
    effective,
    chronoSessions,
    fieldValues.charge,
    firearmData?.noteAtRoundCount,
  )
  const sessionNames = Object.fromEntries(chronoSessions.map((r) => [sessionRef(r.id), r.name]))
  const noteKey = JSON.stringify([lots, noteList, sessionNames])
  // biome-ignore lint/correctness/useExhaustiveDependencies: `noteKey` holds the values
  const loadNotes = useMemo<LoadNotesState>(
    () => ({
      lots,
      setLots,
      notes: noteList,
      sessionName: (ref) => sessionNames[ref] ?? t('a session of another browser'),
      dismiss: (session, rule) =>
        setSnapshots((stored) => dismissed(stored, snapshotsNow.current, session, rule)),
    }),
    [noteKey, t],
  )
  const loadParts: LoadParts = {
    lots,
    snapshots: effective,
    values: fieldValues,
    given,
    cartridge: cartridgeRef,
    firearm: firearmRef,
    bullet: savedRef(asked.bullet?.id, bulletDesign?.id, bullet?.id),
    powder: savedRef(asked.powder?.id, powderDesign?.id, powder?.id),
    notes,
    capacity: capacityRef,
    caseRecord:
      (chosenOwnCase && userRefOf(chosenOwnCase)) || (chosenCase && catalogueRef(chosenCase)),
    primerRecord: catalogueRefIn(primerChoice),
    seating,
    ladder: ladderPartOf(ladderSteps, ladderKind, activeStep.si, direction),
    bulletBase: savedBaseType,
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
    if (!k || !followed.has(k) || (k === 'volume' && seatingOwnsVolume(seated))) return
    const given = suggestions[k]
    return given && !given.fromFirearm && fields[key]?.si === given.si ? given : undefined
  }
  const suggestionKey = JSON.stringify(followKeys.map((k) => suggestions[k]?.si))
  const seatedVolume = seatingOwnsVolume(seated)
  // a followed field takes its default when it changes; what was typed is not in `followed`
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a change of a default or of what follows
  useEffect(() => {
    const writes = followWrites({
      followed,
      seatedVolume: seatingOwnsVolume(seatedNow.current),
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
  const bc = bcOf(bulletNow)

  /** A new load with nothing chosen or typed: the start card replaces the cards. */
  const fresh = isFresh({
    chosen: [cartridge, cartridgeDesign, bullet, bulletDesign, powder, powderDesign, outcome],
    byHand,
    fields,
    defaulted,
  })
  const has = (keys: readonly string[]) => keys.every((k) => fields[k]?.si !== undefined)
  /** What a run still needs, in the order of the cards; the first open one is next. */
  const todo = todoOf({
    cartridge,
    cartridgeDesign,
    bulletLabel,
    bulletDesign,
    powderLabel,
    has,
    t,
  })
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
        area: fields.boreArea?.si ?? qUsed,
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

  const bulletNote = clearedBullet
    ? t(
        'Bullet record {record} cleared: its diameter {diameter} does not fit {cartridge} (over {above}, up to G1 {g1}); the bullet mass stays as typed.',
        {
          record: clearedBullet.record,
          diameter: mmLength(system, clearedBullet.diameter),
          cartridge: clearedBullet.cartridge,
          above: mmLength(system, clearedBullet.above),
          g1: mmLength(system, clearedBullet.g1),
        },
      )
    : ''

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
    bulletNow,
    bulletRecord,
    bulletValues,
    bulletBaseType,
    baseChanged,
    typedBulletFields,
    setTypedBullet,
    bulletFit,
    bulletParams,
    describeBullet,
    bulletLabel,
    powderLabel,
    fresh,
    mmText,
    siLength,
    nextPanel,
    pmax,
    changes,
    resetKeys,
    replaced,
    pickBullet,
    pickDesign,
    pickCartridge,
    pickCartridgeDesign,
    pickPowder,
    pickPowderDesign,
    pickFirearm,
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
    cartridgeBoreArea: qUsed,
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
    opened,
    origin,
    outcome,
    measuredWaterCapacity,
    capacityId: chosenCapacity,
    setCapacityChoice: chooseCapacity,
    caseId: chosenCase,
    setCaseChoice: chooseCase,
    primerId: primerChoice,
    setPrimerChoice,
    ownCases: cartridgeCases,
    ownCaseId: chosenOwnCase,
    chooseOwnCase,
    storeLoad,
    pending,
    powder: chosenPowder,
    powderDesign,
    powderDesigns: powderDesignList,
    choosePowderDesign,
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
    loadNotes,
    sessionRefCount: sessionRefs.length,
    handOffTune,
    setSeen,
    setStepsDraft,
    setTab,
    showChart,
    sight,
    suggestions,
    status: statusText(status, outcome && resultLineOf(outcome, system, t), t),
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
