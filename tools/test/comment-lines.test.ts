import { expect, it } from 'vitest'
import { commentFindings } from '../src/comment-lines.ts'

const lines = (file: string, base: string, head: string) =>
  commentFindings(file, base, head).map(({ line, error }) => [line, error])

it('fails a new run of two comment lines', () => {
  expect(lines('apps/web/src/a.ts', 'const a = 1\n', '// one\n// two\nconst a = 1\n')).toEqual([
    [1, true],
  ])
})

it('does not count a directive line into a run', () => {
  const head = '// why\n// oxlint-disable-next-line no-console\nconsole.log(1)\n'
  expect(lines('apps/web/src/a.ts', '', head)).toEqual([])
})

it('passes the old multi-line comments of a changed file', () => {
  const base = '/* one\n   two */\n// three\n// four\nconst a = 1\n'
  expect(lines('apps/web/src/a.ts', base, base.replace('1', '2'))).toEqual([])
})

it('passes a multi-line doc comment of the published API only', () => {
  const head =
    '/**\n * A load.\n * Simulated.\n */\nexport interface Load {\n  /** Grains,\n   * per case. */\n  charge: number\n}\n'
  expect(lines('packages/schema/src/load.ts', '', head)).toEqual([])
  expect(lines('apps/web/src/load.ts', '', head)).toEqual([
    [1, true],
    [6, true],
  ])
})

it('fails a new multi-line JSX comment and skips JSX text', () => {
  const head =
    "export const X = () => (\n  <p>\n    {/* one\n        two */}\n    // Don't\n    // read\n  </p>\n)\n"
  expect(lines('apps/web/src/x.tsx', '', head)).toEqual([[3, true]])
})

const base = '// Rounds down, see #788 and `floor`.\nconst a = Math.floor(b)\n'

it('fails a comment-only change that drops a reference and notes a dropped name', () => {
  const head = '// Rounds down.\nconst a = Math.floor(b)\n'
  expect(
    commentFindings('apps/web/src/a.ts', base, head).map(({ line, error, message }) => [
      line,
      error,
      message.split(' ')[0],
    ]),
  ).toEqual([
    [1, true, '#788'],
    [1, false, '"`floor`"'],
  ])
})

it('does not judge the references of a change to the code', () => {
  expect(lines('apps/web/src/a.ts', base, '// Rounds down.\nconst a = Math.floor(c)\n')).toEqual([])
})

it('counts only comments on their own consecutive lines as a run', () => {
  const head = 'const a = 1 // x\nconst b = 2 // y\n// z\n\n// w\n'
  expect(lines('apps/web/src/a.ts', '', head)).toEqual([])
})

it('fails a multi-line doc comment inside the body of an exported function', () => {
  const head = 'export function f() {\n  /** a\n   * b */\n}\n'
  expect(lines('packages/schema/src/a.ts', '', head)).toEqual([[2, true]])
})

it('notes a changed link instead of failing it', () => {
  const was = '// see http://x.y/z\nconst a = 1\n'
  expect(lines('apps/web/src/a.ts', was, was.replace('http:', 'https:'))).toEqual([[1, false]])
})
