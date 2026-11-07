// Prints the records that leave the public catalogue, by kind. Reads the records and writes nothing.
import { makerRows } from './maker-rows.ts'
import { readRecords } from './records.ts'

const { bundle, errors } = readRecords()
if (errors.length > 0) {
  console.error(`the records do not validate (${errors.length} errors); run data:validate`)
  process.exit(1)
}
const rows = makerRows(bundle)
for (const [kind, list] of Object.entries(rows)) {
  const of = (bundle as unknown as Record<string, unknown[]>)[kind]?.length ?? 0
  console.log(`${kind}: ${list.length} of ${of} leave (they cite a manufacturer source)`)
}
console.log(`manufacturers: ${bundle.manufacturers.length} stay as identity records`)
if (process.argv.includes('--ids'))
  for (const [kind, list] of Object.entries(rows))
    for (const r of list) console.log(`${kind}/${r.id}`)
