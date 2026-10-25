import type { Bundle } from './records.ts'
import { resolveId } from './renames.ts'

/** Largest gap in mm between a class's nominal diameter and G1 of a member cartridge. */
const diameterTolerance = 0.15

/** Maximum projectile diameter G1 of the cartridge side of a sheet, mm. */
const projectileDiameter = (values: Bundle['cartridges'][number]['values']) => {
  const value = values.find((v) => v.symbol === 'G1' && v.side === 'cartridge')?.value
  return typeof value === 'number' ? value : undefined
}

type CaliberBundle = Pick<Bundle, 'caliberClasses' | 'cartridges' | 'disciplines' | 'renames'>

/** Checks one member of a class: its record, its single class and G1 against the class diameter. */
function checkMember(
  bundle: CaliberBundle,
  c: CaliberBundle['caliberClasses'][number],
  id: string,
  cartridges: Map<string, Bundle['cartridges'][number]>,
  owner: Map<string, string>,
  errors: string[],
) {
  const where = `caliber-classes/${c.id}.json`
  const cartridge = cartridges.get(resolveId(bundle.renames, 'cartridges', id))
  if (!cartridge) {
    errors.push(`${where}: unknown cartridge "${id}"`)
    return
  }
  const other = owner.get(cartridge.id)
  if (other) errors.push(`${where}: cartridge "${id}" is also in ${other}`)
  else owner.set(cartridge.id, c.id)
  const g1 = projectileDiameter(cartridge.values)
  if (g1 === undefined) errors.push(`${where}: cartridge "${id}" has no G1`)
  else if (Math.abs(g1 - c.diameter.value) > diameterTolerance)
    errors.push(
      `${where}: diameter ${c.diameter.value} mm is more than ${diameterTolerance} mm from G1 ${g1} mm of "${id}"`,
    )
}

/**
 * The caliber classes against the C.I.P. records and the disciplines: every member is a cartridge
 * record, in one class only, with G1 of its sheet within 0.15 mm of the class's nominal diameter;
 * every class a discipline names is a record.
 */
export function checkCaliberClasses(bundle: CaliberBundle): string[] {
  const errors: string[] = []
  const cartridges = new Map(bundle.cartridges.map((c) => [c.id, c]))
  const owner = new Map<string, string>()
  for (const c of bundle.caliberClasses)
    for (const id of c.cartridges) checkMember(bundle, c, id, cartridges, owner, errors)
  const classes = new Set(bundle.caliberClasses.map((c) => c.id))
  for (const d of bundle.disciplines)
    for (const id of d.caliberClasses?.ids ?? [])
      if (!classes.has(resolveId(bundle.renames, 'caliber-classes', id)))
        errors.push(`disciplines/${d.id}.json: unknown caliber class "${id}"`)
  return errors
}
