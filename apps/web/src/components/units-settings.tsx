'use client'

import {
  ActionIcon,
  Button,
  NativeSelect,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Tooltip,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Ruler } from '@phosphor-icons/react'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { storageName } from '../lib/edition.ts'
import { type FieldSpec, type Fields, switchFields } from '../lib/field-spec.ts'
import { controlSize } from '../lib/theme.ts'
import {
  localePreset,
  type PresetId,
  parseUnitChoice,
  presetFromLink,
  presetNames,
  presetUnitIds,
  type Quantity,
  resolveUnits,
  type UnitChoice,
  type UnitSystem,
  unitsOf,
} from '../lib/units.ts'
import { SettingsDialog } from './settings-dialog.ts'
import { Loading } from './states.tsx'

/** `localStorage` key of the viewer's unit choice. */
const unitsKey = storageName('units')
/** `localStorage` key of the saved custom variant: kept while a preset is chosen. */
const customUnitsKey = storageName('units-custom')

type Units = {
  choice: UnitChoice
  system: UnitSystem
  choose: (choice: UnitChoice) => void
  /** The saved custom variant: the last choice with overrides; a preset choice keeps it. */
  custom: UnitChoice | undefined
  /** The stored or linked choice has been read (after mounting). */
  ready: boolean
}

const initial: UnitChoice = { preset: 'metric-grains', overrides: {} }

/**
 * The units as a store behind a context whose value never changes. A context value that changed
 * after mounting made React client-render the streamed Suspense boundary of a page still waiting
 * for its reveal, which left a hidden server copy of the page in the DOM.
 */
type UnitsStore = {
  get: () => Units
  /** The snapshot of the server render and of hydration. */
  server: Units
  subscribe: (listener: () => void) => () => void
}

const serverUnits: Units = {
  choice: initial,
  system: resolveUnits(initial),
  choose: () => {},
  custom: undefined,
  ready: false,
}

const UnitsContext = createContext<UnitsStore>({
  get: () => serverUnits,
  server: serverUnits,
  subscribe: () => () => {},
})

const hasOverrides = (c: UnitChoice) => Object.keys(c.overrides).length > 0

function createUnitsStore() {
  const listeners = new Set<() => void>()
  let units = serverUnits
  const set = (patch: Partial<Pick<Units, 'choice' | 'custom' | 'ready'>>) => {
    units = { ...units, ...patch, system: patch.choice ? resolveUnits(patch.choice) : units.system }
    for (const l of listeners) l()
  }
  const choose = (next: UnitChoice) => {
    // a choice with overrides is the custom variant: saved apart, so a preset does not lose it
    const isCustom = hasOverrides(next)
    set(isCustom ? { choice: next, custom: next } : { choice: next })
    try {
      localStorage.setItem(unitsKey, JSON.stringify(next))
      if (isCustom) localStorage.setItem(customUnitsKey, JSON.stringify(next))
    } catch {}
  }
  units = { ...units, choose }
  const store: UnitsStore = {
    get: () => units,
    server: units,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return { store, set }
}

/**
 * The display units of every page. Server and first render use "Metric, grains"; after mounting a
 * link's `units` applies (not stored), else the stored choice, else the locale's preset.
 */
export function UnitsProvider({ children }: { children: ReactNode }) {
  const [{ store, set }] = useState(createUnitsStore)
  useEffect(() => {
    const linked = presetFromLink(new URLSearchParams(window.location.search).get('units'))
    let stored: UnitChoice | undefined
    let custom: UnitChoice | undefined
    try {
      stored = parseUnitChoice(localStorage.getItem(unitsKey))
      custom = parseUnitChoice(localStorage.getItem(customUnitsKey))
      // a choice with overrides stored before the custom variant was kept apart is that variant
      if (!custom && stored && hasOverrides(stored)) {
        custom = stored
        localStorage.setItem(customUnitsKey, JSON.stringify(custom))
      }
    } catch {}
    set({
      ready: true,
      custom,
      choice: linked
        ? { preset: linked, overrides: {} }
        : (stored ?? { preset: localePreset(navigator.language), overrides: {} }),
    })
    // a change in another tab applies here too
    const follow = (e: StorageEvent) => {
      if (e.key === customUnitsKey) set({ custom: parseUnitChoice(e.newValue) })
      if (e.key !== unitsKey) return
      const next = parseUnitChoice(e.newValue)
      set({ choice: next ?? { preset: localePreset(navigator.language), overrides: {} } })
      if (next && hasOverrides(next)) set({ custom: next })
    }
    window.addEventListener('storage', follow)
    return () => window.removeEventListener('storage', follow)
  }, [set])
  return <UnitsContext value={store}>{children}</UnitsContext>
}

const noSubscription = () => () => {}

/**
 * The units, read from the store. A render has the live units, or the server's while hydrating
 * (`useSyncExternalStore` tells the two apart and corrects a late hydration); a change then arrives
 * as a state update, in the lane of the effect that made it. Not `useSyncExternalStore`'s own
 * updates: they are urgent and no longer batch with the other updates of the effects that run on
 * mounting, which a form's unit switch relies on.
 */
export function useUnits() {
  const s = useContext(UnitsContext)
  const first = useSyncExternalStore(noSubscription, s.get, () => s.server)
  const [later, setLater] = useState<Units>()
  useEffect(() => s.subscribe(() => setLater(s.get())), [s])
  return later ?? first
}

/**
 * The units of the Settings with the length unit replaced inside it, not stored: the cartridge
 * record's drawing unit switch, so its drawing, strip and table agree.
 */
export function LengthOverride({
  unit,
  children,
}: {
  unit?: 'mm' | 'in' | undefined
  children: ReactNode
}) {
  const parent = useContext(UnitsContext)
  const value = useMemo(() => {
    if (unit === undefined) return parent
    // one derived snapshot per parent snapshot: useSyncExternalStore needs a stable result
    const over = (u: Units): Units => ({
      ...u,
      system: resolveUnits({ ...u.choice, overrides: { ...u.choice.overrides, length: unit } }),
    })
    let from: Units | undefined
    let to: Units
    return {
      get: () => {
        const u = parent.get()
        if (u !== from) {
          from = u
          to = over(u)
        }
        return to
      },
      server: over(parent.server),
      subscribe: parent.subscribe,
    }
  }, [parent, unit])
  return <UnitsContext value={value}>{children}</UnitsContext>
}

/** Rewrites the text of the fields whose unit changed, from their SI values. */
export function useFieldUnits(
  specs: readonly FieldSpec[],
  system: UnitSystem,
  setValues: (update: (fields: Partial<Fields>) => Fields) => void,
  /** The texts after a switch: `roundedFieldText` in the calculators. */
  text?: Parameters<typeof switchFields>[3],
) {
  const shown = useRef(system)
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on a unit change only
  useEffect(() => {
    const changed = specs.filter((s) => shown.current[s.quantity] !== system[s.quantity])
    shown.current = system
    if (changed.length > 0)
      setValues((fields) => switchFields(fields as Fields, changed, system, text))
  }, [system])
}

/** Quantities with a unit choice, in the order of the presets table. */
const choices: [Quantity, string][] = [
  ['charge', 'Powder charge'],
  ['mass', 'Bullet mass'],
  ['length', 'Lengths'],
  ['twist', 'Barrel twist'],
  ['barrelLength', 'Barrel length'],
  ['area', 'Areas'],
  ['capacity', 'Case capacity'],
  ['velocity', 'Velocity'],
  ['pressure', 'Pressure'],
  ['energy', 'Energy'],
  ['temperature', 'Temperature'],
  ['range', 'Range, distance'],
  ['lineOfSightOffset', 'Drop, windage'],
  ['windSpeed', 'Wind speed'],
  ['altitude', 'Altitude'],
  ['airPressure', 'Air pressure'],
  ['correction', 'Corrections'],
  ['firearmMass', 'Firearm mass'],
]

/** The unit settings of the settings dialog: the preset, one unit per quantity and "Reset to preset"; every change is stored. */
export function UnitsForm() {
  const { choice, choose, custom, ready } = useUnits()
  // four segments do not fit a phone in a row
  const narrow = useMediaQuery('(max-width: 35.99em)')
  const isCustom = hasOverrides(choice)
  const set = (preset: PresetId, overrides: UnitChoice['overrides']) =>
    choose({
      preset,
      overrides: Object.fromEntries(
        Object.entries(overrides).filter(([q, id]) => presetUnitIds[preset][q as Quantity] !== id),
      ),
    })
  // the server cannot know the stored choice: no form showing another preset until it is read
  if (!ready) return <Loading what="the unit settings" />
  return (
    <Stack gap="sm" maw="40rem">
      <div>
        <p className="segment-label" id="units-preset">
          Preset
        </p>
        <SegmentedControl
          aria-labelledby="units-preset"
          orientation={narrow ? 'vertical' : 'horizontal'}
          fullWidth={narrow}
          value={isCustom ? 'custom' : choice.preset}
          // a preset gives its own units; Custom gives back the saved custom variant
          onChange={(v) => (v === 'custom' ? custom && choose(custom) : set(v as PresetId, {}))}
          // alphabetical, the custom variant last
          data={[
            ...(Object.keys(presetNames) as PresetId[])
              .sort((a, b) => presetNames[a].localeCompare(presetNames[b]))
              .map((p) => ({ value: p, label: presetNames[p] })),
            {
              value: 'custom',
              label: 'Custom',
              disabled: !custom && !isCustom,
            },
          ]}
        />
      </div>
      <SimpleGrid minColWidth="9rem" spacing="0.75rem" verticalSpacing="xs">
        {choices.map(([q, label]) => (
          <NativeSelect
            key={q}
            label={label}
            size={controlSize.row.input}
            value={choice.overrides[q] ?? presetUnitIds[choice.preset][q]}
            data={Object.entries(unitsOf[q]).map(([id, u]) => ({
              value: id,
              label: u.symbol,
            }))}
            onChange={(e) =>
              set(choice.preset, { ...choice.overrides, [q]: e.currentTarget.value })
            }
          />
        ))}
      </SimpleGrid>
      <Button
        variant="default"
        size={controlSize.row.button}
        w="fit-content"
        disabled={!hasOverrides(choice)}
        onClick={() => set(choice.preset, {})}
      >
        Reset to preset
      </Button>
    </Stack>
  )
}

/** "Units: <preset>", ", custom" with an override: the name of the Units buttons. */
function useUnitsName() {
  const { choice } = useUnits()
  return `Units: ${presetNames[choice.preset]}${hasOverrides(choice) ? ', custom' : ''}`
}

/** Units in every page bar: an icon button named "Units: <preset>", the name on hover and focus. */
export function UnitsIconButton() {
  const open = useContext(SettingsDialog)
  const name = useUnitsName()
  return (
    <Tooltip label={name}>
      <ActionIcon
        variant="default"
        className="units-link"
        aria-label={name}
        aria-haspopup="dialog"
        onClick={() => open('units')}
      >
        <Ruler aria-hidden="true" />
      </ActionIcon>
    </Tooltip>
  )
}
