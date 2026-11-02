import { type DensityClass, structureOf } from '@open-reloading/core'
import type { Bullet } from '@open-reloading/schema'
import { type Message, msg } from '../i18n/translate.ts'

/**
 * Effective bullet density by class, g/cm³ (mass over the volume of a cylinder of the diameter and
 * length), with the 90th percentile of the relative length error it gives: the median of the bullet
 * records of the class with a published length (`apps/docs/docs/models/case-capacity.md`, "Bullet
 * without a length"). `unknown` is the pooled value of every class.
 */
export const effectiveDensity: Record<
  DensityClass,
  { value: number; error: number; name: Message }
> = {
  cast: { value: 9.1, error: 0.093, name: msg('cast') },
  monolithic: { value: 6.5, error: 0.184, name: msg('monolithic') },
  jacketed: { value: 7.3, error: 0.214, name: msg('jacketed') },
  unknown: { value: 6.8, error: 0.332, name: msg('construction unknown') },
}

/** The class of the record's `construction.structure` (`bulletStructures` of core); not stated is unknown. */
export const classOf = (construction: Bullet['construction'] | undefined): DensityClass =>
  structureOf(construction?.structure)?.density ?? 'unknown'
