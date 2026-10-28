import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Model } from './model.ts'
import type { Records } from './records.ts'
import type { Row } from './rows.ts'
import { byText } from './stats.ts'

const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex')

/** The records the rows name, with the capacity or case the run takes for each cartridge, as `<kind>/<id>` lines. */
function recordLines(rows: readonly Row[], records: Records): string[] {
  const lines = new Set<string>()
  const add = (kind: string, record: { id: string } | undefined) => {
    if (record) lines.add(`${kind}/${record.id} ${sha256(JSON.stringify(record))}`)
  }
  for (const { cartridge, bullet, powder } of rows) {
    add('cartridge', records.cartridges.get(cartridge))
    add('bullet', records.bullets.get(bullet))
    add('powder', records.powders.get(powder))
    add('capacity', records.capacities.get(cartridge))
    add('case', records.cases.get(cartridge))
  }
  return [...lines]
}

/** The fingerprints of the data a run reads: the rows files and the records the rows name. */
export function inputsOf(rows: readonly Row[], files: readonly Uint8Array[], records: Records) {
  return {
    rows: sha256(files.map(sha256).join('\n')),
    records: sha256(recordLines(rows, records).toSorted(byText).join('\n')),
  }
}

/**
 * The model version: SHA-256 over the sorted lines `<label> <sha256 of the file>` of the built
 * sources the evaluation reads (`model.files`), and the `rows` and `records` fingerprints.
 */
export function modelVersion(model: Model, inputs: ReturnType<typeof inputsOf>): string {
  const lines = model.files.map((f) => `${f.label} ${sha256(readFileSync(f.path))}`)
  return sha256(
    [...lines.toSorted(byText), `rows ${inputs.rows}`, `records ${inputs.records}`].join('\n'),
  )
}
