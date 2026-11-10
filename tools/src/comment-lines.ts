/** Fails a changed source file that adds a multi-line comment, or whose comment-only change drops a reference: `node tools/src/comment-lines.ts [base]`, the base being the merge base with `origin/main` by default, uncommitted and untracked files included. */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { computeLineStarts, type Node, type SourceFile, SyntaxKind } from 'typescript/unstable/ast'
import { createVirtualFileSystem } from 'typescript/unstable/fs'
import { API } from 'typescript/unstable/sync'
import { executable } from './executable.ts'

export interface Finding {
  line: number
  error: boolean
  message: string
}

interface Change {
  file: string
  base: string
  head: string
}

interface Comment {
  text: string
  line: number
  endLine: number
  own: boolean
  anchor: number
  published: boolean
}

interface Scan {
  comments: Comment[]
  code: string
}

const root = path.join(import.meta.dirname, '../..')
// a `//` or `/*` inside these tokens is no comment
const literals = new Set<SyntaxKind>([
  SyntaxKind.StringLiteral,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  SyntaxKind.TemplateHead,
  SyntaxKind.TemplateMiddle,
  SyntaxKind.TemplateTail,
  SyntaxKind.RegularExpressionLiteral,
  SyntaxKind.JsxText,
])
const bodies = new Set<SyntaxKind>([
  SyntaxKind.Block,
  SyntaxKind.ArrowFunction,
  SyntaxKind.FunctionExpression,
])
const directive = /^\/[/*]+\s*(<reference|oxlint-|biome-ignore|@ts-|eslint-|@?vitest-environment)/
const references =
  /https?:\/\/[^\s)>\]'"`]*[^\s)>\]'"`.,;:]|\b10\.\d{4,9}\/[^\s)>\]'"`]*[^\s)>\]'"`.,;:]|#\d+\b|\bD\d+\b|[$@][\w./-]*\w/g
const contracts =
  /\b(throws?|undefined when|must|never|ascending|in order)\b|(?<=\d\s?)(mm|cm|km|m|in|ft|gr|g|kg|ms|s|pa|kpa|mpa|bar|psi|j|n|k|px|rem|fps|moa|mil|mrad)\b|%|°|`[^`\n]+`/g
// the line breaks and stars of a doc comment are no part of a reference
const flat = (text: string) => text.replace(/\n[\t ]*\*?/g, ' ').replace(/\s+/g, ' ')

function read(source: SourceFile, published: boolean): Scan {
  const { text } = source
  const spans: number[][] = []
  const docs = new Set<number>()
  // shortcut: a doc comment counts as published API when it sits on an `export`-modified declaration or inside one (not in a function body), not what TypeDoc reaches from its entry points; ask TypeDoc when an `export { }` list or a re-export must count
  const visit = (node: Node, outer: boolean): undefined => {
    const exported =
      outer ||
      node.forEachChild((child) => child.kind === SyntaxKind.ExportKeyword || undefined) === true
    if (exported) for (const doc of node.jsDoc ?? []) docs.add(doc.end)
    if (literals.has(node.kind)) spans.push([node.getStart(source), node.end])
    node.forEachChild((child) => visit(child, exported && !bodies.has(node.kind)))
  }
  visit(source, false)
  const starts = computeLineStarts(text)
  let row = 0
  const lineOf = (pos: number) => {
    while ((starts[row + 1] ?? Number.POSITIVE_INFINITY) <= pos) row++
    return row + 1
  }
  const comments: Comment[] = []
  let code = ''
  let from = 0
  let next = 0
  for (let i = 0; i < text.length; i++) {
    const [start = Number.POSITIVE_INFINITY, end = 0] = spans[next] ?? []
    if (i >= start) {
      i = Math.max(i, end) - 1
      next++
    } else if (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      const block = text[i + 1] === '*'
      const close = text.indexOf(block ? '*/' : '\n', i + 2)
      const stop = close < 0 ? text.length : close + (block ? 2 : 0)
      code += text.slice(from, i).replace(/\s+/g, '')
      const line = lineOf(i)
      comments.push({
        text: text.slice(i, stop).trimEnd(),
        line,
        endLine: lineOf(stop - 1),
        own: text.slice(starts[line - 1], i).trim() === '',
        anchor: code.length,
        published: published && docs.has(stop),
      })
      from = stop
      i = stop - 1
    }
  }
  return { comments, code: code + text.slice(from).replace(/\s+/g, '') }
}

function parse(changes: Change[]): [Scan, Scan][] {
  const files: Record<string, string> = {}
  for (const [i, { file, base, head }] of changes.entries()) {
    files[`/v/${i}/base/${path.basename(file)}`] = base
    files[`/v/${i}/head/${path.basename(file)}`] = head
  }
  const options = { allowJs: true, noLib: true, noResolve: true, types: [] }
  const config = JSON.stringify({ compilerOptions: options, files: Object.keys(files) })
  const api = new API({
    cwd: '/v',
    fs: createVirtualFileSystem({ ...files, '/v/tsconfig.json': config }),
  })
  try {
    const project = api
      .updateSnapshot({ openProject: '/v/tsconfig.json' })
      .getProject('/v/tsconfig.json')
    return changes.map(({ file }, i) => {
      const workspace = /^[^/]+\/[^/]+(?=\/src\/)/.exec(file)?.[0]
      const published =
        workspace !== undefined && existsSync(path.join(root, workspace, 'typedoc.json'))
      const scan = (side: string) => {
        const source = project?.program.getSourceFile(`/v/${i}/${side}/${path.basename(file)}`)
        if (source === undefined) throw new Error(`TypeScript parsed no ${side} version of ${file}`)
        return read(source, published)
      }
      return [scan('base'), scan('head')]
    })
  } finally {
    api.close()
  }
}

const ownLine = (comment: Comment) => comment.own && comment.text.startsWith('//')

function multiLine(comments: Comment[]) {
  const runs: Comment[][] = []
  for (const comment of comments.filter(({ text }) => !directive.test(text))) {
    const run = runs.at(-1)
    const last = run?.at(-1)
    if (run && last && ownLine(last) && ownLine(comment) && comment.line === last.line + 1)
      run.push(comment)
    else runs.push([comment])
  }
  const found: { comment: Comment; key: string }[] = []
  for (const [first, ...rest] of runs)
    if (first && (rest.length > 0 || first.endLine > first.line))
      found.push({
        comment: first,
        key: [first, ...rest]
          .map(({ text }) => text)
          .join(' ')
          .replace(/\s+/g, ' '),
      })
  return found
}

function kept(was: Comment[], now: Comment[]): Finding[] {
  const left = new Set(now.flatMap(({ text }) => flat(text).match(references) ?? []))
  const findings = new Map<string, Finding>()
  for (const comment of was) {
    const line = now.find(({ anchor }) => anchor >= comment.anchor)?.line ?? comment.line
    const here = new Set(
      now
        .filter(({ anchor }) => anchor === comment.anchor)
        .flatMap(({ text }) => text.toLowerCase().match(contracts) ?? []),
    )
    for (const reference of flat(comment.text).match(references) ?? [])
      if (!left.has(reference))
        findings.set(reference, {
          line,
          error: true,
          message: `${reference} of the old comments is gone: a comment-only change keeps every reference`,
        })
    for (const word of comment.text.toLowerCase().match(contracts) ?? [])
      if (!here.has(word))
        findings.set(`${line} ${word}`, {
          line,
          error: false,
          message: `"${word}" of the old comment is not in the new one: read it`,
        })
  }
  return [...findings.values()]
}

function check(changes: Change[]): Finding[][] {
  return parse(changes).map(([was, now], i) => {
    const { base, head } = changes[i] ?? { base: '', head: '' }
    const old = new Set(multiLine(was.comments).map(({ key }) => key))
    const findings = multiLine(now.comments)
      .filter(({ comment, key }) => !comment.published && !old.has(key))
      .map(({ comment }) => ({
        line: comment.line,
        error: true,
        message: 'new multi-line comment: make it one line, the why',
      }))
    if (base === '' || base === head || was.code !== now.code) return findings
    return [...findings, ...kept(was.comments, now.comments)]
  })
}

export const commentFindings = (file: string, base: string, head: string) =>
  check([{ file, base, head }])[0] ?? []

if (import.meta.main) {
  const git = (...args: string[]) =>
    execFileSync(executable('git'), args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
  const base = process.argv[2] ?? git('merge-base', 'origin/main', 'HEAD').trim()
  const changes: Change[] = []
  for (const [status = 'D', from = '', file = from] of [
    ...git('-c', 'core.quotePath=false', 'diff', '--name-status', '--find-renames', base)
      .split('\n')
      .map((entry) => entry.split('\t')),
    ...git('ls-files', '--others', '--exclude-standard')
      .split('\n')
      .map((untracked) => ['A', untracked]),
  ])
    if (
      status !== 'D' &&
      /\.[cm]?[jt]sx?$/.test(file) &&
      !/(^|\/)(node_modules|dist|test\/golden)\//.test(file)
    )
      changes.push({
        file,
        base: status === 'A' ? '' : git('show', `${base}:${from}`),
        head: readFileSync(path.join(root, file), 'utf8'),
      })
  let failed = false
  for (const [i, findings] of check(changes).entries())
    for (const { line, error, message } of findings) {
      const file = changes[i]?.file
      failed ||= error
      console.log(
        process.env.GITHUB_ACTIONS
          ? `::${error ? 'error' : 'notice'} file=${file},line=${line}::${message.replaceAll('%', '%25')}`
          : `${file}:${line}: ${error ? '' : 'notice: '}${message}`,
      )
    }
  process.exitCode = failed ? 1 : 0
}
