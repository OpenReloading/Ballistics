import { ActionIcon, Menu, NumberInput, TextInput, Tooltip, UnstyledButton } from '@mantine/core'
import {
  ArrowCounterClockwise,
  Database,
  FunctionIcon,
  LinkSimple,
  PencilSimpleLine,
  WarningCircle,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { type FieldSpec, type FieldValue, fieldValueFromText } from '../lib/field-spec.ts'
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
  if (units.length === 2) {
    const [id, next] = units.find(([, u]) => u !== unit) ?? units[0]
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

/**
 * A labelled number field: the unit is its suffix and, for screen readers, part of its label; keeps
 * the typed text and its SI value. A
 * field that accepts negatives stays a native number input: `NumberInput` always sets
 * `inputMode="decimal"`, and the iOS decimal keypad has no minus key.
 */
export function NumberField({
  spec,
  system,
  value,
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
  value: FieldValue
  onChange: (value: FieldValue) => void
  onBlur?: () => void
  /** Called on Enter in the field. */
  onEnter?: () => void
  /**
   * The message under the field; `true` marks the field invalid with the message elsewhere. A message
   * naming a unit is a function of the units the field shows, as `fieldError(spec, value, shown)`.
   */
  error?: OfShown<string | boolean | undefined>
  /** The message is the field's description for screen readers but not drawn: it stands elsewhere. */
  hiddenError?: boolean
  /** The field's help where it names a unit, in place of `spec.help`. */
  help?: (shown: UnitSystem) => string
  /** Shown under the field after the help, as where a default value comes from. */
  mark?: OfShown<string | undefined>
  /**
   * Where the value comes from or a limit it exceeds, as an icon inside the input: its text is
   * the tooltip and part of the field's description for screen readers.
   */
  flag?: FieldFlag
  /** An icon button inside the input, as "use seating"; it takes the flag's place. */
  action?: { kind: 'restore'; text: OfShown<string>; onClick: () => void }
  /** Shown while the field is empty, as the value used instead. */
  placeholder?: string | ((system: UnitSystem) => string | undefined)
  /** The value is a default: muted text (its source is the `mark`). */
  muted?: boolean
  /**
   * The unit suffix: a switch to the quantity's other units for this field only, plain text, or
   * none where a column header names it (the designers follow the Settings preset); the label
   * keeps it for screen readers.
   */
  unit?: 'switch' | 'text' | 'none'
}) {
  const [pick, setPick] = useState<UnitPick>()
  // the field's own unit, held in memory: gone with a change of the Settings or a reload
  if (livePick(pick, system) !== pick) setPick(undefined)
  const shown = pickedSystem(spec.quantity, system, pick)
  const own = shown !== system
  const shownValue = own ? { ...value, text: pickedText(spec.quantity, shown, value, pick) } : value
  const { step } = shown[spec.quantity]
  const label = shown[spec.quantity].symbol
  const symbol = unit === 'none' ? '' : label
  const Icon = flag && flagIcons[flag.kind]
  const at = <T,>(v: OfShown<T>): T =>
    typeof v === 'function' ? (v as (s: UnitSystem) => T)(shown) : v
  const helpText = help ? help(shown) : spec.help
  const markText = at(mark)
  const actionText = action && at(action.text)
  const marker = action ? (
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
  ) : flag && Icon ? (
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
  ) : undefined
  // a flag that repeats the help is not said twice
  const describedBy =
    [helpText, markText, flag?.text === helpText ? undefined : flag?.text]
      .filter(Boolean)
      .join(' ') || undefined
  const units = unitList(spec.quantity)
  const switchable = unit === 'switch' && units.length > 1
  // the longest symbol of the quantity: switching does not change the width of the suffix
  const longest = Math.max(...units.map(([, u]) => u.symbol.length))
  const common = {
    // the unit shows once, as the field's suffix; the label keeps it for screen readers
    label: label ? (
      <>
        {spec.label}
        <span className="visually-hidden"> ({label})</span>
      </>
    ) : (
      spec.label
    ),
    description: describedBy,
    // the dense workbench grid hides the description: the label shows it on hover
    labelProps: { title: [helpText, markText].filter(Boolean).join(' ') || undefined },
    required: spec.required,
    placeholder: typeof placeholder === 'function' ? placeholder(shown) : placeholder,
    withAsterisk: false,
    error: at(error),
    // a twist typed as "8" or "1 in 8" reads "1:8" once the field is left
    onBlur: () => {
      const text = spec.quantity === 'twist' ? twistTyped(shownValue.text) : undefined
      if (text !== undefined && text !== shownValue.text && value.si !== undefined) {
        if (pick && own) setPick({ ...pick, typed: { text, si: value.si } })
        else onChange({ text, si: value.si })
      }
      onBlur?.()
    },
    onKeyDown: onEnter && ((e: { key: string }) => e.key === 'Enter' && onEnter()),
    min: spec.min,
    max: spec.max,
    // the flag or its action before the unit: the values stay in one column
    rightSection:
      !symbol && !marker ? undefined : (
        <span className="field-end">
          {marker}
          {!symbol ? null : switchable ? (
            <UnitSwitch
              q={spec.quantity}
              unit={shown[spec.quantity]}
              label={spec.label}
              onPick={(id) => setPick(pickUnit(spec.quantity, system, id))}
            />
          ) : (
            <span aria-hidden="true">{symbol}</span>
          )}
        </span>
      ),
    // a unit switch needs room for its 24 px target beside the text, a marker 1.5rem more, both
    // 0.25rem after the value
    rightSectionWidth: `${0.25 + Math.max(switchable ? 2 : 0, symbol ? 0.75 + 0.5 * (switchable ? longest : symbol.length) : 0) + (marker ? 1.5 : 0)}rem`,
    rightSectionPointerEvents: switchable || marker ? ('all' as const) : ('none' as const),
    classNames: {
      section: 'field-unit',
      input: muted ? 'field-default' : undefined,
      error: hiddenError ? 'field-error-elsewhere' : undefined,
    },
    // Mantine adds a margin under the input for an error: with the message elsewhere it would grow the field
    styles: hiddenError ? { wrapper: { marginBottom: 0 } } : undefined,
  }
  const change = (text: string) => {
    if (!own) return onChange(fieldValueFromText(spec.quantity, system, text))
    const next = pickedTyped(spec.quantity, system, shown, text)
    setPick(pick && { ...pick, typed: next.typed })
    onChange(next.value)
  }
  // a twist is "1:8" or "8": text, not a number
  return spec.quantity === 'twist' ? (
    <TextInput
      {...common}
      value={shownValue.text}
      onChange={(e) => change(e.currentTarget.value)}
    />
  ) : spec.min === undefined || spec.min < 0 ? (
    <TextInput
      {...common}
      type="number"
      step="any"
      value={shownValue.text}
      onChange={(e) => change(e.currentTarget.value)}
    />
  ) : (
    <NumberInput
      {...common}
      hideControls
      step={step}
      clampBehavior="none"
      // Trimming on blur turns the text into a number and calls onChange although nothing was typed.
      trimLeadingZeroesOnBlur={false}
      value={shownValue.text}
      onChange={(v) => change(String(v))}
    />
  )
}
