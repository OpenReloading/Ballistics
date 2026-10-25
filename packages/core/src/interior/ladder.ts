import { need, nth } from '../errors.ts'

/**
 * Charges of a charge ladder in kg: the i-th (from 0) is `start + i * step` up or `start - i * step`
 * down, multiplied rather than summed so the last step carries no accumulated rounding. `around`
 * takes an odd count centred on `start`, lowest first: `start + (i - (steps - 1) / 2) * step`.
 */
export function chargeLadder(
  start: number,
  step: number,
  steps: number,
  direction: 'up' | 'down' | 'around',
): number[] {
  need(Number.isFinite(start) && start > 0, 'ladder start charge must be above 0')
  need(Number.isFinite(step) && step > 0, 'ladder step must be above 0')
  need(Number.isInteger(steps) && steps >= 1, 'ladder steps must be an integer of at least 1')
  need(direction !== 'around' || steps % 2 === 1, 'a ladder around the charge needs an odd count')
  const charges = Array.from({ length: steps }, (_, i) =>
    direction === 'around'
      ? start + (i - (steps - 1) / 2) * step
      : start + (direction === 'up' ? 1 : -1) * i * step,
  )
  const lowest = Math.min(nth(charges, 0), nth(charges, steps - 1))
  need(lowest > 0, `ladder charge ${lowest} kg must be above 0`)
  return charges
}
