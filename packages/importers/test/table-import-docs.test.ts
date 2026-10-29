/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fieldSpecs, tableKinds, tierFloors } from '../src/index.ts'
import { kindNames } from '../src/record-fields.ts'

const page = readFileSync(
  new URL('../../../apps/docs/docs/data/table-import.md', import.meta.url),
  'utf8',
)

/** The lines of the page's section `### <title>`. */
const section = (title: string) =>
  (page.split(`### ${title}\n`)[1] ?? '').split('\n## ')[0]?.split('\n### ')[0]?.split('\n') ?? []

describe('the table import docs page', () => {
  for (const kind of tableKinds) {
    const name = kindNames[kind]
    it(`lists every field of ${name} with its aliases and units`, () => {
      const lines = section(name.charAt(0).toUpperCase() + name.slice(1))
      for (const f of fieldSpecs[kind]) {
        const row = lines.find((l) => l.startsWith(`| ${f.label} `))
        expect(row, f.label).toBeDefined()
        expect(row).toContain(`| ${f.aliases.join(', ')} |`)
        if (f.units) expect(row).toContain(f.units.map((u) => u.symbol).join(', '))
        if (f.range) expect(row).toContain(`${f.range[0]} to ${f.range[1]}`)
      }
    })
  }

  it('names the tier floors', () => {
    for (const floor of Object.values(tierFloors)) expect(page).toContain(floor.toFixed(2))
  })
})
