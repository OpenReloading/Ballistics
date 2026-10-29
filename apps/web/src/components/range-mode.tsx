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
import { useTranslation } from '../i18n/language.ts'
import { decimalMark, formatNumber, plainNumber } from '../i18n/number.ts'
import type { Translator } from '../i18n/translate.ts'
import type { RangeStep } from '../lib/range-entry.ts'
import { rangeStats } from '../lib/range-entry.ts'
import { type UnitSystem, withUnit } from '../lib/units.ts'
import { BarCount, PageBar } from './page-bar.tsx'
import { EmptyNote, Message } from './states.tsx'
import { useOnline, useRangeMode } from './use-range-mode.ts'

/** The smallest side of a control on this page, px (WCAG 2.2 criterion 2.5.5). */
const target = 44

const padKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'] as const

/** `+1`, `0`, `−2` as a ladder step's name next to its charge. */
function stepName(step: RangeStep, system: UnitSystem, t: Translator['t']) {
  const charge = step.charge === undefined ? undefined : toSi('mass', step.charge)
  const text = charge === undefined ? t('Load as saved') : withUnit('charge', system, charge)
  if (step.offset === undefined || step.offset === 0) return text
  return `${text} (${step.offset > 0 ? '+' : '−'}${plainNumber(Math.abs(step.offset))})`
}

export function RangeMode() {
  const { t } = useTranslation()
  const r = useRangeMode()
  const online = useOnline()
  const { system } = r
  const unit = system.velocity.symbol
  const stats = rangeStats(r.string)
  const shown = (ms: number | undefined) =>
    ms === undefined ? t('n/a') : `${formatNumber(system.velocity.fromSi(ms), 1)} ${unit}`

  return (
    <>
      <PageBar
        title={t('Range mode')}
        status={<BarCount>{online ? t('Online') : t('Offline, saved on this device')}</BarCount>}
      />
      <Stack gap="md" maw="32rem" mx="auto" py="md" px="md">
        {r.failure && <Message severity="error">{r.failure}</Message>}
        {r.loads?.length === 0 && (
          <EmptyNote
            icon={<Gauge size={32} aria-hidden="true" />}
            title={t('No saved loads in this browser')}
            description={t(
              'Save a load in the workbench while you are online, then open it here at the range.',
            )}
            action={
              <Button component={Link} href="/workbench" mih={target}>
                {t('Open the workbench')}
              </Button>
            }
          />
        )}
        {r.loads && r.loads.length > 0 && (
          <NativeSelect
            label={t('Saved load')}
            size="lg"
            value={r.loadId ?? ''}
            onChange={(e) => r.choose(e.currentTarget.value || undefined)}
            data={[
              { value: '', label: t('Choose a load'), disabled: true },
              ...r.loads.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
        )}
        {r.load && r.step && (
          <>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="visually-hidden">{t('Ladder step')}</legend>
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
                    {stepName(s, system, t)}
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
                  label={t('Velocity ({unit})', { unit })}
                  size="lg"
                  inputMode="none"
                  autoComplete="off"
                  enterKeyHint="done"
                  value={r.entry}
                  onChange={(e) => r.setEntry(e.currentTarget.value)}
                />
                <SimpleGrid cols={3} spacing="xs" aria-label={t('Number pad')} role="group">
                  {padKeys.map((key) => {
                    // the decimal key writes the mark of the language shown
                    const k = key === '.' ? decimalMark() : key
                    return (
                      <Button
                        key={key}
                        type="button"
                        variant="default"
                        h={56}
                        fz="xl"
                        onClick={() => r.append(k)}
                      >
                        {k}
                      </Button>
                    )
                  })}
                  <Button
                    type="button"
                    variant="default"
                    h={56}
                    aria-label={t('Delete last digit')}
                    onClick={r.erase}
                  >
                    <Backspace size={24} aria-hidden="true" />
                  </Button>
                </SimpleGrid>
                <Button type="submit" h={56} fz="lg" disabled={r.saving || r.entry.trim() === ''}>
                  {t('Add shot')}
                </Button>
              </Stack>
            </form>
            <div role="status" aria-live="polite">
              {r.saved}
            </div>
            {r.problem && <Message severity="error">{r.problem}</Message>}
            <section aria-label={t('Shots of this step')}>
              <Text component="h2" fw={600} mb="xs">
                {t('Shots, {step}', { step: stepName(r.step, system, t) })}
              </Text>
              {(r.string?.shots.length ?? 0) === 0 && <Text>{t('No shot entered yet.')}</Text>}
              <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {r.string?.shots.map((shot, k) => (
                  // shots have no id: the position in the string is the key
                  // biome-ignore lint/suspicious/noArrayIndexKey: shots are only appended
                  <li key={k}>
                    <Group justify="space-between" wrap="nowrap">
                      <Text td={shot.excluded ? 'line-through' : undefined}>
                        {plainNumber(k + 1)}: {shown(shot.velocity.value)}
                        {shot.excluded && (
                          <span className="visually-hidden"> {t('(excluded)')}</span>
                        )}
                      </Text>
                      <Button
                        variant={shot.excluded ? 'filled' : 'default'}
                        aria-pressed={!!shot.excluded}
                        aria-label={t('Exclude shot {n}', { n: k + 1 })}
                        mih={target}
                        miw={target}
                        onClick={() => void r.exclude(k, !shot.excluded)}
                      >
                        {t('Exclude')}
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
                    <dt>{t('Shots counted')}</dt>
                    <dd style={{ margin: 0 }}>{plainNumber(stats.count)}</dd>
                  </div>
                  <div style={{ display: 'contents' }}>
                    <dt>{t('Mean')}</dt>
                    <dd style={{ margin: 0 }}>{shown(stats.mean)}</dd>
                  </div>
                  <div style={{ display: 'contents' }}>
                    <dt>{t('SD')}</dt>
                    <dd style={{ margin: 0 }}>{shown(stats.standardDeviation)}</dd>
                  </div>
                  <div style={{ display: 'contents' }}>
                    <dt>{t('ES')}</dt>
                    <dd style={{ margin: 0 }}>{shown(stats.extremeSpread)}</dd>
                  </div>
                </dl>
              )}
            </section>
            <section aria-label={t('Conditions and note')}>
              <Text component="h2" fw={600} mb="xs">
                {t('Conditions and note')}
              </Text>
              <Stack gap="sm">
                <TextInput
                  label={t('Air temperature ({unit})', { unit: system.temperature.symbol })}
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
                  label={t('Air pressure ({unit})', { unit: system.airPressure.symbol })}
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
                  label={t('Wind speed ({unit})', { unit: system.windSpeed.symbol })}
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
                  label={t('Note')}
                  size="lg"
                  autosize
                  minRows={2}
                  maxLength={2000}
                  value={r.note}
                  onChange={(e) => void r.keep({ weather: r.weather, note: e.currentTarget.value })}
                />
                {(r.string?.shots.length ?? 0) === 0 && (
                  <Text size="sm">{t('Kept with the first shot of this step.')}</Text>
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
              {t('Shot groups for a target photo')}
            </Button>
            <Button component={Link} href="/session" variant="default" mih={target}>
              {t('Session summary')}
            </Button>
          </>
        )}
      </Stack>
    </>
  )
}
