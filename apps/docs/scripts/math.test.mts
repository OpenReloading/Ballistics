import assert from 'node:assert/strict'
import { test } from 'node:test'
import rehypeKatex from 'rehype-katex'
import { VFile } from 'vfile'
import { failOnMathErrors, katexOptions } from './math.mts'

/** Runs the docs' rehype math plugins over one inline formula on line 3, in the shape remark-math hands it on. */
const render = (formula: string) => {
  const position = { start: { line: 3, column: 1 }, end: { line: 3, column: 9 } }
  const code = {
    type: 'element' as const,
    tagName: 'code',
    properties: { className: ['language-math', 'math-inline'] },
    children: [{ type: 'text' as const, value: formula }],
    position,
  }
  const tree = { type: 'root' as const, children: [code] }
  const file = new VFile()
  rehypeKatex(katexOptions)(tree, file)
  failOnMathErrors()(tree, file)
}

test('a valid formula renders', () => {
  assert.doesNotThrow(() => render(String.raw`x_{\min} = \frac{a}{b}`))
})

test('a formula KaTeX cannot parse fails the page with its line', () => {
  assert.throws(() => render(String.raw`x_\min`), /line 3: ParseError: KaTeX parse error/)
})

test('a formula that is not valid LaTeX fails the page in strict mode', () => {
  assert.throws(() => render('é'), /line 3: .*unicodeTextInMathMode/)
})

test('a display formula KaTeX cannot parse fails the page with the line of its block', () => {
  const position = { start: { line: 3, column: 1 }, end: { line: 5, column: 3 } }
  const code = {
    type: 'element' as const,
    tagName: 'code',
    properties: { className: ['language-math', 'math-display'] },
    children: [{ type: 'text' as const, value: String.raw`x_\min` }],
  }
  // remark-math puts the position of a $$ block on the pre, not on its code.
  const pre = {
    type: 'element' as const,
    tagName: 'pre',
    properties: {},
    children: [code],
    position,
  }
  const tree = { type: 'root' as const, children: [pre] }
  const file = new VFile()
  rehypeKatex(katexOptions)(tree, file)
  assert.throws(() => failOnMathErrors()(tree, file), /line 3: ParseError: KaTeX parse error/)
})
