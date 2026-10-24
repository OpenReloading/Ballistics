import { readRecords } from './records.ts'

const { bundle, errors } = readRecords()
for (const error of errors) console.error(error)
const counts = Object.entries(bundle).flatMap(([kind, records]) =>
  Array.isArray(records) ? [`${records.length} ${kind}`] : [],
)
console.log(`${counts.join(', ')}, ${errors.length} errors`)
process.exitCode = errors.length > 0 ? 1 : 0
