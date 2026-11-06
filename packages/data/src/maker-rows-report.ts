// Prints the records that leave the public catalogue, by kind and reason, and the manufacturer
// records with fields beyond their identity. Reads the records and writes nothing.
import { makerRows, manufacturerExtras } from './maker-rows.ts'
import { readRecords } from './records.ts'

const { bundle, errors } = readRecords()
if (errors.length > 0) {
  console.error(`the records do not validate (${errors.length} errors); run data:validate`)
  process.exit(1)
}
const rows = makerRows(bundle)
for (const [kind, list] of Object.entries(rows)) {
  const counts = new Map<string, number>()
  for (const r of list) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1)
  const reasons = [...counts].map(([reason, n]) => `${n} ${reason}`).join(', ')
  const of = (bundle as unknown as Record<string, unknown[]>)[kind]?.length ?? 0
  console.log(`${kind}: ${list.length} of ${of} leave (${reasons})`)
}
const extras = manufacturerExtras(bundle)
console.log(
  `manufacturers: ${bundle.manufacturers.length} stay as identity records, ${extras.length} with other fields${extras.length > 0 ? `: ${extras.map((e) => `${e.id} (${e.fields.join(', ')})`).join('; ')}` : ''}`,
)
if (process.argv.includes('--ids'))
  for (const [kind, list] of Object.entries(rows))
    for (const r of list) console.log(`${kind}/${r.id}: ${r.reason}`)
