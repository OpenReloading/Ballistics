import { ActionIcon, Menu, NumberInput, TextInput, Tooltip, UnstyledButton } from '@mantine/core'
import {
  ArrowCounterClockwise,
  Database,
  FunctionIcon,
  LinkSimple,
  PencilSimpleLine,
  WarningCircle,
} from '@phosphor-icons/react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import {
  ambiguousMessage,
  decimalMark,
  localizeNumber,
  type NumberRange,
  type ParsedNumber,
  parseNumber,
} from '../i18n/number.ts'
import {
  type FieldSpec,
  type FieldValue,
  fieldValueFromText,
  rangeOf,
  typedFieldValue,
} from '../lib/field-spec.ts'
import {
  livePick,
  pickedSystem,
  pickedText,
  pickedTyped,
  pickUnit,
  type UnitPick,
  unitList,
} from '../lib/field-unit.ts'
import { type Quantity, twistTyped, type Unit, type UnitSystem } from '../lib/units.ts'

/**
 * A field's flag: the value follows the seated bullet, is the record's, is above a limit or refused,
 * differs from the record, or is derived by the drawing (the designers).
 */
export type FieldFlag = {
  kind: 'seating' | 'record' | 'exceeded' | 'changed' | 'derived'
  text: string
}
/** A text or message that names units: given as a function of the units the field shows. */
type OfShown<T> = T | ((shown: UnitSystem) => T)
const flagIcons = {
  seating: LinkSimple,
  record: Database,
  exceeded: WarningCircle,
  changed: PencilSimpleLine,
  derived: FunctionIcon,
}

/**
 * The unit suffix of a field, a quick switch of that field only: one click to the other unit
 * where the quantity has two, a menu where it has more. The Settings keep the stored units.
 */
function UnitSwitch({
  q,
  unit,
  label,
  onPick,
}: {
  q: Quantity
  unit: Unit
  label: string
  onPick: (id: string) => void
}) {
  const units = unitList(q)
  const [first, second] = units
  if (first && second && units.length === 2) {
    const [id, next] = units.find(([, u]) => u !== unit) ?? first
    // starts with the visible text (WCAG 2.5.3)
    const name = `${unit.symbol}, switch ${label} to ${next.symbol}`
    return (
      <UnstyledButton
        className="field-unit-switch"
        aria-label={name}
        title={name}
        onClick={() => onPick(id)}
      >
        {unit.symbol}
      </UnstyledButton>
    )
  }
  return (
    <Menu position="bottom-end" withinPortal shadow="sm">
      <Menu.Target>
        <UnstyledButton
          className="field-unit-switch"
          aria-label={`Unit of ${label}: ${unit.symbol}`}
        >
          {unit.symbol}
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {units.map(([id, u]) => (
          <Menu.Item key={id} onClick={() => onPick(id)} aria-current={u === unit || undefined}>
            {u.symbol || '1'}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

/** The flag or the restore action of a field, as an icon inside the input. */
function FieldMarker({
  action,
  actionText,
  flag,
}: {
  action: { onClick: () => void } | undefined
  actionText: string | undefined
  flag: FieldFlag | undefined
}) {
  if (action)
    return (
      <Tooltip label={actionText}>
        <ActionIcon
          variant="subtle"
          size={24}
          className="field-action"
          aria-label={actionText}
          onClick={action.onClick}
        >
          <ArrowCounterClockwise size={16} aria-hidden="true" />
        </ActionIcon>
      </Tooltip>
    )
  if (!flag) return null
  const Icon = flagIcons[flag.kind]
  return (
    <Tooltip
      label={flag.text}
      multiline
      maw={280}
      events={{ hover: true, focus: false, touch: true }}
    >
      <span className={`field-flag field-flag-${flag.kind}`}>
        <Icon size={16} weight={flag.kind === 'exceeded' ? 'fill' : 'regular'} aria-hidden="true" />
      </span>
    </Tooltip>
  )
}

/** The unit shows once, as the field's suffix; the label keeps it for screen readers. */
function fieldLabel(text: string, unit: string): ReactNode {
  if (!unit) return text
  return (
    <>
      {text}
      <span className="visually-hidden"> ({unit})</span>
    </>
  )
}

/** The field's description: help, mark and flag; a flag that repeats the help is not said twice. */
const describedByOf = (
  help: string | undefined,
  mark: string | undefined,
  flag: FieldFlag | undefined,
) =>
  [help, mark, flag?.text === help ? undefined : flag?.text].filter(Boolean).join(' ') || undefined

/** A twist typed as "8" or "1 in 8" reads "1:8" once the field is left; none when it is as is. */
function retypedTwist(quantity: Quantity, text: string, si: number | undefined) {
  if (quantity !== 'twist' || si === undefined) return
  const typed = twistTyped(text)
  return typed !== undefined && typed !== text ? typed : undefined
}

/** The suffix section: the flag or its action before the unit, so the values stay in one column. */
function endProps({
  marker,
  symbol,
  switchable,
  longest,
  q,
  unit,
  label,
  onPick,
}: {
  marker: ReactNode
  symbol: string
  switchable: boolean
  longest: number
  q: Quantity
  unit: Unit
  label: string
  onPick: (id: string) => void
}) {
  const interactive = switchable || marker !== undefined
  return {
    rightSection:
      !symbol && !marker ? undefined : (
        <FieldEnd
          marker={marker}
          symbol={symbol}
          switchable={switchable}
          q={q}
          unit={unit}
          label={label}
          onPick={onPick}
        />
      ),
    // a unit switch needs room for its 24 px target beside the text, a marker 1.5rem more, both
    // 0.25rem after the value
    rightSectionWidth: endWidth(switchable, symbol, longest, marker !== undefined),
    rightSectionPointerEvents: interactive ? ('all' as const) : ('none' as const),
  }
}

/** The classes of a muted default and of a message shown elsewhere. */
const errorProps = (muted: boolean | undefined, hiddenError: boolean | undefined) => ({
  classNames: {
    section: 'field-unit',
    input: muted ? 'field-default' : undefined,
    error: hiddenError ? 'field-error-elsewhere' : undefined,
  },
  // Mantine adds a margin under the input for an error: with the message elsewhere it would grow the field
  styles: hiddenError ? { wrapper: { marginBottom: 0 } } : undefined,
})

/** The width of the suffix: the longest symbol of the quantity, so switching does not change it. */
const endWidth = (switchable: boolean, symbol: string, longest: number, marker: boolean) =>
  `${0.25 + Math.max(switchable ? 2 : 0, symbol ? 0.75 + 0.5 * (switchable ? longest : symbol.length) : 0) + (marker ? 1.5 : 0)}rem`

/** The flag or its action before the unit: the values stay in one column. */
function FieldEnd({
  marker,
  symbol,
  switchable,
  q,
  unit,
  label,
  onPick,
}: {
  marker: ReactNode
  symbol: string
  switchable: boolean
  q: Quantity
  unit: Unit
  label: string
  onPick: (id: string) => void
}) {
  let suffix: ReactNode = <span aria-hidden="true">{symbol}</span>
  if (!symbol) suffix = null
  else if (switchable) suffix = <UnitSwitch q={q} unit={unit} label={label} onPick={onPick} />
  return (
    <span className="field-end">
      {marker}
      {suffix}
    </span>
  )
}

/**
 * A twist is "1:8" or "8": text, not a number. Under a decimal point a field that accepts negatives
 * is a native number input (it keeps the iOS minus key) and the others are `NumberInput`s. Under a
 * decimal comma every field is a text input read by `parseNumber`: a native number input and the
 * `NumberInput` take the point only from a key press, not from pasted, filled or composed text.
 * `onText` gets what a person typed (`typed`) or the canonical text of a `NumberInput`.
 */
function FieldInput({
  common,
  quantity,
  range,
  text,
  step,
  onText,
  onRefused,
}: {
  common: object
  quantity: Quantity
  range: NumberRange
  text: string
  step: number | undefined
  onText: (text: string, typed: boolean) => void
  onRefused: (p: Extract<ParsedNumber, { kind: 'ambiguous' }>) => void
}) {
  const comma = decimalMark() !== '.'
  const signed = range.min === undefined || range.min < 0
  if (quantity === 'twist' || comma || signed)
    return (
      <TextInput
        {...common}
        {...(quantity !== 'twist' &&
          (comma
            ? // the decimal keypad of a phone has no minus key: a signed field keeps the full keyboard
              !signed && { inputMode: 'decimal' as const }
            : { type: 'number', step: 'any' }))}
        value={text}
        onChange={(e) => onText(e.currentTarget.value, true)}
      />
    )
  return (
    <NumberInput
      {...common}
      hideControls
      {...(step !== undefined && { step })}
      clampBehavior="none"
      // Trimming on blur turns the text into a number and calls onChange although nothing was typed.
      trimLeadingZeroesOnBlur={false}
      value={text}
      onChange={(v) => onText(String(v), false)}
      // pasted text is read by `parseNumber`, not by the input's own rule for a lone separator
      onPasteCapture={(e) => {
        // the text the field would hold after a native paste: at the caret, over the selection
        const el = e.currentTarget
        const at = (n: number | null) => n ?? el.value.length
        const after = `${el.value.slice(0, at(el.selectionStart))}${e.clipboardData.getData('text')}${el.value.slice(at(el.selectionEnd))}`
        const p = parseNumber(after, range)
        if (p.kind !== 'number' && p.kind !== 'ambiguous') return
        e.preventDefault()
        e.stopPropagation()
        if (p.kind === 'number') onText(p.text, false)
        else onRefused(p)
      }}
    />
  )
}

const noValue: FieldValue = { text: '', si: undefined }

/**
 * A labelled number field: the unit is its suffix and, for screen readers, part of its label; keeps
 * the typed text and its SI value. A
 * field that accepts negatives stays a native number input: `NumberInput` always sets
 * `inputMode="decimal"`, and the iOS decimal keypad has no minus key.
 */
export function NumberField({
  spec,
  system,
  value: given,
  onChange,
  onBlur,
  onEnter,
  error,
  hiddenError,
  help,
  mark,
  flag,
  action,
  placeholder,
  muted,
  unit = 'switch',
}: {
  spec: FieldSpec
  system: UnitSystem
  /** Undefined where the form holds no value for the field: an empty field. */
  value: FieldValue | undefined
  onChange: (value: FieldValue) => void
  onBlur?: () => void
  /** Called on Enter in the field. */
  onEnter?: (() => void) | undefined
  /**
   * The message under the field; `true` marks the field invalid with the message elsewhere. A message
   * naming a unit is a function of the units the field shows, as `fieldError(spec, value, shown)`.
   */
  error?: OfShown<string | boolean | undefined>
  /** The message is the field's description for screen readers but not drawn: it stands elsewhere. */
  hiddenError?: boolean
  /** The field's help where it names a unit, in place of `spec.help`. */
  help?: ((shown: UnitSystem) => string) | undefined
  /** Shown under the field after the help, as where a default value comes from. */
  mark?: OfShown<string | undefined>
  /**
   * Where the value comes from or a limit it exceeds, as an icon inside the input: its text is
   * the tooltip and part of the field's description for screen readers.
   */
  flag?: FieldFlag | undefined
  /** An icon button inside the input, as "use seating"; it takes the flag's place. */
  action?: { kind: 'restore'; text: OfShown<string>; onClick: () => void } | undefined
  /** Shown while the field is empty, as the value used instead. */
  placeholder?: string | ((system: UnitSystem) => string | undefined) | undefined
  /** The value is a default: muted text (its source is the `mark`). */
  muted?: boolean
  /**
   * The unit suffix: a switch to the quantity's other units for this field only, plain text, or
   * none where a column header names it (the designers follow the Settings preset); the label
   * keeps it for screen readers.
   */
  unit?: 'switch' | 'text' | 'none' | undefined
}) {
  const value = given ?? noValue
  // the language shown: the field writes its decimal mark and reads text in it
  useTranslation()
  // what was typed where it differs from the text shown for the value (a point under a decimal comma,
  // text that is no number), until the field is left with a value; `text` is the state's text it gave
  const [draft, setDraft] = useState<{ raw: string; text: string }>()
  // the message of a pasted text that could be read two ways
  const [refused, setRefused] = useState<string>()
  const [pick, setPick] = useState<UnitPick>()
  // the field's own unit, held in memory: gone with a change of the Settings or a reload
  if (livePick(pick, system) !== pick) setPick(undefined)
  const shown = pickedSystem(spec.quantity, system, pick)
  const own = shown !== system
  const shownValue = own ? { ...value, text: pickedText(spec.quantity, shown, value, pick) } : value
  const { step } = shown[spec.quantity]
  const range = rangeOf(spec)
  const label = shown[spec.quantity].symbol
  const symbol = unit === 'none' ? '' : label
  const at = <T,>(v: OfShown<T>): T =>
    typeof v === 'function' ? (v as (s: UnitSystem) => T)(shown) : v
  const helpText = help ? help(shown) : spec.help
  const markText = at(mark)
  const actionText = action && at(action.text)
  const marker =
    action || flag ? <FieldMarker action={action} actionText={actionText} flag={flag} /> : undefined
  // a flag that repeats the help is not said twice
  const describedBy = describedByOf(helpText, markText, flag)
  const units = unitList(spec.quantity)
  const switchable = unit === 'switch' && units.length > 1
  // the longest symbol of the quantity: switching does not change the width of the suffix
  const longest = Math.max(...units.map(([, u]) => u.symbol.length))
  const common = {
    // the unit shows once, as the field's suffix; the label keeps it for screen readers
    label: fieldLabel(spec.label, label),
    description: describedBy,
    // the dense workbench grid hides the description: the label shows it on hover
    labelProps: { title: [helpText, markText].filter(Boolean).join(' ') || undefined },
    required: spec.required,
    placeholder: typeof placeholder === 'function' ? placeholder(shown) : placeholder,
    withAsterisk: false,
    error: refused ?? at(error),
    // a twist typed as "8" or "1 in 8" reads "1:8" once the field is left
    onBlur: () => {
      setRefused(undefined)
      if (value.si !== undefined) setDraft(undefined)
      const text = retypedTwist(spec.quantity, shownValue.text, value.si)
      if (text !== undefined && value.si !== undefined) {
        if (pick && own) setPick({ ...pick, typed: { text, si: value.si } })
        else onChange({ text, si: value.si })
      }
      onBlur?.()
    },
    onKeyDown: onEnter && ((e: { key: string }) => e.key === 'Enter' && onEnter()),
    min: spec.min,
    max: spec.max,
    ...endProps({
      marker,
      symbol,
      switchable,
      longest,
      q: spec.quantity,
      unit: shown[spec.quantity],
      label: spec.label,
      onPick: (id) => setPick(pickUnit(spec.quantity, system, id)),
    }),
    ...errorProps(muted, hiddenError),
  }
  const change = (raw: string, typed: boolean) => {
    const v = typed
      ? typedFieldValue(spec.quantity, shown, raw, range)
      : fieldValueFromText(spec.quantity, shown, raw)
    setRefused(undefined)
    setDraft(typed && raw !== localizeNumber(v.text) ? { raw, text: v.text } : undefined)
    if (!own) return onChange(v)
    const next =
      v.si === undefined
        ? { value: v, typed: undefined }
        : pickedTyped(spec.quantity, system, shown, v.text)
    setPick(pick && { ...pick, typed: next.typed })
    onChange(next.value)
  }
  return (
    <FieldInput
      common={common}
      quantity={spec.quantity}
      range={range}
      text={draft?.text === shownValue.text ? draft.raw : localizeNumber(shownValue.text)}
      step={step}
      onText={change}
      onRefused={(p) => {
        setRefused(ambiguousMessage(p))
        setDraft(undefined)
      }}
    />
  )
}
