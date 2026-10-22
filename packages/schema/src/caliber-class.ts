import { z } from 'zod'

/** One entry of the caliber class vocabulary. */
export interface CaliberClass {
  /** Id used in the `caliberClasses` of a `Discipline`. */
  id: string
  /** Name as a shooter says it. */
  label: string
  /**
   * Nominal bullet diameter in mm. For cartridges it is the maximum projectile diameter G1 of the
   * cartridge side of the CIP sheet (the heading "Projectile" of the sheet layout); .22 rimfire
   * takes the calibre 5.6 mm of the rule books, since G1 of the .22 Long Rifle sheet equals the case
   * diameter H2 (heeled bullet). Airgun pellets carry the calibre of the rule book.
   */
  diameter: number
  /** Ids of the cartridge records in the class; empty where the class has no CIP cartridge. */
  cartridges: readonly string[]
}

// the literal list: `CaliberClassId` reads its ids
const classes = [
  { id: 'air-4-5', label: '4.5 mm (.177) air', diameter: 4.5, cartridges: [] },
  { id: 'rimfire-17', label: '.17 HMR', diameter: 4.38, cartridges: ['17-hmr'] },
  {
    id: 'rimfire-22',
    label: '.22 rimfire',
    diameter: 5.6,
    cartridges: ['22-long-rifle', '22-long', '22-win-mag-r-f'],
  },
  {
    id: 'rifle-22-cf',
    label: '.22 centre-fire rifle',
    diameter: 5.7,
    cartridges: ['223-rem', '222-rem', '22-250-rem'],
  },
  {
    id: 'rifle-6mm',
    label: '6 mm rifle',
    diameter: 6.17,
    cartridges: ['243-win', '6-mm-creedmoor', '6-mm-ppc', '6-mm-br-rem'],
  },
  {
    id: 'rifle-25',
    label: '.25 rifle (6.4 mm)',
    diameter: 6.54,
    cartridges: ['25-06-rem', '257-roberts', '250-savage'],
  },
  {
    id: 'rifle-6-5',
    label: '6.5 mm rifle',
    diameter: 6.72,
    cartridges: ['6-5-creedmoor', '6-5-x-55-se', '260-rem', '6-5-prc', '6-5-x-57', '6-5-grendel'],
  },
  { id: 'rifle-270', label: '.270 rifle', diameter: 7.06, cartridges: ['270-win'] },
  {
    id: 'rifle-7mm',
    label: '7 mm rifle',
    diameter: 7.23,
    cartridges: ['7-mm-rem-mag', '7-x-57', '7-x-64', '280-rem', '284-win', '7-mm-08-rem'],
  },
  {
    id: 'rifle-30',
    label: '.30 rifle (7.62 mm)',
    diameter: 7.85,
    cartridges: ['308-win', '30-06-spring', '300-win-mag', '30-30-win', '7-62-x-54-r', '7-62-x-39'],
  },
  { id: 'rifle-30-carbine', label: '.30 Carbine', diameter: 7.85, cartridges: ['30-carbine'] },
  {
    id: 'rifle-8mm',
    label: '8 mm rifle',
    diameter: 8.22,
    cartridges: ['8-x-57-is', '8-x-68-s', '8-mm-rem-mag'],
  },
  {
    id: 'rifle-338',
    label: '.338 rifle (8.6 mm)',
    diameter: 8.61,
    cartridges: ['338-lapua-mag', '338-win-mag', '338-federal'],
  },
  {
    id: 'pistol-7-65',
    label: '7.65 mm (.32) pistol',
    diameter: 7.85,
    cartridges: ['7-65-mm-browning', '7-65-parabellum'],
  },
  { id: 'revolver-32', label: '.32 revolver', diameter: 8, cartridges: ['32-s-w-long'] },
  {
    id: 'pistol-9mm',
    label: '9 mm pistol',
    diameter: 9.04,
    cartridges: ['9-mm-luger', '38-super-auto', '357-sig', '9-x-21', '9-mm-browning-court'],
  },
  {
    id: 'revolver-357-38',
    label: '.357 and .38 revolver',
    diameter: 9.12,
    cartridges: ['357-magnum', '38-special'],
  },
  { id: 'pistol-9x18', label: '9 x 18 pistol', diameter: 9.27, cartridges: ['9-mm-makarov'] },
  {
    id: 'pistol-40-10mm',
    label: '.40 and 10 mm pistol',
    diameter: 10.17,
    cartridges: ['40-s-w', '10-mm-auto'],
  },
  { id: 'revolver-41', label: '.41 revolver', diameter: 10.41, cartridges: ['41-rem-mag'] },
  {
    id: 'revolver-44',
    label: '.44 revolver',
    diameter: 10.98,
    cartridges: ['44-rem-mag', '44-s-w-special'],
  },
  { id: 'pistol-45', label: '.45 ACP pistol', diameter: 11.48, cartridges: ['45-auto'] },
  { id: 'revolver-45-colt', label: '.45 Colt revolver', diameter: 11.58, cartridges: ['45-colt'] },
] as const satisfies readonly CaliberClass[]

/**
 * The caliber classes: groups of cartridges whose bullets have the same diameter, so a hole size
 * separates .22, 9 mm and .45 and cannot separate classes of one diameter (9 mm Luger and
 * .357 Magnum). Cartridge membership is checked against the CIP records by a test in
 * `packages/data`. A caliber range of a rule book names more than one class per discipline
 * (`Discipline.caliberClasses` with basis `derived`).
 */
export const caliberClasses: readonly CaliberClass[] = classes

/** Id of a class of {@link caliberClasses}. */
export type CaliberClassId = (typeof classes)[number]['id']

/** The ids of {@link caliberClasses} as a schema. */
export const caliberClassId = z.enum(
  classes.map((c) => c.id) as [CaliberClassId, ...CaliberClassId[]],
)
