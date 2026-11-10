import { nth } from '@open-reloading/statistics'
import { need } from '../issue.ts'

/** Charges in kg: `start + i * step` up or `start - i * step` down, multiplied so the last step carries no accumulated rounding; `around` takes an odd count centered on `start`, lowest first. */
export function chargeLadder(
  start: number,
  step: number,
  steps: number,
  direction: 'up' | 'down' | 'around',
): number[] {
  need(Number.isFinite(start) && start > 0, { code: 'ladderStartNotPositive', params: {} })
  need(Number.isFinite(step) && step > 0, { code: 'ladderStepNotPositive', params: {} })
  need(Number.isInteger(steps) && steps >= 1, { code: 'ladderStepCountInvalid', params: {} })
  need(direction !== 'around' || steps % 2 === 1, { code: 'ladderAroundNeedsOddCount', params: {} })
  const charges = Array.from({ length: steps }, (_, i) =>
    direction === 'around'
      ? start + (i - (steps - 1) / 2) * step
      : start + (direction === 'up' ? 1 : -1) * i * step,
  )
  const lowest = Math.min(nth(charges, 0), nth(charges, steps - 1))
  need(lowest > 0, { code: 'ladderLowestChargeNotPositive', params: { charge: lowest } })
  return charges
}
