import { describe, expect, it } from 'vitest'
import { maxCellCharacters, maxCells, maxElements, maxPartSize } from '../src/limits.ts'
import { isWorkbook, readWorkbook } from '../src/workbook.ts'
import { defined } from './defined.ts'
import { rejection } from './refusal.ts'
import { treeRows, treeStrings } from './tree-rows.ts'
import { type Part, workbookParts, zip } from './xlsx.ts'

const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const sheet = 'xl/worksheets/sheet1.xml'
/** Tests that read parts near the size limit: a few seconds on a desktop, over 5 s in CI's coverage run. */
const slow = { timeout: 30_000 }
const ws = (data: string, root = 'worksheet') =>
  `<${root} xmlns="${main}"><sheetData>${data}</sheetData></${root}>`

/** A one-sheet workbook whose parts are replaced by name. */
function book(replace: Record<string, string | Uint8Array | null>, extra: Part[] = []) {
  const parts = workbookParts([{ name: 'S1', rows: [['x']] }])
    .filter((p) => replace[p.name] !== null)
    .map((p) => (replace[p.name] === undefined ? p : { ...p, data: replace[p.name] as string }))
  return zip([...parts, ...extra])
}
/** Workbook relationships with one worksheet at `target`. */
const worksheetRels = (target: string) =>
  `<Relationships><Relationship Id="rId1" Type="${rel}/worksheet" Target="${target}"/></Relationships>`
/** A part of elements `<a/>` under `root` as large as a part may be. */
const filler = (root: string) => {
  const open = `<${root} xmlns="${main}">`
  const close = `</${root}>`
  return `${open}${'<a/>'.repeat((maxPartSize - open.length - close.length) / 4)}${close}`
}
const sst = (items: string) => `<sst xmlns="${main}">${items}</sst>`

describe('readWorkbook cells: references, cell types and prefixes', () => {
  it('places cells by reference and after the previous cell', async () => {
    const xml = ws(
      '<row r="3"><c r="A3"><v>1</v></c><c r="B3"><v>2800.0</v></c><c r="H3" t="inlineStr"><is><t>x</t></is></c></row>' +
        '<row r="4"/><row><c><v>a</v></c><c><v>b</v></c><c r="E5"><v>e</v></c></row>',
    )
    const r = await readWorkbook(book({ [sheet]: xml }))
    expect(r.worksheets[0]?.rows).toEqual([
      ['1', '2800.0', '', '', '', '', '', 'x'],
      ['a', 'b', '', '', 'e'],
    ])
  })

  it('reads each cell type as written', async () => {
    const xml = ws(
      '<row><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Time</t></is></c>' +
        '<c r="C1"><v>2800.5</v></c><c r="D1" t="str"><f>A1</f><v>ok</v></c>' +
        '<c r="E1" t="b"><v>1</v></c><c r="F1"/><c r="G1" t="s"><v>1</v></c>' +
        '<c r="H1" t="b"><v>0</v></c></row>',
    )
    const strings = sst(
      '<si><t> Speed (FPS)\uFEFF </t></si><si><r><t>Test </t></r><r><rPr/><t>load</t></r><rPh><t>xx</t></rPh></si>',
    )
    const r = await readWorkbook(book({ [sheet]: xml, 'xl/sharedStrings.xml': strings }))
    expect(r.worksheets[0]?.rows).toEqual([
      ['Speed (FPS)', 'Time', '2800.5', 'ok', '1', '', 'Test load', ''],
    ])
  })

  it('reads prefixed element names', async () => {
    const xml = `<x:worksheet xmlns:x="${main}"><x:sheetData><x:row><x:c r="A1"><x:v>1</x:v></x:c></x:row></x:sheetData></x:worksheet>`
    expect((await readWorkbook(book({ [sheet]: xml }))).worksheets[0]?.rows).toEqual([['1']])
  })
})

describe('readWorkbook cells: refused cells', () => {
  it('refuses a shared string out of range, a column beyond IV and cells out of order', async () => {
    const strings = sst('<si><t>a</t></si><si><t>b</t></si><si><t>c</t></si>')
    expect(await rejection(readWorkbook(
        book({
          [sheet]: ws('<row><c r="A1" t="s"><v>5</v></c></row>'),
          'xl/sharedStrings.xml': strings,
        }),
      ))).toEqual({ code: 'sharedStringOutOfRange', params: { cell: 'A1', index: '5', count: 3, part: sheet } })
    expect(await rejection(readWorkbook(book({ [sheet]: ws('<row><c r="IW1"><v>1</v></c></row>') })))).toEqual({ code: 'cellBeyondColumnIV', params: { cell: 'IW1', part: sheet } })
    expect(await rejection(readWorkbook(book({ [sheet]: ws('<row><c r="B1"/><c r="A1"/></row>') })))).toEqual({ code: 'cellOutOfOrder', params: { cell: 'A1', part: sheet } })
    expect(await rejection(readWorkbook(book({ [sheet]: ws('<row><c r="a1"/></row>') })))).toEqual({ code: 'cellRefMalformed', params: { ref: 'a1', part: sheet } })
  })

  it('names a cell without reference by its column in a refusal', async () => {
    expect(await rejection(readWorkbook(book({ [sheet]: ws(`<row>${'<c/>'.repeat(257)}</row>`) })))).toEqual({ code: 'cellBeyondColumnIV', params: { cell: 'at column 257', part: sheet } })
    expect(await rejection(readWorkbook(
        book({ [sheet]: ws('<row><c t="s"><v>5</v></c></row>'), 'xl/sharedStrings.xml': sst('') }),
      ))).toEqual({ code: 'sharedStringOutOfRange', params: { cell: 'at column 1', index: '5', count: 0, part: sheet } })
  })
})

describe('readWorkbook parts: inline strings and relationships', () => {
  it('reads inline strings without a shared strings part', async () => {
    const rels = `<Relationships><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
    const r = await readWorkbook(
      book({
        'xl/_rels/workbook.xml.rels': rels,
        'xl/sharedStrings.xml': null,
        [sheet]: ws('<row><c t="inlineStr"><is><t>a</t></is></c></row>'),
      }),
    )
    expect(r.worksheets[0]?.rows).toEqual([['a']])
  })

  it('finds the workbook through the package relationships and reads absolute targets', async () => {
    const pkg = `<Relationships><Relationship Id="r" Type="${rel}/officeDocument" Target="/book/main.xml"/></Relationships>`
    const parts: Part[] = [
      { name: '_rels/.rels', data: pkg },
      {
        name: 'book/main.xml',
        data: `<workbook xmlns:r="${rel}"><sheets><sheet name="A" r:id="c"/><sheet name="B" r:id="w"/></sheets></workbook>`,
      },
      {
        name: 'book/_rels/main.xml.rels',
        data: `<Relationships><Relationship Id="w" Type="${rel}/worksheet" Target="/xl/worksheets/sheet1.xml"/><Relationship Id="c" Type="${rel}/chartsheet" Target="../charts/c.xml"/></Relationships>`,
      },
      { name: sheet, data: ws('<row><c><v>7</v></c></row>') },
    ]
    expect(await readWorkbook(zip(parts))).toEqual({ worksheets: [{ name: 'B', rows: [['7']] }] })
  })
})

describe('readWorkbook parts: refused parts', () => {
  it('refuses a missing worksheet part and a target outside the package', async () => {
    expect(await rejection(readWorkbook(book({ 'xl/_rels/workbook.xml.rels': worksheetRels('worksheets/sheet2.xml') })))).toEqual({ code: 'partMissing', params: { name: 'xl/worksheets/sheet2.xml' } })
    expect(await rejection(readWorkbook(book({ 'xl/_rels/workbook.xml.rels': worksheetRels('../../x.xml') })))).toEqual({ code: 'relationshipLeaves', params: { target: '../../x.xml' } })
  })

  it('refuses invalid UTF-8, a document type declaration and an unclosed row, naming the part', async () => {
    const bad = new Uint8Array([...new TextEncoder().encode(ws('<row>')), 0xff])
    expect(await rejection(readWorkbook(book({ [sheet]: bad })))).toEqual({ code: 'notUtf8', params: { part: sheet } })
    expect(await rejection(readWorkbook(
        book({ 'xl/sharedStrings.xml': `<!DOCTYPE sst [<!ENTITY a "aaaa">]>${sst('')}` }),
      ))).toEqual({ code: 'doctype', params: { part: 'xl/sharedStrings.xml' } })
    expect(await rejection(readWorkbook(book({ 'xl/sharedStrings.xml': sst('<si><t>&ext;</t></si>') })))).toEqual({ code: 'unknownEntity', params: { name: 'ext', part: 'xl/sharedStrings.xml' } })
    expect(await rejection(readWorkbook(book({ [sheet]: `<worksheet><sheetData><row>` })))).toEqual({ code: 'unclosedElement', params: { tag: 'row', part: sheet } })
  })
})

describe('readWorkbook limits', slow, () => {
  it('counts cells left out before a reference across all worksheets', async () => {
    const half = ws('<row><c r="IV1"/></row>'.repeat(Math.ceil(maxCells / 512)))
    const parts = workbookParts([
      { name: 'A', xml: half },
      { name: 'B', xml: half },
    ])
    expect(await rejection(readWorkbook(zip(parts)))).toEqual({ code: 'tooManyCells', params: { max: maxCells, part: 'xl/worksheets/sheet2.xml' } })
  })

  it('counts a shared string at every cell that refers to it', async () => {
    const strings = sst(`<si><t>${'a'.repeat(1024 * 1024)}</t></si>`)
    const cells = maxCellCharacters / (1024 * 1024) + 1
    const xml = ws(`<row>${'<c t="s"><v>0</v></c>'.repeat(cells)}</row>`)
    expect(await rejection(readWorkbook(book({ [sheet]: xml, 'xl/sharedStrings.xml': strings })))).toEqual({ code: 'tooMuchCellText', params: { max: maxCellCharacters, part: sheet } })
  })

  it('counts the elements of all XML parts and stops at the limit', async () => {
    // '<a/>' compresses to almost nothing; two full parts hold more elements than the limit
    const strings = filler('sst')
    const xml = filler('worksheet')
    expect(2 * ((maxPartSize - 100) / 4)).toBeGreaterThan(maxElements)
    expect(await rejection(readWorkbook(book({ [sheet]: xml, 'xl/sharedStrings.xml': strings })))).toEqual({ code: 'xmlElementsExceeded', params: { max: maxElements, part: sheet } })
  })

  it('refuses a repeated relationship id and a worksheet named twice', async () => {
    const twice = `<Relationships><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
    expect(await rejection(readWorkbook(book({ 'xl/_rels/workbook.xml.rels': twice })))).toEqual({ code: 'relationshipTwice', params: { part: 'xl/_rels/workbook.xml.rels', id: 'rId1' } })
    const again = `<workbook xmlns:r="${rel}"><sheets><sheet name="A" r:id="rId1"/><sheet name="B" r:id="rId1"/></sheets></workbook>`
    expect(await rejection(readWorkbook(book({ 'xl/workbook.xml': again })))).toEqual({ code: 'sheetPartAgain', params: { part: 'xl/workbook.xml', sheet: 'B', target: 'xl/worksheets/sheet1.xml' } })
  })
})

/** Seeded pseudo-random numbers in [0, 1) (mulberry32). */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The pieces of the generated parts, drawn from `random`, element names with the prefix `p`. */
function pieces(random: () => number, p: string) {
  const pick = <T>(items: T[]) => defined(items[Math.floor(random() * items.length)], 'pick')
  const space = () => pick(['', '', ' ', '\n  ', '<!-- c -->', '<?p q?>'])
  const text = () =>
    Array.from({ length: Math.floor(random() * 4) }, () =>
      pick([
        'a',
        ' b ',
        '&amp;',
        '&#x41;',
        '&#66;',
        '\uFEFF',
        '\u00fc',
        '1',
        '<![CDATA[<c>]]>',
        ' ',
      ]),
    ).join('')
  const t = () =>
    pick([
      `<${p}t>${text()}</${p}t>`,
      `<${p}t xml:space="preserve">${text()}</${p}t>`,
      `<${p}t>${text()}<${p}x>${text()}</${p}x>${text()}</${p}t>`,
      `<${p}t/>`,
    ])
  const rich = () =>
    Array.from({ length: 1 + Math.floor(random() * 3) }, () =>
      pick([
        t(),
        `<${p}r><${p}rPr/>${t()}${space()}${t()}</${p}r>`,
        `<${p}rPh sb="0"><${p}t>zz</${p}t></${p}rPh>`,
        space(),
        text().replaceAll('<', ''),
        `<${p}v>9</${p}v>`,
      ]),
    ).join('')
  return { pick, space, text, t, rich }
}

/** The rows of a generated worksheet; a shared string cell refers to one of `count` strings. */
function generatedRows(
  random: () => number,
  p: string,
  count: number,
  { pick, space, text, t, rich }: ReturnType<typeof pieces>,
): string[] {
  const cell = (ref: string) => {
    const r = ref ? ` r="${ref}"` : ''
    const v = (body: string) => `<${p}v>${body}</${p}v>`
    return pick([
      `<${p}c${r}/>`,
      `<${p}c${r} t="s">${v(String(Math.floor(random() * count)))}</${p}c>`,
      `<${p}c${r} t="s">${space()}${v(` ${Math.floor(random() * count)} `)}${space()}</${p}c>`,
      `<${p}c${r} t="inlineStr"><${p}is>${rich()}</${p}is>${space()}<${p}is>${t()}</${p}is></${p}c>`,
      `<${p}c${r} t="inlineStr">${v('7')}</${p}c>`,
      `<${p}c${r} t="b">${v(pick(['0', '1', ' 0 ']))}</${p}c>`,
      `<${p}c${r}>${v(text())}${v('second')}</${p}c>`,
      `<${p}c${r}>${space()}<${p}t>no</${p}t>${v(`${text()}<${p}x>9</${p}x>${text()}`)}</${p}c>`,
      `<${p}c${r} t="str"><${p}f>A1</${p}f>${v(text())}</${p}c>`,
    ])
  }
  return Array.from({ length: Math.floor(random() * 8) }, (_, k) => {
    let column = 0
    const cells: string[] = []
    for (let n = Math.floor(random() * 6); n > 0; n--) {
      const withRef = random() < 0.6
      column += withRef ? 1 + Math.floor(random() * 3) : 1
      cells.push(cell(withRef ? `${letters(column)}${k + 1}` : ''))
      if (random() < 0.1)
        cells.push(`<${p}extLst><${p}c><${p}v>nested</${p}v></${p}c></${p}extLst>`)
      cells.push(space())
    }
    return `<${p}row r="${k + 1}">${space()}${cells.join('')}</${p}row>`
  })
}

/** A worksheet and a shared strings part with the constructs both readers must agree on. */
function generated(random: () => number) {
  const p = random() < 0.3 ? 'x:' : ''
  const ns = p ? `xmlns:x="${main}"` : `xmlns="${main}"`
  const g = pieces(random, p)
  const count = 1 + Math.floor(random() * 6)
  const si = Array.from({ length: count }, () => `<${p}si>${g.rich()}</${p}si>`)
  const sstXml = `<${p}sst ${ns}>${g.space()}${si.join(g.space())}<${p}t>stray</${p}t><${p}x><${p}si><${p}t>deep</${p}t></${p}si></${p}x></${p}sst>`
  const rows = generatedRows(random, p, count, g)
  const extra =
    random() < 0.3 ? `<${p}g><${p}row><${p}c><${p}v>deep</${p}v></${p}c></${p}row></${p}g>` : ''
  const second =
    random() < 0.3
      ? `<${p}sheetData><${p}row><${p}c><${p}v>2nd</${p}v></${p}c></${p}row></${p}sheetData>`
      : ''
  const sheetXml = `<?xml version="1.0" encoding="UTF-8"?>\n<${p}worksheet ${ns}>${g.space()}<${p}dimension ref="A1"/><${p}sheetData>${extra}${rows.join(g.space())}</${p}sheetData>${second}${g.space()}</${p}worksheet>`
  return { sheetXml, sst: sstXml }
}

/** Column letters for a column number from 1. */
const letters = (column: number): string =>
  column > 26
    ? letters(Math.floor((column - 1) / 26)) + letters(((column - 1) % 26) + 1)
    : String.fromCharCode(64 + column)

describe('readWorkbook in one pass', slow, () => {
  it('returns the rows of the tree reader on generated worksheets', async () => {
    const random = mulberry32(40)
    for (let k = 0; k < 200; k++) {
      const { sheetXml, sst: strings } = generated(random)
      const r = await readWorkbook(book({ [sheet]: sheetXml, 'xl/sharedStrings.xml': strings }))
      expect(r.worksheets[0]?.rows, sheetXml).toEqual(treeRows(sheetXml, treeStrings(strings)))
    }
  })

  it('takes the first v, the first is and the first sheetData', async () => {
    const xml = ws(
      '<row><c><v>1</v><v>2</v></c><c><v>1<x>9</x>2</v></c>' +
        '<c t="inlineStr"><is><t>a</t><r><t>b</t></r><rPh><t>z</t></rPh></is><is><t>q</t></is></c></row>',
    ).replace('</worksheet>', '<sheetData><row><c><v>3</v></c></row></sheetData></worksheet>')
    expect((await readWorkbook(book({ [sheet]: xml }))).worksheets[0]?.rows).toEqual([
      ['1', '12', 'ab'],
    ])
  })

  it('reports a cell error before a later markup error', async () => {
    const xml = `<worksheet><sheetData><row><c r="IW1"><v>1</v></c></row><row>`
    expect(await rejection(readWorkbook(book({ [sheet]: xml })))).toEqual({ code: 'cellBeyondColumnIV', params: { cell: 'IW1', part: sheet } })
  })

  it('names the part as stored in the archive in a cell error', async () => {
    const rels = `<Relationships><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/Sheet1.xml"/></Relationships>`
    expect(await rejection(readWorkbook(
        book({
          'xl/_rels/workbook.xml.rels': rels,
          [sheet]: ws('<row><c r="IW1"><v>1</v></c></row>'),
        }),
      ))).toEqual({ code: 'cellBeyondColumnIV', params: { cell: 'IW1', part: sheet } })
  })

  it('refuses a relationships or workbook part over 1 MiB before inflating', async () => {
    const parts = workbookParts([{ name: 'S1', rows: [['x']] }]).map((p) =>
      p.name === 'xl/workbook.xml' ? { ...p, size: 2097152 } : p,
    )
    expect(await rejection(readWorkbook(zip(parts)))).toEqual({ code: 'partTooLarge', params: { size: 2097152, limit: 1048576, part: 'xl/workbook.xml' } })
  })
})

describe('isWorkbook', () => {
  it('tells ZIP and legacy Excel bytes from text', () => {
    expect(isWorkbook(book({}))).toBe(true)
    expect(isWorkbook(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe(true)
    expect(isWorkbook(new TextEncoder().encode('#,Speed (FPS)\n'))).toBe(false)
    expect(isWorkbook(new Uint8Array([0x50, 0x4b]))).toBe(false)
  })
})
