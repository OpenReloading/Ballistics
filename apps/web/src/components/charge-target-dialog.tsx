'use client'

import { Button, Group, NumberInput, Select, Stack, Text } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { apiFetch } from '../lib/api-fetch.ts'
import {
  answerOf,
  chargeTargetBody,
  checkedRequest,
  type Outcome,
  type TargetKind,
  targetKinds,
  targetNumber,
  targetUnit,
} from '../lib/charge-target.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { powderDesignNote } from '../lib/powder-designer.ts'
import { formatQuantity, msText, withUnit } from '../lib/units.ts'
import { AppModal } from './app-modal.tsx'
import { useLoad } from './workbench-context.ts'
import { notReached } from './workbench-outcome.ts'

/** `request` is the load request the answer was solved for: an answer shows only for the same load. */
type Answer = { request: string } & Outcome

/** The load request as text, to compare the load an answer was solved for with the current one. */
function requestKey(loadRequest: () => { body: object; bulkDensity?: number | undefined }) {
  try {
    const { body, bulkDensity } = loadRequest()
    return JSON.stringify([body, bulkDensity])
  } catch {
    return ''
  }
}

/**
 * The charge at which the simulation reaches a target: the target and its value, the answer with
 * the pressure range at that charge, and Apply, which writes the charge into the field. It posts the load of the fields as Run does.
 */
export function ChargeTargetDialog({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { system, cartridge, loadRequest, applyCharge, powderDesign } = useLoad()
  const [kind, setKind] = useState<TargetKind>('peakPressure')
  const [percent, setPercent] = useState(false)
  const [value, setValue] = useState<string | number>('')
  const [pending, setPending] = useState(false)
  const [solved, setAnswer] = useState<Answer | undefined>(undefined)
  const running = useRef<AbortController | null>(null)
  // the closed dialog builds no request: it is mounted on every workbench render
  const request = opened ? requestKey(loadRequest) : ''
  const answer = solved?.request === request ? solved : undefined
  // a percentage needs the cartridge's CIP limit
  const percentable = kind === 'peakPressure' && cartridge !== undefined
  const asPercent = percentable && percent
  const unit = targetUnit(kind, system, asPercent)

  useEffect(() => () => running.current?.abort(), [])

  // an open, a close and a changed load end the request in flight and drop the answer
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on these two only
  useEffect(() => {
    reset()
  }, [opened, request])

  /** Ends the request in flight, so its answer is never shown, and drops the answer. */
  function reset() {
    running.current?.abort()
    running.current = null
    setPending(false)
    setAnswer(undefined)
  }

  function change(next: TargetKind) {
    setKind(next)
    setPercent(false)
    setValue('')
    reset()
  }

  async function find() {
    const typed = targetNumber(value)
    const checked = checkedRequest(value, unit, kind, loadRequest)
    if ('text' in checked) {
      setAnswer({ request, kind: 'failed', text: checked.text })
      return
    }
    const req = checked.req
    running.current?.abort()
    const controller = new AbortController()
    running.current = controller
    setPending(true)
    try {
      const res = await apiFetch('interior/charge-target', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          chargeTargetBody(req.body, req.bulkDensity, {
            kind,
            value: unit.toSi(typed),
            percent: asPercent,
          }),
        ),
        signal: controller.signal,
      })
      const json = await res.json().catch(() => undefined)
      if (controller.signal.aborted) return
      setAnswer({ request, ...answerOf(res, json, kind, system, asPercent) })
    } catch {
      if (!controller.signal.aborted)
        setAnswer({ request, kind: 'failed', text: (t) => t(notReached) })
    } finally {
      if (running.current === controller) setPending(false)
    }
  }

  const found = answer?.kind === 'found' ? answer.body : undefined
  return (
    <AppModal opened={opened} onClose={onClose} title={t('Charge for a target')} size="sm">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void find()
        }}
      >
        <Stack gap="xs">
          <Select
            label={t('Target')}
            allowDeselect={false}
            data={targetKinds.map((k) => ({ value: k.value, label: t(k.label) }))}
            value={kind}
            onChange={(v) => v && change(v as TargetKind)}
            comboboxProps={{ withinPortal: false }}
          />
          <Group align="flex-end" gap="xs" wrap="nowrap">
            <NumberInput
              flex={1}
              label={t('Value')}
              hideControls
              value={value}
              decimalScale={unit.decimals}
              onChange={(v) => {
                // blur normalises the text ("0.80" to 0.8) and calls this again: the same number keeps the answer
                if (!Object.is(targetNumber(v), targetNumber(value))) reset()
                setValue(v)
              }}
              rightSection={
                <Text size="xs" c="dimmed" pr="xs">
                  {unit.symbol}
                </Text>
              }
              rightSectionWidth={asPercent ? 72 : 44}
              data-autofocus
            />
            {percentable && (
              <Button
                variant="default"
                aria-pressed={percent}
                title={t("Read the value as a percentage of the cartridge's CIP Pmax")}
                onClick={() => {
                  setPercent((p) => !p)
                  setValue('')
                  reset()
                }}
              >
                {t('% of Pmax')}
              </Button>
            )}
          </Group>
          <Button type="submit" loading={pending}>
            {t('Find charge')}
          </Button>
        </Stack>
      </form>
      <div aria-live="polite" role="status">
        {answer && answer.kind !== 'found' && (
          <Text mt="sm" size="sm" role={answer.kind === 'failed' ? 'alert' : undefined}>
            {answer.text(t)}
          </Text>
        )}
        {found && (
          <Stack mt="sm" gap="xs" data-testid="charge-target-result">
            <Text size="sm">
              {t('The simulation reaches the target at about')}{' '}
              <strong data-testid="charge-target-charge">
                {formatQuantity('charge', system, found.charge)} {system.charge.symbol}
              </strong>{' '}
              {t('(simulation, not load data).')}
            </Text>
            <Row
              label={t('Peak pressure')}
              value={withUnit('pressure', system, found.pressureRange.nominalPressure)}
            />
            <Row
              label={t('Pressure range')}
              value={t('{low} to {high}', {
                low: formatQuantity('pressure', system, found.pressureRange.lowPressure),
                high: withUnit('pressure', system, found.pressureRange.highPressure),
              })}
            />
            <Row
              label={t('Muzzle velocity')}
              value={withUnit('velocity', system, found.result.muzzleVelocity)}
            />
            <Row label={t('Barrel time')} value={msText(found.result.barrelTime)} />
            {!found.burnoutInBarrel && <Row label={t('Burnout')} value={t('not in the barrel')} />}
            {powderDesign && (
              <Text size="xs" className="user-design">
                {powderDesignNote(powderDesign.name, t)}
              </Text>
            )}
            {found.warnings
              .filter((w) => w.code !== 'noCartridge')
              .map((w) => (
                <Text key={w.message} size="xs">
                  {translateMessage(w.message, t)}
                </Text>
              ))}
            <Group justify="flex-end" gap="xs">
              <Button
                title={t('Writes the charge into the charge field')}
                onClick={() => {
                  applyCharge(found.charge)
                  onClose()
                }}
              >
                {t('Apply')}
              </Button>
            </Group>
          </Stack>
        )}
      </div>
    </AppModal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Group>
  )
}
