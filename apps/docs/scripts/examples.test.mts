import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inspect, isDeepStrictEqual } from 'node:util'
import { runInThisContext } from 'node:vm'

// the examples are type-checked by `tsc -p examples` (the typecheck script); this file runs them and checks that each is shown
const docs = fileURLToPath(new URL('../', import.meta.url))
const pagesDir = `${docs}docs/libraries/`
const examplesDir = `${docs}examples/`

const shown = /from '!\.\.\/\.\.\/examples\/([^']+\.ts)\?raw'/g

const pages = readdirSync(pagesDir)
  .filter((name) => /\.mdx?$/.test(name))
  .sort()
const shownOn = new Map(
  pages.map((page) => [
    page,
    [...readFileSync(`${pagesDir}${page}`, 'utf8').matchAll(shown)].map((match) => match[1]),
  ]),
)
const examples = readdirSync(examplesDir, { recursive: true, encoding: 'utf8' })
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts'))
  .sort()

for (const page of pages) {
  test(`${page}: shows an example of examples/`, () => {
    assert.ok((shownOn.get(page) ?? []).length > 0, `${page}: imports no file of examples/`)
  })
}

const logged = /^\s*console\.log\(.*\) \/\/ (.*)$/

for (const example of examples) {
  test(`examples/${example}: a page shows it`, () => {
    assert.ok(
      [...shownOn.values()].some((files) => files.includes(example)),
      `examples/${example}: no page of docs/libraries/ imports it`,
    )
  })

  test(`examples/${example}: prints what its comments say`, async () => {
    const where = (line: number) => `examples/${example}:${line + 1}`
    const expected = readFileSync(`${examplesDir}${example}`, 'utf8')
      .split('\n')
      .flatMap((line, n) => {
        const comment = logged.exec(line)?.[1]
        return comment === undefined ? [] : [{ at: where(n), comment }]
      })
    assert.ok(
      expected.length > 0,
      `${where(0)}: no console.log line with its output in a trailing comment`,
    )

    const printed: unknown[] = []
    const log = console.log
    console.log = (...values: unknown[]) => {
      printed.push(values.length === 1 ? values[0] : values)
    }
    try {
      await import(pathToFileURL(`${examplesDir}${example}`).href)
    } finally {
      console.log = log
    }

    assert.equal(
      printed.length,
      expected.length,
      `${where(0)}: printed ${printed.length} values, the comments state ${expected.length}`,
    )
    expected.forEach(({ at, comment }, n) => {
      const value = printed[n]
      // a primitive is compared as console.log prints it; an object or array as a JavaScript literal
      let matches: boolean
      if (typeof value !== 'object' || value === null) matches = String(value) === comment
      else {
        try {
          matches = isDeepStrictEqual(value, runInThisContext(`(${comment})`))
        } catch {
          matches = false
        }
      }
      assert.ok(
        matches,
        `${at}: printed ${typeof value === 'string' ? value : inspect(value)}, the comment says ${comment}`,
      )
    })
  })
}
