'use client'

import { Button, Stack } from '@mantine/core'
import { useEffect, useState } from 'react'
import {
  type FieldSpec,
  type Fields,
  type FieldValue,
  fieldError,
  initialFields,
} from '../lib/field-spec.ts'
import { barrelLengthByClass } from '../lib/input-defaults.ts'
import { interiorFields } from '../lib/interior-input.ts'
import { controlSize } from '../lib/theme.ts'
import { fixedFieldText, type UnitSystem, withUnit } from '../lib/units.ts'
import {
  citedDefaults,
  defaultKeys,
  defaultsText,
  readDefaults,
  storeDefaults,
  validDefault,
  type WorkbenchDefaults,
} from '../lib/workbench-defaults.ts'
import { NumberField } from './number-field.tsx'
import { Loading } from './states.tsx'
import { useFieldUnits, useUnits } from './units-settings.tsx'

/** The barrel length of the seating: optional, empty means by cartridge class (`input-defaults.ts`). */
const barrelSpec = {
  key: 'barrelLength',
  label: 'Barrel length',
  quantity: 'barrelLength',
  min: 0,
} as const satisfies FieldSpec

const specs: readonly FieldSpec[] = [
  ...defaultKeys.map(
    (k) => interiorFields.find((s) => s.key === k) as (typeof interiorFields)[number],
  ),
  barrelSpec,
]
const keys = [...defaultKeys, 'barrelLength'] as const

/** What an empty barrel length stands for, in the shown unit. */
const barrelHelp = (system: UnitSystem) =>
  `Empty: by cartridge class, rifle ${withUnit('barrelLength', system, barrelLengthByClass.rifle)}, pistol ${withUnit('barrelLength', system, barrelLengthByClass.pistol)} (assumptions, no source).`

/** The workbench defaults of the settings dialog: one field per default, stored at once when valid, and a reset. */
export function WorkbenchDefaultsForm() {
  const { system, ready } = useUnits()
  const [stored, setStored] = useState<WorkbenchDefaults>()
  const [fields, setFields] = useState<Fields>({})
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once after mounting; units follow below
  useEffect(() => {
    const d = readDefaults()
    setStored(d)
    setFields(
      initialFields(
        specs.map((s, i) => ({ ...s, initial: d[keys[i]] })),
        system,
        fixedFieldText,
      ),
    )
  }, [])
  useFieldUnits(specs, system, (update) => setFields((f) => update(f)), fixedFieldText)
  // the server cannot know the stored values: no form showing the cited ones until they are read
  if (!ready || !stored) return <Loading what="the workbench defaults" />

  /** The message of a default field in the units `shown` by the field; none for an empty barrel length (by cartridge class). */
  function errorOf(key: (typeof keys)[number], value: FieldValue, shown: UnitSystem) {
    const spec = specs[keys.indexOf(key)]
    if (key === 'barrelLength')
      return value.text.trim() === ''
        ? undefined
        : (fieldError(spec, value, shown) ??
            ((value.si ?? 0) > 0 ? undefined : `${spec.label} must be above 0.`))
    return (
      fieldError(spec, value, shown) ??
      (validDefault(key, value.si) ? undefined : `${spec.label} must be above 0.`)
    )
  }

  function change(key: (typeof keys)[number], value: FieldValue) {
    setFields((f) => ({ ...f, [key]: value }))
    const error = errorOf(key, value, system)
    setErrors((e) => ({ ...e, [key]: error }))
    if (error || !stored) return
    let next: WorkbenchDefaults
    if (key === 'barrelLength') {
      // empty: by cartridge class
      const { barrelLength: _, ...rest } = stored
      next = (
        value.si === undefined ? rest : { ...rest, barrelLength: value.si }
      ) as WorkbenchDefaults
    } else {
      if (value.si === undefined) return
      next = { ...stored, [key]: value.si }
    }
    setStored(next)
    storeDefaults(next)
  }

  function reset() {
    const cited = Object.fromEntries(
      defaultKeys.map((k) => [k, citedDefaults[k].si]),
    ) as WorkbenchDefaults
    storeDefaults(cited)
    setStored(cited)
    setErrors({})
    setFields(
      initialFields(
        specs.map((s, i) => ({ ...s, initial: cited[keys[i]] })),
        system,
        fixedFieldText,
      ),
    )
  }

  return (
    <Stack gap="sm" maw="40rem" className="workbench-defaults">
      {specs.map((spec, i) => (
        <NumberField
          key={spec.key}
          spec={spec}
          help={spec.key === 'barrelLength' ? barrelHelp : undefined}
          system={system}
          value={fields[spec.key]}
          error={
            errors[spec.key]
              ? (s) => errorOf(keys[i], fields[spec.key], s) ?? errors[spec.key]
              : undefined
          }
          mark={
            i < defaultKeys.length
              ? `Cited default: ${citedDefaults[defaultKeys[i]].source}.`
              : undefined
          }
          onChange={(value) => change(keys[i], value)}
        />
      ))}
      <Button
        variant="default"
        size={controlSize.row.button}
        w="fit-content"
        disabled={defaultsText(stored) === undefined}
        onClick={reset}
      >
        Reset to cited defaults
      </Button>
    </Stack>
  )
}
