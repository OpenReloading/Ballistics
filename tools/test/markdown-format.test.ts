import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { frontmatter } from 'micromark-extension-frontmatter'
import { gfm } from 'micromark-extension-gfm'
import { expect, it } from 'vitest'
import { parse } from 'yaml'

const root = fileURLToPath(new URL('../..', import.meta.url))
const biome = `${root}node_modules/.bin/biome`

/** The Markdown tree of `text` without positions and with the front matter as data, as a reader of the page sees it. */
const tree = (text: string) =>
  JSON.stringify(
    fromMarkdown(text, {
      extensions: [gfm(), frontmatter()],
      mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown()],
    }),
    (key, value: { type?: string; value?: string } | undefined) => {
      if (key === 'position') return
      // Biome puts an empty line after the opening `---`, which leaves the data as it is
      return value?.type === 'yaml' ? { type: 'yaml', data: parse(value.value ?? '') } : value
    },
  )

/** `text` as the repository's Biome formats a Markdown file. */
function format(text: string) {
  const run = spawnSync(biome, ['format', '--stdin-file-path=page.md'], {
    cwd: root,
    input: text,
    encoding: 'utf8',
  })
  if (run.status !== 0) throw new Error(run.stderr)
  return run.stdout
}

it('formats Markdown without changing what it means', () => {
  // Biome 2.6.2 merged a list that starts above 1 into the paragraph before it and dropped the space before a code span (biomejs/biome#12739, #12542)
  const page = readFileSync(new URL('fixtures/markdown-meaning.md', import.meta.url), 'utf8')
  expect(tree(format(page))).toBe(tree(page))
})

/** Biome 2.6 rewrites an indented block (a nested map, an indented list, a block list followed by a key and a block scalar) into other data, so front matter stays one key per line. */
const indentedFrontMatter = (text: string) =>
  (/^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '').split('\n').some((line) => /^\s+\S/.test(line))

it('finds an indented line in front matter, not a blank one', () => {
  for (const block of ['a:\n  b: 1', 'tags:\n  - x\n  - y', 'tags:\n- x\nnote: |\n  text'])
    expect(indentedFrontMatter(`---\n${block}\n---\nText.\n`), block).toBe(true)
  for (const flat of ['title: A\ntags: [x, y]', '\ntitle: A', ''])
    expect(indentedFrontMatter(`---\n${flat}\n---\nText.\n`), flat).toBe(false)
  expect(indentedFrontMatter('No front matter.\n  indented text\n')).toBe(false)
})

it('keeps the front matter of every page one key per line, which Biome leaves as it is', () => {
  // Biome skips .claude (biome.json), where skills are copied from upstream unchanged
  const pages = execFileSync('git', ['ls-files', '*.md', ':!.claude'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
  expect(pages.length).toBeGreaterThan(100)
  expect(
    pages.filter((page) => indentedFrontMatter(readFileSync(`${root}${page}`, 'utf8'))),
  ).toEqual([])
})
