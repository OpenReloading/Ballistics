import { readFileSync } from 'node:fs'
import type { Bundle } from '@rangefoundry/catalog'
import {
  errorAnswer,
  inlineRunner,
  jsonSchema,
  operation,
  operations,
  RecordNotFound,
} from '@rangefoundry/use-cases'
import { buildCatalogue, type Catalogue, openCatalogue } from '@rangefoundry/use-cases/catalog'
import { z } from 'zod'
import { DataError, NoInputError, Refusal, UsageError } from './errors.ts'
import { readBundle } from './records.ts'
import { systemErrorCode } from './system-error.ts'

const dialect = 'https://json-schema.org/draft/2020-12/schema'

/** One entry of `ballistics operations`. */
interface Listed {
  name: string
  summary: string
  description: string
  input: Record<string, unknown>
  output: Record<string, unknown>
}

/** `operations`: every compute operation with its body and answer as JSON Schema 2020-12. */
export function listOperations(): { operations: Listed[] } {
  return {
    operations: operations.map(({ name, summary, description, body, response }) => ({
      name,
      summary,
      description,
      input: { $schema: dialect, ...jsonSchema(body) },
      output: { $schema: dialect, ...jsonSchema(response, 'output') },
    })),
  }
}

/** The JSON body of `--input`, a file or `-` for standard input. */
function readBody(input: string): unknown {
  let text: string
  try {
    text = readFileSync(input === '-' ? 0 : input, 'utf8') // NOSONAR: the path is the argument the user gave
  } catch (error) {
    throw new NoInputError(`the --input cannot be read: ${systemErrorCode(error)}`)
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    throw new DataError('the --input is not JSON')
  }
}

/** A body the schema rejects; a terminal run prints the message only, so it names the first issue. */
function schemaError(error: z.ZodError) {
  const issues = error.issues.map(({ path, message }) => ({ path, message }))
  const first = issues[0]
  const at = first?.path.length ? `${first.path.map(String).join('.')}: ` : ''
  return new DataError(
    `the --input does not match the schema of the operation${first ? `: ${at}${first.message}` : ''}`,
    { issues },
  )
}

/** The catalogue `run` answers over: the records read, opened in memory. */
export const catalogueOf = (bundle: Bundle): Catalogue => openCatalogue(buildCatalogue(bundle))

/** A message with the values after it; a typed refusal's message is its code, which the command line does not word. */
function withParams(message: string, params: object): string {
  const values = Object.entries(params).map(
    ([k, v]) => `${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}`,
  )
  return values.length === 0 ? message : `${message} (${values.join(', ')})`
}

/** `run`: the answer of the operation `name` to the body of `input`, over the records of `roots`. */
export async function runOperation(
  name: string,
  input: string,
  roots: readonly string[],
  warn: (text: string) => void,
): Promise<unknown> {
  const op = operation(name)
  if (!op)
    throw new UsageError(
      `unknown operation ${name}: one of ${operations.map((o) => o.name).join(', ')}`,
    )
  const body = readBody(input)
  const { bundle, errors } = readBundle(roots)
  if (errors.length > 0)
    warn(`${errors.length} problem(s) in the records; check them before relying on the result\n`)
  const context = { catalogue: catalogueOf(bundle), compute: inlineRunner }
  let answer: { status: number; payload: unknown }
  try {
    answer = await op.run(context, body)
  } catch (error) {
    if (error instanceof z.ZodError) throw schemaError(error)
    // an unknown record id is bad input, not a refusal of the model
    if (error instanceof RecordNotFound)
      throw new DataError(withParams(error.message, error.issue.params), error.issue)
    const known = errorAnswer(error, op.errors)
    if (!known) throw error
    answer = { status: known.status, payload: known.body }
  }
  if (answer.status !== 200) throw refusalOf(answer)
  return answer.payload
}

/** The fields of an answer other than 200 that a refusal names. */
const refusalBody = z.object({
  message: z.string().optional(),
  field: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
})

/** The refusal of an answer other than 200: its message (else its status), its field and its parameters. */
function refusalOf({ status, payload }: { status: number; payload: unknown }) {
  const { message, field, params } = refusalBody.parse(payload)
  const text = message ?? `answer ${status}`
  const named = field === undefined ? text : `${text} (${field})`
  return new Refusal(withParams(named, params ?? {}), { answer: payload })
}
