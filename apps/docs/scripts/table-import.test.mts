import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fieldSpecs, kindNames, tableKinds } from '../../../packages/importers/src/record-fields.ts'
import { tierFloors } from '../../../packages/importers/src/records.ts'

const page = readFileSync(new URL('../docs/data/table-import.md', import.meta.url), 'utf8')

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** The lines of the page's section `### <title>`. */
const section = (title: string) =>
  (page.split(`### ${title}\n`)[1] ?? '').split('\n## ')[0]?.split('\n### ')[0]?.split('\n') ?? []

for (const kind of tableKinds) {
  const name = kindNames[kind]
  test(`the table import page lists every field of ${name} with its aliases and units`, () => {
    const lines = section(name.charAt(0).toUpperCase() + name.slice(1))
    for (const f of fieldSpecs[kind]) {
      const row = lines.find((l) => l.startsWith(`| ${f.label} `))
      assert.ok(row, f.label)
      // a table cell, padded to its column's width
      assert.match(row, new RegExp(`\\| ${escape(f.aliases.join(', '))} +\\|`))
      if (f.units) assert.ok(row.includes(f.units.map((u) => u.symbol).join(', ')), f.label)
      if (f.range) assert.ok(row.includes(`${f.range[0]} to ${f.range[1]}`), f.label)
    }
  })
}

test('the table import page names the tier floors', () => {
  for (const floor of Object.values(tierFloors)) assert.ok(page.includes(floor.toFixed(2)))
})
