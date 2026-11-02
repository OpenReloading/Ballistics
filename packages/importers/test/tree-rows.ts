import { parseXml, type XmlElement } from '../src/xml.ts'
import { defined } from './defined.ts'

// Reference reader for the one-pass worksheet reader, built on the element tree of `parseXml`.
// Budgets and the cell column checks are left out; the tests compare rows only.

const elements = (e: XmlElement | undefined, name: string) =>
  (e?.children ?? []).filter((c): c is XmlElement => typeof c !== 'string' && c.name === name)
const textOf = (e: XmlElement) => e.children.filter((c) => typeof c === 'string').join('')

const richText = (e: XmlElement) =>
  e.children
    .flatMap((c) =>
      typeof c === 'string' ? [] : c.name === 't' ? [c] : c.name === 'r' ? elements(c, 't') : [],
    )
    .map(textOf)
    .join('')

const clean = (text: string) => text.replaceAll('﻿', '').trim()

const columnOf = (letters: string) =>
  [...letters].reduce((col, l) => col * 26 + l.charCodeAt(0) - 64, 0)

function cellText(c: XmlElement, strings: string[]): string {
  let text: string
  if (c.attributes.t === 'inlineStr') {
    const is = elements(c, 'is')[0]
    text = is ? richText(is) : ''
  } else {
    const v = elements(c, 'v')[0]
    text = v ? textOf(v) : ''
    if (c.attributes.t === 's' && text !== '')
      return defined(strings[Number(text)], 'shared string')
    if (c.attributes.t === 'b' && text.trim() === '0') return ''
  }
  return clean(text)
}

/** Shared strings of a shared strings part, read through the element tree. */
export function treeStrings(xml: string): string[] {
  return elements(parseXml(xml), 'si').map((si) => clean(richText(si)))
}

/** Rows of a worksheet part, read through the element tree. */
export function treeRows(xml: string, strings: string[]): string[][] {
  const rows: string[][] = []
  for (const row of elements(elements(parseXml(xml), 'sheetData')[0], 'row')) {
    const cells: string[] = []
    for (const c of elements(row, 'c')) {
      const letters =
        c.attributes.r === undefined ? undefined : /^([A-Z]{1,3})[0-9]+$/.exec(c.attributes.r)?.[1]
      const column = letters === undefined ? cells.length + 1 : columnOf(letters)
      while (cells.length < column - 1) cells.push('')
      cells.push(cellText(c, strings))
    }
    if (cells.length > 0) rows.push(cells)
  }
  return rows
}
