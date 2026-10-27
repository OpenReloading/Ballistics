'use client'

import {
  Button,
  Group,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { toSi } from '@open-reloading/schema'
import { Backspace, Camera, Gauge } from '@phosphor-icons/react'
import Link from 'next/link'
import type { RangeStep } from '../lib/range-entry.ts'
import { rangeStats } from '../lib/range-entry.ts'
import { formatNumber, type UnitSystem, withUnit } from '../lib/units.ts'
import { BarCount, PageBar } from './page-bar.tsx'
import { EmptyNote, Message } from './states.tsx'
import { useOnline, useRangeMode } from './use-range-mode.ts'

/** The smallest side of a control on this page, px (WCAG 2.2 criterion 2.5.5). */
const target = 44

const padKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'] as const

/** `+1`, `0`, `−2` as a ladder step's name next to its charge. */
function stepName(step: RangeStep, system: UnitSystem) {
  const charge = step.charge === undefined ? undefined : toSi('mass', step.charge)
  const text = charge === undefined ? 'Load as saved' : withUnit('charge', system, charge)
  if (step.offset === undefined || step.offset === 0) return text
  return `${text} (${step.offset > 0 ? '+' : '−'}${Math.abs(step.offset)})`
}

export function RangeMode() {
  const r = useRangeMode()
  const online = useOnline()
  const { system } = r
  const unit = system.velocity.symbol
  const stats = rangeStats(r.string)
  const shown = (ms: number | undefined) =>
    ms === undefined ? 'n/a' : `${formatNumber(system.velocity.fromSi(ms), 1)} ${unit}`

  return (
    <>
      <PageBar
        title="Range mode"
        status={<BarCount>{online ? 'Online' : 'Offline, saved on this device'}</BarCount>}
      />
      <Stack gap="md" maw="32rem" mx="auto" py="md" px="md">
        {r.failure && <Message severity="error">{r.failure}</Message>}
        {r.loads?.length === 0 && (
          <EmptyNote
            icon={<Gauge size={32} aria-hidden="true" />}
            title="No saved loads in this browser"
            description="Save a load in the workbench while you are online, then open it here at the range."
            action={
              <Button component={Link} href="/workbench" mih={target}>
                Open the workbench
              </Button>
            }
          />
        )}
        {r.loads && r.loads.length > 0 && (
          <NativeSelect
            label="Saved load"
            size="lg"
            value={r.loadId ?? ''}
            onChange={(e) => r.choose(e.currentTarget.value || undefined)}
            data={[
              { value: '', label: 'Choose a load', disabled: true },
              ...r.loads.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
        )}
        {r.load && r.step && (
          <>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="visually-hidden">Ladder step</legend>
              <Group gap="xs">
                {r.steps.map((s) => (
                  <Button
                    key={s.key}
                    variant={s.key === r.step?.key ? 'filled' : 'default'}
                    aria-pressed={s.key === r.step?.key}
                    mih={target}
                    miw={target}
                    onClick={() => r.chooseStep(s.key)}
                  >
                    {stepName(s, system)}
                  </Button>
                ))}
              </Group>
            </fieldset>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void r.add()
              }}
            >
              <Stack gap="sm">
                <TextInput
                  label={`Velocity (${unit})`}
                  size="lg"
                  inputMode="none"
                  autoComplete="off"
                  enterKeyHint="done"
                  value={r.entry}
                  onChange={(e) => r.setEntry(e.currentTarget.value)}
                />
                <SimpleGrid cols={3} spacing="xs" aria-label="Number pad" role="group">
                  {padKeys.map((k) => (
                    <Button
                      key={k}
                      type="button"
                      variant="default"
                      h={56}
                      fz="xl"
                      onClick={() => r.append(k)}
                    >
                      {k}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="default"
                    h={56}
                    aria-label="Delete last digit"
                    onClick={r.erase}
                  >
                    <Backspace size={24} aria-hidden="true" />
                  </Button>
                </SimpleGrid>
                <Button type="submit" h={56} fz="lg" disabled={r.saving || r.entry.trim() === ''}>
                  Add shot
                </Button>
              </Stack>
            </form>
            <div role="status" aria-live="polite">
              {r.saved}
            </div>
            {r.problem && <Message severity="error">{r.problem}</Message>}
            <section aria-label="Shots of this step">
              <Text component="h2" fw={600} mb="xs">
                Shots, {stepName(r.step, system)}
              </Text>
              {(r.string?.shots.length ?? 0) === 0 && <Text>No shot entered yet.</Text>}
              <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {r.string?.shots.map((shot, k) => (
                  // shots have no id: the position in the string is the key
                  // biome-ignore lint/suspicious/noArrayIndexKey: shots are only appended
                  <li key={k}>
                    <Group justify="space-between" wrap="nowrap">
                      <Text td={shot.excluded ? 'line-through' : undefined}>
                        {k + 1}: {shown(shot.velocity.value)}
                        {shot.excluded && <span className="visually-hidden"> (excluded)</span>}
                      </Text>
                      <Button
                        variant={shot.excluded ? 'filled' : 'default'}
                        aria-pressed={!!shot.excluded}
                        aria-label={`Exclude shot ${k + 1}`}
                        mih={target}
                        miw={target}
                        onClick={() => void r.exclude(k, !shot.excluded)}
                      >
                        Exclude
                      </Button>
                    </Group>
                  </li>
                ))}
              </ol>
              {stats && (
                <dl
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '0 1rem',
                    margin: '0.5rem 0 0',
                  }}
                >
                  <div style={{ display: 'contents' }}>
                    <dt>Shots counted</dt>
                    <dd style={{ margin: 0 }}>{stats.count}</dd>
                  </div>
                  <div style={{ display: 'contents' }}>
                    <dt>Mean</dt>
                    <dd style={{ margin: 0 }}>{shown(stats.mean)}</dd>
                  </div>
                  <div style={{ display: 'contents' }}>
                    <dt>SD</dt>
                    <dd style={{ margin: 0 }}>{shown(stats.standardDeviation)}</dd>
                  </div>
                  <div style={{ display: 'contents' }}>
                    <dt>ES</dt>
                    <dd style={{ margin: 0 }}>{shown(stats.extremeSpread)}</dd>
                  </div>
                </dl>
              )}
            </section>
            <section aria-label="Conditions and note">
              <Text component="h2" fw={600} mb="xs">
                Conditions and note
              </Text>
              <Stack gap="sm">
                <TextInput
                  label={`Air temperature (${system.temperature.symbol})`}
                  size="lg"
                  inputMode="decimal"
                  value={r.weather.temperature}
                  onChange={(e) =>
                    void r.keep({
                      weather: { ...r.weather, temperature: e.currentTarget.value },
                      note: r.note,
                    })
                  }
                />
                <TextInput
                  label={`Air pressure (${system.airPressure.symbol})`}
                  size="lg"
                  inputMode="decimal"
                  value={r.weather.pressure}
                  onChange={(e) =>
                    void r.keep({
                      weather: { ...r.weather, pressure: e.currentTarget.value },
                      note: r.note,
                    })
                  }
                />
                <TextInput
                  label={`Wind speed (${system.windSpeed.symbol})`}
                  size="lg"
                  inputMode="decimal"
                  value={r.weather.wind}
                  onChange={(e) =>
                    void r.keep({
                      weather: { ...r.weather, wind: e.currentTarget.value },
                      note: r.note,
                    })
                  }
                />
                <Textarea
                  label="Note"
                  size="lg"
                  autosize
                  minRows={2}
                  maxLength={2000}
                  value={r.note}
                  onChange={(e) => void r.keep({ weather: r.weather, note: e.currentTarget.value })}
                />
                {(r.string?.shots.length ?? 0) === 0 && (
                  <Text size="sm">Kept with the first shot of this step.</Text>
                )}
              </Stack>
            </section>
            <Button
              component={Link}
              href="/groups"
              variant="default"
              mih={target}
              leftSection={<Camera aria-hidden="true" />}
            >
              Shot groups for a target photo
            </Button>
            <Button component={Link} href="/session" variant="default" mih={target}>
              Session summary
            </Button>
          </>
        )}
      </Stack>
    </>
  )
}
