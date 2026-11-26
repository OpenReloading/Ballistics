/** A name-only bullet or a powder without burn values cannot run. */

import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/lib/complete-records.json' with { type: 'json' }

loadEnglish(englishMessages)

/** A bullet record or list item that only names the bullet. */
export const bulletIncomplete = (b: { nameOnly?: true | undefined }) => b.nameOnly === true

/** A powder list item without the burn values of an interior model. */
export const powderIncomplete = (p: { interior?: unknown }) => p.interior === undefined

/** A powder whose maker states shotgun use only: the metallic cartridges the app computes leave it out. */
export const shotgunOnly = (p: { scope?: readonly string[] | undefined }) =>
  p.scope !== undefined && p.scope.length > 0 && p.scope.every((s) => s === 'shotgun')

/** Why a shotgun-only powder is greyed out in the pickers and not computed. */
export const notMetallic = /*i18n*/ {
  id: 'burnRate.notMetallic',
  message: 'Not a metallic-cartridge powder',
}

/** A powder row of a list or chooser without the burn values of an interior model, a design's included. */
export const powderRowIncomplete = (r: { modelled?: true | undefined }) => r.modelled !== true

/** Complete ones first in their order; without the others when `completeOnly`. */
export function completeFirst<T>(
  items: readonly T[],
  incomplete: (item: T) => boolean,
  completeOnly: boolean,
): T[] {
  const complete = items.filter((i) => !incomplete(i))
  return completeOnly ? complete : [...complete, ...items.filter(incomplete)]
}
