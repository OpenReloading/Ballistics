import { type DensityClass, structureOf } from '@rangefoundry/ballistics'
import type { Bullet } from '@rangefoundry/schema'
import { type Message, msg } from '../i18n/translate.ts'

/** g/cm³: the median of the class's records with a published length, with its 90th percentile length error (`apps/docs/docs/models/case-capacity.md`, "Bullet without a length"). */
export const effectiveDensity: Record<
  DensityClass,
  { value: number; error: number; name: Message }
> = {
  cast: { value: 9.1, error: 0.093, name: msg('cast') },
  monolithic: { value: 6.5, error: 0.184, name: msg('monolithic') },
  jacketed: { value: 7.3, error: 0.214, name: msg('jacketed') },
  unknown: { value: 6.8, error: 0.332, name: msg('construction unknown') },
}

/** The class of the record's `construction.structure` (`bulletStructures` of ballistics); not stated is unknown. */
export const classOf = (construction: Bullet['construction'] | undefined): DensityClass =>
  structureOf(construction?.structure)?.density ?? 'unknown'
