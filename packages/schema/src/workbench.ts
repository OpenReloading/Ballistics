import { z } from 'zod'
import { chronoShot } from './chrono-session.ts'
import { recordId } from './ids.ts'
import { siValues, text } from './shared.ts'

/**
 * One chronograph file of a load: what the Measurements tab shows of it.
 * Inferred type: {@link MeasuredSeries}.
 */
export const measuredSeries = z.object({
  name: text(200).describe('Name of the imported chronograph file, shown on the Measurements tab.'),
  date: text(64).describe('Date of the session as the file gives it.').optional(),
  device: text(400).describe('Manufacturer and model of the device.').optional(),
  muzzleDistance: z
    .number()
    .nonnegative()
    .meta({ unit: 'm', description: 'Muzzle to the measuring point, m.' })
    .optional(),
  strings: z
    .array(
      z.object({
        label: text(200).describe('Name of the string in the file.').optional(),
        charge: z
          .number()
          .positive()
          .meta({
            unit: 'kg',
            description: 'The charge the string is mapped to, kg. Absent: not used.',
          })
          .optional(),
        shots: z.array(chronoShot).max(5000).describe('Shots of the string in file order.'),
      }),
    )
    .max(500)
    .describe('Shot strings of the file.'),
})

const ladderKind = z
  .enum(['charge', 'seating', 'temperature'])
  .describe(
    'What the ladder varies: the charge, the length the bullet is seated by (`seating.by`) or the propellant temperature. Absent: the charge.',
  )
  .optional()
const ladderStep = z
  .number()
  .positive()
  .describe(
    'Step between ladder steps: kg for a charge ladder, m for a seating ladder, K for a temperature ladder. Absent until entered.',
  )
  .optional()

/**
 * A saved workbench state: SI values per interior field key, record ids, notes, measured water
 * capacity (m3), seating, charge ladder (charge step in kg) and measured series.
 * Inferred type: {@link WorkbenchState}.
 */
export const workbenchState = z.object({
  siValues: siValues.describe(
    'Workbench field values in SI units by field key. m³: volume. m: boreDiameter, travel, twist (length per turn), engravingLength. m²: boreArea, leakArea. kg: bulletMass, charge, firearmMass. J/kg: propellantEnergy. kg/m³: density. m³/kg: covolume. 1/s: vivacity. Pa: referencePressure, ignitionPressure, startPressure, boreFriction, engravingPressure. K: propellantTemperature. 1: gamma, exponent, sebert, formA, formM, formQ, formZ1.',
  ),
  cartridge: recordId.describe('Id of the cartridge record.').optional(),
  bullet: recordId.describe('Id of the bullet record.').optional(),
  powder: recordId.describe('Id of the powder record.').optional(),
  notes: text(10000).describe('Notes of the load, plain text.').optional(),
  measuredWaterCapacity: z
    .number()
    .positive()
    .meta({
      unit: 'm3',
      description: 'The measured case capacity (water to the mouth) of the cartridge, m³.',
    })
    .optional(),
  firearm: z
    .string()
    .min(1)
    .max(64)
    .describe('Id of the firearm record of the browser library (a `firearm` user record).')
    .optional(),
  seating: z
    .object({
      by: z
        .enum(['overallLength', 'baseToOgive'])
        .describe('The length the bullet is seated by: cartridge overall length or base to ogive.'),
      value: z.number().positive().meta({ unit: 'm', description: 'That length, m.' }),
    })
    .describe('The length the bullet is seated by. The other one is derived.')
    .optional(),
  ladder: z
    .union([
      z.object({
        kind: ladderKind,
        stepCount: z.int().min(2).max(21).describe('Number of ladder steps.'),
        chargeStep: ladderStep,
        direction: z
          .enum(['up', 'down'])
          .describe('Steps from the charge (or seating length) up or down.'),
      }),
      z.object({
        kind: ladderKind,
        stepCount: z
          .literal([3, 5, 7, 9, 11, 13, 15, 17, 19, 21])
          .describe('Number of ladder steps, odd so the steps centre on the charge.'),
        chargeStep: ladderStep,
        direction: z.literal('around').describe('Steps centred on the charge (or seating length).'),
      }),
    ])
    .describe('The ladder of the load: step count, step size and direction.')
    .optional(),
  measurements: z
    .array(measuredSeries)
    .max(50)
    .describe(
      'Chronograph files read on the Measurements tab, one series each, strings mapped to charges.',
    )
    .optional(),
})

/** A saved workbench state: SI inputs, record ids, ladder and measured series. */
export interface WorkbenchState extends z.infer<typeof workbenchState> {}
/** One imported chronograph file with its shot strings mapped to charges. */
export interface MeasuredSeries extends z.infer<typeof measuredSeries> {}
