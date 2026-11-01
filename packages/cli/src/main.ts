import { readFileSync } from 'node:fs'
import { type ParseArgsConfig, parseArgs } from 'node:util'
import type { Options } from './commands.ts'
import { Refusal, UsageError } from './errors.ts'
import type { Grouping } from './metrics.ts'
import { compareTable, verifyTable } from './report.ts'
import { type Split, splits } from './split.ts'

/** Where a run writes and whether stdout is a terminal. */
export interface Io {
  stdout: (text: string) => void
  stderr: (text: string) => void
  /** Whether stdout is a terminal: a table by default, else JSON. */
  tty: boolean
}

const usage = `usage:
  ballistics verify  --rows <path> [--model m3|<module>] [options]
  ballistics compare --rows <path> --baseline <m3|module|verify.json> --candidate <m3|module> [options]
  ballistics run <operation> --input <file|-> [--records <dir>]
  ballistics operations
  ballistics --help | --version

options:
  --rows <path>      a rows file, a folder of .csv files or - for stdin (default: BALLISTICS_ROWS);
                     catalogue for the published loads of the records, or a folder
                     laid out as records/loads/ (maker tables only)
  --records <dir>    a records root, repeatable (default: BALLISTICS_RECORDS, else the repository records)
  --split <name>     validation (default), training or test
  --final            required for the test split
  --group-by <key>   also group by powder, family, cartridge, bullet or construction
  --leave-one-powder-out
                     verify: add the line of the powder not in the fitted set
  --params records   the powder parameters of the records (the only mode so far)
  --json | --table   output format (default: JSON unless stdout is a terminal)
  -h, --help         this text
  --version          the version

exit codes: 0 done, 1 refused run, 2 bad input, 3 internal error`

/** The help of `run` and `operations`, each with an example that runs from the repository root. */
const commandHelp = {
  run: `usage: ballistics run <operation> --input <file|-> [--records <dir>]

Runs one compute operation offline and writes its answer as JSON: the answer of the
route POST /v1/<operation> to the body in the --input file (- for stdin). Record ids
resolve against --records (repeatable, default BALLISTICS_RECORDS, else the repository
records). A body the schema rejects is bad input (exit 2), a 422 answer a refusal (exit 1).

example:
  node packages/cli/dist/bin.js run interior --input packages/cli/examples/interior.json`,
  operations: `usage: ballistics operations

Writes every operation of run as JSON: its name, summary, description, and the JSON Schema
(2020-12) of its input body and of its answer.

example:
  node packages/cli/dist/bin.js operations`,
}

/** Parses a command line, an unknown or malformed option is bad input with `help`. */
function parse<T extends ParseArgsConfig>(config: T, help = usage) {
  try {
    return parseArgs(config)
  } catch (error) {
    // parseArgs reports an unknown or malformed option as a TypeError with a code
    if (error instanceof TypeError && 'code' in error)
      throw new UsageError(`${error.message}\n\n${help}`)
    throw error
  }
}

/** Refuses an option value that is not one of its choices. */
function checkChoices(
  values: { json?: boolean | undefined; table?: boolean | undefined; params?: string | undefined },
  split: string,
  by: string | undefined,
  groupings: readonly Grouping[],
) {
  if (!splits.includes(split as Split))
    throw new UsageError(`--split is one of ${splits.join(', ')}`)
  if (values.json && values.table) throw new UsageError('--json and --table exclude each other')
  if (by !== undefined && !groupings.includes(by as Grouping))
    throw new UsageError(`--group-by is one of ${groupings.join(', ')}`)
  if (values.params === 'fit-on-training')
    throw new UsageError('--params fit-on-training is not available yet: only --params records')
  if (values.params !== undefined && values.params !== 'records')
    throw new UsageError('--params is records')
}

/** The options of the command line, with the environment's defaults. */
function optionsOf(
  command: 'verify' | 'compare',
  args: string[],
  env: NodeJS.ProcessEnv,
  warn: Io['stderr'],
  groupings: readonly Grouping[],
) {
  const { values } = parse({
    args,
    strict: true,
    options: {
      rows: { type: 'string' },
      records: { type: 'string', multiple: true },
      split: { type: 'string' },
      final: { type: 'boolean' },
      model: { type: 'string' },
      baseline: { type: 'string' },
      candidate: { type: 'string' },
      json: { type: 'boolean' },
      table: { type: 'boolean' },
      'group-by': { type: 'string' },
      params: { type: 'string' },
      'leave-one-powder-out': { type: 'boolean' },
    },
  })
  const foreign =
    command === 'verify'
      ? (['baseline', 'candidate'] as const).filter((o) => values[o] !== undefined)
      : (['model', 'leave-one-powder-out'] as const).filter((o) => values[o] !== undefined)
  if (foreign.length > 0) throw new UsageError(`${command} takes no --${foreign.join(' or --')}`)
  const rows = values.rows ?? env.BALLISTICS_ROWS
  if (!rows) throw new UsageError('give --rows <path> or set BALLISTICS_ROWS')
  const split = values.split ?? 'validation'
  const by = values['group-by']
  checkChoices(values, split, by, groupings)
  const fromEnv = env.BALLISTICS_RECORDS?.split(':').filter(Boolean) ?? []
  const options: Options = {
    rows,
    records: values.records ?? fromEnv,
    split: split as Split,
    final: values.final === true,
    leaveOnePowderOut: values['leave-one-powder-out'] === true,
    warn,
    ...(by !== undefined && { groupBy: by as Grouping }),
  }
  return { options, values }
}

/** Runs `command` with its options and returns the text of the result. */
async function execute(
  command: 'verify' | 'compare',
  args: string[],
  env: NodeJS.ProcessEnv,
  io: Io,
) {
  // the libraries load after --help and --version have answered
  const [{ compare, verify }, { groupings }] = await Promise.all([
    import('./commands.ts'),
    import('./metrics.ts'),
  ])
  const { options, values } = optionsOf(command, args, env, io.stderr, groupings)
  const json = values.json === true || (values.table !== true && !io.tty)
  if (command === 'verify') {
    const result = await verify(options, values.model)
    return json ? JSON.stringify(result, null, 2) : verifyTable(result)
  }
  if (!values.baseline || !values.candidate)
    throw new UsageError('compare needs --baseline and --candidate')
  const result = await compare(options, values.baseline, values.candidate)
  return json ? JSON.stringify(result, null, 2) : compareTable(result)
}

/** Runs `run` or `operations` with its options and returns the answer. */
async function operate(
  command: 'run' | 'operations',
  args: string[],
  env: NodeJS.ProcessEnv,
  io: Io,
) {
  const { listOperations, runOperation } = await import('./operations.ts')
  if (command === 'operations') {
    parse({ args, strict: true, options: { json: { type: 'boolean' } } }, commandHelp.operations)
    return listOperations()
  }
  const { values, positionals } = parse(
    {
      args,
      strict: true,
      allowPositionals: true,
      options: {
        input: { type: 'string' },
        records: { type: 'string', multiple: true },
        json: { type: 'boolean' },
      },
    },
    commandHelp.run,
  )
  const [name, ...extra] = positionals
  if (name === undefined || extra.length > 0 || values.input === undefined)
    throw new UsageError(commandHelp.run)
  const roots = values.records ?? env.BALLISTICS_RECORDS?.split(':').filter(Boolean) ?? []
  return await runOperation(name, values.input, roots, io.stderr)
}

/** What went wrong: bad input (exit 2), a refused run (1) or an internal error (3). */
type ErrorKind = 'usage' | 'refused' | 'internal'

/** The kind, exit code and message of an error a run ends with. */
function failure(error: unknown): {
  kind: ErrorKind
  code: number
  message: string
  details?: Record<string, unknown> | undefined
} {
  if (error instanceof Refusal)
    return { kind: 'refused', code: 1, message: error.message, details: error.details }
  if (error instanceof UsageError)
    return { kind: 'usage', code: 2, message: error.message, details: error.details }
  return {
    kind: 'internal',
    code: 3,
    message: error instanceof Error ? error.message : String(error),
  }
}

/**
 * The error of the command line `argv` on stderr: one JSON object for `--json` or a script, the
 * text line on a terminal; never a stack trace. Returns the exit code.
 */
export function report(error: unknown, argv: string[], io: Io): number {
  const { kind, code, message, details } = failure(error)
  const json = argv.includes('--json') || !io.tty
  if (json) io.stderr(`${JSON.stringify({ error: { kind, message, ...details } })}\n`)
  else if (kind === 'refused') io.stderr(`refused: ${message}\n`)
  else if (kind === 'usage') io.stderr(`${message}\n`)
  else io.stderr(`error: ${message}\n`.replace(/\n(?!$)/g, ' '))
  return code
}

/** Runs the command line `argv` (without the program), writes the result and returns the exit code. */
export async function run(argv: string[], env: NodeJS.ProcessEnv, io: Io): Promise<number> {
  const [command = '', ...args] = argv
  if (argv.includes('--help') || argv.includes('-h')) {
    io.stdout(`${command === 'run' || command === 'operations' ? commandHelp[command] : usage}\n`)
    return 0
  }
  if (argv.includes('--version')) {
    const { version } = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    )
    io.stdout(`ballistics ${version}\n`)
    return 0
  }
  try {
    if (command === 'run' || command === 'operations') {
      io.stdout(`${JSON.stringify(await operate(command, args, env, io), null, 2)}\n`)
      return 0
    }
    if (command !== 'verify' && command !== 'compare') {
      parse({ args: argv, strict: true, allowPositionals: true, options: {} })
      throw new UsageError(usage)
    }
    io.stdout(`${await execute(command, args, env, io)}\n`)
    return 0
  } catch (error) {
    return report(error, argv, io)
  }
}
