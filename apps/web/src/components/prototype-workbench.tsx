'use client'

import {
  ActionIcon,
  Button,
  Paper,
  Popover,
  Select,
  Slider,
  Switch,
  Tabs,
  TextInput,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { DotsThree, MagnifyingGlass, Play } from '@phosphor-icons/react'
import { useSearchParams } from 'next/navigation'
import { createContext, use, useState } from 'react'
import { msg } from '../i18n/translate.ts'
import type { FieldSpec, FieldValue } from '../lib/field-spec.ts'
import { interiorFields } from '../lib/interior-input.ts'
import { controlSize } from '../lib/theme.ts'
import { roundedFieldText } from '../lib/units.ts'
import { NumberField } from './number-field.tsx'
import { PageBar } from './page-bar.tsx'
import { SegmentedRow } from './segmented-row.tsx'
import { useUnits } from './units-settings.tsx'
import { Workspace } from './workspace.tsx'

// Throwaway prototype: the workbench inputs in four layouts on fake data, with the shipped classes
// so the shipped frame, breakpoints and 28 px rows apply. Nothing here runs a model.

type Variant = 'A' | 'B' | 'C' | 'D'

const fake = {
  cartridge: 'Sample 7.62 x 51 (fake)',
  powder: 'Sample powder N1 (fake)',
  bullet: 'Sample 168 gr HPBT (fake)',
  firearm: 'Sample rifle 24 in (fake)',
  brass: ['Sample brass A (fake)', 'Sample brass B (fake)'],
  capacity: ['Sample capacity 56.0 g (fake)', 'Sample capacity 55.4 g (fake)'],
  primer: ['Sample large rifle primer (fake)', 'Sample magnum primer (fake)'],
}

/** Every label 30 percent longer with `?long=1`, as German labels run. */
const Long = createContext(false)
function useLabel() {
  const long = use(Long)
  return (s: string) =>
    long ? `${s} ${'ä'.repeat(Math.max(1, Math.ceil(s.length * 0.3) - 1))}` : s
}

const spec = (key: string): FieldSpec => {
  const s = interiorFields.find((f) => f.key === key)
  if (!s) throw new Error(`No field ${key}`)
  return s
}
const extra: Record<string, FieldSpec> = {
  measuredWaterCapacity: {
    key: 'measuredWaterCapacity',
    label: msg('Case capacity (H₂O)'),
    quantity: 'capacity',
    min: 0,
  },
  coal: { key: 'coal', label: msg('COAL'), quantity: 'length', min: 0 },
  barrelLength: {
    key: 'barrelLength',
    label: msg('Barrel length'),
    quantity: 'barrelLength',
    min: 0,
  },
  firearmMass: { key: 'firearmMass', label: msg('Gun weight'), quantity: 'firearmMass', min: 0 },
  ladderStep: { key: 'ladderStep', label: msg('Step size'), quantity: 'charge', min: 0 },
}
const fieldSpec = (key: string) => extra[key] ?? spec(key)

/** Fake values in SI, the charge in kg. */
const start: Record<string, number> = {
  volume: 3.08e-6,
  boreDiameter: 7.62e-3,
  boreArea: 4.72e-5,
  measuredWaterCapacity: 3.6e-6,
  coal: 71.1e-3,
  charge: 2.4e-3,
  propellantTemperature: 294.15,
  ladderStep: 1.3e-5,
  bulletMass: 168 * 6.479891e-5,
  travel: 0.555,
  twist: 0.254,
  barrelLength: 0.61,
  firearmMass: 4.5,
  leakArea: 0,
  boreFriction: 0,
  engravingPressure: 2.5e7,
  engravingLength: 1e-3,
}

type Values = { get: (k: string) => FieldValue; set: (k: string, v: FieldValue) => void }
const ValuesContext = createContext<Values | null>(null)

function useValues() {
  const v = use(ValuesContext)
  if (!v) throw new Error('No values')
  return v
}

function Field({ name }: { name: string }) {
  const { system } = useUnits()
  const { get, set } = useValues()
  const label = useLabel()
  const s = fieldSpec(name)
  return (
    <NumberField
      spec={{ ...s, label: msg(label(s.label)) }}
      system={system}
      value={get(name)}
      onChange={(v) => set(name, v)}
    />
  )
}

function RecordRow({ name, value, unit }: { name: string; value: string; unit?: string }) {
  const label = useLabel()
  return (
    <div className="record-row wide">
      <span>{label(name)}</span>
      <span>{value}</span>
      {unit && <span className="record-unit">{unit}</span>}
    </div>
  )
}

type ChoiceMode = 'more' | 'row' | 'top'

function Choice({ name, data, mode }: { name: string; data: string[]; mode: ChoiceMode }) {
  const label = useLabel()
  const [value, setValue] = useState<string | null>(data[0] ?? null)
  return (
    <Select
      className={mode === 'more' ? 'wide' : mode === 'row' ? 'wide proto-pin-row' : undefined}
      size={controlSize.row.input}
      label={label(name)}
      data={data}
      value={value}
      onChange={setValue}
      allowDeselect={false}
    />
  )
}

function Picker({ name, value }: { name: string; value: string }) {
  const label = useLabel()
  return (
    <Select
      size={controlSize.row.input}
      aria-label={label(name)}
      searchable
      data={[value]}
      defaultValue={value}
      allowDeselect={false}
    />
  )
}

function Seg({ legend, items }: { legend: string; items: string[] }) {
  const label = useLabel()
  const [value, setValue] = useState(items[0] ?? '')
  return (
    <SegmentedRow
      legend={label(legend)}
      name={`proto-${legend}`}
      value={value}
      segments={items.map((i) => ({ value: i, label: label(i) }))}
      onChange={setValue}
    />
  )
}

/** The seating values the figure computes, as the card's `dl`. */
function SeatingValues() {
  const label = useLabel()
  return (
    <dl className="wide">
      <div className="seating-row">
        <dt>{label('CBTO')}</dt>
        <dd>
          <span className="num">57.40</span> <span className="row-unit">mm</span>
        </dd>
      </div>
      <div className="seating-row">
        <dt>{label('Seating depth')}</dt>
        <dd>
          <span className="num">8.47</span> <span className="row-unit">mm</span>
        </dd>
      </div>
    </dl>
  )
}

function SeatingFields() {
  const label = useLabel()
  return (
    <div className="seating-slot wide">
      <div className="seating-controls">
        <Field name="measuredWaterCapacity" />
        <Seg legend="Seat the bullet by" items={['COAL', 'CBTO']} />
        <Field name="coal" />
        <Slider
          aria-label={label('Slide to change COAL')}
          size="xs"
          min={68}
          max={72}
          step={0.05}
          defaultValue={71.1}
          label={null}
        />
      </div>
      <SeatingValues />
    </div>
  )
}

/** Primer, brass and capacity record: in the Cartridge card's More (A, C), as rows (B, D) or above the columns. */
function CaseChoices({ mode }: { mode: ChoiceMode }) {
  return (
    <>
      <Choice name="Primer" data={fake.primer} mode={mode} />
      <Choice name="Brass record" data={fake.brass} mode={mode} />
      <Choice name="Case capacity record" data={fake.capacity} mode={mode} />
    </>
  )
}

function MoreValues() {
  const label = useLabel()
  const rows = [
    ['Case volume to the mouth', '3.39 cm³'],
    ['Bullet travel', '555 mm'],
    ['Leade', '1.52 mm'],
    ['Jump', '0.50 mm'],
  ]
  return (
    <dl className="seating-more wide">
      {rows.map(([term, value]) => (
        <div key={term} className="seating-row">
          <dt>{label(term ?? '')}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function CartridgeBody({ pinned }: { pinned: boolean }) {
  return (
    <div className="panel-fields">
      {pinned && <CaseChoices mode="row" />}
      <RecordRow name="CIP Pmax" value="415" unit="MPa" />
      <RecordRow name="Case length, CIP L3" value="51.18" unit="mm" />
      <Field name="volume" />
      <Field name="boreDiameter" />
      <Field name="boreArea" />
      <SeatingFields />
    </div>
  )
}

function CartridgeMore({ pinned }: { pinned: boolean }) {
  return (
    <>
      <RecordRow name="COAL, CIP maximum L6" value="71.12" unit="mm" />
      {!pinned && <CaseChoices mode="more" />}
      <MoreValues />
      <p className="note wide">Staying below L6 says nothing about pressure.</p>
    </>
  )
}

function LadderFields() {
  const label = useLabel()
  return (
    <>
      <div className="pair-row wide">
        <span aria-hidden="true">{label('Ladder steps, size')}</span>
        <TextInput
          size={controlSize.row.input}
          className="ladder-steps"
          aria-label={label('Ladder steps')}
          defaultValue="5"
          inputMode="numeric"
        />
        <Field name="ladderStep" />
      </div>
      <Seg legend="Ladder" items={['Charge', 'Seating', 'Temperature']} />
      <Seg legend="Direction" items={['Up', 'Down', 'Around']} />
    </>
  )
}

function ModelRow() {
  const label = useLabel()
  return (
    <div className="model-row wide">
      <span>{label('Model parameters')}</span>
      <Button size={controlSize.row.button} variant="default" aria-expanded={false}>
        {label('Show')}
      </Button>
    </div>
  )
}

function PowderBody() {
  return (
    <div className="panel-fields">
      <Field name="charge" />
      <Field name="propellantTemperature" />
      <LadderFields />
      <ModelRow />
    </div>
  )
}

function BulletBody() {
  return (
    <div className="panel-fields">
      <RecordRow name="Diameter × length" value="7.82 × 31.2" unit="mm" />
      <RecordRow name="Ballistic coefficient" value="G7 0.218" />
      <RecordRow name="Construction" value="Hollow point boat tail" />
      <Field name="bulletMass" />
    </div>
  )
}

function GunBody() {
  return (
    <div className="panel-fields">
      <Field name="travel" />
      <Field name="twist" />
      <Field name="barrelLength" />
      <Field name="firearmMass" />
    </div>
  )
}

type Panel = 'cartridge' | 'powder' | 'bullet' | 'firearm'
const titles: Record<Panel, string> = {
  cartridge: 'Cartridge',
  powder: 'Powder',
  bullet: 'Bullet',
  firearm: 'Gun',
}
const pickers: Record<Panel, [string, string]> = {
  cartridge: ['Search cartridges by name', fake.cartridge],
  powder: ['Search powders by manufacturer and name', fake.powder],
  bullet: ['Search bullets by manufacturer and name', fake.bullet],
  firearm: ['Firearm from your library', fake.firearm],
}

function Card({ panel, pinned = false }: { panel: Panel; pinned?: boolean }) {
  const label = useLabel()
  const [open, setOpen] = useState(false)
  const title = label(titles[panel])
  const [pickerLabel, pickerValue] = pickers[panel]
  const more =
    panel === 'cartridge' ? (
      <CartridgeMore pinned={pinned} />
    ) : panel === 'powder' ? (
      ['leakArea', 'boreFriction', 'engravingPressure', 'engravingLength'].map((k) => (
        <Field key={k} name={k} />
      ))
    ) : panel === 'bullet' ? (
      <Switch className="wide" label={label('Bullets of all diameters')} />
    ) : undefined
  return (
    <Paper
      component="section"
      withBorder
      className="panel"
      data-panel={panel}
      aria-labelledby={`proto-${panel}`}
    >
      <div className="panel-head" data-chosen>
        <h2 id={`proto-${panel}`} className="panel-title">
          {title}
        </h2>
        <Picker name={pickerLabel} value={pickerValue} />
        {more && (
          <Popover
            opened={open}
            onChange={setOpen}
            position="bottom-end"
            width={360}
            keepMounted
            trapFocus
          >
            <Popover.Target>
              <ActionIcon
                size={controlSize.row.icon}
                variant="subtle"
                color="gray"
                aria-label={`${label('More of')} ${title}`}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
              >
                <DotsThree size={18} weight="bold" aria-hidden="true" />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <div className="panel-fields more-fields" data-panel={panel}>
                {more}
              </div>
            </Popover.Dropdown>
          </Popover>
        )}
      </div>
      {panel === 'cartridge' && <CartridgeBody pinned={pinned} />}
      {panel === 'powder' && <PowderBody />}
      {panel === 'bullet' && <BulletBody />}
      {panel === 'firearm' && <GunBody />}
    </Paper>
  )
}

function Figure() {
  return (
    <div className="figure-host proto-figure" role="img" aria-label="Fake cartridge figure">
      <svg viewBox="0 0 200 60" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect x="10" y="20" width="120" height="20" fill="none" stroke="currentColor" />
        <path d="M130 22 L180 28 L180 32 L130 38 Z" fill="none" stroke="currentColor" />
      </svg>
    </div>
  )
}

function RunBar() {
  const label = useLabel()
  return (
    <div className="run-bar">
      <Button>{label('Run simulation')}</Button>
      <span className="run-hint">or Ctrl+Enter</span>
    </div>
  )
}

/** A (and C and D from 48em): the shipped two columns, Cartridge with the figure, then Powder, Bullet, Gun. */
function Cards({ pin }: { pin: 'none' | 'card' | 'top' }) {
  const label = useLabel()
  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} aria-label={label('Load')}>
      {pin === 'top' && (
        <div className="proto-pin proto-pin-top">
          <CaseChoices mode="top" />
        </div>
      )}
      <div className="panels">
        <div className="panel-column">
          <Card panel="cartridge" pinned={pin === 'card'} />
          <Figure />
        </div>
        <div className="panel-column">
          <Card panel="powder" />
          <Card panel="bullet" />
          <Card panel="firearm" />
        </div>
      </div>
      <RunBar />
    </form>
  )
}

const groups = ['Cartridge and gun', 'Projectile', 'Propellant'] as const

/** The three input groups as tabs: B at every width, C below 48em. */
function GroupTabs() {
  const label = useLabel()
  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} aria-label={label('Load')}>
      <Tabs defaultValue={groups[0]} className="proto-groups">
        <Tabs.List grow aria-label={label('Input groups')}>
          {groups.map((g) => (
            <Tabs.Tab key={g} value={g}>
              {label(g)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value={groups[0]}>
          <div className="panels">
            <div className="panel-column">
              <Card panel="cartridge" pinned />
              <Card panel="firearm" />
            </div>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value={groups[1]}>
          <div className="panels">
            <div className="panel-column">
              <Card panel="bullet" />
              <Figure />
            </div>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value={groups[2]}>
          <div className="panels">
            <div className="panel-column">
              <Card panel="powder" />
            </div>
          </div>
        </Tabs.Panel>
      </Tabs>
      <RunBar />
    </form>
  )
}

/** Fake readouts that follow the charge, so an edit changes their width. */
function Readouts() {
  const { get } = useValues()
  const label = useLabel()
  const grams = (get('charge').si ?? 0) * 1000
  const velocity = Math.round(265 * grams)
  const keys: [string, string, string][] = [
    ['Peak pressure', String(Math.round(373 * grams * grams)), 'bar'],
    ['Muzzle velocity', String(velocity), 'm/s'],
    ['Muzzle energy', String(Math.round((velocity * velocity * 0.01089) / 2)), 'J'],
  ]
  const rows: [string, string][] = [
    ['Muzzle pressure', '483 bar'],
    ['Case fill', '92 %'],
    ['Barrel time', '1.373 ms'],
    ['Efficiency', '30.6 %'],
    ['Bullet lead time', '1.381 ms'],
    ['Free recoil', '8.7 J'],
    ['Burnout at', '465.7 mm'],
    ['Muzzle spin', '143.5 krpm'],
  ]
  return (
    <>
      <p className="proto-head">{label('Sample load (fake), simulation, not load data')}</p>
      <dl className="readouts readout-keys">
        {keys.map(([term, value, unit]) => (
          <div key={term} className="readout-wide">
            <dt>{label(term)}</dt>
            <dd className="readout-big">
              <span className="readout-value">{value}</span>{' '}
              <span className="readout-unit">{unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      <dl className="readouts proto-list">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt>{label(term)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="proto-band">
        {label('Velocity 715 to 743 m/s. 5th to 95th percentile, input tolerances only.')}
      </p>
    </>
  )
}

function Lots() {
  const label = useLabel()
  return (
    <fieldset className="proto-lots">
      <legend>{label('Lots')}</legend>
      {['Powder lot', 'Primer lot', 'Brass lot'].map((l) => (
        <TextInput key={l} size={controlSize.row.input} label={label(l)} />
      ))}
    </fieldset>
  )
}

function Results() {
  const label = useLabel()
  return (
    <div className="result proto-result">
      <Readouts />
      <div className="proto-chips" role="radiogroup" aria-label={label('Charge ladder')}>
        {['2.40', '2.39', '2.37', '2.36', '2.35'].map((c, i) => (
          <label key={c} className="proto-chip">
            <input type="radio" name="proto-chip" defaultChecked={i === 0} />
            <span>{c} g</span>
          </label>
        ))}
      </div>
      <Tabs defaultValue="chart" className="result-tabs">
        <Tabs.List className="result-tablist">
          {['Chart', 'Ladder table', 'Trajectory', 'Measurements', 'Notes'].map((t) => (
            <Tabs.Tab key={t} value={t === 'Chart' ? 'chart' : t}>
              {label(t)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="chart" className="results-panel">
          <div className="proto-chart" role="img" aria-label="Fake pressure and velocity chart" />
        </Tabs.Panel>
        <Tabs.Panel value="Notes">
          <Lots />
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}

function Variant({ v, pin }: { v: Variant; pin: 'card' | 'top' }) {
  const phone = useMediaQuery('(max-width: 47.99em)', false) ?? false
  const label = useLabel()
  const inputs =
    v === 'B' || (v === 'C' && phone) ? <GroupTabs /> : <Cards pin={v === 'D' ? pin : 'none'} />
  return (
    <div className="page-frame">
      <PageBar
        title={`Workbench layout ${v} (prototype)`}
        compact
        status={<span className="bar-result">Fake data, no model</span>}
        after={
          <Button
            className="bar-run"
            leftSection={<Play size={14} weight="fill" aria-hidden="true" />}
          >
            {label('Run')}
          </Button>
        }
        actions={
          <Button
            variant="default"
            className="bar-icon"
            leftSection={<MagnifyingGlass size={18} aria-hidden="true" />}
          >
            {label('Search')}
          </Button>
        }
      />
      <Workspace
        className={`workbench proto-variant-${v}`}
        inputsLabel={label('Load')}
        inputs={inputs}
        results={<Results />}
        range={<p>Fake range view</p>}
        bar={(show) => (
          <div className="bar-state">
            <Button size={controlSize.row.button} variant="default" onClick={show}>
              {label('Results')}
            </Button>
          </div>
        )}
      />
    </div>
  )
}

const variantOf = (v: string | null): Variant => (v === 'B' || v === 'C' || v === 'D' ? v : 'A')

/** `?v=A|B|C|D`, `&long=1` for labels 30 percent longer, `&pin=top` for D's row above both columns. */
export function PrototypeWorkbench() {
  const params = useSearchParams()
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const { system } = useUnits()
  const get = (k: string): FieldValue => {
    const given = values[k]
    if (given) return given
    const si = start[k]
    if (si === undefined) return { text: '', si: undefined }
    return { text: roundedFieldText(fieldSpec(k).quantity, system, si), si }
  }
  return (
    <Long value={params.get('long') === '1'}>
      <ValuesContext value={{ get, set: (k, v) => setValues((all) => ({ ...all, [k]: v })) }}>
        <Variant
          v={variantOf(params.get('v'))}
          pin={params.get('pin') === 'top' ? 'top' : 'card'}
        />
      </ValuesContext>
    </Long>
  )
}
