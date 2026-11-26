import type { I18n } from '@lingui/core'
import { type Catalogue, type Message, type Translator, translator } from '../i18n/translate.ts'
import { setCoreMessages } from './core-messages.ts'
import { refusalWords } from './refusal-words.ts'

// Package and API message templates (apps/docs/docs/translating.md); only a non-English language loads them

/** A message of the table: its Lingui id and its English text, with `{name}` where a value stands. */
type Described = { readonly id: string; readonly message: string }

/** The `code` of a warning of an interior answer (`Warning['code']` of the API). */
export type WarningCode =
  | 'limitExceeded'
  | 'noCartridge'
  | 'noComparableLimit'
  | 'rangeIncomplete'
  | 'chargeTooSmall'
  | 'resistanceNotApplied'
  | 'loadRatioHigh'
  | 'startPressureBelowResistance'
  | 'gyrationRadiusWithoutTwist'
  | 'startPressureHeldOnce'

/** The English sentences the API writes for each warning code. */
export const warningMessages = {
  limitExceeded: [
    /*i18n*/ {
      id: 'coreMessage.warning.limitExceeded',
      message:
        'Simulated peak pressure {nominal} (range {low} to {high}) is above {name} {limit} ({spec}; {method}).',
    },
    /*i18n*/ {
      id: 'coreMessage.warning.limitExceededUpper',
      message:
        'The upper end of the simulated peak pressure range, {high}, is above {name} {limit} ({spec}; {method}); the nominal value is {nominal}.',
    },
    /*i18n*/ {
      id: 'coreMessage.warning.typedLimitExceeded',
      message:
        'Simulated peak pressure {nominal} (range {low} to {high}) is above the typed {name} {limit}.',
    },
    /*i18n*/ {
      id: 'coreMessage.warning.typedLimitExceededUpper',
      message:
        'The upper end of the simulated peak pressure range, {high}, is above the typed {name} {limit}; the nominal value is {nominal}.',
    },
  ],
  noCartridge: [
    /*i18n*/ {
      id: 'coreMessage.warning.noCartridge',
      message: 'No cartridge id was given, so no CIP Pmax was checked.',
    },
  ],
  noComparableLimit: [
    /*i18n*/ {
      id: 'coreMessage.warning.noComparableLimit',
      message:
        '{name} has no CIP Pmax measured by transducer or piezo. Crusher values are not compared with a simulated pressure.',
    },
  ],
  rangeIncomplete: [
    /*i18n*/ {
      id: 'coreMessage.warning.rangeIncomplete',
      message:
        '{n} of {m} range cases could not be computed ({list}); the range covers only the computed cases, and the true range can be wider.',
    },
  ],
  chargeTooSmall: [
    /*i18n*/ {
      id: 'coreMessage.warning.chargeTooSmall',
      message:
        'Charge too small for the model: the simulated peak mean pressure, {p}, is below {ratio} times the start pressure ({hold}); results are outside the range the model was built for.',
    },
    /*i18n*/ {
      id: 'coreMessage.warning.chargeTooSmallIgnition',
      message:
        'Charge too small for the model: the simulated peak mean pressure, {p}, is below {ratio} times the ignition pressure ({hold}); results are outside the range the model was built for.',
    },
  ],
  resistanceNotApplied: [
    /*i18n*/ {
      id: 'coreMessage.warning.resistanceNotApplied',
      message:
        'Simulation: the parameters of {label} were fitted with a bore-resistance law this run cannot apply (missing: {list}); the results are biased.',
    },
  ],
  loadRatioHigh: [
    /*i18n*/ {
      id: 'coreMessage.warning.solidFillHigh',
      message:
        'Simulation: solid fill {fill} is above {limit}; the model is outside the range it was built for.',
    },
    /*i18n*/ {
      id: 'coreMessage.warning.loadRatioHigh',
      message:
        'Simulation: load ratio {ratio} is above {max}, solid fill {limit} for this powder; the model is outside the range it was built for.',
    },
  ],
  startPressureBelowResistance: [
    /*i18n*/ {
      id: 'coreMessage.warning.startPressureBelowResistance',
      message:
        'The start pressure is at or below the bore resistance at travel 0, so the shot starts when the pressure force exceeds that resistance and the start pressure has no effect.',
    },
  ],
  gyrationRadiusWithoutTwist: [
    /*i18n*/ {
      id: 'coreMessage.warning.gyrationRadiusWithoutTwist',
      message:
        'The twist is 0, so the bullet has no rotational energy and the radius of gyration is ignored.',
    },
  ],
  startPressureHeldOnce: [
    /*i18n*/ {
      id: 'coreMessage.warning.startPressureHeldOnce',
      message:
        'The start pressure is above the bore resistance at travel 0 and above the ignition pressure, and the engraving pressure at travel 0 is not 0, so the projectile is held until the start pressure and then starts against the lower bore resistance at travel 0, after which the engraving profile applies.',
    },
  ],
} satisfies Record<WarningCode, readonly Described[]>

/** Texts the packages and the API write whole: reason codes, measuring methods, advisory names, labels, import failures. */
const codes: readonly Described[] = [
  /*i18n*/ { id: 'coreMessage.code.noValue', message: 'noValue' },
  /*i18n*/ { id: 'coreMessage.method.crusher', message: 'crusher' },
  /*i18n*/ { id: 'coreMessage.method.transducer', message: 'transducer' },
  /*i18n*/ { id: 'coreMessage.method.piezo', message: 'piezo' },
  /*i18n*/ { id: 'coreMessage.method.caseContact', message: 'case-contact' },
  /*i18n*/ { id: 'coreMessage.method.energy', message: 'energy' },
  /*i18n*/ { id: 'coreMessage.method.notStated', message: 'measuring method not stated' },
  /*i18n*/ {
    id: 'coreMessage.method.notStatedInRecord',
    message: 'measuring method not stated in the record',
  },
  /*i18n*/ { id: 'coreMessage.code.busy', message: 'busy' },
  /*i18n*/ { id: 'coreMessage.code.timeout', message: 'timeout' },
  /*i18n*/ { id: 'coreMessage.code.outputTooLarge', message: 'outputTooLarge' },
  /*i18n*/ { id: 'coreMessage.code.missingValues', message: 'missingValues' },
  /*i18n*/ { id: 'coreMessage.code.unreachable', message: 'unreachable' },
  /*i18n*/ { id: 'coreMessage.code.input', message: 'input' },
  /*i18n*/ { id: 'coreMessage.code.chamberVolume', message: 'chamberVolume' },
  /*i18n*/ { id: 'coreMessage.code.noShotStart', message: 'noShotStart' },
  /*i18n*/ { id: 'coreMessage.code.stuck', message: 'stuck' },
  /*i18n*/ { id: 'coreMessage.code.integration', message: 'integration' },
  /*i18n*/ { id: 'coreMessage.code.maxTime', message: 'maxTime' },
  /*i18n*/ { id: 'coreMessage.code.nonFinite', message: 'nonFinite' },
  /*i18n*/ { id: 'coreMessage.code.outsideModel', message: 'outsideModel' },
  /*i18n*/ { id: 'coreMessage.code.invalid', message: 'invalid' },
  /*i18n*/ { id: 'coreMessage.code.noValidRun', message: 'noValidRun' },
  /*i18n*/ { id: 'coreMessage.code.belowRange', message: 'belowRange' },
  /*i18n*/ { id: 'coreMessage.code.aboveRange', message: 'aboveRange' },
  /*i18n*/ { id: 'coreMessage.code.notMonotone', message: 'notMonotone' },
  /*i18n*/ { id: 'coreMessage.code.bracketFailed', message: 'bracketFailed' },
  /*i18n*/ { id: 'coreMessage.code.toleranceNotReached', message: 'toleranceNotReached' },
  /*i18n*/ { id: 'coreMessage.code.noComparableLimit', message: 'noComparableLimit' },
  /*i18n*/ { id: 'coreMessage.code.underdetermined', message: 'underdetermined' },
  /*i18n*/ { id: 'coreMessage.code.unresolved', message: 'unresolved' },
  /*i18n*/ { id: 'coreMessage.code.illConditioned', message: 'ill-conditioned' },
  /*i18n*/ { id: 'coreMessage.code.notConverged', message: 'not-converged' },
  /*i18n*/ { id: 'coreMessage.code.stepBudget', message: 'step-budget' },
  /*i18n*/ { id: 'coreMessage.code.noInformation', message: 'no-information' },
  /*i18n*/ { id: 'coreMessage.code.collinear', message: 'collinear' },
  /*i18n*/ { id: 'coreMessage.code.imprecise', message: 'imprecise' },
  /*i18n*/ { id: 'coreMessage.code.inconsistent', message: 'inconsistent' },
  /*i18n*/ { id: 'coreMessage.code.fitFailed', message: 'fit-failed' },
  /*i18n*/ { id: 'coreMessage.code.apex', message: 'apex' },
  /*i18n*/ { id: 'coreMessage.code.atmosphere', message: 'atmosphere' },
  /*i18n*/ { id: 'coreMessage.code.yaw', message: 'yaw' },
  /*i18n*/ { id: 'coreMessage.code.done', message: 'done' },
  /*i18n*/ { id: 'coreMessage.advisory.simulation', message: 'simulation, not load data' },
  /*i18n*/ { id: 'coreMessage.advisory.limitExceeded', message: 'limit exceeded' },
  /*i18n*/ { id: 'coreMessage.advisory.noCartridge', message: 'no cartridge' },
  /*i18n*/ { id: 'coreMessage.advisory.noComparableLimit', message: 'no comparable limit' },
  /*i18n*/ { id: 'coreMessage.advisory.rangeIncomplete', message: 'range incomplete' },
  /*i18n*/ {
    id: 'coreMessage.advisory.chargeTooSmall',
    message: 'charge too small for the model',
  },
  /*i18n*/ { id: 'coreMessage.advisory.resistanceNotApplied', message: 'resistance not applied' },
  /*i18n*/ { id: 'coreMessage.advisory.solidFillHigh', message: 'solid fill high' },
  /*i18n*/ {
    id: 'coreMessage.advisory.startPressureNoEffect',
    message: 'start pressure has no effect',
  },
  /*i18n*/ {
    id: 'coreMessage.advisory.gyrationRadiusIgnored',
    message: 'gyration radius ignored',
  },
  /*i18n*/ {
    id: 'coreMessage.advisory.startPressureHeldOnce',
    message: 'start pressure held once',
  },
  /*i18n*/ { id: 'coreMessage.label.maker', message: 'Maker' },
  /*i18n*/ { id: 'coreMessage.label.caliber', message: 'Caliber' },
  /*i18n*/ { id: 'coreMessage.label.diameter', message: 'Diameter' },
  /*i18n*/ { id: 'coreMessage.label.mass', message: 'Mass' },
  /*i18n*/ { id: 'coreMessage.label.length', message: 'Length' },
  /*i18n*/ { id: 'coreMessage.label.grainForm', message: 'Grain form' },
  /*i18n*/ { id: 'coreMessage.label.propellantBase', message: 'Propellant base' },
  /*i18n*/ { id: 'coreMessage.label.bulkDensity', message: 'Bulk density' },
  /*i18n*/ { id: 'coreMessage.label.caseLength', message: 'Case length' },
  /*i18n*/ { id: 'coreMessage.label.overallLength', message: 'Overall length' },
  /*i18n*/ { id: 'coreMessage.label.bulletDiameter', message: 'Bullet diameter' },
  /*i18n*/ { id: 'coreMessage.label.maxPressure', message: 'Max pressure' },
  /*i18n*/ {
    id: 'coreMessage.import.tooLarge',
    message: 'The file is larger than 40 MB. Split it and import the parts.',
  },
  /*i18n*/ {
    id: 'coreMessage.import.noText',
    message:
      'The workbook has no cells with text. Open the right file or paste the table into a sheet.',
  },
  /*i18n*/ {
    id: 'coreMessage.import.oddBytes',
    message: 'UTF-16 text with an odd number of bytes',
  },
  /*i18n*/ {
    id: 'coreMessage.import.notUnicode',
    message: 'the file is not UTF-8 or UTF-16 text; save it as UTF-8 (CSV UTF-8) and import again',
  },
  /*i18n*/ {
    id: 'coreMessage.import.oddBytesSave',
    message:
      'UTF-16 text with an odd number of bytes; save it as UTF-8 (CSV UTF-8) and import again.',
  },
  /*i18n*/ {
    id: 'coreMessage.import.notUnicodeSentence',
    message: 'The file is not UTF-8 or UTF-16 text; save it as UTF-8 (CSV UTF-8) and import again.',
  },
  /*i18n*/ {
    id: 'coreMessage.import.notRun',
    message: 'The import could not run in this browser.',
  },
  /*i18n*/ { id: 'coreMessage.import.notRead', message: 'The file could not be read.' },
]

/** Sentences with `{name}` where a value stands: request failures, error answers, curve fit, ladders, advisory rules, table import, seating, the user data schema. */
const sentences: readonly Described[] = [
  /*i18n*/ {
    id: 'coreMessage.request.refused',
    message: 'The model refused the load. The error panel gives the reason.',
  },
  /*i18n*/ {
    id: 'coreMessage.request.failed',
    message: 'A data file did not load or the computation failed. Check the connection and retry.',
  },
  /*i18n*/ { id: 'coreMessage.request.timeLimit', message: 'The run passed the time limit.' },
  /*i18n*/ {
    id: 'coreMessage.request.lotRowsSilent',
    message: 'The lot rows did not answer in {seconds} s.',
  },
  /*i18n*/ {
    id: 'coreMessage.request.longerRunSilent',
    message: 'The longer run did not answer in {seconds} s.',
  },
  /*i18n*/ { id: 'coreMessage.request.error', message: 'Error {status}.' },
  /*i18n*/ { id: 'coreMessage.request.fileStatus', message: '{file}.json answered {status}' },
  /*i18n*/ {
    id: 'coreMessage.request.loadGone',
    message: 'the load is no longer in this browser',
  },
  /*i18n*/ { id: 'coreMessage.request.schema', message: 'request does not match the schema' },
  /*i18n*/ {
    id: 'coreMessage.request.querySchema',
    message: 'querystring does not match the schema',
  },
  /*i18n*/ { id: 'coreMessage.request.idMismatch', message: 'params/id must match the record id' },
  /*i18n*/ { id: 'coreMessage.request.notFound', message: '{path} not found' },
  /*i18n*/ { id: 'coreMessage.request.bodyTooLarge', message: 'request body above 64 KiB' },
  /*i18n*/ { id: 'coreMessage.request.notJson', message: 'Body is not valid JSON' },
  /*i18n*/ { id: 'coreMessage.request.internal', message: 'internal server error' },
  /*i18n*/ { id: 'coreMessage.request.workerFailed', message: 'compute worker failed' },
  /*i18n*/ { id: 'coreMessage.request.workerExited', message: 'compute worker exited' },
  /*i18n*/ { id: 'coreMessage.request.poolClosed', message: 'compute pool closed' },
  /*i18n*/ {
    id: 'coreMessage.request.noWorker',
    message: 'no compute worker could be started',
  },
  /*i18n*/ { id: 'coreMessage.request.workersBusy', message: 'all compute workers are busy' },
  /*i18n*/ {
    id: 'coreMessage.request.tooSlow',
    message: 'computation did not finish within {ms} ms',
  },
  /*i18n*/ { id: 'coreMessage.request.ladderTooSlow', message: 'ladder would pass {ms} ms' },
  /*i18n*/ {
    id: 'coreMessage.request.indexOnly',
    message: 'the Pages catalogue holds the index only',
  },
  /*i18n*/ { id: 'coreMessage.answer.interior', message: 'interior: {reason}' },
  /*i18n*/ {
    id: 'coreMessage.answer.noValidChargeField',
    message: 'no scanned charge gives a valid run: interior {reason} ({field})',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.noValidCharge',
    message: 'no scanned charge gives a valid run: interior {reason}',
  },
  /*i18n*/ { id: 'coreMessage.answer.chargeSolver', message: 'charge solver: {reason}' },
  /*i18n*/ { id: 'coreMessage.answer.truing', message: 'truing: {reason}' },
  /*i18n*/ { id: 'coreMessage.answer.truingDetail', message: 'truing: {reason} ({detail})' },
  /*i18n*/ { id: 'coreMessage.answer.powderFit', message: 'powder fit: {reason}' },
  /*i18n*/ {
    id: 'coreMessage.answer.ladderOutput',
    message:
      'ladder output of {n} points is above {max}: fewer steps or a larger options.outputStep',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.ladderKind',
    message: 'ladder.kind: a {kind} ladder runs in the workbench, not in this route',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.lacksValue',
    message:
      'The load file lacks 1 value: {list}. Type them under analysis.overrides, or name catalogue records that give them.',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.lacksValues',
    message:
      'The load file lacks {n} values: {list}. Type them under analysis.overrides, or name catalogue records that give them.',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.oneLoad',
    message: 'The file must hold exactly one load record, it has {n}',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.userRecord',
    message: 'A user record is not on the server, name a catalogue record',
  },
  /*i18n*/ { id: 'coreMessage.answer.unknownField', message: 'Unknown field' },
  /*i18n*/ {
    id: 'coreMessage.answer.formatVersion',
    message: 'The file has format version {v}; this app reads version {w}.',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.tolerance',
    message: 'at least one tolerance must be above 0',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.oddSteps',
    message: 'a ladder around the charge needs an odd number of steps',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.outputSteps',
    message: 'maxTime / outputStep must be at most {max}',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.samplingSingle',
    message: 'sampling applies to a single run, not to a ladder',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.bulletValues',
    message: 'mass, diameter and length are required without bullet',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.percentOfLimit',
    message: 'unit percentOfLimit applies to the peakPressure target only',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.bulkDensity',
    message: 'propellant.bulkDensity or powder is required for the loadRatio target',
  },
  /*i18n*/ {
    id: 'coreMessage.answer.maxSteps',
    message: 'options.maxSteps must be at most {max} for the charge solver',
  },
  /*i18n*/ { id: 'coreMessage.curveFit.sameCharge', message: 'traces {list} have the same charge' },
  /*i18n*/ {
    id: 'coreMessage.curveFit.peakRatio',
    message:
      'the highest peak (trace {high}) is {ratio} times the lowest (trace {low}), below {limit}',
  },
  /*i18n*/ { id: 'coreMessage.ladder.tooBig', message: 'Too big: expected number to be <={n}' },
  /*i18n*/ {
    id: 'coreMessage.advisory.limitExceededRule',
    message: 'The simulated peak pressure is above a CIP maximum pressure of the cartridge.',
  },
  /*i18n*/ {
    id: 'coreMessage.advisory.noComparableLimitRule',
    message: 'The cartridge has no CIP Pmax measured by transducer or piezo.',
  },
  /*i18n*/ {
    id: 'coreMessage.advisory.rangeIncompleteRule',
    message: 'Some cases of the pressure range could not be computed.',
  },
  /*i18n*/ {
    id: 'coreMessage.advisory.chargeTooSmallRule',
    message:
      'The simulated peak mean pressure is below {ratio} times the hold pressure; the results are outside the range the model was built for.',
  },
  /*i18n*/ {
    id: 'coreMessage.import.noTable',
    message:
      'Sheet "{name}" has no table of two columns or more. Move the table to the first sheet.',
  },
  /*i18n*/ {
    id: 'coreMessage.import.unreadable',
    message: 'The workbook cannot be read. Save it again as XLSX or CSV.',
  },
  /*i18n*/ {
    id: 'coreMessage.seating.behindHead',
    message:
      'The bullet base is behind the case head: the seating depth is above the case length. No volume behind the bullet is given.',
  },
  /*i18n*/ {
    id: 'coreMessage.seating.noVolume',
    message:
      'The bullet below the mouth takes the whole case volume: no volume behind the bullet is given.',
  },
  /*i18n*/ {
    id: 'coreMessage.schema.loadOrFactory',
    message: 'Give a load or factory ammunition, not both.',
  },
]

/** A template: a message of the table, or a refusal sentence of the old catalogue (`refusal-words.ts`). */
type Template = Described | Message

const templates: readonly Template[] = [
  ...Object.values(warningMessages).flat(),
  ...Object.values(refusalWords),
  ...sentences,
]

/** Every message of the table: the Lingui messages of the codes and sentences and the refusal words. */
export const coreMessages: readonly Template[] = [...codes, ...templates]

const englishOf = (template: Template) =>
  typeof template === 'string' ? template : template.message

interface Pattern {
  template: Template
  /** The names of the placeholders in order of appearance. */
  names: string[]
  /** The whole text with the values captured lazily. */
  matcher: RegExp
  /** Characters of the template outside its placeholders: the more, the more specific. */
  literal: number
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function compile(template: Template): Pattern {
  const english = englishOf(template)
  const names: string[] = []
  const source = english
    .split(/(\{\w+\})/)
    .map((part) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1]
      if (name === undefined) return escaped(part)
      names.push(name)
      return '(.+?)'
    })
    .join('')
  const literal = english.replace(/\{\w+\}/g, '').length
  // a template of placeholders only would match every text
  if (literal === 0) throw new Error(`message without text: ${english}`)
  return { template, names, matcher: new RegExp(`^${source}$`, 's'), literal }
}

/** The templates, the most specific first, so that `{kind} range` never takes `range must be positive`. */
const patterns = templates.map(compile).sort((a, b) => b.literal - a.literal)
const codeIds = new Map(codes.map((c) => [c.message, c.id]))

/** A number with the unit symbols of the messages: its point is the language's decimal mark on screen. */
const quantity =
  /^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?(?: (?:bar|psi|MPa|kPa|Pa|mm|cm|m|kg\/m3|kg|g|gr|K|ms|s|rad))?$/

/** A text that `t` leaves as it is, where `{n}` is filled with a number: the decimal mark of its language. */
const probe = '{n}' as Message

/** `text` with each point between digits written as the decimal mark of the language of `t`. */
function withDecimalMark(text: string, t: Translator['t']): string {
  const mark = t(probe, { n: 1.5 }).charAt(1)
  return mark === '.' ? text : text.replace(/(?<=\d)\.(?=\d)/g, mark)
}

/** The longest template is under 150 characters, and the lazy groups backtrack, so a text that matches nothing costs far more than its length. */
const maxMessageChars = 2000

/** One language: its Lingui messages and its old catalogue, which words the refusal sentences and the labels of the app. */
type Language = { i18n: I18n; t: Translator['t'] }

/** The German of `text` when it is a code or an instance of a template, else undefined. */
function translated(text: string, language: Language): string | undefined {
  const id = codeIds.get(text)
  if (id !== undefined) return language.i18n._(id)
  if (text.length > maxMessageChars) return undefined
  for (const { template, names, matcher } of patterns) {
    const match = matcher.exec(text)
    if (!match) continue
    const values: Record<string, string> = {}
    names.forEach((name, i) => {
      values[name] ??= value(match[i + 1] ?? '', language)
    })
    return typeof template === 'string'
      ? language.t(template, values)
      : language.i18n._(template.id, values)
  }
}

/** A value of a message as shown: a code or message, a list of them, a label of the catalogue, a number. */
function value(text: string, language: Language): string {
  const message = translated(text, language)
  if (message !== undefined) return message
  const parts = text.split(', ')
  if (parts.length > 1) return parts.map((part) => value(part, language)).join(', ')
  const label = language.t(text as Message)
  if (label !== text) return label
  return quantity.test(text) ? withDecimalMark(text, language.t) : text
}

const byLingui = new WeakMap<I18n, Language>()
const byT = new WeakMap<Translator['t'], Language>()

/** Makes `translateMessage` translate the messages of this table in the language of `i18n`; returns the translator of `catalogue`, which words the refusal words and labels and which the language module publishes, so a caller's `t` finds its language. */
export function installCoreMessages(i18n: I18n, catalogue: Catalogue, code: string): Translator {
  const shown = translator(catalogue, code)
  const language = { i18n, t: shown.t }
  byLingui.set(i18n, language)
  byT.set(shown.t, language)
  setCoreMessages((text, shown) => {
    const language = typeof shown === 'function' ? byT.get(shown) : byLingui.get(shown)
    return language && translated(text, language)
  })
  return shown
}
