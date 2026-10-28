import { createHash } from 'node:crypto'

/** The three held-out groups of cartridges. */
export const splits = ['test', 'validation', 'training'] as const

/** One of {@link splits}. */
export type Split = (typeof splits)[number]

/**
 * The split of a cartridge by the first byte of the SHA-256 of its lower-case id (UTF-8): 0 to 50
 * test, 51 to 101 validation, 102 to 255 training (about 20 %, 20 % and 60 %). A row has the split of
 * its cartridge, so no cartridge is in two splits.
 */
export function splitOf(cartridgeId: string): Split {
  const first = createHash('sha256').update(cartridgeId.toLowerCase(), 'utf8').digest()[0] ?? 0
  if (first <= 50) return 'test'
  return first <= 101 ? 'validation' : 'training'
}
