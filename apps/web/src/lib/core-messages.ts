import { type Message, msg, type Translator } from '../i18n/translate.ts'

/**
 * Messages of the packages, the API and the app's own request code, in the language shown.
 *
 * They are English text: the packages raise `InputError`s with free text and the API passes it on,
 * so a message is known by its template, the English text with `{name}` where a value stands.
 * A template is matched against the whole text, the values are taken from the match and the
 * German sentence is filled with them. A text that no template matches is shown as it is.
 * A message stays English in state, links and files; it is translated where it is shown.
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
} satisfies Record<WarningCode, readonly Message[]>

/**
 * Words that stand alone as a message: the reasons of a refused or invalid run, of a limit that is
 * not compared and of a failed fit, and the notice every answer carries.
 */
const codes: readonly Message[] = [
  msg('noValue'),
  msg('crusher'),
  msg('transducer'),
  msg('piezo'),
  msg('energy'),
  msg('measuring method not stated'),
  msg('measuring method not stated in the record'),
  msg('busy'),
  msg('timeout'),
  msg('outputTooLarge'),
  msg('missingValues'),
  msg('unreachable'),
  msg('input'),
  msg('chamberVolume'),
  msg('noShotStart'),
  msg('stuck'),
  msg('integration'),
  msg('maxTime'),
  msg('nonFinite'),
  msg('outsideModel'),
  msg('invalid'),
  msg('noValidRun'),
  msg('belowRange'),
  msg('aboveRange'),
  msg('notMonotone'),
  msg('bracketFailed'),
  msg('toleranceNotReached'),
  msg('noComparableLimit'),
  msg('underdetermined'),
  msg('unresolved'),
  msg('ill-conditioned'),
  msg('not-converged'),
  msg('step-budget'),
  msg('no-information'),
  msg('collinear'),
  msg('imprecise'),
  msg('fit-failed'),
  msg('apex'),
  msg('atmosphere'),
  msg('yaw'),
  msg('done'),
  msg('the floor'),
  msg('simulation, not load data'),
]

/** The messages of the packages and the API that carry values, and the app's own request failures. */
const templates: readonly Message[] = [
  ...Object.values(warningMessages).flat(),
  // app and API request failures
  msg('The API answered {status}.'),
  msg('The API did not answer.'),
  msg('The run passed the API deadline.'),
  msg('The lot rows did not answer in {seconds} s.'),
  msg('The longer run did not answer in {seconds} s.'),
  msg('Error {status}.'),
  msg('{file}.json answered {status}'),
  msg('the load is no longer in this browser'),
  msg('request does not match the schema'),
  msg('querystring does not match the schema'),
  msg('params/id must match the record id'),
  msg('{path} not found'),
  msg('{kind} {id} not found'),
  msg('request body above 64 KiB'),
  msg('Body is not valid JSON'),
  msg('internal server error'),
  msg('compute worker failed'),
  msg('compute worker exited'),
  msg('compute pool closed'),
  msg('no compute worker could be started'),
  msg('all compute workers are busy'),
  msg('computation did not finish within {ms} ms'),
  msg('ladder would pass {ms} ms'),
  msg('the Pages catalogue holds the index only'),

  // error answers that name a reason
  msg('interior: {reason}'),
  msg('no scanned charge gives a valid run: interior {reason} ({field})'),
  msg('no scanned charge gives a valid run: interior {reason}'),
  msg('charge solver: {reason}'),
  msg('truing: {reason}'),
  msg('truing: {reason} ({detail})'),
  msg('powder fit: {reason}'),
  msg('ladder output of {n} points is above {max}: fewer steps or a larger options.outputStep'),
  msg('ladder.kind: a {kind} ladder runs in the workbench, not in this route'),
  msg(
    'The load file lacks 1 value: {list}. Type them under analysis.overrides, or name catalogue records that give them.',
  ),
  msg(
    'The load file lacks {n} values: {list}. Type them under analysis.overrides, or name catalogue records that give them.',
  ),
  msg('The file must hold exactly one load record, it has {n}'),
  msg('A user record is not on the server, name a catalogue record'),
  msg('Unknown field'),
  msg('The file has format version {v}; this app reads version {w}.'),
  msg(
    'A record of kind "workbenchState" is a load in the format of an earlier version, which this app no longer reads. Kind "load" replaces it.',
  ),
  msg('at least one tolerance must be above 0'),
  msg('a ladder around the charge needs an odd number of steps'),
  msg('maxTime / outputStep must be at most {max}'),
  msg('sampling applies to a single run, not to a ladder'),
  msg('mass, diameter and length are required without bullet'),
  msg('unit percentOfLimit applies to the peakPressure target only'),
  msg('propellant.bulkDensity or powder is required for the loadRatio target'),
  msg('options.maxSteps must be at most {max} for the charge solver'),
  msg('bullet {id} has no length'),
  msg('bullet {id} {key} {value} {unit} must be within {low} and {high} {unit}'),
  msg('result holds a non-finite number at {path}'),
  msg('powder {id} bulk density {n} kg/m3 must be above 0 and at most {max} kg/m3'),
  msg('powder {id} has no bulk density'),
  msg('bullet {id} has no {model} ballistic coefficient'),
  msg('bullet {id} has {n} {model} values without distinct velocity bands; send drag explicitly'),

  // recoil
  msg('Firearm mass must be positive.'),
  msg('Projectile mass must be positive.'),
  msg('Charge mass must not be negative.'),
  msg('Muzzle velocity must not be negative.'),
  msg('Gas velocity factor must not be negative.'),

  // charge solver
  msg('target value must be above 0'),
  msg('bulk density must be above 0'),
  msg('the load ratio target needs the bulk density'),

  // curve fit
  msg('the trace never falls to the fall fraction of its peak after the peak'),
  msg('trace: equal numbers of finite, strictly increasing times and finite pressures, at least 2'),
  msg('trace.sensor: breech, mean or base'),
  msg('sigma must be positive'),
  msg('a curve fit needs a vivacity burn law with a two-stage form'),
  msg('parameters: burnRate, formSlope, transition and exponent, each at most once'),
  msg('formSlope needs a start value above 0'),
  msg('transition needs a start value below 1'),
  msg('exponent needs a start value above 0'),
  msg('maxIterations must be a positive integer'),
  msg('maxCondition must be positive'),
  msg('fallFraction must lie in (0, 1)'),
  msg('the trace has no positive pressure'),
  msg('too few trace samples in the window'),
  msg(
    'the model at the start values leaves the barrel before the end of the trace window; start closer or raise fallFraction',
  ),

  // fit confidence and sessions
  msg('at least one point'),
  msg('{input}: standardUncertainty must be 0 or above'),
  msg('burn coefficient and energy must be positive'),
  msg('count must be a positive integer'),
  msg('the range has no width'),
  msg('at least one session'),
  msg('the burn coefficient is always fitted'),
  msg('a prior needs its parameter in parameters'),

  // powder fit
  msg('at least one ladder point'),
  msg('ladder charge must be positive'),
  msg('ladder velocity must be positive'),
  msg('velocitySigma must be positive'),
  msg('ladder pressure must be positive'),
  msg('pressureSigma must be positive'),
  msg('barrelLength must be positive'),
  msg('propellantTemperature must be positive'),
  msg('peakPressure and pressureSigma together'),
  msg('velocitySigma on all points or none'),
  msg('pressures need velocity sigmas'),
  msg('parameters: {list}, each at most once'),
  msg('temperatureFactor needs the load to carry a temperature sensitivity other than 0'),
  msg('huberThreshold must be positive'),
  msg('priors and huberThreshold need velocity sigmas'),
  msg('startPressure must be above the ignition pressure and the resistance at travel 0'),
  msg('prior {name}: value above {floor}, sigma above 0'),
  msg('charge must be positive'),
  msg('level must lie in (0, 1)'),
  msg('the fit has no covariance: add rows or velocity sigmas'),

  // ladders
  msg('ladder start charge must be above 0'),
  msg('ladder step must be above 0'),
  msg('ladder steps must be an integer of at least 1'),
  msg('a ladder around the charge needs an odd count'),
  msg('ladder charge {n} kg must be above 0'),
  msg('a ladder needs at least two strings'),
  msg('mean must be finite'),
  msg('standard deviation must be 0 or more'),
  msg('each string needs at least two shots'),
  msg('charges must differ'),

  // load file values
  // the German text of the first is in the catalogue with the field errors
  msg('Enter a number for {label}.'),
  msg('{label} must be at least 0.'),
  msg('Burn form: {list} needed with the others, or leave all four empty.'),
  msg('Enter a number.'),
  msg('Must be above 0.'),
  msg('Must be at least 0.'),
  msg('Needed with the other engraving value, or from a powder record.'),

  // start pressure, vivacity
  msg('barrel {n} m must be a positive number'),
  msg('unknown bullet construction {id}'),
  msg('dynamic vivacity: exponent must be 1'),
  msg('dynamic vivacity: need 0 <= from < to <= 1'),

  // groups
  msg('degrees of freedom must be a positive whole number'),
  msg('probability must lie in (0, 1)'),
  msg('degrees of freedom must be positive'),
  msg('distances must be positive'),
  msg('the group dispersion must be positive'),
  msg('wind inputs must not be negative'),
  msg('the range uncertainty must not be negative'),
  msg('the semi-axes must be positive'),
  msg('the standard deviations must be positive'),
  msg('a face needs at least one zone'),
  msg('confidence level must lie in (0, 1)'),
  msg('distance must be positive'),
  msg('shot coordinates must be finite'),
  msg('shot velocity must be finite'),
  msg('aim must be finite'),
  msg('coverage must lie in (0, 1)'),

  // atmosphere, moving target, outline drag, stability
  msg('altitude {n} m outside {low} to {high} m'),
  msg('temperature {n} K'),
  msg('humidity {n} outside 0..1'),
  msg('pressure {n} Pa'),
  msg(
    'pressure {p} Pa at temperature {t} K gives an air density of {d} kg/m3, outside 0 to {max} kg/m3',
  ),
  msg('target speed must be 0 or more'),
  msg('target heading must be a number'),
  msg('range must be positive'),
  msg('time of flight must be 0 or more'),
  msg('diameter must be positive'),
  msg('length and noseLength must be positive'),
  msg('headShape must be from 0 to 1'),
  msg('boatTailLength must be zero or more'),
  msg('baseDiameter must be positive'),
  msg('meplatDiameter must be zero up to the diameter'),
  msg('bandDiameter must be at least the diameter'),
  msg('noseLength plus boatTailLength must not exceed length'),
  msg('mach must be positive'),
  msg('the outline gives no positive finite drag: outside the method'),
  msg('mass, diameter, length, twist and velocity must be positive'),

  // range strings and truing
  msg('muzzle velocity must be positive'),
  msg('maxZeroSigma must be positive'),
  msg('prior {name}'),
  msg('prior {name} must be positive'),
  msg('a zeroOffset prior needs the fitZeroOffset option'),
  msg('click value must be positive'),
  msg('confidenceLevel must lie in (0, 1)'),
  msg('residualConfidenceLevel must lie in (0, 1)'),
  msg('maxInflation must exceed 1'),
  msg('maxRelativeStandardUncertainty must be positive'),
  msg('maxCondition must be finite and above 1'),
  msg('maxIterations must be a whole number of at least 1'),
  msg('group {key}: an impact and a dial entry share their shots, keep one or name two groups'),
  msg('{kind} range'),
  msg('{kind} shotCount must be a whole number of at least 1'),
  msg('{kind} standardDeviation must be positive'),
  msg('{kind} rounding must not be negative'),
  msg('at least one entry or a chronograph'),
  msg('entry kind {kind}'),
  msg('entry value'),
  msg('chronograph mean'),
  msg('dispersion must be positive'),
  msg('at least one candidate'),
  msg('maxTotalSteps must be positive'),
  msg('at least one observation'),
  msg('observation kind {kind}'),
  msg('observation value'),
  msg('observation range {n}'),
  msg('standardUncertainty must be positive'),
  msg('standardUncertainty on all observations or none'),
  msg('observations of different kinds need standard uncertainties'),
  msg('at least two knots'),
  msg('knot Mach must be positive'),
  msg('knots must rise'),
  msg('knots need a single-band BC or a curve'),
  msg('at least one observation per session'),

  // integrator
  msg('more than {n} integration steps'),
  msg('more than {n} integration steps in total'),
  msg('step size {h} s below {min} s'),

  // trajectory input
  msg('wind segment'),
  msg('wind segments must end in rising order'),
  msg('drag model {id}'),
  msg('at least one BC band'),
  msg('BC band'),
  msg('BC bands need distinct speeds'),
  msg('BC reference {id}'),
  msg('a drag curve needs at least two nodes'),
  msg('drag curve node'),
  msg('drag curve Mach must rise'),
  msg('drag interpolation {id}'),
  msg('mass must be positive'),
  msg('length must be positive'),
  msg('sight height and offset'),
  msg('twist must be positive'),
  msg('look angle outside -pi/2..pi/2'),
  msg('latitude'),
  msg('azimuth'),
  msg('zero range must be positive'),
  msg('zero look angle outside -pi/2..pi/2'),
  msg('bore angles'),
  msg('tolerances and limits'),
  msg('step budget'),
  msg('gravity'),
  msg('zero tolerance and maximum yaw must be positive'),
  msg('model {id}'),
  msg('{name} table needs at least two nodes'),
  msg('{name} table node'),
  msg('{name} table Mach must rise'),
  msg('the modified point mass needs projectile.aerodynamics'),
  msg('the modified point mass needs twist and twist hand'),
  msg('the modified point mass needs liftSlope'),
  msg('a missing moment of inertia needs the length'),
  msg('moments of inertia must be positive'),
  msg('a missing momentSlope needs the length'),
  msg('momentSlope must be positive (spin-stabilised bullet)'),
  msg('zero range {n} m not reached ({stop})'),
  msg('zero did not converge (miss {h} m, {w} m)'),
  msg('range {n}'),
  msg('range {n} m not reached'),
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

/** The German of `text` when it is a code or an instance of a template, else undefined. */
function translated(text: string, t: Translator['t']): string | undefined {
  if (codeSet.has(text)) return t(text as Message)
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

/**
 * A message that came from the packages, the API or the app's own request code, in the language of
 * `t`: the text of the message that `text` is an instance of, else `text` as it is.
 */
export function translateMessage(text: string, t: Translator['t']): string {
  return translated(text, t) ?? text
}
