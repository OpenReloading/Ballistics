/** A short name for a summary line, the message of a rule whose message states no values, and what changes the situation; a message states facts about the inputs and the model only, never a statement about the load. */
import {
  type AdvisoryId,
  chargeTooSmallRatio,
  type ResistanceGap,
} from '@open-reloading/ballistics'

/** The English words of one rule. */
export interface AdvisoryText {
  /** Short name for a summary line. */
  name: string
  /** What holds, as a fact about the inputs or the model. A message built from values states those values too. */
  message: string
  /** What changes the situation. */
  fix: string
}

/** The words of each rule of the registry. */
export const advisoryText: Readonly<Record<AdvisoryId, AdvisoryText>> = {
  limitExceeded: {
    name: 'limit exceeded',
    message: 'The simulated peak pressure is above a CIP maximum pressure of the cartridge.',
    fix: 'Change the inputs that set the simulated pressure, or compare with another cartridge record.',
  },
  noCartridge: {
    name: 'no cartridge',
    message: 'No cartridge id was given, so no CIP Pmax was checked.',
    fix: 'Give a cartridge id.',
  },
  noComparableLimit: {
    name: 'no comparable limit',
    message: 'The cartridge has no CIP Pmax measured by transducer or piezo.',
    fix: 'Use a cartridge record with such a value.',
  },
  rangeIncomplete: {
    name: 'range incomplete',
    message: 'Some cases of the pressure range could not be computed.',
    fix: 'Narrow the tolerances or change the inputs named by the failed cases.',
  },
  chargeTooSmall: {
    name: 'charge too small for the model',
    message: `The simulated peak mean pressure is below ${chargeTooSmallRatio} times the hold pressure; the results are outside the range the model was built for.`,
    fix: 'Change the charge, the start pressure or the ignition pressure.',
  },
  resistanceNotApplied: {
    name: 'resistance not applied',
    message:
      'The powder parameters were fitted with a bore-resistance law this run cannot apply; the results are biased.',
    fix: 'Give the values the law needs.',
  },
  loadRatioHigh: {
    name: 'solid fill high',
    message:
      'The solid fill is above the limit of the model; the model is outside the range it was built for.',
    fix: 'Change the charge or the chamber volume.',
  },
  startPressureBelowResistance: {
    name: 'start pressure has no effect',
    message:
      'The start pressure is at or below the bore resistance at travel 0, so the shot starts when the pressure force exceeds that resistance and the start pressure has no effect.',
    fix: 'Set a start pressure above the bore resistance at travel 0, or remove the start pressure.',
  },
  gyrationRadiusWithoutTwist: {
    name: 'gyration radius ignored',
    message:
      'The twist is 0, so the bullet has no rotational energy and the radius of gyration is ignored.',
    fix: 'Give a twist above 0, or remove the radius of gyration.',
  },
  startPressureHeldOnce: {
    name: 'start pressure held once',
    message:
      'The start pressure is above the bore resistance at travel 0 and above the ignition pressure, and the engraving pressure at travel 0 is not 0, so the projectile is held until the start pressure and then starts against the lower bore resistance at travel 0, after which the engraving profile applies.',
    fix: 'Set the start pressure to the bore resistance at travel 0 or below, or the engraving pressure at travel 0 to 0.',
  },
}

/** What a run lacks for a powder record's bore resistance, as the resistance warning names it. */
export const resistanceGapText: Readonly<Record<ResistanceGap, string>> = {
  cartridgeRecord: 'a cartridge record',
  bulletLength: 'a bullet length',
}
