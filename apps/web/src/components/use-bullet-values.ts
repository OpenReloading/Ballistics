import type { Bullet } from '@rangefoundry/schema'
import { useMemo } from 'react'
import {
  type BulletValues,
  effectiveBulletValues,
  recordBulletValues,
  typedBaseType,
  typedBullet,
} from '../lib/bullet.ts'
import type { Fields } from '../lib/field-spec.ts'

/** `values` (the record's, the mass field's, the typed ones) is what a run reads and stays one object while its numbers do; `now` has them and `baseType` in place, `given` is what a reference gives again on opening. */
export function useBulletValues(
  bullet: Bullet | undefined,
  design: { record?: Partial<Bullet> | undefined } | undefined,
  designReferenced: boolean | undefined,
  mass: number | undefined,
  typed: Fields,
) {
  const record: Partial<Bullet> | undefined = bullet ?? design?.record
  const key = JSON.stringify(effectiveBulletValues(record, mass, typed))
  const values = useMemo(() => JSON.parse(key) as BulletValues, [key])
  const baseType = typedBaseType(typed)
  const baseChanged = baseType !== undefined && baseType !== record?.base?.type
  const now = record && typedBullet(record, values, baseType)
  return {
    record,
    values,
    baseType,
    /** Whether the typed base form differs from the record's. */
    baseChanged,
    /** The typed form a load saves: one that differs from the record's. */
    savedBaseType: baseChanged ? baseType : undefined,
    now,
    given: bullet || designReferenced ? recordBulletValues(record) : {},
  }
}
