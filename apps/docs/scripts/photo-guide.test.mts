import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { guideRule } from '../../web/src/lib/photo-quality.ts'

test("the web app's photo checks name a heading of the photo guide and link its anchor", () => {
  const guide = readFileSync(new URL('../docs/photo-guide.md', import.meta.url), 'utf8')
  const headings = [...guide.matchAll(/^## (.+)$/gm)].map((m) => m[1] ?? '')
  // the anchor of a Docusaurus heading: lower case, punctuation dropped, spaces as hyphens
  const anchor = (h: string) =>
    h
      .toLowerCase()
      .replace(/[^\p{L}\p{N} -]/gu, '')
      .replace(/ /g, '-')
  for (const rule of Object.values(guideRule)) {
    const heading = headings.find((h) => h.endsWith(rule.name))
    assert.equal(heading && anchor(heading), rule.anchor)
  }
})
