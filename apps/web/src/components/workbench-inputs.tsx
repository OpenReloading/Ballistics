'use client'

import {
  ActionIcon,
  Button,
  Loader,
  NumberInput,
  Paper,
  Popover,
  Select,
  Switch,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { boreArea } from '@open-reloading/core'
import { type Bullet, toSi } from '@open-reloading/schema'
import { DotsThree } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../i18n/language.ts'
import { plainNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import type { BulletSummary, CartridgeSummary, PowderSummary } from '../lib/api-types.ts'
import { fitOf, summaryFitSource } from '../lib/bullet-fit.ts'
import type { BulletRow } from '../lib/bullet-rows.ts'
import { findBullets } from '../lib/bullet-search.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { dayText } from '../lib/dates.ts'
import { quickCartridges } from '../lib/examples.ts'
import {
  type FieldSpec,
  type FieldValue,
  fieldError,
  siValues,
  specText,
} from '../lib/field-spec.ts'
import { landsFor } from '../lib/firearm.ts'
import { type FollowKey, followKeys } from '../lib/input-defaults.ts'
import { burnFormError, interiorFields } from '../lib/interior-input.ts'
import { productLabel } from '../lib/manufacturers.ts'
import { newerFit } from '../lib/powder-designer.ts'
import { loadFitMark, recordMark } from '../lib/powder-record.ts'
import { constructionRows, titleFromKebab } from '../lib/record-fields.ts'
import {
  type LadderDirection,
  ladderKinds,
  runKindOf,
  temperatureLadderBlockReason,
} from '../lib/seating-ladder.ts'
import { shortcutAriaKeys, shortcutLabel } from '../lib/shortcuts.ts'
import { userBulletRows, userRecordId } from '../lib/sources.ts'
import { cartridgeOptionText } from '../lib/standards.ts'
import { controlSize } from '../lib/theme.ts'
import { formatQuantity, inchText, lengthText, type UnitSystem } from '../lib/units.ts'
import { catalogueRef, userRef } from '../lib/variants.ts'
import type { InputPanel } from '../lib/workbench.ts'
import { citedDefaults, type DefaultKey } from '../lib/workbench-defaults.ts'
import { AppPopover, popoverWidth } from './app-popover.tsx'
import { Noted } from './field-table.tsx'
import { LotField } from './load-notes.tsx'
import { NavIcon } from './nav-icons.tsx'
import { NumberField } from './number-field.tsx'
import { PrimerChoice } from './primer-choice.tsx'
import { RecordSearch } from './record-search.tsx'
import { SegmentedRow } from './segmented-row.tsx'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import { useLoad, useResult } from './workbench-context.ts'
import { CartridgeFigure } from './workbench-figure.tsx'
import { isPreviewKey, notReached } from './workbench-outcome.ts'
import { BurnFigure } from './workbench-results.tsx'

/** Interior fields of each panel, in reading order. */
const panelFields: Record<InputPanel, readonly string[]> = {
  cartridge: ['volume', 'boreDiameter', 'boreArea'],
  bullet: ['bulletMass'],
  powder: ['charge', 'propellantTemperature'],
  firearm: ['travel', 'twist'],
}
/** The Powder panel's collapsed group "Model parameters". */
export const modelFields = [
  'propellantEnergy',
  'gamma',
  'density',
  'covolume',
  'vivacity',
  'exponent',
  'referencePressure',
  'ignitionPressure',
  'startPressure',
  'sebert',
  'formA',
  'formM',
  'formQ',
  'formZ1',
] as const
/** The Powder card's optional leak and bore resistance fields, in its More popover. */
export const powderMoreFields = [
  'leakArea',
  'boreFriction',
  'engravingPressure',
  'engravingLength',
] as const
/** Model parameters a run needs (the burn form and the Sébert factor are optional). */
export const requiredModelKeys: readonly string[] = modelFields.filter((k) =>
  interiorFields.some((f) => f.key === k && 'required' in f && f.required),
)
/** The two-stage burn form fields, checked together. */
const burnFormKeys = ['formA', 'formM', 'formQ', 'formZ1']
/** Ladder step size; the charge field is the first step. */
export const ladderSpec = {
  key: 'ladderStep',
  label: msg('Step size'),
  quantity: 'charge',
  required: true,
  min: 0,
} as const satisfies FieldSpec

/** Seating ladder step size, a length; the seating field is the first step. */
export const seatingStepSpec = {
  key: 'seatStep',
  label: msg('Step size'),
  quantity: 'length',
  required: true,
  min: 0,
} as const satisfies FieldSpec

/** Temperature ladder step size, a difference of temperatures; the Powder temperature field is the first step. */
export const temperatureStepSpec = {
  key: 'tempStep',
  label: msg('Step size'),
  quantity: 'temperatureDifference',
  required: true,
  min: 0,
} as const satisfies FieldSpec

/** Steps the API accepts at most (`caps.ladderSteps`). */
export const maxLadderSteps = 21
/** A link's or file's direction; anything else is up. */
export const directionOf = (v: string | null): LadderDirection =>
  v === 'down' || v === 'around' ? v : 'up'
export const emptyStep: FieldValue = { text: '', si: undefined }
/** The Gun card's gun weight: not an interior input, it only feeds the free recoil readout. */
export const firearmMassSpec = {
  key: 'firearmMass',
  label: msg('Gun weight'),
  help: msg('With scope and attachments. Feeds the free recoil readout only.'),
  quantity: 'firearmMass',
  positive: true,
} as const satisfies FieldSpec

/**
 * Input groups from 75em: Cartridge and below it the cartridge figure in the first column, Powder,
 * Bullet and Gun in the second. In a window lower than 45em the burn-rate figure takes the cartridge
 * figure's place, which is then the result tab Cartridge (`FigureTab`). Below 75em the columns have
 * no box: one flow in this order.
 */
const panelColumns: InputPanel[][] = [['cartridge'], ['powder', 'bullet', 'firearm']]

/** The desktop frame of a window lower than 45em (`panelColumns`). */
export const shortFrame = '(min-width: 75em) and (max-height: 44.99em)'
const panelTitles: Record<InputPanel, Message> = {
  cartridge: msg('Cartridge'),
  bullet: msg('Bullet'),
  powder: msg('Powder'),
  firearm: msg('Gun'),
}

/** Panel icons, as the sidebar's (`nav-icons.tsx`); the heading names the panel. */
const panelIcon: Record<InputPanel, string> = {
  cartridge: '/cartridges',
  bullet: '/bullets',
  powder: '/powders',
  firearm: '/firearms',
}

function PanelIcon({ panel }: { panel: InputPanel }) {
  return <NavIcon name={panelIcon[panel]} size={18} />
}

/** `g1`, `land`, `groove`: the cartridge-side G1 and chamber-side F and Z of the CIP record, mm. */
export type CartridgeChoice = {
  id: string
  name: string
  g1?: number | undefined
  land?: number | undefined
  groove?: number | undefined
}

/**
 * A record's value as a read-only row of its card: what the simulation reads, not typed; the unit
 * in its own column, as the fields'.
 */
const recordRow = (label: string, value: ReactNode, unit?: string) =>
  value != null && (
    <div key={label} className="record-row wide">
      <span>{label}</span>
      <span>{value}</span>
      {unit && <span className="record-unit">{unit}</span>}
    </div>
  )

/** A length in mm as the cards show it: the number in the length unit, inches below 1 as ".3". */
const lengthCell = (system: UnitSystem, mm: number) =>
  inchText(lengthText('diameter', system, toSi('length', mm)), system.length.symbol)

/** Diameter and length on one row, or the diameter alone. */
function sizeRow(b: Bullet | undefined, system: UnitSystem, t: Translator['t']) {
  if (!b) return false
  const d = lengthCell(system, b.diameter.value)
  return b.length
    ? recordRow(
        t('Diameter × length'),
        `${d} × ${lengthCell(system, b.length.value)}`,
        system.length.symbol,
      )
    : recordRow(t('Diameter'), d, system.length.symbol)
}

/** The construction on one line: the structure, the full wording on hover; else the wording. */
function constructionCell(c: Bullet['construction']) {
  const text = constructionRows(c)[0]?.text
  const short = c?.structure && titleFromKebab(c.structure)
  return short && short !== text ? <Noted value={short} notes={[text as string]} inline /> : text
}

/** The Powder card's charge ladder: the step count, and with more than one the step size and direction. */
const directions = [
  { value: 'up', label: msg('Up') },
  { value: 'down', label: msg('Down') },
  { value: 'around', label: msg('Around') },
] as const

/** The step size of a ladder: its field, spec and value follow the kind of ladder. */
function StepSizeField() {
  const {
    system,
    ladder,
    ladderError,
    ladderKind,
    seatStep,
    tempStep,
    markChanged,
    setLadderError,
    stepError,
    setLadder,
    setSeatStep,
    setTempStep,
  } = useLoad()
  const spec =
    ladderKind === 'seating'
      ? seatingStepSpec
      : ladderKind === 'temperature'
        ? temperatureStepSpec
        : ladderSpec
  const value =
    ladderKind === 'seating'
      ? seatStep.seatStep
      : ladderKind === 'temperature'
        ? tempStep.tempStep
        : ladder.ladderStep
  const setValue = (v: FieldValue) => {
    if (ladderKind === 'seating') setSeatStep({ seatStep: v })
    else if (ladderKind === 'temperature') setTempStep({ tempStep: v })
    else setLadder({ ladderStep: v })
  }
  return (
    <NumberField
      spec={spec}
      system={system}
      value={value}
      // shown once a run or blur found one, and gone as soon as the cause is fixed
      error={ladderError && stepError}
      onBlur={() => setLadderError(stepError())}
      onChange={(v) => {
        markChanged()
        setValue(v)
        if (ladderError) setLadderError(undefined)
      }}
    />
  )
}

/** The ladder's step count: a number sets the count at once, so Enter runs it. */
function StepCountInput() {
  const {
    direction,
    ladderSteps,
    stepsDraft,
    markChanged,
    setLadderSteps,
    setLadderError,
    setStepsDraft,
  } = useLoad()
  const { t } = useTranslation()
  const around = direction === 'around'
  return (
    <NumberInput
      className="ladder-steps"
      label={around ? t('Steps each side') : t('Ladder steps')}
      labelProps={{ className: 'visually-hidden' }}
      hideControls
      // around, 0 steps each side is the charge alone
      min={around ? 0 : 1}
      max={around ? (maxLadderSteps - 1) / 2 : maxLadderSteps}
      allowDecimal={false}
      clampBehavior="strict"
      value={stepsDraft ?? (around ? (ladderSteps - 1) / 2 : ladderSteps)}
      onChange={(v) => {
        setStepsDraft(v)
        // a number sets the count at once, so Enter runs it; an empty field keeps the count
        if (typeof v !== 'number') return
        markChanged()
        setLadderSteps(around ? 2 * v + 1 : v)
        setLadderError(undefined)
      }}
      onBlur={() => setStepsDraft(undefined)}
    />
  )
}

/** The reason a ladder kind cannot be chosen now, if any. */
function ladderKindReason(
  k: (typeof ladderKinds)[number],
  ladderKind: string,
  powderLabel: string | undefined,
  sensitive: boolean,
  seatingBlock: string | undefined,
  t: Translator['t'],
) {
  if (k.value === ladderKind) return
  if (k.value === 'temperature') return temperatureLadderBlockReason(powderLabel, sensitive, t)
  return k.value === 'seating' ? seatingBlock : undefined
}

/** The ladder kind and direction, once there is more than one step. */
function LadderChoices() {
  const {
    direction,
    ladderSteps,
    ladderKind,
    seatingBlock,
    powderLabel,
    powder,
    setLadderKind,
    markChanged,
    setLadderSteps,
    setLadderError,
    setDirection,
  } = useLoad()
  const id = useId()
  const { t } = useTranslation()
  return (
    <>
      <SegmentedRow
        legend={t('Ladder')}
        name={`${id}-kind`}
        value={ladderKind}
        segments={ladderKinds.map((k) => ({
          value: k.value,
          label: t(k.label),
          reason: ladderKindReason(
            k,
            ladderKind,
            powderLabel,
            powder?.temperatureSensitivity !== undefined,
            seatingBlock,
            t,
          ),
        }))}
        onChange={(v) => {
          markChanged()
          setLadderKind(runKindOf(v))
          setLadderError(undefined)
        }}
      />
      <SegmentedRow
        legend={t('Direction')}
        name={`${id}-direction`}
        value={direction}
        segments={directions.map((d) => ({ value: d.value, label: t(d.label) }))}
        onChange={(next) => {
          markChanged()
          // around the charge needs an odd count of charges
          if (next === 'around' && ladderSteps % 2 === 0) setLadderSteps(ladderSteps + 1)
          setDirection(next)
        }}
      />
    </>
  )
}

function LadderInputs() {
  const { direction, ladderSteps } = useLoad()
  const { t } = useTranslation()
  const stepsLabel = direction === 'around' ? t('Steps each side') : t('Ladder steps')
  return (
    <>
      {/* the count and, with more than one step, the step size in one row of one unit */}
      <div className="pair-row wide">
        <span
          aria-hidden="true"
          title={
            direction === 'around'
              ? t('Charges below and above the charge, which is the middle step.')
              : t('The charge is step 1.')
          }
        >
          {/* around, the longer label alone fits the row */}
          {direction === 'around' ? stepsLabel : t('Ladder steps, size')}
        </span>
        {/* the state is the number of charges; around the charge the field counts the steps per side */}
        <StepCountInput />
        {ladderSteps > 1 && <StepSizeField />}
      </div>
      {ladderSteps > 1 && <LadderChoices />}
    </>
  )
}

/** What a run still needs, in the order of the cards; `next` is the first open step. */
export function Checklist({
  todo,
  next,
}: {
  todo: { label: string; done: boolean; value?: string | undefined }[]
  next: number
}) {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="next-steps" className="next-steps">
      <h2 id="next-steps">{t('Before the first run')}</h2>
      <ol>
        {todo.map((s, i) => (
          <li key={s.label} data-done={s.done || undefined} data-next={i === next || undefined}>
            <span aria-hidden="true">{s.done ? '✓' : i + 1}</span> {specText(t, s.label)}
            {s.value && <span className="next-steps-value">: {s.value}</span>}
            {i === next && <span className="visually-hidden"> {t('(next)')}</span>}
          </li>
        ))}
      </ol>
      <p>
        {next === -1 || (next === 0 && todo.slice(1).every((s) => s.done))
          ? t('Ready: press Run simulation or {shortcut}.', { shortcut: shortcutLabel('run') })
          : t('Run simulation needs every step but the cartridge.')}
      </p>
    </section>
  )
}

/** A new load with nothing chosen or typed: the start card replaces the cards. `onAct` hears a click or key in the card. */
export function StartCard({ onAct }: { onAct?: () => void }) {
  const { chooseCartridge: onCartridge, asNewLoad, fillExample, setByHand } = useLoad()
  const { t } = useTranslation()
  return (
    <Paper
      component="section"
      withBorder
      className="start-card"
      aria-labelledby="start-title"
      onClickCapture={onAct}
      onKeyDownCapture={onAct}
    >
      <h2 id="start-title">{t('Start a load')}</h2>
      <p>
        {t(
          'Step 1: choose the cartridge. Its CIP record limits the bullets to its groove and gives the chamber values and the maximum pressure.',
        )}
      </p>
      <CardPicker panel="cartridge" />
      <p className="start-label">{t('Common cartridges')}</p>
      <div className="start-picks">
        {quickCartridges.map((c) => (
          <Button
            key={c.id}
            variant="default"
            size={controlSize.row.button}
            onClick={() => onCartridge(c)}
          >
            {c.name}
          </Button>
        ))}
      </div>
      <div className="start-actions">
        <Button variant="light" onClick={asNewLoad(fillExample)}>
          {t('Try the example load')}
        </Button>
        <Button variant="subtle" onClick={() => setByHand(true)}>
          {t('Enter values by hand')}
        </Button>
      </div>
      <p className="start-label">{t('A saved load opens from Open in the page bar.')}</p>
    </Paper>
  )
}

/** The input cards Cartridge, Bullet, Gun, Powder with the figure, and the Run bar. */
export function InputCards() {
  const {
    inputs,
    more,
    setMore,
    nextPanel,
    pending,
    cartridge,
    cartridgeDesign,
    bullet,
    bulletDesign,
    powder,
    firearm,
    linkedBullet,
    linkedPowder,
  } = useLoad()
  // the server and the first render lay out a tall window; a low one moves Gun once mounted
  const { t } = useTranslation()
  const short = useMediaQuery(shortFrame, false) ?? false
  const [figureCard, setFigureCard] = useState<HTMLDivElement | null>(null)
  const { figureTab } = useLoad()
  /** The card's record is chosen: the head shows its name as text. */
  const chosen: Record<InputPanel, boolean> = {
    cartridge: !!(cartridge || cartridgeDesign),
    bullet: !!(bullet || bulletDesign || linkedBullet?.name),
    powder: !!(powder || linkedPowder?.name),
    firearm: !!firearm,
  }
  return (
    <form ref={inputs} noValidate onSubmit={(e) => e.preventDefault()} aria-label={t('Load')}>
      {/* fixed cards: icon and title in the heading, the record in its picker */}
      <div className="panels">
        <LoadRow />
        {panelColumns.map((column, i) => (
          <div key={column[0]} className="panel-column">
            {column.map((p) => (
              <Paper
                key={p}
                component="section"
                withBorder
                className="panel"
                data-panel={p}
                aria-labelledby={`panel-${p}`}
                data-next={p === nextPanel || undefined}
              >
                <div className="panel-head" data-chosen={chosen[p] || undefined}>
                  <PanelIcon panel={p} />
                  {/* the title, then the record's name in its search field */}
                  <h2 id={`panel-${p}`} className="panel-title">
                    {t(panelTitles[p])}
                  </h2>
                  {p !== 'cartridge' && <CardPicker panel={p} />}
                  {p === 'powder' && <LotField lot="powder" bare />}
                  {morePanels.includes(p) && (
                    <AppPopover
                      opened={more === p}
                      onChange={(o) => setMore(o ? p : undefined)}
                      position="bottom-end"
                      width={popoverWidth.fields}
                      keepMounted
                      trapFocus
                    >
                      <Popover.Target>
                        <ActionIcon
                          size={controlSize.row.icon}
                          variant="subtle"
                          color="gray"
                          aria-label={t('More of {panel}', { panel: t(panelTitles[p]) })}
                          aria-expanded={more === p}
                          onClick={() => setMore(more === p ? undefined : p)}
                        >
                          <DotsThree size={18} weight="bold" aria-hidden="true" />
                        </ActionIcon>
                      </Popover.Target>
                      <Popover.Dropdown>
                        <div className="panel-fields more-fields" data-panel={p}>
                          <CardMore panel={p} />
                        </div>
                      </Popover.Dropdown>
                    </AppPopover>
                  )}
                </div>
                <CardBody panel={p} />
              </Paper>
            ))}
            {i === 0 &&
              (short ? <BurnFigure /> : <div ref={setFigureCard} className="figure-host" />)}
          </div>
        ))}
      </div>
      <LoadFigure host={short ? figureTab : figureCard} />
      <div className="run-bar">
        <RunButton />
        <span className="run-hint">{t('or {shortcut}', { shortcut: shortcutLabel('run') })}</span>
        {pending && <Loader size="xs" aria-hidden="true" />}
      </div>
    </form>
  )
}

/**
 * The pinned row above the cards: the cartridge search, then the choices that depend on it in that
 * order, primer and its lot, brass record and its lot and case capacity record (the `choices` slot).
 */
function LoadRow() {
  const { primerId, setPrimerChoice } = useLoad()
  return (
    <div className="pinned-row">
      <CartridgePicker />
      <PrimerChoice id={primerId} onChange={setPrimerChoice} />
      <LotField lot="primer" short />
      <SeatingSlot name="choices" />
    </div>
  )
}

/** The seating preview's slots in the cards. */
export const seatingSlotNames = ['cartridge', 'gun', 'choices', 'more', 'moreValues'] as const
export type SeatingSlotName = (typeof seatingSlotNames)[number]

/**
 * A named place for the seating preview's controls: the case capacity, seating and its values
 * (`cartridge`), the barrel length (`gun`), the brass and capacity record choices of the pinned row
 * (`choices`), the notes (`more`) and further values (`moreValues`, a `dl`).
 */
function SeatingSlot({ name }: { name: SeatingSlotName }) {
  const { slotRefs } = useLoad()
  if (name === 'moreValues') return <dl ref={slotRefs[name]} className="seating-more wide" />
  if (name === 'choices') return <div ref={slotRefs[name]} className="pinned-row-slot" />
  return <div ref={slotRefs[name]} className="seating-slot wide" />
}

/** The cards with a More popover. */
const morePanels: readonly InputPanel[] = ['cartridge', 'bullet', 'powder']

type LoadValues = ReturnType<typeof useLoad>
type InteriorSpec = (typeof interiorFields)[number]

/** What an optional empty field stands for. */
function fieldPlaceholder(
  key: string,
  quantity: InteriorSpec['quantity'],
  fromRecord: number | undefined,
  boreDiameter: number | undefined,
  bore: {
    cartridgeBoreArea: LoadValues['cartridgeBoreArea']
    grooveDiameter: LoadValues['grooveDiameter']
  },
  t: Translator['t'],
) {
  if (key === 'boreArea' && boreDiameter)
    return (s: UnitSystem) =>
      formatQuantity(
        'area',
        s,
        boreArea({
          area: bore.cartridgeBoreArea,
          boreDiameter: boreDiameter ?? 0,
          grooveDiameter: bore.grooveDiameter,
        }),
      )
  if (key === 'sebert') return 'Lagrange'
  if (key.startsWith('form')) return t('constant')
  if (fromRecord !== undefined) return (s: UnitSystem) => formatQuantity(quantity, s, fromRecord)
  return
}

/** The note of a field that holds a Settings or cited default. */
function defaultMark(key: string, defaults: LoadValues['defaults'], t: Translator['t']) {
  const cited = citedDefaults[key as DefaultKey]
  const source =
    defaults[key as DefaultKey] === cited.si ? t(cited.source) : t('your default from Settings')
  return t('Default: {source}.', { source })
}

type LoadFieldMarkArgs = {
  key: string
  spec: InteriorSpec
  fields: LoadValues['fields']
  defaulted: LoadValues['defaulted']
  defaults: LoadValues['defaults']
  given: ReturnType<LoadValues['defaultOf']>
  fromRecord: number | undefined
  powder: LoadValues['powder']
  powderDesign: LoadValues['powderDesign']
  origin: LoadValues['origin']
  tn: Translator['tn']
}

/** The mark of a field in the units it shows: where its value comes from. */
function loadFieldMark(
  s: UnitSystem,
  {
    key,
    spec,
    fields,
    defaulted,
    defaults,
    given,
    fromRecord,
    powder,
    powderDesign,
    origin,
    tn,
  }: LoadFieldMarkArgs,
  t: Translator['t'],
) {
  if (defaulted.has(key)) return defaultMark(key, defaults, t)
  if (given) return t('Default: {source}.', { source: given.source })
  if (fromRecord !== undefined)
    return fields[key]?.si === undefined
      ? t("From the powder record's bore-resistance law. A typed value replaces it.")
      : t('Typed. The powder record gives {value} {unit}.', {
          value: formatQuantity(spec.quantity, s, fromRecord),
          unit: s[spec.quantity].symbol,
        })
  return (
    powder &&
    origin &&
    recordMark(
      powder,
      origin,
      key,
      fields[key]?.si,
      (si) =>
        [formatQuantity(spec.quantity, s, si), s[spec.quantity].symbol].filter(Boolean).join(' '),
      powderDesign ? 'user design' : 'record',
      t,
      loadFitMark(powderDesign, origin, siValues(fields), s, dayText, { t, tn }),
    )
  )
}

/** The flag of a field that holds the seated bullet's value. */
function seatingFlag(
  key: string,
  seated: LoadValues['seated'],
  previewed: LoadValues['previewed'],
  fields: LoadValues['fields'],
  t: Translator['t'],
) {
  if (!isPreviewKey(key) || seated[key] === undefined || previewed[key] === undefined) return
  if (fields[key]?.si !== previewed[key]) return
  return {
    kind: 'seating' as const,
    text: t(
      'From the seated bullet in the Cartridge card, approximate: derived from the bullet and case geometry. A typed value replaces it; an emptied field follows again.',
    ),
  }
}

/** The action of a field that holds another value than the seated bullet's: use it again. */
function seatingAction(
  key: string,
  spec: InteriorSpec,
  seated: LoadValues['seated'],
  previewed: LoadValues['previewed'],
  fields: LoadValues['fields'],
  takeSeated: LoadValues['takeSeated'],
  t: Translator['t'],
) {
  if (!isPreviewKey(key) || seated[key] === undefined || fields[key]?.si === previewed[key]) return
  return {
    kind: 'restore' as const,
    text: (s: UnitSystem) =>
      t('Use seating: {label} {value} {unit} from the seated bullet, and follow it again', {
        label: specText(t, spec.label),
        value: formatQuantity(spec.quantity, s, seated[key] as number),
        unit: s[spec.quantity].symbol,
      }),
    onClick: () => takeSeated(key),
  }
}

/** One interior field of the load, with its marks, flag, restore action and error. */
function LoadField({ name: key }: { name: string }) {
  const {
    form,
    fields,
    system,
    defaulted,
    defaultOf,
    defaults,
    grooveDiameter,
    cartridgeBoreArea,
    setFollowed,
    powder,
    powderDesign,
    origin,
    seated,
    previewed,
    takeSeated,
    follow,
    markChanged,
    setDefaulted,
    setBulletDesign,
    printing,
    printMedia,
    recordBore,
  } = useLoad()
  const { t, tn } = useTranslation()
  const spec = interiorFields.find((s) => s.key === key)
  if (!spec) throw new Error(`no field ${key}`)
  const props = form.getInputProps(key)
  const value = fields[key]
  /** The default this field holds, with where it comes from (`input-defaults.ts`). */
  const given = defaultOf(key)
  const followable = (followKeys as readonly string[]).includes(key)
  /** What the powder record's bore-resistance law gives this field, SI. */
  const fromRecord = recordBore?.[key as keyof typeof recordBore]
  return (
    <NumberField
      spec={spec}
      system={system}
      // print writes inches below 1 as the readouts do, ".3"; the field keeps its text
      value={
        (printing || printMedia) && value
          ? { ...value, text: inchText(value.text, system[spec.quantity].symbol) }
          : value
      }
      // what an optional empty field stands for
      placeholder={fieldPlaceholder(
        key,
        spec.quantity,
        fromRecord,
        fields.boreDiameter?.si,
        { cartridgeBoreArea, grooveDiameter },
        t,
      )}
      muted={given !== undefined}
      // texts naming a unit follow the units the field shows
      mark={(s) =>
        loadFieldMark(
          s,
          {
            key,
            spec,
            fields,
            defaulted,
            defaults,
            given,
            fromRecord,
            powder,
            powderDesign,
            origin,
            tn,
          },
          t,
        )
      }
      // in the units the field shows, so a unit switch rewrites a shown message
      error={
        props.error &&
        ((s) =>
          fieldError(spec, fields[key], s, t) ??
          burnFormError(siValues(fields), key, t) ??
          // a message a run set, as the engraving values needing each other
          (typeof props.error === 'string' ? translateMessage(props.error, t) : undefined))
      }
      flag={seatingFlag(key, seated, previewed, fields, t)}
      action={seatingAction(key, spec, seated, previewed, fields, takeSeated, t)}
      onBlur={() => {
        // an emptied field takes its default again
        if (followable && !fields[key]?.text.trim())
          setFollowed((s) => new Set([...s, key as FollowKey]))
        // an emptied volume or travel follows the seated bullet again
        if (key in seated && !fields[key]?.text.trim()) {
          follow(seated)
          form.clearFieldError(key)
        } else props.onBlur()
      }}
      onChange={(value) => {
        markChanged()
        if (defaulted.has(key)) setDefaulted((s) => new Set([...s].filter((k) => k !== key)))
        if (followable) setFollowed((s) => new Set([...s].filter((k) => k !== key)))
        if (key === 'bulletMass') setBulletDesign(undefined)
        form.setFieldValue(key, value)
        // once a field shows an error it is checked on each change; a burn form value checks the other three
        for (const k of key.startsWith('form') ? burnFormKeys : [key])
          if (form.errors[k]) form.validateField(k)
      }}
    />
  )
}

const fieldsOf = (keys: readonly string[]) => keys.map((k) => <LoadField key={k} name={k} />)

/** The note on a load whose powder design has a newer fit, with the switch to it. */
function NewerFitNote() {
  const { powderDesign, powderDesigns, choosePowderDesign } = useLoad()
  const { t } = useTranslation()
  const newer = powderDesign && newerFit(powderDesigns, powderDesign.id)
  if (!newer) return null
  return (
    <p className="note wide">
      {t('A newer fit of this powder exists.')}{' '}
      <Button
        size={controlSize.row.button}
        variant="default"
        onClick={() => choosePowderDesign(newer.id)}
      >
        {t('Use the refit')}
      </Button>
    </p>
  )
}

/** A card's fields and record rows. */
function CardBody({ panel }: { panel: InputPanel }) {
  const {
    system,
    bullet,
    powder,
    bulletNote,
    pmax,
    specValue,
    bc,
    modelShown,
    setModelShown,
    printing,
    printMedia,
    gunWeight,
    setGunWeight,
    markChanged,
  } = useLoad()
  const { t } = useTranslation()
  // the gun weight's message waits for the end of the typing, as "0." on the way to "0.5" is no error
  const [gunLeft, setGunLeft] = useState(false)
  const l3 = specValue('cartridge', 'L3')
  if (panel === 'cartridge')
    return (
      <div className="panel-fields">
        {recordRow(
          t('CIP Pmax'),
          pmax === undefined
            ? undefined
            : formatQuantity('pressure', system, toSi('pressure', pmax)),
          system.pressure.symbol,
        )}
        {recordRow(
          t('Case length, CIP L3'),
          l3 === undefined ? undefined : lengthCell(system, l3),
          system.length.symbol,
        )}
        {fieldsOf(panelFields.cartridge)}
        {/* case capacity, COAL or CBTO and the seating values of the figure */}
        <SeatingSlot name="cartridge" />
      </div>
    )
  if (panel === 'bullet')
    return (
      <div className="panel-fields">
        {/* one line each, so the column fits at 1366 x 650 */}
        {sizeRow(bullet, system, t)}
        {recordRow(t('Ballistic coefficient'), bc && `${bc.dragModel} ${plainNumber(bc.value)}`)}
        {recordRow(t('Construction'), constructionCell(bullet?.construction))}
        {bulletNote && <p className="note wide">{bulletNote}</p>}
        {fieldsOf(panelFields.bullet)}
      </div>
    )
  if (panel === 'powder')
    return (
      <div className="panel-fields">
        {recordRow(
          t('Bulk density'),
          powder?.bulkDensity &&
            formatQuantity('density', system, toSi('density', powder.bulkDensity.value)),
          system.density.symbol,
        )}
        <NewerFitNote />
        {fieldsOf(panelFields.powder)}
        <LadderInputs />
        {/* the model parameters behind one row at every width; an invalid one opens it */}
        <div className="model-row wide">
          <span>{t('Model parameters')}</span>
          <Button
            size={controlSize.row.button}
            variant="default"
            aria-expanded={modelShown}
            onClick={() => setModelShown((v) => !v)}
          >
            {modelShown ? t('Hide') : t('Show')}
          </Button>
        </div>
        {(modelShown || printing || printMedia) && fieldsOf(modelFields)}
      </div>
    )
  return (
    <div className="panel-fields">
      {fieldsOf(panelFields.firearm)}
      {/* the barrel length of the figure */}
      <SeatingSlot name="gun" />
      <NumberField
        spec={firearmMassSpec}
        system={system}
        value={gunWeight}
        error={gunLeft ? (s) => fieldError(firearmMassSpec, gunWeight, s, t) : undefined}
        onBlur={() => setGunLeft(true)}
        onChange={(value) => {
          markChanged()
          setGunLeft(false)
          setGunWeight(value)
        }}
      />
    </div>
  )
}

const BulletSearchDialog = dynamic(
  () => import('./bullet-search-dialog.tsx').then((m) => m.BulletSearchDialog),
  { ssr: false },
)

/** The Bullet card's picker: the inline quick search, and a button that opens the search dialog. */
function BulletPicker() {
  const {
    bulletLabel,
    bulletDesign,
    designs,
    bulletParams,
    describeBullet,
    chooseBullet,
    chooseDesign,
    readDesigns,
    linkedBullet,
    cartridge,
    system,
  } = useLoad()
  const { t } = useTranslation()
  const [dialog, setDialog] = useState({ text: '', opened: false })
  // opened before its code has loaded, the dialog mounts open and cannot return the focus itself
  const opener = useRef<HTMLElement | null>(null)
  const close = () => {
    setDialog({ ...dialog, opened: false })
    setTimeout(() => opener.current?.focus())
  }
  const designRows = useMemo(() => userBulletRows(designs), [designs])
  const fit = useMemo(
    () => (bulletParams ? fitOf(cartridge) : undefined),
    [bulletParams, cartridge],
  )
  // the card's field and the dialog rank the same way; the list lasts while its inputs do
  const find = useMemo(
    () => (text: string, limit: number) => findBullets(designRows, text, limit, fit),
    [designRows, fit],
  )
  return (
    <>
      <RecordSearch<BulletRow>
        size={controlSize.row.input}
        chevron
        kind="bullets"
        label={t('Search bullets by manufacturer and name')}
        chosen={
          bulletLabel
            ? bulletLabel
            : bulletDesign
              ? t('{name} (your design)', { name: bulletDesign.name })
              : linkedBullet?.name
                ? t('{name} (from the link)', { name: linkedBullet.name })
                : t('Search bullets')
        }
        describe={(b) =>
          b.origin
            ? t('{name} (your design)', { name: b.name })
            : describeBullet(b as BulletSummary)
        }
        onSelect={(b) => {
          const design = userRecordId(b.id)
          if (design) chooseDesign(design)
          else chooseBullet(b.id)
        }}
        noneText={t('No bullet found')}
        unreachableText={t(notReached)}
        find={find}
        browse={{
          label: t('Browse bullets'),
          onOpen: (typed) => {
            readDesigns()
            opener.current = document.activeElement as HTMLElement | null
            setDialog({ text: typed, opened: true })
          },
        }}
      />
      <BulletSearchDialog
        opened={dialog.opened}
        onClose={close}
        text={dialog.text}
        designs={designRows}
        fit={fit}
        fitName={cartridge?.name}
        system={system}
        onChoose={(row) => {
          const design = userRecordId(row.id)
          if (design) chooseDesign(design)
          else chooseBullet(row.id)
          close()
        }}
      />
    </>
  )
}

/** The cartridge search: the browser's cartridge designs in the same list, first. */
function CartridgePicker() {
  const {
    cartridge,
    cartridgeDesign,
    cartridgeDesigns,
    chooseCartridgeDesign,
    searchKey,
    chooseCartridge,
  } = useLoad()
  const { t } = useTranslation()
  return (
    <RecordSearch<CartridgeSummary>
      size={controlSize.row.input}
      chevron
      key={searchKey}
      kind="cartridges"
      label={t('Search cartridges by name')}
      picked={!!(cartridge || cartridgeDesign)}
      chosen={
        cartridge?.name ??
        (cartridgeDesign
          ? t('{name} (your design)', { name: cartridgeDesign.name })
          : t('Search cartridges (optional)'))
      }
      describe={cartridgeOptionText}
      onSelect={(c) =>
        chooseCartridge({
          id: c.id,
          name: c.name,
          ...summaryFitSource(c),
        })
      }
      // the browser's cartridge designs in the same list, first
      extra={cartridgeDesigns.map((d) => ({
        id: d.id,
        label: t('{name} (your design)', { name: d.name }),
      }))}
      onExtra={chooseCartridgeDesign}
      noneText={t('No cartridge found')}
      unreachableText={t(notReached)}
    />
  )
}

/** The powder search, with the chosen powder, the link's name or the typed parameters as its text. */
function PowderPicker({ names }: { names: ReturnType<typeof useManufacturerNames> }) {
  const {
    fields,
    powderLabel,
    choosePowder,
    linkedPowder,
    powderDesign,
    powderDesigns,
    choosePowderDesign,
  } = useLoad()
  const { t } = useTranslation()
  const chosen = (() => {
    if (powderDesign) return t('{name} (your design)', { name: powderDesign.name })
    if (powderLabel) return powderLabel
    if (linkedPowder?.name) return t('{name} (from the link)', { name: linkedPowder.name })
    return requiredModelKeys.every((k) => fields[k]?.si !== undefined)
      ? t('Typed model parameters, no powder record')
      : t('Search powders')
  })()
  return (
    <RecordSearch<PowderSummary>
      size={controlSize.row.input}
      chevron
      kind="powders"
      label={t('Search powders by manufacturer and name')}
      chosen={chosen}
      describe={(p) => productLabel(p, names)}
      onSelect={(p) => choosePowder(p.id)}
      // the browser's powder designs in the same list, first
      extra={powderDesigns.map((d) => ({
        id: d.id,
        label: t('{name} (your design)', { name: d.name }),
      }))}
      onExtra={choosePowderDesign}
      noneText={t('No powder found')}
      unreachableText={t(notReached)}
    />
  )
}

/** A card's record picker, its heading: the chosen record shows in the field. */
function CardPicker({ panel }: { panel: InputPanel }) {
  const { chooseFirearm, firearm, firearmList, readDesigns } = useLoad()
  const names = useManufacturerNames()
  const { t } = useTranslation()
  if (panel === 'cartridge') return <CartridgePicker />
  if (panel === 'bullet') return <BulletPicker />
  if (panel === 'powder') return <PowderPicker names={names} />
  return (
    <Select
      size={controlSize.row.input}
      aria-label={t('Firearm from your library')}
      placeholder={firearmList.length ? t('Choose a firearm') : t('No firearm in this browser')}
      searchable
      clearable
      data={firearmList.map((f) => ({ value: f.id, label: f.name }))}
      value={firearm ?? null}
      onChange={chooseFirearm}
      onDropdownOpen={readDesigns}
      nothingFoundMessage={t('No firearm found')}
    />
  )
}

/** Rarely needed rows of a card, in its More popover: no accordion moves the layout. */
function CardMore({ panel }: { panel: InputPanel }) {
  const { specValue, system, allDiameters, setAllDiameters } = useLoad()
  const { t } = useTranslation()
  const l6 = specValue('cartridge', 'L6')
  if (panel === 'cartridge')
    return (
      <>
        {recordRow(
          t('COAL, CIP maximum L6'),
          l6 === undefined ? undefined : lengthCell(system, l6),
          system.length.symbol,
        )}
        <SeatingSlot name="more" />
        <SeatingSlot name="moreValues" />
      </>
    )
  if (panel === 'powder') return <>{fieldsOf(powderMoreFields)}</>
  return (
    <Switch
      className="wide"
      label={t('Bullets of all diameters')}
      checked={allDiameters}
      onChange={(e) => setAllDiameters(e.currentTarget.checked)}
    />
  )
}

/** The lands contact of the chosen firearm as it applies to the chosen bullet record or design. */
function landsChoice(
  lands: Parameters<typeof landsFor>[0],
  bullet: { id: string } | undefined,
  design: { id: string } | undefined,
) {
  const ref = design ? userRef(design.id) : bullet && catalogueRef(bullet.id)
  return landsFor(lands, ref)
}

/**
 * The cartridge figure with the seated bullet, once a cartridge is chosen, drawn into `host`: the
 * card of the inputs' second column or the result tab Cartridge. One node moves between them, so
 * the preview and its seating stay; without a host it is out of the page and keeps filling the
 * cards' slots.
 */
function LoadFigure({ host }: { host: HTMLElement | null }) {
  const {
    cartridge,
    cartridgeDesign,
    designLoad,
    figureView,
    setFigureView,
    searchKey,
    system,
    previewInitial,
    firearmList,
    firearm,
    bullet,
    bulletDesign,
    seatingSlots,
    more,
    follow,
    measured,
    measuredFor,
    typeMeasured,
    setMeasuredFor,
    capacityId,
    setCapacityChoice,
    caseId,
    setCaseChoice,
    ownCases,
    ownCaseId,
    chooseOwnCase,
    setSeatAt,
    suggestions,
  } = useLoad()
  const { ok, stale } = useResult()
  // the figure draws the selected step of a seating ladder while its result is current
  const seatingStep = ok?.steps[ok.selected]?.seating
  const ladderStep =
    !stale && ok?.ladder.seatingBy && ok.steps.length > 1 && seatingStep
      ? { by: ok.ladder.seatingBy, value: seatingStep.value }
      : undefined
  // a card moved or left out of a layout drops the seating controls it held: development says so
  // once the page has settled. The More slots attach only while the Cartridge card's More is open
  // (its kept dropdown is a hidden Activity, which detaches refs)
  const [missing, setMissing] = useState<string[]>([])
  const [node, setNode] = useState<HTMLDivElement>()
  useEffect(() => {
    const div = document.createElement('div')
    div.className = 'figure-node'
    setNode(div)
  }, [])
  useEffect(() => {
    if (node && host) host.append(node)
  }, [node, host])
  const lands = landsChoice(
    firearmList.find((f) => f.id === firearm)?.data.lands,
    bullet,
    bulletDesign,
  )
  const shown = cartridge !== undefined || cartridgeDesign !== undefined
  const moreOpen = more === 'cartridge'
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !shown) return
    const needed = seatingSlotNames.filter((name) => moreOpen || !name.startsWith('more'))
    const timer = setTimeout(() => setMissing(needed.filter((name) => !seatingSlots[name])), 1000)
    return () => clearTimeout(timer)
  }, [shown, moreOpen, seatingSlots])
  if (missing.length > 0)
    throw new Error(
      `Seating slot not mounted: ${missing.join(', ')}. Every slot the seating preview fills needs its <SeatingSlot> in a card.`,
    )
  if (!(cartridge || cartridgeDesign) || !node) return null
  const measuredId = cartridge?.id ?? (cartridgeDesign as { id: string }).id
  return createPortal(
    <CartridgeFigure
      view={figureView}
      onView={setFigureView}
      previewKey={`${measuredId} ${searchKey}`}
      cartridge={cartridge}
      draft={designLoad && { spec: designLoad.spec, title: designLoad.title, card: true }}
      system={system}
      initial={previewInitial}
      barrelLength={firearmList.find((f) => f.id === firearm)?.data.barrelLength}
      lands={lands.contact}
      landsOther={lands.other}
      barrelDefault={suggestions.barrelLength}
      linked={{ bullet: bullet?.id, design: bulletDesign?.id }}
      slots={{
        cartridge: seatingSlots.cartridge ?? null,
        gun: seatingSlots.gun ?? null,
        choices: seatingSlots.choices ?? null,
        more: seatingSlots.more ?? null,
        moreValues: seatingSlots.moreValues ?? null,
      }}
      onSeated={follow}
      onSeatLadder={setSeatAt}
      ladderStep={ladderStep}
      measuredWaterCapacity={
        measuredFor === measuredId ? measured.measuredWaterCapacity : emptyStep
      }
      capacityId={capacityId}
      onCapacityId={(id) =>
        cartridge && setCapacityChoice(id ? { cartridge: cartridge.id, id } : undefined)
      }
      caseId={caseId}
      caseLot={<LotField lot="case" short />}
      onCaseId={(id) =>
        cartridge && setCaseChoice(id ? { cartridge: cartridge.id, id } : undefined)
      }
      ownCases={ownCases}
      ownCaseId={ownCaseId}
      onOwnCaseId={chooseOwnCase}
      onMeasuredWaterCapacity={(v) => {
        typeMeasured(v)
        setMeasuredFor(measuredId)
      }}
    />,
    node,
  )
}

function RunButton() {
  const { run, pending } = useLoad()
  const { t } = useTranslation()
  return (
    <Button
      onClick={() => run()}
      loading={pending}
      loaderProps={{ type: 'dots' }}
      aria-keyshortcuts={shortcutAriaKeys('run')}
    >
      {t('Run simulation')}
    </Button>
  )
}
