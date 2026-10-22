import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readRecords } from './records.ts'

const { bundle, errors } = readRecords()
if (errors.length > 0) {
  for (const error of errors) console.error(error)
  process.exit(1)
}
writeFileSync(join(import.meta.dirname, 'bundle.json'), `${JSON.stringify(bundle)}\n`)
