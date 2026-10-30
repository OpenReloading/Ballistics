import { type Message, msg, type Translator } from '../i18n/translate.ts'
import table from './core-message-table.json' with { type: 'json' }
import { setCoreMessages } from './core-messages.ts'

/**
 * Messages of the packages, the API and the app's own request code, in the language shown.
 *
 * They are English text: the packages raise `InputError`s with free text and the API passes it on,
 * so a message is known by its template, the English text with `{name}` where a value stands.
 * A template is matched against the whole text, the values are taken from the match and the
 * German sentence is filled with them. A text that no template matches is shown as it is.
 * A message stays English in state, links and files; it is translated where it is shown.
 *
 * This table is large and English pages never read it: the language module loads it when a
 * language other than English is chosen and `installCoreMessages` hands it to `translateMessage`.
 */

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
    msg(
      'Simulated peak pressure {nominal} (range {low} to {high}) is above {name} {limit} ({spec}; {method}).',
    ),
    msg(
      'The upper end of the simulated peak pressure range, {high}, is above {name} {limit} ({spec}; {method}); the nominal value is {nominal}.',
    ),
  ],
  noCartridge: [msg('No cartridge id was given, so no CIP Pmax was checked.')],
  noComparableLimit: [
    msg(
      '{name} has no CIP Pmax measured by transducer or piezo. Crusher values are not compared with a simulated pressure.',
    ),
  ],
  rangeIncomplete: [
    msg(
      '{n} of {m} range cases could not be computed ({list}); the range covers only the computed cases, and the true range can be wider.',
    ),
  ],
  chargeTooSmall: [
    msg(
      'Charge too small for the model: the simulated peak mean pressure, {p}, is below {ratio} times the start pressure ({hold}); results are outside the range the model was built for.',
    ),
    msg(
      'Charge too small for the model: the simulated peak mean pressure, {p}, is below {ratio} times the ignition pressure ({hold}); results are outside the range the model was built for.',
    ),
  ],
  resistanceNotApplied: [
    msg(
      'Simulation: the parameters of {label} were fitted with a bore-resistance law this run cannot apply (missing: {list}); the results are biased.',
    ),
  ],
  loadRatioHigh: [
    msg(
      'Simulation: solid fill {fill} is above {limit}; the model is outside the range it was built for.',
    ),
    msg(
      'Simulation: load ratio {ratio} is above {max}, solid fill {limit} for this powder; the model is outside the range it was built for.',
    ),
  ],
  startPressureBelowResistance: [
    msg(
      'The start pressure is at or below the bore resistance at travel 0, so the shot starts when the pressure force exceeds that resistance and the start pressure has no effect.',
    ),
  ],
  gyrationRadiusWithoutTwist: [
    msg(
      'The twist is 0, so the bullet has no rotational energy and the radius of gyration is ignored.',
    ),
  ],
  startPressureHeldOnce: [
    msg(
      'The start pressure is above the bore resistance at travel 0 and above the ignition pressure, and the engraving pressure at travel 0 is not 0, so the projectile is held until the start pressure and then starts against the lower bore resistance at travel 0, after which the engraving profile applies.',
    ),
  ],
} satisfies Record<WarningCode, readonly Message[]>

/**
 * The texts of the table, in `core-message-table.json` so that the scan of `scripts/i18n.mts` reads
 * them as it reads the `msg` calls: `codes` are words that stand alone as a message (the reasons of
 * a refused or invalid run, of a limit that is not compared and of a failed fit, and the notice
 * every answer carries), `templates` the messages of the packages and the API that carry values and
 * the app's own request failures, in groups named by their source.
 */
const codes: readonly Message[] = table.codes.map(msg)

const templates: readonly Message[] = [
  ...Object.values(warningMessages).flat(),
  ...Object.values(table.templates).flat().map(msg),
]

/** Every message text this file translates: the codes and the templates. */
export const messageTexts: readonly Message[] = [...codes, ...templates]

interface Pattern {
  template: Message
  /** The names of the placeholders in order of appearance. */
  names: string[]
  /** The whole text with the values captured lazily. */
  matcher: RegExp
  /** Characters of the template outside its placeholders: the more, the more specific. */
  literal: number
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function compile(template: Message): Pattern {
  const names: string[] = []
  const source = template
    .split(/(\{\w+\})/)
    .map((part) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1]
      if (name === undefined) return escaped(part)
      names.push(name)
      return '(.+?)'
    })
    .join('')
  const literal = template.replace(/\{\w+\}/g, '').length
  // a template of placeholders only would match every text
  if (literal === 0) throw new Error(`message without text: ${template}`)
  return { template, names, matcher: new RegExp(`^${source}$`, 's'), literal }
}

/** The templates, the most specific first, so that `{kind} range` never takes `range must be positive`. */
const patterns = templates.map(compile).sort((a, b) => b.literal - a.literal)
const codeSet = new Set<string>(codes)

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

/**
 * Longest text matched against the templates: the longest template has fewer than 150 characters
 * and its values are short. The lazy groups backtrack, so the time of a text that matches no
 * template grows much faster than its length.
 */
const maxMessageChars = 2000

/** The German of `text` when it is a code or an instance of a template, else undefined. */
function translated(text: string, t: Translator['t']): string | undefined {
  if (codeSet.has(text)) return t(text as Message)
  if (text.length > maxMessageChars) return undefined
  for (const { template, names, matcher } of patterns) {
    const match = matcher.exec(text)
    if (!match) continue
    const values: Record<string, string> = {}
    names.forEach((name, i) => {
      values[name] ??= value(match[i + 1] ?? '', t)
    })
    return t(template, values)
  }
}

/** A value of a message as shown: a code or message, a list of them, a label of the catalogue, a number. */
function value(text: string, t: Translator['t']): string {
  const message = translated(text, t)
  if (message !== undefined) return message
  const parts = text.split(', ')
  if (parts.length > 1) return parts.map((part) => value(part, t)).join(', ')
  const label = t(text as Message)
  if (label !== text) return label
  return quantity.test(text) ? withDecimalMark(text, t) : text
}

/** Makes `translateMessage` translate the messages of this table. */
export const installCoreMessages = () => setCoreMessages(translated)

/** The text in the language of `t` when `text` is a message of this table, else `text`. */
export const translateKnown = (text: string, t: Translator['t']) => translated(text, t) ?? text
