import type { Bullet } from '@open-reloading/schema'
import { useMemo } from 'react'
import {
  type BulletValues,
  effectiveBulletValues,
  recordBulletValues,
  typedBaseType,
  typedBullet,
} from '../lib/bullet.ts'
import type { Fields } from '../lib/field-spec.ts'

/**
 * The bullet the Bullet card holds: the catalogue record, else the design of this browser
 * (`record`), the values a run reads (`values`: the record's, the mass field's, the typed ones), the
 * record with them and the typed base form (`baseType`) in place (`now`) and the values a reference gives again on opening (`given`: those
 * of the catalogue record, or of a design the load can name). `values` stays one object while its
 * numbers do.
 */
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
