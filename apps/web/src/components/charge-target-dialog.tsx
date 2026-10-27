'use client'

import { Button, Group, NumberInput, Select, Stack, Text } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api-fetch.ts'
import {
  type ChargeTargetRefusal,
  type ChargeTargetResponse,
  chargeTargetBody,
  refusalText,
  type TargetKind,
  targetError,
  targetKinds,
  targetNumber,
  targetUnit,
} from '../lib/charge-target.ts'
import { errorText } from '../lib/error-text.ts'
import { powderDesignNote } from '../lib/powder-designer.ts'
import { formatQuantity, msText, withUnit } from '../lib/units.ts'
import { AppModal } from './app-modal.tsx'
import { useLoad } from './workbench-context.ts'
import { notReached } from './workbench-outcome.ts'

type Outcome =
  | { kind: 'found'; body: ChargeTargetResponse }
  | { kind: 'refused'; text: string }
  | { kind: 'failed'; text: string }

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

type LoadRequest = ReturnType<ReturnType<typeof useLoad>['loadRequest']>

/** The load request to post, or the text that says why not: a bad value, an unbuilt load, no bulk density. */
function checkedRequest(
  value: string | number,
  unit: ReturnType<typeof targetUnit>,
  kind: TargetKind,
  loadRequest: () => LoadRequest,
): { req: LoadRequest } | { text: string } {
  const invalid = targetError(value, unit)
  if (invalid) return { text: invalid }
  let req: LoadRequest
  try {
    req = loadRequest()
  } catch (err) {
    return { text: errorText(err) }
  }
  if (kind === 'loadRatio' && req.bulkDensity === undefined)
    return { text: 'The load ratio needs a powder with a bulk density.' }
  return { req }
}

/** The answer for an HTTP response of the solver: found, refused (422) or failed. */
function answerOf(
  res: Response,
  json: unknown,
  kind: TargetKind,
  system: Parameters<typeof refusalText>[2],
  asPercent: boolean,
): Outcome {
  if (res.ok && json) return { kind: 'found', body: json as ChargeTargetResponse }
  if (res.status === 422 && json)
    return {
      kind: 'refused',
      text: refusalText(json as ChargeTargetRefusal, kind, system, asPercent),
    }
  return {
    kind: 'failed',
    text: (json as ChargeTargetRefusal | undefined)?.message ?? `Error ${res.status}.`,
  }
}

/**
 * The charge at which the simulation reaches a target: the target and its value, the answer with
 * the pressure range at that charge, and Apply, which writes the charge into the field. It posts the load of the fields as Run does.
 */
export function ChargeTargetDialog({ opened, onClose }: { opened: boolean; onClose: () => void }) {
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
      if (!controller.signal.aborted) setAnswer({ request, kind: 'failed', text: notReached })
    } finally {
      if (running.current === controller) setPending(false)
    }
  }

  const found = answer?.kind === 'found' ? answer.body : undefined
  return (
    <AppModal opened={opened} onClose={onClose} title="Charge for a target" size="sm">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void find()
        }}
      >
        <Stack gap="xs">
          <Select
            label="Target"
            allowDeselect={false}
            data={targetKinds}
            value={kind}
            onChange={(v) => v && change(v as TargetKind)}
            comboboxProps={{ withinPortal: false }}
          />
          <Group align="flex-end" gap="xs" wrap="nowrap">
            <NumberInput
              flex={1}
              label="Value"
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
                title="Read the value as a percentage of the cartridge's CIP Pmax"
                onClick={() => {
                  setPercent((p) => !p)
                  setValue('')
                  reset()
                }}
              >
                % of Pmax
              </Button>
            )}
          </Group>
          <Button type="submit" loading={pending}>
            Find charge
          </Button>
        </Stack>
      </form>
      <div aria-live="polite" role="status">
        {answer && answer.kind !== 'found' && (
          <Text mt="sm" size="sm" role={answer.kind === 'failed' ? 'alert' : undefined}>
            {answer.text}
          </Text>
        )}
        {found && (
          <Stack mt="sm" gap="xs" data-testid="charge-target-result">
            <Text size="sm">
              The simulation reaches the target at about{' '}
              <strong data-testid="charge-target-charge">
                {formatQuantity('charge', system, found.charge)} {system.charge.symbol}
              </strong>{' '}
              (simulation, not load data).
            </Text>
            <Row
              label="Peak pressure"
              value={withUnit('pressure', system, found.pressureRange.nominalPressure)}
            />
            <Row
              label="Pressure range"
              value={`${formatQuantity('pressure', system, found.pressureRange.lowPressure)} to ${withUnit('pressure', system, found.pressureRange.highPressure)}`}
            />
            <Row
              label="Muzzle velocity"
              value={withUnit('velocity', system, found.result.muzzleVelocity)}
            />
            <Row label="Barrel time" value={msText(found.result.barrelTime)} />
            {!found.burnoutInBarrel && <Row label="Burnout" value="not in the barrel" />}
            {powderDesign && (
              <Text size="xs" className="user-design">
                {powderDesignNote(powderDesign.name)}
              </Text>
            )}
            {found.warnings
              .filter((w) => w.code !== 'noCartridge')
              .map((w) => (
                <Text key={w.message} size="xs">
                  {w.message}
                </Text>
              ))}
            <Group justify="flex-end" gap="xs">
              <Button
                title="Writes the charge into the charge field"
                onClick={() => {
                  applyCharge(found.charge)
                  onClose()
                }}
              >
                Apply
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
