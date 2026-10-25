const NICE_STEPS = [1, 2, 5, 10]

/**
 * Axis ticks after Heckbert 1990: the span and then the step are rounded to 1, 2, 5 or 10 times a
 * power of ten.
 */
function nice(x: number, round: boolean): number {
  const e = Math.floor(Math.log10(x))
  const f = x / 10 ** e
  const limits = round ? [1.5, 3, 7] : [1, 2, 5]
  const i = limits.findIndex((l) => (round ? f < l : f <= l))
  return NICE_STEPS[i < 0 ? 3 : i] * 10 ** e
}

/** About `count` ticks covering min to max; equal ends widen by 1 each way; non-finite input gives none. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  let lo = Math.min(min, max)
  let hi = Math.max(min, max)
  if (lo === hi) {
    lo -= 1
    hi += 1
  }
  const step = nice(nice(hi - lo, false) / (count - 1), true)
  const first = Math.floor(lo / step)
  const last = Math.ceil(hi / step)
  const ticks: number[] = []
  // integer multiples of the step, so 0.1 + 0.2 style sums do not accumulate
  for (let k = first; k <= last; k++) ticks.push(Number((k * step).toPrecision(12)))
  return ticks
}

/** Decimals that tell the ticks apart: those of their step. */
export function tickDecimals(ticks: number[]): number {
  return ticks.length < 2 ? 0 : Math.max(0, -Math.floor(Math.log10(ticks[1] - ticks[0])))
}
