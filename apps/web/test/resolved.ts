import {
  applyOverrides,
  type Bullet,
  type UserBullet,
  type UserCartridge,
} from '@openreloading/schema'
import type { CartridgeDetail } from '../src/lib/api-types.ts'
import type { ResolvedBullet, ResolvedCartridge } from '../src/lib/variants.ts'

/** What `resolveCartridge` gives for `data` with `base` as its base record, or with none. */
export const resolvedCartridge = (
  data: UserCartridge,
  base?: CartridgeDetail,
): ResolvedCartridge => ({
  base: base ? { status: 'found', record: base } : { status: 'none' },
  record: applyOverrides<ResolvedCartridge['record']>(
    base ? { table: base.table, values: base.values } : { values: [] },
    data.overrides,
  ),
})

/** What `resolveBullet` gives for `data` with `base` as its base record, or with none. */
export const resolvedBullet = (data: UserBullet, base?: Bullet): ResolvedBullet => ({
  base: base ? { status: 'found', record: base } : { status: 'none' },
  record: applyOverrides<Partial<Bullet>>(base ?? {}, data.overrides),
})
