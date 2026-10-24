'use client'

import { Button, Group, NativeSelect } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { type StartIntent, setStartIntent } from '../lib/start-intent.ts'
import {
  formatQuantity,
  type PresetId,
  presetNames,
  presetUnits,
  type Quantity,
} from '../lib/units.ts'
import { AppModal } from './app-modal.tsx'
import { isSafetyAccepted, safetyAcceptedEvent } from './safety-dialog.tsx'
import { useUnits } from './units-settings.tsx'

/** Browser storage key of the finished first-run step. */
const doneKey = 'first-run-done'
const openEvent = 'first-run-open'

/** Opens the first-run step again, from the Settings. */
export const openFirstRun = () => window.dispatchEvent(new Event(openEvent))

/** Three values shown in the chosen preset, SI. */
const preview: [string, Quantity, number][] = [
  ['Muzzle velocity', 'velocity', 800],
  ['Powder charge', 'charge', 0.003],
  ['Peak pressure', 'pressure', 3.6e8],
]

const doneBefore = () => {
  try {
    return localStorage.getItem(doneKey) === '1'
  } catch {
    return false
  }
}

/**
 * The first-run step after the Safety notice is accepted: the unit preset, with three values in it,
 * and a start from the example load or from an empty workbench. It applies the preset at once and
 * is not shown again once finished; with storage blocked it shows on each visit.
 */
export function FirstRunDialog() {
  const [opened, setOpened] = useState(false)
  const { choice, choose } = useUnits()
  const router = useRouter()
  useEffect(() => {
    if (isSafetyAccepted() && !doneBefore()) setOpened(true)
    const afterNotice = () => {
      if (!doneBefore()) setOpened(true)
    }
    const open = () => setOpened(true)
    window.addEventListener(safetyAcceptedEvent, afterNotice)
    window.addEventListener(openEvent, open)
    return () => {
      window.removeEventListener(safetyAcceptedEvent, afterNotice)
      window.removeEventListener(openEvent, open)
    }
  }, [])
  const finish = (intent?: StartIntent) => {
    try {
      localStorage.setItem(doneKey, '1')
    } catch {}
    setOpened(false)
    if (!intent) return
    setStartIntent(intent)
    router.push('/workbench')
  }
  const system = presetUnits(choice.preset)
  return (
    <AppModal
      opened={opened}
      onClose={() => finish()}
      size="md"
      centered
      className="first-run-dialog"
      title="Start here"
      closeButton={{ 'aria-label': 'Close the first-run step' }}
      bodyProps={{ 'data-autofocus': true }}
      footer={
        <Group justify="flex-end" p="md">
          <Button variant="default" onClick={() => finish('empty')}>
            Start empty
          </Button>
          <Button onClick={() => finish('example')}>Start from the example</Button>
        </Group>
      }
    >
      <NativeSelect
        label="Unit preset"
        description="The units values are shown in. Settings, Units changes them later."
        value={choice.preset}
        data={(Object.keys(presetNames) as PresetId[])
          .sort((a, b) => presetNames[a].localeCompare(presetNames[b]))
          .map((p) => ({ value: p, label: presetNames[p] }))}
        onChange={(e) => choose({ preset: e.currentTarget.value as PresetId, overrides: {} })}
      />
      <dl className="first-run-preview" aria-label="The same values in this preset">
        {preview.map(([label, q, si]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {formatQuantity(q, system, si)} {system[q].symbol}
            </dd>
          </div>
        ))}
      </dl>
    </AppModal>
  )
}
