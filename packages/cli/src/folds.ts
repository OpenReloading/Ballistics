import { createHash } from 'node:crypto'
import { compareKeys } from '@rangefoundry/schema'
import type { Split } from './split.ts'

/** Folds of the grouped cross-validation of `--folds`. */
export const foldCount = 5

/** The splits whose cartridges are dealt to the folds; the test split is never read. */
export const foldSplits: readonly Split[] = ['training', 'validation']

/** How a result names {@link foldSplits}. */
export const foldPool = 'training+validation' as const

/** Hashed before the cartridge id in the order that deals the cartridges to the folds, so that it names the rule a result was folded by. */
export const foldSalt = '2026-11-14'

/** The fold of each distinct id of `cartridgeIds`: the ids sorted by the hex SHA-256 of {@link foldSalt}, a slash and the id (UTF-8), each dealt to fold position mod {@link foldCount}. */
export function foldsOf(cartridgeIds: Iterable<string>): Map<string, number> {
  const digest = (id: string) =>
    createHash('sha256').update(`${foldSalt}/${id}`, 'utf8').digest('hex')
  const order = [...new Set(cartridgeIds)]
    .map((id) => ({ id, key: digest(id) }))
    .toSorted((a, b) => compareKeys(a.key, b.key))
  return new Map(order.map(({ id }, position) => [id, position % foldCount]))
}
