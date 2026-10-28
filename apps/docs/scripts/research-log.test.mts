import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { entryErrors, entryFiles, sections } from './research-log.mts'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const dir = fileURLToPath(new URL('../docs/research/', import.meta.url))

const entry = (skip = '') =>
  sections
    .filter((s) => s !== skip)
    .map(
      (s) =>
        `## ${s}\n\n${{ Result: 'No change.', 'Data basis': 'Analytic.', Confidence: 'High, exact.' }[s] ?? 'Text `apps/docs/scripts/research-log.mts`.'}\n`,
    )
    .join('\n')

test('an entry with every section passes and one without a section fails', () => {
  assert.deepEqual(entryErrors(entry(), root), [])
  for (const s of sections)
    assert.deepEqual(entryErrors(entry(s), root), [`section "${s}" is missing or empty`])
})

test('a fixed answer and the named files are checked', () => {
  assert.deepEqual(entryErrors(entry().replaceAll('No change.', 'Better.'), root), [
    '"Result" must start with improved, no change, worse',
  ])
  assert.deepEqual(entryErrors(entry().replaceAll('research-log.mts', 'nope.mts'), root), [
    'no file apps/docs/scripts/nope.mts',
  ])
})

test('a comment-only section, a longer word as answer and a missing extensionless file fail', () => {
  const comment = `${entry('Method')}\n## Method\n\n<!-- TODO -->\n`
  assert.deepEqual(entryErrors(comment, root), ['section "Method" is missing or empty'])
  assert.deepEqual(entryErrors(entry().replaceAll('High, exact.', 'Highly unsure.'), root), [
    '"Confidence" must start with high, medium, low',
  ])
  assert.deepEqual(entryErrors(entry().replaceAll('research-log.mts', 'Dockerfil'), root), [
    'no file apps/docs/scripts/Dockerfil',
  ])
})

test('every research log entry has all fields', () => {
  const files = entryFiles(dir)
  assert.ok(files.length > 0)
  const errors = files.flatMap((f) =>
    entryErrors(readFileSync(dir + f, 'utf8'), root).map((e) => `${f}: ${e}`),
  )
  assert.deepEqual(errors, [])
})
