import { readFileSync } from 'node:fs'
import {
  Command,
  CommanderError,
  Help,
  InvalidArgumentError,
  Option,
} from '@commander-js/extra-typings'
import type { Options } from './commands.ts'
import { ExpectedError, internalCode, UsageError } from './errors.ts'
import type { Grouping } from './metrics.ts'
import { compareTable, fitTable, verifyTable } from './report.ts'
import { type Split, splits } from './split.ts'

/** Where a run writes and whether stdout is a terminal. */
export interface Io {
  stdout: (text: string) => void
  stderr: (text: string) => void
  /** Whether stdout is a terminal: a table by default, else JSON. */
  tty: boolean
}

const exitCodes = `exit codes: 0 done, 1 refused run, 64 bad command line, 65 bad data, 66 missing or
unreadable input, 70 internal error`

/** The values of the options of verify, compare and fit, each command taking its own subset. */
interface Values {
  rows?: string | undefined
  records?: string[] | undefined
  split?: Split | undefined
  final?: true | undefined
  model?: string | undefined
  baseline?: string | undefined
  candidate?: string | undefined
  json?: true | undefined
  table?: true | undefined
  groupBy?: string | undefined
  params?: 'records' | 'fit-on-training' | undefined
  leaveOnePowderOut?: true | undefined
  perRow?: true | undefined
  velocitySigma?: number | undefined
  exponent?: 'family' | undefined
  pressureSigma?: number | undefined
  pressureFactor?: string | undefined
  energy?: 'prior' | 'family' | undefined
  fit?: string | undefined
  family?: string | undefined
  folds?: true | undefined
}

/** A sigma option's fraction, bad input outside (0, 1). */
function fraction(value: string) {
  const sigma = Number(value)
  if (!Number.isFinite(sigma) || sigma <= 0 || sigma >= 1)
    throw new InvalidArgumentError('It is a fraction above 0 and below 1.')
  return sigma
}

/** The options of verify, compare and fit with today's descriptions; each command adds its own. */
function rowsOptions() {
  const sigma = (flags: `--${string} <fraction>`, description: string) =>
    new Option(flags, description).argParser(fraction)
  return {
    rows: new Option(
      '--rows <path>',
      'a rows file, a folder of .csv files or - for stdin (default: BALLISTICS_ROWS); catalogue for the published loads of the records, or a folder laid out as records/loads/ (maker tables only)',
    ),
    records: new Option(
      '--records <dir>',
      'a records root, repeatable (default: BALLISTICS_RECORDS, else the repository records)',
    ).argParser((value, previous: string[] = []) => [...previous, value]),
    split: new Option('--split <name>', 'the split (default: validation)').choices(splits),
    final: new Option('--final', 'required for the test split'),
    model: new Option(
      '--model <m3|module>',
      'm3 (default), the model of the installed @rangefoundry/ballistics, or a module that exports interior(load, options?)',
    ),
    json: new Option(
      '--json',
      'output format JSON (default: JSON unless stdout is a terminal)',
    ).conflicts('table'),
    table: new Option('--table', 'output format a table (default on a terminal)'),
    groupBy: new Option(
      '--group-by <key>',
      'also group by powder, family, cartridge, bullet or construction',
    ),
    params: new Option(
      '--params <params>',
      'the powder parameters of the records (default), or the burn coefficients fitted to the training rows',
    ).choices(['records', 'fit-on-training']),
    fit: new Option(
      '--fit <fit.json>',
      'instead of --params: evaluate the values of a saved fit of the same rows and records without fitting; the result is marked as a screen with this build version and carries the fit model version',
    ),
    velocitySigma: sigma(
      '--velocity-sigma <fraction>',
      'fit and --params fit-on-training: velocity sigma of a row, a fraction of its velocity (default 0.03)',
    ),
    exponent: new Option(
      '--exponent <exponent>',
      'fit and --params fit-on-training: choose the pressure exponent per powder family and fit each burn coefficient at it',
    ).choices(['family']),
    family: new Option(
      '--family <fit.json>',
      'with --exponent family: take the family choice of a saved fit of the same rows, records, velocity sigma and build instead of making it',
    ),
    pressureSigma: sigma(
      '--pressure-sigma <fraction>',
      'fit and --params fit-on-training: fit the printed pressures too, with this sigma, a fraction of the pressure, and one factor per key',
    ),
    pressureFactor: new Option(
      '--pressure-factor <key>',
      "with --pressure-sigma: the key of a pressure factor, basis (the row's pressure basis, default), table, cartridge or table-cartridge (both)",
    ),
    energy: new Option(
      '--energy <energy>',
      "fit and --params fit-on-training: prior, each powder's energy is its prior from thermochemistry times one energy-level factor chosen on the training pressures and only the burn coefficient is fitted per powder; family, each powder's energy is fitted with its burn coefficient, under a prior on its family's median impetus (all reference powders' for a family with fewer than 5) that tightens as its used rows (below 20) or cartridges (below 4) fall",
    ).choices(['prior', 'family']),
    folds: new Option(
      '--folds',
      'cross-validate over 5 folds of the cartridges of the training and validation splits (the fold of a cartridge is its place, mod 5, in the order of the SHA-256 of 2026-11-14/<cartridge id>); each fold is scored by a fit, with the fit options, on the other four, and the result holds each fold and all folds together; the test split is not read; verify takes no --split, --params or --fit with it',
    ),
  }
}

/** Refuses an option value that is not one of the choices of the libraries, which load after the command line parses. */
function checkChoices(
  values: Values,
  choices: { groupings: readonly Grouping[]; pressureKeys: readonly string[] },
) {
  const { groupings, pressureKeys } = choices
  if (values.groupBy !== undefined && !groupings.includes(values.groupBy as Grouping))
    throw new UsageError(`--group-by is one of ${groupings.join(', ')}`)
  const key = values.pressureFactor
  if (key !== undefined && !pressureKeys.includes(key))
    throw new UsageError(`--pressure-factor is one of ${pressureKeys.join(', ')}`)
}

/** The commands that evaluate or fit on rows. */
type RowsCommand = 'verify' | 'compare' | 'fit'

/** The options of the command line, with the environment's defaults. */
function optionsOf(
  command: RowsCommand,
  values: Values,
  env: NodeJS.ProcessEnv,
  warn: Io['stderr'],
  choices: Parameters<typeof checkChoices>[1],
) {
  for (const [option, value] of [
    ['velocity-sigma', values.velocitySigma],
    ['exponent', values.exponent],
    ['pressure-sigma', values.pressureSigma],
    ['pressure-factor', values.pressureFactor],
    ['energy', values.energy],
    ['family', values.family],
  ] as const)
    if (
      command !== 'fit' &&
      value !== undefined &&
      values.params !== 'fit-on-training' &&
      !values.folds
    )
      throw new UsageError(`--${option} is for fit, --params fit-on-training and --folds`)
  if (values.fit !== undefined && values.params !== undefined)
    throw new UsageError('--fit and --params exclude each other')
  const rows = values.rows ?? env.BALLISTICS_ROWS
  if (!rows) throw new UsageError('give --rows <path> or set BALLISTICS_ROWS')
  if (values.folds && values.split !== undefined)
    throw new UsageError('--folds reads the training and validation splits and takes no --split')
  checkChoices(values, choices)
  const fromEnv = env.BALLISTICS_RECORDS?.split(':').filter(Boolean) ?? []
  const options: Options = {
    rows,
    records: values.records ?? fromEnv,
    split: values.split ?? 'validation',
    final: values.final === true,
    leaveOnePowderOut: values.leaveOnePowderOut === true,
    perRow: values.perRow === true,
    warn,
    ...(values.groupBy !== undefined && { groupBy: values.groupBy as Grouping }),
    params: values.params,
    velocitySigma: values.velocitySigma,
    exponent: values.exponent,
    pressureSigma: values.pressureSigma,
    pressureFactor: values.pressureFactor as Options['pressureFactor'],
    energy: values.energy,
    fit: values.fit,
    family: values.family,
    folds: values.folds === true,
  }
  return options
}

/** Runs `command` with its options and returns the text of the result. */
async function execute(command: RowsCommand, values: Values, env: NodeJS.ProcessEnv, io: Io) {
  // the libraries load after --help and --version have answered
  const [{ compare, fit, verify }, { groupings }, { pressureKeys }] = await Promise.all([
    import('./commands.ts'),
    import('./metrics.ts'),
    import('./fit.ts'),
  ])
  const options = optionsOf(command, values, env, io.stderr, { groupings, pressureKeys })
  const json = values.json === true || (values.table !== true && !io.tty)
  if (command === 'fit') {
    const result = await fit(options, values.model)
    return json ? JSON.stringify(result, null, 2) : fitTable(result)
  }
  if (command === 'verify') {
    const result = await verify(options, values.model)
    return json ? JSON.stringify(result, null, 2) : verifyTable(result)
  }
  if (!values.baseline || !values.candidate)
    throw new UsageError('compare needs --baseline and --candidate')
  const result = await compare(options, values.baseline, values.candidate)
  return json ? JSON.stringify(result, null, 2) : compareTable(result)
}

/** Ends a parse error of `command` as bad usage followed by its help; help and version end the run with 0. */
function usageError(command: { helpInformation: () => string }) {
  return (error: CommanderError): never => {
    if (error.exitCode === 0) throw error
    const help = command.helpInformation().trimEnd()
    if (error.code === 'commander.help') throw new UsageError(help)
    // commander starts its messages with "error: ", which the stderr line already says by its kind
    const message = error.message.replace(/^error: (.)/, (_, first: string) => first.toUpperCase())
    throw new UsageError(`${message}\n\n${help}`)
  }
}

/** The command line of one run, writing help and version to stdout and each result through `io`. */
function program(env: NodeJS.ProcessEnv, io: Io) {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const roots = (records: string[] | undefined) =>
    records ?? env.BALLISTICS_RECORDS?.split(':').filter(Boolean) ?? []
  const root = new Command('ballistics')
    .description(
      'Measures how far the interior model is from printed load rows it was not fitted to, says whether a changed model got better, and runs the compute operations of the REST API offline. Results are simulations compared with printed values, never load data.',
    )
    .configureOutput({ writeOut: io.stdout, writeErr: () => {} })
    .configureHelp({
      styleTitle: (title) => title.toLowerCase(),
      // operations sets a blank usage, as commander replaces an empty one with its own
      commandUsage(command) {
        return Help.prototype.commandUsage.call(this, command).trimEnd()
      },
    })
    .helpOption('-h, --help', 'this text')
    .helpCommand(false)
    .version(`ballistics ${version}`, '--version', 'the version')
    .addHelpText('afterAll', `\n${exitCodes}`)
  root.exitOverride(usageError(root))
  const o = rowsOptions()

  const verify = root
    .command('verify')
    .summary('evaluate one model on a split of the rows')
    .usage('--rows <path> [--model m3|<module>] [options]')
    .addOption(o.rows)
    .addOption(o.model)
    .addOption(o.records)
    .addOption(o.split)
    .addOption(o.final)
    .addOption(o.groupBy)
    .option('--leave-one-powder-out', 'add the line of the powder not in the fitted set')
    .option(
      '--per-row',
      'add the error of each used row, which a compare against this result as --baseline pairs (in the JSON, not the table)',
    )
    .addOption(o.params)
    .addOption(o.fit)
    .addOption(o.velocitySigma)
    .addOption(o.exponent)
    .addOption(o.family)
    .addOption(o.pressureSigma)
    .addOption(o.pressureFactor)
    .addOption(o.energy)
    .addOption(o.folds)
    .addOption(o.json)
    .addOption(o.table)
    .action(async (values) => io.stdout(`${await execute('verify', values, env, io)}\n`))
  verify.exitOverride(usageError(verify))

  const compare = root
    .command('compare')
    .summary('compare a candidate model with a baseline on the same rows and split')
    .usage('--rows <path> --baseline <m3|module|verify.json> --candidate <m3|module> [options]')
    .addOption(o.rows)
    .option('--baseline <m3|module|verify.json>', 'm3, a module or a saved verify result')
    .option('--candidate <m3|module>', 'm3 or a module')
    .addOption(o.records)
    .addOption(o.split)
    .addOption(o.final)
    .addOption(o.groupBy)
    .addOption(o.params)
    .addOption(o.fit)
    .addOption(o.velocitySigma)
    .addOption(o.exponent)
    .addOption(o.family)
    .addOption(o.pressureSigma)
    .addOption(o.pressureFactor)
    .addOption(o.energy)
    .addOption(o.json)
    .addOption(o.table)
    .action(async (values) => io.stdout(`${await execute('compare', values, env, io)}\n`))
  compare.exitOverride(usageError(compare))

  const fit = root
    .command('fit')
    .summary('fit the burn coefficient of each powder the rows name')
    .usage('--rows <path> [--model m3|<module>] [options]')
    .addOption(o.rows)
    .addOption(o.model)
    .addOption(o.records)
    .addOption(o.velocitySigma)
    .addOption(o.exponent)
    .addOption(o.family)
    .addOption(o.pressureSigma)
    .addOption(o.pressureFactor)
    .addOption(o.energy)
    .addOption(o.folds)
    .addOption(o.json)
    .addOption(o.table)
    .action(async (values) => io.stdout(`${await execute('fit', values, env, io)}\n`))
  fit.exitOverride(usageError(fit))

  const run = root
    .command('run')
    .summary('run one compute operation offline')
    .description(
      'Runs one compute operation offline and writes its answer as JSON: the answer of the route POST /v1/<operation> to the body in the --input file (- for stdin). Record ids resolve against --records (repeatable, default BALLISTICS_RECORDS, else the repository records). A body the schema rejects is bad data (exit 65), a 422 answer a refusal (exit 1).',
    )
    .usage('<operation> --input <file|-> [--records <dir>]')
    .argument('<operation>')
    .requiredOption('--input <file|->', 'the body, - for stdin')
    .addOption(o.records)
    .option('--json', 'output format JSON, the only one')
    .addHelpText(
      'after',
      '\nexample:\n  node apps/cli/dist/bin.js run interior --input apps/cli/examples/interior.json',
    )
    .action(async (name, values) => {
      const { runOperation } = await import('./operations.ts')
      const answer = await runOperation(name, values.input, roots(values.records), io.stderr)
      io.stdout(`${JSON.stringify(answer, null, 2)}\n`)
    })
  run.exitOverride(usageError(run))

  const estimate = root
    .command('estimate-capacities')
    .summary('write an estimated capacity record for each cartridge with a case outline only')
    .description(
      'Writes a capacity record (provenance kind derived) for each cartridge of the records that has a case outline and neither a capacity nor a case with one, to <dir>/capacities/, a folder that must not exist yet: the outline volume times the median of capacity over outline volume of the cartridges with a capacity record. Pass <dir> as one more --records root: verify and compare report its rows as estimatedCapacity, apart from the other rows, and fit does not read them. Writes the fill factor, its cartridges, its leave-one-out error and the count as JSON.',
    )
    .usage('--out <dir> [--records <dir>]')
    .option('--out <dir>', 'the folder to write capacities/ into')
    .addOption(o.records)
    .addHelpText(
      'after',
      '\nexample:\n  node apps/cli/dist/bin.js estimate-capacities --out /tmp/estimates',
    )
    .action(async (values) => {
      // checked here, not as a required option, so that an unknown option is named first
      if (values.out === undefined)
        return estimate.error("error: required option '--out <dir>' not specified")
      const { writeEstimatedCapacities } = await import('./capacity.ts')
      const summary = await writeEstimatedCapacities(roots(values.records), values.out)
      io.stdout(`${JSON.stringify(summary, null, 2)}\n`)
    })
  estimate.exitOverride(usageError(estimate))

  const operations = root
    .command('operations')
    .summary('list every operation of run')
    .description(
      'Writes every operation of run as JSON: its name, summary, description, and the JSON Schema (2020-12) of its input body and of its answer.',
    )
    .usage(' ')
    .option('--json', 'output format JSON, the only one')
    .addHelpText('after', '\nexample:\n  node apps/cli/dist/bin.js operations')
    .action(async () => {
      const { listOperations } = await import('./operations.ts')
      io.stdout(`${JSON.stringify(listOperations(), null, 2)}\n`)
    })
  operations.exitOverride(usageError(operations))

  return root
}

/** The kind, exit code and message of an error a run ends with. */
function failure(error: unknown): {
  kind: ExpectedError['kind'] | 'internal'
  code: number
  message: string
  details?: Record<string, unknown> | undefined
} {
  if (error instanceof ExpectedError)
    return { kind: error.kind, code: error.code, message: error.message, details: error.details }
  return {
    kind: 'internal',
    code: internalCode,
    message: error instanceof Error ? error.message : String(error),
  }
}

/** One JSON object for `--json` or a script, the text line on a terminal, never a stack trace; returns the exit code. */
export function report(error: unknown, argv: string[], io: Io): number {
  const { kind, code, message, details } = failure(error)
  const json = argv.includes('--json') || !io.tty
  if (json) io.stderr(`${JSON.stringify({ error: { kind, message, ...details } })}\n`)
  else if (kind === 'refused') io.stderr(`refused: ${message}\n`)
  else if (kind === 'internal') io.stderr(`error: ${message}\n`.replace(/\n(?!$)/g, ' '))
  else io.stderr(`${message}\n`)
  return code
}

/** Refuses a separate option value that starts with `-` (not `-` alone), so an option missing its value never takes the next option; help and version there still answer. */
function checkOptionLikeValues(root: ReturnType<typeof program>, argv: string[]) {
  const command = root.commands.find((c) => c.name() === argv[0])
  if (command === undefined) return argv
  const takesValue = new Set(
    command.options.filter((o) => o.required || o.optional).map((o) => o.long),
  )
  for (const [i, word] of argv.entries()) {
    if (word === '--') break
    const value = argv[i + 1]
    if (!takesValue.has(word) || value === undefined || value.length < 2 || !value.startsWith('-'))
      continue
    if (value === '--help' || value === '-h' || value === '--version')
      return argv.filter((_, j) => j !== i)
    throw new UsageError(
      `Option '${word}' argument is ambiguous.\nDid you forget to specify the option argument for '${word}'?\nTo specify an option argument starting with a dash use '${word}=-XYZ'.\n\n${command.helpInformation().trimEnd()}`,
    )
  }
  return argv
}

/** Runs the command line `argv` (without the program), writes the result and returns the exit code. */
export async function run(argv: string[], env: NodeJS.ProcessEnv, io: Io): Promise<number> {
  try {
    const root = program(env, io)
    await root.parseAsync(checkOptionLikeValues(root, argv), { from: 'user' })
    return 0
  } catch (error) {
    // commander ends help and version by throwing with exit code 0
    if (error instanceof CommanderError && error.exitCode === 0) return 0
    return report(error, argv, io)
  }
}
