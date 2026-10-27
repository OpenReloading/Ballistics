import { parseArgs } from 'node:util'
import { compare, type Options, verify } from './commands.ts'
import { Refusal, UsageError } from './errors.ts'
import { type Grouping, groupings } from './metrics.ts'
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

options:
  --rows <path>      a rows file or a folder of .csv files (default: BALLISTICS_ROWS)
  --records <dir>    a records root, repeatable (default: BALLISTICS_RECORDS, else the repository records)
  --split <name>     validation (default), training or test
  --final            required for the test split
  --group-by <key>   also group by powder, family, cartridge, bullet or construction
  --params records   the powder parameters of the records (the only mode so far)
  --json | --table   output format (default: JSON unless stdout is a terminal)

exit codes: 0 done, 1 refused run, 2 bad input`

/** Refuses an option value that is not one of its choices. */
function checkChoices(
  values: { json?: boolean | undefined; table?: boolean | undefined; params?: string | undefined },
  split: string,
  by: string | undefined,
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
function optionsOf(args: string[], env: NodeJS.ProcessEnv) {
  const { values } = parseArgs({
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
    },
  })
  const rows = values.rows ?? env.BALLISTICS_ROWS
  if (!rows) throw new UsageError('give --rows <path> or set BALLISTICS_ROWS')
  const split = values.split ?? 'validation'
  const by = values['group-by']
  checkChoices(values, split, by)
  const fromEnv = env.BALLISTICS_RECORDS?.split(':').filter(Boolean) ?? []
  const options: Options = {
    rows,
    records: values.records ?? fromEnv,
    split: split as Split,
    final: values.final === true,
    ...(by !== undefined && { groupBy: by as Grouping }),
  }
  return { options, values }
}

/** Runs `command` with its options and returns the text of the result. */
async function execute(command: string, args: string[], env: NodeJS.ProcessEnv, tty: boolean) {
  const { options, values } = optionsOf(args, env)
  const json = values.json === true || (values.table !== true && !tty)
  if (command === 'verify') {
    const result = await verify(options, values.model)
    return json ? JSON.stringify(result, null, 2) : verifyTable(result)
  }
  if (!values.baseline || !values.candidate)
    throw new UsageError('compare needs --baseline and --candidate')
  const result = await compare(options, values.baseline, values.candidate)
  return json ? JSON.stringify(result, null, 2) : compareTable(result)
}

/** Runs the command line `argv` (without the program), writes the result and returns the exit code. */
export async function run(argv: string[], env: NodeJS.ProcessEnv, io: Io): Promise<number> {
  const [command = '', ...args] = argv
  try {
    if (command !== 'verify' && command !== 'compare') throw new UsageError(usage)
    io.stdout(`${await execute(command, args, env, io.tty)}\n`)
    return 0
  } catch (error) {
    if (error instanceof Refusal) {
      io.stderr(`refused: ${error.message}\n`)
      return 1
    }
    // parseArgs reports an unknown or malformed option as a TypeError with a code
    if (error instanceof UsageError || (error instanceof TypeError && 'code' in error)) {
      io.stderr(`${error.message}\n`)
      return 2
    }
    throw error
  }
}
