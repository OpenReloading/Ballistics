import type { Bullet } from '@open-reloading/schema'
import { type Message, msg } from '../i18n/translate.ts'

/** The classes of an effective bullet density, by the construction fields of the record. */
export type DensityClass = 'cast' | 'monolithic' | 'jacketed' | 'unknown'

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

const classes: Record<string, DensityClass> = {
  cast: 'cast',
  monolithic: 'monolithic',
  'cup-and-core': 'jacketed',
  bonded: 'jacketed',
  partitioned: 'jacketed',
}

/** The class of the record's `construction.structure`; swaged, plated, frangible and not stated are unknown. */
export const classOf = (construction: Bullet['construction'] | undefined): DensityClass =>
  construction?.structure !== undefined && Object.hasOwn(classes, construction.structure)
    ? (classes[construction.structure] as DensityClass)
    : 'unknown'
