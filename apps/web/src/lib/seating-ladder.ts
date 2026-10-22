/** The direction of a ladder: up or down from the start, or around it. */
export type LadderDirection = 'up' | 'down' | 'around'

/** What a ladder varies: the charge, the seating depth or the powder temperature. */
type LadderKind = 'charge' | 'seating' | 'temperature'

export const ladderKinds: readonly { value: LadderKind; label: string }[] = [
  { value: 'charge', label: 'Charge' },
  { value: 'seating', label: 'Seating' },
  { value: 'temperature', label: 'Temperature' },
]

/** The kinds a ladder can run; the temperature kind is listed but unavailable. */
export type RunnableLadderKind = Exclude<LadderKind, 'temperature'>

/** A link's or file's ladder kind; anything else is the charge. */
export const runKindOf = (v: string | null | undefined): RunnableLadderKind =>
  v === 'seating' ? v : 'charge'

/** Reason the temperature ladder is unavailable. Always set: no powder record has a temperature coefficient. */
export function temperatureLadderBlockReason(powderLabel: string | undefined) {
  return powderLabel
    ? `${powderLabel} has no temperature coefficient, so the model cannot vary its burn rate with temperature.`
    : 'No powder is chosen. The model varies the burn rate with temperature only through a temperature coefficient of the powder record, and no record has one yet.'
}

/** The length a bullet is seated by: the `seating.by` values of a saved workbench state. */
export type SeatingLengthKind = 'overallLength' | 'baseToOgive'
/** The short name of each seating length, as the page and the print show it. */
export const seatingLengthName: Record<SeatingLengthKind, string> = {
  overallLength: 'COAL',
  baseToOgive: 'CBTO',
}

/**
 * The seated bullet at another COAL or CBTO, from the seating preview (`seat` of
 * `@openreloading/drawing/seating`): the length it seats by, its slider range and the values
 * behind the bullet at a length.
 */
export type SeatingLengths = {
  lengthKind: SeatingLengthKind
  /** Slider range of the length it seats by, m. */
  range: readonly [number, number]
  /** Case volume behind the bullet (m³) and bullet travel (m) at `value` (m); absent without the record values. */
  at: (value: number) => { volume?: number; travel?: number }
}

/** One step of a seating ladder: the length the bullet is seated by (m) and what follows from it. */
export type SeatingStep = { value: number; volume: number; travel: number }

/**
 * The lengths of a seating ladder, m: `start + i * step` up or down, or an odd count centred on
 * `start`, lowest first (the rule of the charge ladder, `chargeLadder` of core). Up is a longer COAL
 * or CBTO: a shallower seating and more volume behind the bullet.
 */
function ladderLengths(start: number, step: number, steps: number, direction: LadderDirection) {
  return Array.from({ length: steps }, (_, i) =>
    direction === 'around'
      ? start + (i - (steps - 1) / 2) * step
      : start + (direction === 'up' ? 1 : -1) * i * step,
  )
}

/**
 * The steps of a seating ladder from `start`, or the reason it cannot run. `show` writes a length
 * in the page's unit with its symbol, so the messages name the unit the fields show.
 */
export function seatingLadder(
  seat: SeatingLengths,
  start: number | undefined,
  step: number,
  steps: number,
  direction: LadderDirection,
  show: (m: number) => string,
): { steps: SeatingStep[] } | { error: string } {
  const name = seatingLengthName[seat.lengthKind]
  if (start === undefined) return { error: `${name} is empty: the seating ladder starts from it.` }
  const lengths = ladderLengths(start, step, steps, direction)
  const [lo, hi] = [Math.min(...lengths), Math.max(...lengths)]
  const [from, to] = seat.range
  // a millionth of a millimetre: a step that lands on the range's end is inside it
  if (lo < from - 1e-9 || hi > to + 1e-9)
    return {
      error: `${name} ${show(lo)} to ${show(hi)} is outside the seating range ${show(from)} to ${show(to)} of this cartridge and bullet.`,
    }
  const out: SeatingStep[] = []
  for (const value of lengths) {
    const { volume, travel } = seat.at(value)
    if (volume === undefined || travel === undefined)
      return { error: 'The seating ladder needs a case capacity and a barrel length.' }
    if (volume <= 0)
      return { error: `The case volume behind the bullet is 0 or less at ${name} ${show(value)}.` }
    out.push({ value, volume, travel })
  }
  return { steps: out }
}
