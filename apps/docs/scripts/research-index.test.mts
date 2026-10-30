import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  entries,
  frontMatter,
  isNote,
  llmsText,
  modelPages,
  noteErrors,
  notesErrors,
  required,
  splitPath,
} from './research-index.mts'

const note = `---
title: Pressure exponent per powder family
description: What the literature reports on the pressure exponent.
id: A1
question: Does the pressure exponent differ between powder families?
model_pages: [interior-powder-fit]
status: partly_verified
evidence: review
retrieved: 2026-10-29
result: no_change
sources:
  - { doi: 10.1000/example, year: 2001, claim: The exponent differs by family., verified: true }
  - { year: 1999, claim: A lot changes the exponent less than the family., verified: false }
---

# Pressure exponent per powder family
`

const pages = modelPages()
const fm = () => frontMatter(note)

test('a complete note passes and one without a required field fails', () => {
  assert.deepEqual(noteErrors(fm(), pages), [])
  for (const k of required) {
    const { [k]: _, ...rest } = fm()
    assert.deepEqual(noteErrors(rest, pages), [`"${k}" is missing`])
  }
})

test('a verified source without a doi, a wrong answer and an unknown model page fail', () => {
  const sources = [{ year: 2001, claim: 'A claim.', verified: true }]
  assert.deepEqual(noteErrors({ ...fm(), sources, status: 'verified' }, pages), [
    'source 1 is verified without a doi',
  ])
  assert.deepEqual(noteErrors({ ...fm(), status: 'verified' }, pages), [
    '"status" is verified but its sources give partly_verified',
  ])
  assert.deepEqual(noteErrors({ ...fm(), status: 'sure' }, pages), [
    '"status" must be one of verified, partly_verified, unverified',
  ])
  assert.deepEqual(noteErrors({ ...fm(), model_pages: ['interior-nope'] }, pages), [
    'no model page interior-nope',
  ])
  assert.deepEqual(noteErrors({ ...fm(), retrieved: 'October' }, pages), [
    '"retrieved" must be a date YYYY-MM-DD',
  ])
})

test('the literature pages that are no note are not checked as notes', () => {
  assert.ok(isNote('literature/A1.md'))
  assert.ok(!isNote('literature/index.md'))
  assert.ok(!isNote('literature/open-questions.md'))
  assert.ok(!isNote('interior-burn-law-checks.md'))
})

test('every literature note has all fields', () => {
  assert.deepEqual(notesErrors(), [])
})

test('the index lists every research page once, with a link line in llms.txt and the command line page', () => {
  const list = entries('https://example.org/')
  assert.ok(list.some((e) => e.link === 'https://example.org/research/literature/open-questions'))
  assert.ok(list.some((e) => e.link === 'https://example.org/research/literature/'))
  assert.equal(new Set(list.map((e) => e.link)).size, list.length)
  assert.ok(list.every((e) => e.title && e.description))
  const lines = llmsText(list, 'https://example.org/')
    .split('\n')
    .filter((l) => l.startsWith('- ['))
  assert.equal(lines.length, list.length + 1)
  assert.ok(lines.at(-1)?.startsWith('- [Command line](https://example.org/cli)'))
})

test('a page path splits into its folder and file name, in linear time on a long one', () => {
  assert.deepEqual(splitPath('literature/open-questions.md'), {
    folder: 'literature/',
    name: 'open-questions',
  })
  assert.deepEqual(splitPath('log.md'), { folder: '', name: 'log' })
  const long = `${'a/'.repeat(100_000)}b`
  const start = performance.now()
  assert.equal(splitPath(long).name, 'b')
  // guards against polynomial backtracking, which takes seconds; a loaded runner stalls past a tight bound
  assert.ok(performance.now() - start < 5000)
})
