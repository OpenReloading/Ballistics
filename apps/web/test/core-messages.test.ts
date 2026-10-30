import { readdirSync, readFileSync } from 'node:fs'
import { buildOpenApi } from '@open-reloading/api/openapi'
import { advisoryRules } from '@open-reloading/core'
import { pressureMethod } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { limitCheck, type Warning } from '../../../packages/api/dist/compute/limits.js'
import { missingValuesAnswer } from '../../../packages/api/dist/compute/load-file.js'
import de from '../src/i18n/de.json'
import { type Catalogue, english, translator } from '../src/i18n/translate.ts'
import {
  installCoreMessages,
  messageTexts,
  type WarningCode,
  warningMessages,
} from '../src/lib/core-message-table.ts'
import { translateMessage } from '../src/lib/core-messages.ts'
import { linkReasonText, readLink, shareLink } from '../src/lib/share-link.ts'
import { parseUserDataFile, reasonText, userDataText } from '../src/lib/user-data.ts'

installCoreMessages()

const german = translator(de as Catalogue, 'de')
/** Every message text mapped to a marker: a message shows the marker only if a template matched it. */
const marker = translator(Object.fromEntries(messageTexts.map((m) => [m, 'MAPPED'])), 'de')

const byText = (a: string, b: string) => a.localeCompare(b)

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never

const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort((a, b) => a.localeCompare(b))

describe('the message table', () => {
  it('has a German text with the placeholders of the English one for every message', () => {
    for (const text of messageTexts) {
      const entry = (de as Record<string, unknown>)[text]
      expect(typeof entry, text).toBe('string')
      expect(placeholders(entry as string), text).toEqual(placeholders(text))
      expect(entry, text).not.toBe(text)
    }
  })

  it('leaves a text that no message matches as it is', () => {
    for (const text of ['Hello', 'The cartridge is fine.', '', 'range']) {
      expect(translateMessage(text, german.t)).toBe(text)
    }
  })

  it('refuses a file and a share link of 1000 invalid records quickly, naming the first problems', async () => {
    const records = Array.from({ length: 1000 }, () => ({})) as never
    const file = parseUserDataFile(userDataText(records))
    const link = await readLink(
      new URL((await shareLink(records, 'https://example.org/workbench')) as string).hash,
    )
    for (const [read, shown] of [
      [file, reasonText],
      [link, linkReasonText],
    ] as const) {
      if (read?.ok !== false) throw new Error('not refused')
      expect(read.reason).toMatch(/\nand 997 more problems$/)
      const start = performance.now()
      shown(read.reason, german.t)
      // guards against polynomial backtracking, which takes seconds; a loaded runner stalls past a tight bound
      expect(performance.now() - start).toBeLessThan(5000)
    }
  })

  it('leaves a long text as it is without matching it', () => {
    const text = 'x'.repeat(200_000)
    const start = performance.now()
    expect(translateMessage(text, german.t)).toBe(text)
    // guards against polynomial backtracking, which takes seconds; a loaded runner stalls past a tight bound
    expect(performance.now() - start).toBeLessThan(5000)
  })

  it('prefers the most specific template', () => {
    expect(translateMessage('range must be positive', german.t)).toBe(
      'Die Entfernung muss positiv sein',
    )
    expect(translateMessage('qx range', german.t)).toBe('Entfernung (qx) ungültig')
    expect(translateMessage('range 12', german.t)).toBe('Entfernung 12 ungültig')
    expect(translateMessage('prior qx must be positive', german.t)).toBe(
      'prior qx muss positiv sein',
    )
  })

  it('fills the values: a code or a message inside a message, a list, a label, a number', () => {
    expect(translateMessage('interior: stuck', german.t)).toBe(
      'Innenballistik: Geschoss bleibt im Lauf stecken',
    )
    expect(translateMessage('truing: unreachable (range 500 m not reached)', german.t)).toBe(
      'Truing: nicht erreichbar (Entfernung 500 m nicht erreicht)',
    )
    expect(translateMessage('zero range 5 m not reached (apex)', german.t)).toBe(
      'Einschießentfernung 5 m nicht erreicht (Scheitelpunkt)',
    )
    expect(translateMessage('Enter a number for Qx label.', german.t)).toBe(
      'Geben Sie eine Zahl für Qx label ein.',
    )
    // a value that is a label of the catalogue is shown in German
    expect(translateMessage('Enter a number for Pressure.', german.t)).toBe(
      `Geben Sie eine Zahl für ${german.t('Pressure')} ein.`,
    )
    expect(translateMessage('ladder charge 0.0025 kg must be above 0', german.t)).toBe(
      'Die Treibladung 0,0025 kg des Ladeleiters muss größer als 0 sein',
    )
    expect(translateMessage('bullet 6.5 Creedmoor has no length', german.t)).toBe(
      'Geschoss 6.5 Creedmoor hat keine Länge',
    )
  })

  it('gives English text back unchanged under the English translator', () => {
    for (const text of ['interior: stuck', 'ladder charge 0.0025 kg must be above 0', 'busy']) {
      expect(translateMessage(text, english.t)).toBe(text)
    }
  })
})

describe('reason codes', () => {
  /** The members of the string union `name` of a core source file. */
  const union = (file: string, name: string) => {
    const source = readFileSync(
      new URL(`../../../packages/core/src/${file}`, import.meta.url),
      'utf8',
    )
    const start = source.indexOf(`type ${name} =`)
    expect(start, `${file}: ${name}`).toBeGreaterThan(-1)
    const body = source.slice(start, source.indexOf('\n\n', start))
    return [...body.matchAll(/'([\w-]+)'/g)].map((m) => m[1] ?? '')
  }

  const reasons = [
    ...union('exterior/truing.ts', 'TruingReason'),
    ...union('interior/model.ts', 'InteriorReason'),
    ...union('interior/charge-solver.ts', 'ChargeRefusal'),
    ...union('interior/fit.ts', 'PowderFitReason'),
    ...union('exterior/range-strings.ts', 'WeakReason'),
    // set where the reason is not a union: a range case, the API's 422 and 503 answers
    'outsideModel',
    'nonFinite',
    'outputTooLarge',
    'missingValues',
    'timeout',
    'busy',
    // the reason of a limit that is not compared: no value, or the measuring method
    'noValue',
    ...pressureMethod.options,
    // where a zero search stopped
    'apex',
    'atmosphere',
    'maxTime',
    'yaw',
    'done',
  ]

  it('reads the unions of the sources', () => {
    expect(union('exterior/truing.ts', 'TruingReason')).toContain('step-budget')
    expect(union('interior/charge-solver.ts', 'ChargeRefusal')).toContain('toleranceNotReached')
    expect(union('interior/model.ts', 'InteriorReason')).toEqual([
      'input',
      'chamberVolume',
      'noShotStart',
      'stuck',
      'integration',
      'maxTime',
    ])
  })

  it('has a German text for each reason', () => {
    for (const reason of new Set(reasons)) {
      expect(translateMessage(reason, marker.t), reason).toBe('MAPPED')
      expect(translateMessage(reason, german.t), reason).not.toBe(reason)
    }
  })
})

describe('the warnings of an interior answer', () => {
  it('has a message for every code the API lists', async () => {
    const doc = JSON.stringify(await buildOpenApi())
    const found = /"enum":\[("limitExceeded"[^\]]*)\]/.exec(doc)?.[1]
    const codes = (found ?? '').split(',').map((c) => JSON.parse(c) as string)
    expect(codes.length).toBeGreaterThan(5)
    expect(Object.keys(warningMessages).sort(byText)).toEqual([...codes].sort(byText))
    // the code table has the type of the API's codes
    const same: Equal<WarningCode, Warning['code']> = true
    expect(same).toBe(true)
  })

  const range = (cases: { maxPressure: number | null; reason?: string }[]) =>
    ({
      quantity: 'maxPressure',
      nominalPressure: 4.2e8,
      lowPressure: 3.9e8,
      highPressure: 4.4e8,
      complete: cases.every((c) => c.maxPressure !== null),
      tolerances: {},
      cases: cases.map((c) => ({ input: 'charge', side: 1, ...c })),
    }) as unknown as Parameters<typeof limitCheck>[0]
  const sheet = (method: 'transducer' | 'crusher', value: number) =>
    ({
      id: 'test-cartridge',
      name: 'Test Cartridge 6.5',
      published: '2020-01-01',
      revised: '2021-02-03',
      pressureMethod: method,
      provenance: { kind: 'published', sources: [{ title: 'Test sheet' }] },
      values: [{ symbol: 'Pmax', value }],
    }) as unknown as NonNullable<Parameters<typeof limitCheck>[1]>
  const done = [{ maxPressure: 4e8 }]
  const small = (startPressure: number, ignitionPressure: number) => ({
    result: { maxMeanPressure: 1e6 },
    load: {
      startPressure,
      ignitionPressure,
      barrel: { length: 0.6, twist: 0.3 },
      bullet: { mass: 0.01 },
    },
  })

  /** The warnings the API writes, from its own limit check. */
  const produced: Warning[] = [
    ...limitCheck(range(done), undefined).warnings,
    ...limitCheck(range(done), sheet('crusher', 3800)).warnings,
    // the nominal pressure above the limit, then only the upper end of the range
    ...limitCheck(range(done), sheet('transducer', 3800)).warnings,
    ...limitCheck(range(done), sheet('transducer', 4300)).warnings,
    ...limitCheck(
      range([
        { maxPressure: null, reason: 'input' },
        { maxPressure: null, reason: 'maxTime' },
      ]),
      sheet('transducer', 9000),
    ).warnings,
    ...limitCheck(range(done), sheet('transducer', 9000), small(1e7, 1e6)).warnings,
    ...limitCheck(range(done), sheet('transducer', 9000), small(1e6, 1e7)).warnings,
  ]
  // the load file route writes these with the words of the workbench's own check
  const fromLoadFile = [
    'Simulation: the parameters of Example Fitted were fitted with a bore-resistance law this run cannot apply (missing: boreFriction, engravingPressure); the results are biased.',
    'Simulation: load ratio 1.76 is above 1.71, solid fill 0.64 for this powder; the model is outside the range it was built for.',
    'Simulation: solid fill 0.66 is above 0.64; the model is outside the range it was built for.',
  ]

  it('gives the answer of a load file that lacks values a German sentence', () => {
    const values = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, 1]))
    const all = missingValuesAnswer({}, [])?.payload.missing.map((m) => m.key) ?? []
    expect(all.length).toBeGreaterThan(2)
    for (const keys of [all, all.slice(1)]) {
      const message = missingValuesAnswer(values(all.filter((k) => !keys.includes(k))), [])?.payload
        .message
      expect(translateMessage(message ?? '', marker.t), message).toBe('MAPPED')
      expect(translateMessage(message ?? '', english.t)).toBe(message)
    }
    const one = missingValuesAnswer(values(all.slice(1)), [])?.payload.message ?? ''
    expect(one).toMatch(/lacks 1 value:/)
    expect(translateMessage(one, german.t)).toMatch(/^In der Datei der Laborierung fehlt 1 Wert: /)
  })

  it('writes the load ratio warning with the words of the API', () => {
    // the warning of a load file run is built inside a function that needs a catalogue: its words are read from the source
    const source = readFileSync(
      new URL('../../../packages/api/src/compute/simulate.ts', import.meta.url),
      'utf8',
    )
    expect(source).toContain(`solid fill \${fill.toFixed(2)} is above \${solidFillLimit}`)
    expect(source).toContain(
      `load ratio \${ratio.toFixed(2)} is above \${fillLoadRatioLimit(density, bulkDensity).toFixed(2)}, solid fill \${solidFillLimit} for this powder`,
    )
    expect(source).toContain('; the model is outside the range it was built for.')
    expect(source).toContain('advisoryRule.loadRatioHigh')
  })

  it('names every rule of the registry in German', () => {
    for (const { name } of advisoryRules) {
      expect(translateMessage(name, marker.t), name).toBe('MAPPED')
      expect(translateMessage(name, german.t), name).not.toBe(name)
    }
  })

  it('produces the codes of the limit check', () => {
    const count = (code: WarningCode) => produced.filter((w) => w.code === code).length
    expect(count('noCartridge')).toBe(1)
    expect(count('noComparableLimit')).toBe(1)
    expect(count('limitExceeded')).toBe(2)
    expect(count('rangeIncomplete')).toBe(1)
    expect(count('chargeTooSmall')).toBe(2)
  })

  it('gives each message of the API a German sentence and keeps English as it is', () => {
    for (const text of [...produced.map((w) => w.message), ...fromLoadFile]) {
      expect(translateMessage(text, marker.t), text).toBe('MAPPED')
      expect(translateMessage(text, english.t), text).toBe(text)
      const shown = translateMessage(text, german.t)
      expect(shown, text).not.toBe(text)
      expect(shown, text).not.toMatch(/[{}]/)
    }
  })

  it('writes the numbers of a message with the decimal mark of the language', () => {
    const message = (code: WarningCode) => produced.find((w) => w.code === code)?.message ?? ''
    expect(translateMessage(message('chargeTooSmall'), german.t)).toContain('unter dem 2,2-Fachen')
    expect(translateMessage(fromLoadFile[2] ?? '', german.t)).toBe(
      'Simulation: Der Feststoff-Füllgrad 0,66 liegt über 0,64; das Modell liegt außerhalb des Bereichs, für den es gebaut wurde.',
    )
    expect(translateMessage(message('noComparableLimit'), german.t)).toMatch(
      /^Test Cartridge 6\.5 hat kein CIP-Pmax/,
    )
  })
})

describe('the request failures of the app', () => {
  const sentences = [
    'The model refused the load. The error panel gives the reason.',
    'A data file did not load or the computation failed. Check the connection and retry.',
    'The run passed the time limit.',
    'The lot rows did not answer in 20 s.',
    'The longer run did not answer in 20 s.',
    'Error 404.',
    'simulation, not load data',
    'request does not match the schema',
    'no compute worker could be started',
    'all compute workers are busy',
    'computation did not finish within 15000 ms',
    'internal server error',
  ]

  it('has a German text for each sentence', () => {
    for (const text of sentences) {
      expect(translateMessage(text, marker.t), text).toBe('MAPPED')
      expect(translateMessage(text, german.t), text).not.toBe(text)
      expect(translateMessage(text, english.t), text).toBe(text)
    }
  })

  it('writes the status into the sentence', () => {
    expect(translateMessage('Error 503.', german.t)).toBe('Fehler 503.')
  })
})

/** The package sources whose messages can reach the app through the API. */
const sources = (['core', 'api'] as const).flatMap((pkg) =>
  readdirSync(new URL(`../../../packages/${pkg}/src`, import.meta.url), {
    recursive: true,
    encoding: 'utf8',
  })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => `${pkg}/src/${f}`),
)

/** Files whose messages are no fixed text, each with the reason. */
const dynamicFiles: Record<string, string> = {
  'core/src/errors.ts': 'the definition of `need` and `InputError`: the message is the argument',
  'api/src/compute/tasks.ts': 'passes the message of another error on',
}

/** Message expressions that are no fixed text, by file and expression, each with the reason. */
const dynamicArguments: { file: string; arg: string; reason: string }[] = [
  {
    file: 'core/src/exterior/trajectory.ts',
    arg: 'name',
    reason: 'a coefficient named by the caller: its name is the text',
  },
  {
    file: 'core/src/interior/load-file.ts',
    arg: "key === 'engravingLength' ? 'Must be above 0.' : 'Must be at least 0.'",
    reason: 'a choice of two sentences: each has its own template',
  },
  {
    file: 'core/src/interior/load-file.ts',
    arg: 'needed',
    reason: 'the sentence is a variable with its own template',
  },
  {
    file: 'api/src/compute/limits.ts',
    arg: 'exceededMessage(l, range)',
    reason: 'the exceeded-limit message: tested above',
  },
  {
    file: 'api/src/compute/load-file.ts',
    arg: 'problem',
    reason: 'the text comes from the schema package',
  },
  {
    file: 'api/src/compute/load-file.ts',
    arg: 'legacyLoadProblem',
    reason: 'the text comes from the schema package',
  },
  {
    file: 'api/src/compute/load-file.ts',
    arg: 'error.message',
    reason: 'the text of a `ValueError`: has its own template',
  },
]

/** Messages built from parts that a sample value cannot stand for: the tests of the warnings cover them. */
const compound: { file: string; text: string }[] = [
  { file: 'api/src/compute/limits.ts', text: 'the simulated peak mean pressure' },
  { file: 'api/src/compute/simulate.ts', text: 'the model is outside the range it was built for' },
  { file: 'api/src/compute/load-file.ts', text: 'The load file lacks' },
]

/** The end of the string or template literal that starts at `j`, `${}` parts skipped. */
function skipText(src: string, j: number): number {
  const quote = src[j]
  let k = j + 1
  if (quote !== '`') {
    while (src[k] !== quote) k += src[k] === '\\' ? 2 : 1
    return k + 1
  }
  while (src[k] !== '`') {
    if (src[k] === '\\') k += 2
    else if (src[k] === '$' && src[k + 1] === '{') k = skipBraces(src, k + 2)
    else k++
  }
  return k + 1
}

/** The index after the `}` that closes a `${` whose body starts at `k`. */
function skipBraces(src: string, from: number): number {
  let k = from
  let depth = 1
  while (depth > 0) {
    const c = src[k]
    if (c === '`' || c === "'" || c === '"') {
      k = skipText(src, k)
      continue
    }
    if (c === '{') depth++
    else if (c === '}') depth--
    k++
  }
  return k
}

/** The top level arguments of the call whose arguments start at `from`. */
function callArguments(src: string, from: number): string[] {
  const args: string[] = []
  let depth = 0
  let start = from
  let j = from
  for (; j < src.length; j++) {
    const c = src[j] ?? ''
    if (c === "'" || c === '"' || c === '`') j = skipText(src, j) - 1
    else if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) {
      if (depth === 0) break
      depth--
    } else if (c === ',' && depth === 0) {
      args.push(src.slice(start, j).trim())
      start = j + 1
    }
  }
  args.push(src.slice(start, j).trim())
  return args.filter(Boolean)
}

/** The text of a string or template literal with `sample` for each `${...}`; undefined for any other expression. */
function literalText(arg: string, sample: string): string | undefined {
  const quote = arg[0]
  if (!quote || !'\'"`'.includes(quote) || skipText(arg, 0) !== arg.length) return
  let out = ''
  for (let k = 1; k < arg.length - 1; k++) {
    if (arg[k] === '\\') out += arg[++k]
    else if (quote === '`' && arg[k] === '$' && arg[k + 1] === '{') {
      k = skipBraces(arg, k + 2) - 1
      out += sample
    } else out += arg[k]
  }
  return out
}

const calls =
  /\b(?:need|new InputError|new ValueError|new ComputeTimeout|new ComputeBusy|issue)\(|\bmessage: (?=['"`])/g

interface Found {
  where: string
  text: string
}

/** The message of the call that `match` found in `src`: the second argument of `need`, `ValueError` and `issue`, else the first. */
function messageOf(src: string, match: RegExpMatchArray): string | undefined {
  const args = callArguments(src, (match.index ?? 0) + match[0].length)
  return /^(?:need|new ValueError|issue)\(/.test(match[0]) ? args[1] : args[0]
}

/** The messages of every source, with `sample` for each value; a message that is no fixed text is marked. */
function scan(sample: string): Found[] {
  const found: Found[] = []
  for (const file of sources) {
    const src = readFileSync(new URL(`../../../packages/${file}`, import.meta.url), 'utf8')
    for (const match of src.matchAll(calls)) {
      const where = `${file}:${src.slice(0, match.index).split('\n').length}`
      const arg = messageOf(src, match)
      const text = arg === undefined ? undefined : literalText(arg, sample)
      if (text !== undefined) found.push({ where, text })
      else if (
        !(file in dynamicFiles || dynamicArguments.some((d) => d.file === file && d.arg === arg))
      )
        found.push({ where, text: `<not a fixed text> ${arg ?? ''}` })
    }
  }
  return found.filter(
    (f) => !compound.some((c) => f.where.startsWith(c.file) && f.text.includes(c.text)),
  )
}

const unmapped = (sample: string) =>
  scan(sample)
    .filter((f) => translateMessage(f.text, marker.t) !== 'MAPPED')
    .map((f) => `${f.where}: ${f.text}`)

describe('the messages of the packages', () => {
  it('reads the sources', () => {
    const texts = scan('7').map((f) => f.text)
    expect(texts.length).toBeGreaterThan(200)
    expect(texts).toContain('Firearm mass must be positive.')
    expect(texts).toContain('ladder charge 7 kg must be above 0')
    expect(texts).toContain('Unknown field')
  })

  it('maps every message of core and the API', () => {
    expect(unmapped('7')).toEqual([])
  })

  it('maps a message whatever its values are', () => {
    for (const sample of ['0.5', 'a-b', '1e-9', 'x (y)'])
      expect(unmapped(sample), sample).toEqual([])
  })

  it('keeps every message as it is in English', () => {
    for (const f of scan('0.5')) expect(translateMessage(f.text, english.t), f.where).toBe(f.text)
  })

  it('has a German text that differs from the English for every message', () => {
    const same = scan('7')
      .filter((f) => translateMessage(f.text, german.t) === f.text)
      .map((f) => `${f.where}: ${f.text}`)
    expect(same).toEqual([])
  })
})
