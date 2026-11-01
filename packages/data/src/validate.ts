import { readRecords } from './records.ts'

const { bundle, errors, warnings } = readRecords()
for (const error of errors) console.error(error)
for (const warning of warnings) console.warn(`warning: ${warning}`)
const counts = Object.entries(bundle).flatMap(([kind, records]) =>
  Array.isArray(records) ? [`${records.length} ${kind}`] : [],
)
console.log(`${counts.join(', ')}, ${errors.length} errors, ${warnings.length} warnings`)
process.exitCode = errors.length > 0 ? 1 : 0
