import assert from 'node:assert/strict'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inspect, isDeepStrictEqual } from 'node:util'
import { runInThisContext } from 'node:vm'
import ts from 'typescript'

const docs = fileURLToPath(new URL('../', import.meta.url))
const pagesDir = `${docs}docs/libraries/`
// gitignored; inside apps/docs so an example resolves the workspace packages as a reader's install would
const scratch = `${docs}.examples/`

interface Example {
  page: string
  // page line of the first code line
  line: number
  file: string
  code: string[]
  skip?: string
}

function examplesOf(page: string): Example[] {
  const lines = readFileSync(`${pagesDir}${page}`, 'utf8').split('\n')
  const found: Example[] = []
  let inExample = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.startsWith('## ')) inExample = line === '## Example'
    if (!line.startsWith('```')) continue
    const end = lines.indexOf('```', i + 1)
    assert.ok(end > i, `${page}:${i + 1}: unclosed code block`)
    const fence = /^```(js|ts)(?: (.*))?$/.exec(line)
    if (inExample && fence) {
      const skip = /^no-run(.*)$/.exec(fence[2] ?? '')?.[1]?.trim()
      assert.notEqual(
        skip,
        '',
        `${page}:${i + 1}: a no-run block names its reason beside the marker`,
      )
      const name = `${page.replace(/\.md$/, '')}-${i + 2}.${fence[1] === 'ts' ? 'mts' : 'mjs'}`
      found.push({
        page,
        line: i + 2,
        file: `${scratch}${name}`,
        code: lines.slice(i + 1, end),
        skip,
      })
    }
    i = end
  }
  return found
}

const examples = readdirSync(pagesDir)
  .filter((name) => name.endsWith('.md'))
  .sort()
  .flatMap(examplesOf)

// examples print with console.log only, one value per call, so no Node types are needed
const consoleTypes = `${scratch}console.d.ts`
mkdirSync(scratch, { recursive: true })
writeFileSync(consoleTypes, 'declare const console: { log(value: unknown): void }\n')
for (const example of examples) writeFileSync(example.file, `${example.code.join('\n')}\n`)

const program = ts.createProgram(
  [consoleTypes, ...examples.filter((example) => !example.skip).map((example) => example.file)],
  {
    strict: true,
    noEmit: true,
    allowJs: true,
    checkJs: true,
    resolveJsonModule: true,
    skipLibCheck: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ESNext,
    lib: ['lib.esnext.d.ts'],
    types: [],
  },
)

test('the example compiler options are valid', () => {
  const problems = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()]
  assert.deepEqual(
    problems.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
    [],
  )
})

const logged = /^\s*console\.log\(.*\) \/\/ (.*)$/

for (const example of examples) {
  const where = (offset: number) => `${example.page}:${example.line + offset}`

  test(`${where(0)}: the example type-checks and prints what its comments say`, {
    skip: example.skip,
  }, async () => {
    const source = program.getSourceFile(example.file)
    assert.ok(source, `${example.file} not in the program`)
    const errors = ts.getPreEmitDiagnostics(program, source).map((d) => {
      const at =
        d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line : 0
      return `${where(at)}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`
    })
    assert.deepEqual(errors, [], `type errors:\n${errors.join('\n')}`)

    const expected = example.code.flatMap((line, offset) => {
      const comment = logged.exec(line)?.[1]
      return comment === undefined ? [] : [{ at: where(offset), comment }]
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
      await import(pathToFileURL(example.file).href)
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
      // a string prints bare; any other value is written as a JavaScript literal
      const matches =
        typeof value === 'string'
          ? value === comment
          : isDeepStrictEqual(value, runInThisContext(`(${comment})`))
      assert.ok(
        matches,
        `${at}: printed ${typeof value === 'string' ? value : inspect(value)}, the comment says ${comment}`,
      )
    })
  })
}
