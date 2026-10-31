import { readFileSync } from 'node:fs'
import { buildCatalogue, openCatalogue } from '@open-reloading/api/catalogue'
import {
  errorAnswer,
  inlineRunner,
  jsonSchema,
  operation,
  operations,
} from '@open-reloading/api/compute'
import { z } from 'zod'
import { Refusal, UsageError } from './errors.ts'
import { readBundle } from './records.ts'

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
    throw new UsageError(`the --input cannot be read: ${(error as NodeJS.ErrnoException).code}`)
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    throw new UsageError('the --input is not JSON')
  }
}

/** A body the schema rejects; a terminal run prints the message only, so it names the first issue. */
function schemaError(error: z.ZodError) {
  const issues = error.issues.map(({ path, message }) => ({ path, message }))
  const first = issues[0]
  const at = first?.path.length ? `${first.path.map(String).join('.')}: ` : ''
  return new UsageError(
    `the --input does not match the schema of the operation${first ? `: ${at}${first.message}` : ''}`,
    { issues },
  )
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
  const context = { catalogue: openCatalogue(buildCatalogue(bundle)), compute: inlineRunner }
  let answer: { status: number; payload: unknown }
  try {
    answer = await op.run(context, body)
  } catch (error) {
    if (error instanceof z.ZodError) throw schemaError(error)
    // a record lookup of the routes fails an unknown id with a 404 error
    if ((error as { statusCode?: unknown }).statusCode === 404)
      throw new UsageError((error as Error).message)
    const known = errorAnswer(error, op.errors)
    if (!known) throw error
    answer = { status: known.status, payload: known.body }
  }
  if (answer.status !== 200) {
    const { message, field } = answer.payload as { message?: unknown; field?: unknown }
    const text = String(message ?? `answer ${answer.status}`)
    throw new Refusal(field === undefined ? text : `${text} (${String(field)})`, {
      answer: answer.payload,
    })
  }
  return answer.payload
}
