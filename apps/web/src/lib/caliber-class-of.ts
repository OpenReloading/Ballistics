/**
 * The caliber class of a firearm's cartridge: the one class record whose `cartridges` names it
 * (each cartridge is in at most one class), for the link to the disciplines that name the class.
 */
import type { CaliberClass } from '@open-reloading/schema'
import { apiFetch, fetchRecord } from './api-fetch.ts'

/** A caliber class: its id, name and member cartridge record ids. */
export type ClassMembers = Pick<CaliberClass, 'id' | 'name' | 'cartridges'>

/** The class whose members name the catalogue cartridge `cartridgeId`; none without one. */
export const classOfCartridge = (
  classes: readonly ClassMembers[],
  cartridgeId: string | undefined,
) => (cartridgeId ? classes.find((c) => c.cartridges.includes(cartridgeId)) : undefined)

/** The discipline list with its caliber class filter set to `classId`, no other filter. */
export const classDisciplinesHref = (classId: string) =>
  `/disciplines?class=${encodeURIComponent(classId)}`

/** Every caliber class with its members: the list names the ids, the records hold the members. */
export async function fetchClassMembers(): Promise<ClassMembers[]> {
  const res = await apiFetch('caliber-classes')
  if (!res.ok) throw new Error(`Error ${res.status}.`)
  const { items } = (await res.json()) as { items: { id: string }[] }
  const classes = await Promise.all(
    items.map(({ id }) => fetchRecord<CaliberClass>('caliber-classes', id)),
  )
  return classes.flatMap((c) => (c ? [{ id: c.id, name: c.name, cartridges: c.cartridges }] : []))
}
