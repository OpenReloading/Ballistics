/** Invented files for the prototype: tables of bullets, powders and cartridges, a load file of an invented format, an unrelated table. */

export interface Invented {
  name: string
  bytes: Uint8Array
  /** What the file is for, in one line. */
  note: string
}

const enc = (s: string) => new TextEncoder().encode(s)

/** A seeded generator (mulberry32), so every run writes the same files. */
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const makers = [
  'Demo Maker 1',
  'Demo Maker 2',
  'Demo Maker 3',
  'Demo Maker 4',
  'Demo Maker 5',
  'Demo Maker 6',
]
const calibers = [
  { cal: '.224', inch: 0.224, grains: [40, 90] },
  { cal: '.264', inch: 0.264, grains: [100, 160] },
  { cal: '.308', inch: 0.308, grains: [110, 250] },
  { cal: '.338', inch: 0.338, grains: [200, 300] },
] as const

/** Bullet rows as `[name, maker, caliber, diameter in, mass gr, length in, G1, G7]`; every 97th row has a bad mass, 211th a zero diameter, 331st no name, 251st repeats the row before, 503rd changes the length of the row before. */
export function bulletRows(n: number): string[][] {
  const r = rng(7)
  const rows: string[][] = []
  for (let i = 1; i <= n; i++) {
    const c = calibers[i % calibers.length] ?? calibers[0]
    const grains = Math.round(c.grains[0] + r() * (c.grains[1] - c.grains[0]))
    const row = [
      `Demo ${c.cal} ${grains} #${i}`,
      makers[i % makers.length] ?? '',
      c.cal,
      c.inch.toFixed(3),
      String(grains),
      (0.6 + r() * 0.9).toFixed(3),
      (0.2 + r() * 0.5).toFixed(3),
      (0.1 + r() * 0.3).toFixed(3),
    ]
    const prev = rows[rows.length - 1]
    if (i % 97 === 0) row[4] = 'n/a'
    else if (i % 211 === 0) row[3] = '0'
    else if (i % 331 === 0) row[0] = ''
    else if (prev && i % 251 === 0) rows.push([...prev])
    else if (prev && i % 503 === 0) rows.push([...prev.slice(0, 5), '9.999', ...prev.slice(6)])
    rows.push(row)
  }
  return rows
}

const csv = (rows: string[][], d = ',') =>
  rows
    .map((r) =>
      r.map((c) => (c.includes(d) || c.includes('"') ? `"${c.replaceAll('"', '""')}"` : c)).join(d),
    )
    .join('\n')

const bulletHeader = [
  'Name',
  'Maker',
  'Caliber',
  'Diameter (in)',
  'Weight (gr)',
  'Length (in)',
  'G1',
  'G7',
]

/** A CRC-32 table lookup (APPNOTE 4.4.7). */
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff
  for (const x of b) c = (crcTable[(c ^ x) & 0xff] ?? 0) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** A ZIP archive of stored (uncompressed) parts: enough for the workbook reader. */
function zip(parts: { name: string; data: string }[]): Uint8Array {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const p of parts) {
    const name = enc(p.name)
    const data = enc(p.data)
    const crc = crc32(data)
    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true)
    head.setUint16(4, 20, true)
    head.setUint32(14, crc, true)
    head.setUint32(18, data.length, true)
    head.setUint32(22, data.length, true)
    head.setUint16(26, name.length, true)
    const entry = new DataView(new ArrayBuffer(46))
    entry.setUint32(0, 0x02014b50, true)
    entry.setUint16(4, 20, true)
    entry.setUint16(6, 20, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, data.length, true)
    entry.setUint32(24, data.length, true)
    entry.setUint16(28, name.length, true)
    entry.setUint32(42, offset, true)
    chunks.push(new Uint8Array(head.buffer), name, data)
    central.push(new Uint8Array(entry.buffer), name)
    offset += 30 + name.length + data.length
  }
  const dirLength = central.reduce((s, c) => s + c.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, parts.length, true)
  end.setUint16(10, parts.length, true)
  end.setUint32(12, dirLength, true)
  end.setUint32(16, offset, true)
  const all = [...chunks, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0))
  let at = 0
  for (const c of all) {
    out.set(c, at)
    at += c.length
  }
  return out
}

const xml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const letter = (i: number) => String.fromCharCode(65 + i)

/** An XLSX workbook with one worksheet of inline strings. */
export function workbookBytes(sheet: string, rows: string[][]): Uint8Array {
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const pkg = 'http://schemas.openxmlformats.org/package/2006/relationships'
  const cells = rows
    .map(
      (cs, r) =>
        `<row r="${r + 1}">${cs.map((t, c) => (t ? `<c r="${letter(c)}${r + 1}" t="inlineStr"><is><t>${xml(t)}</t></is></c>` : '')).join('')}</row>`,
    )
    .join('')
  return zip([
    { name: '[Content_Types].xml', data: '<Types/>' },
    {
      name: '_rels/.rels',
      data: `<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      data: `<workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="${xml(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: `<worksheet xmlns="${main}"><sheetData>${cells}</sheetData></worksheet>`,
    },
  ])
}

/** The invented files by name. `bullets-5000.csv` is the speed file; the others are small. */
export function inventedFiles(): Invented[] {
  const eu = [
    ['Bezeichnung', 'Hersteller', 'Kaliber', 'Durchmesser mm', 'Gewicht g', 'Länge mm', 'G1'],
    ['Demo Spitzer 150', 'Demo Maker 1', '.308', '7,82', '9,72', '31,5', '0,45'],
    ['Demo Spitzer 168', 'Demo Maker 2', '.308', '7,82', '10,89', '33,0', '0,52'],
    ['Demo Rundkopf 180', 'Demo Maker 3', '.308', '7,82', '11,66', '29,0', '0,31'],
    ['Demo Boat Tail 140', 'Demo Maker 1', '6.5 mm', '6,70', '9,07', '34,0', '0,60'],
  ]
  const powders = [
    ['Name', 'Maker', 'Grain form', 'Base', 'Bulk density (g/cm3)'],
    ['Demo Powder DP40', 'Demo Powder Co', 'extruded', 'single', '0.92'],
    ['Demo Powder DP41', 'Demo Powder Co', 'stick', 'double-base', '0.95'],
    ['Demo Powder DB10', 'Demo Powder Co', 'ball', 'double', '0.99'],
    ['Demo Powder DF05', 'Demo Powder Co', 'flake', 'single', '0.55'],
  ]
  const cartridges = [
    ['Name', 'Case length (mm)', 'COAL (mm)', 'Bullet diameter (mm)', 'Pmax (bar)'],
    ['Demo 30-06', '63.35', '84.6', '7.82', '4050'],
    ['Demo 308', '51.18', '71.1', '7.82', '4150'],
    ['Demo 6.5x55', '55.0', '80.0', '6.7', '3800'],
    ['Demo 223', '44.7', '57.4', '5.7', '4300'],
  ]
  const unrelated = [
    ['Date', 'City', 'Temperature', 'Wind'],
    ['2026-01-02', 'Alphaville', '3.5', '12'],
    ['2026-01-03', 'Betaburg', '1.0', '20'],
    ['2026-01-04', 'Gammatown', '-2.5', '5'],
  ]
  const sheet = [bulletHeader, ...bulletRows(30)]
  const load = [
    'DEMO-LOAD 1',
    'bullet: Demo Spitzer 168',
    'bullet mass: 168 gr',
    'bullet diameter: 0.308 in',
    'powder: Demo Powder DP40',
    'charge: 42.5 gr',
    'primer: Demo Primer Small Rifle',
  ].join('\n')
  const guess = [
    ['Name', 'Dia', 'Len'],
    ['Demo A', '7.82', '31.5'],
    ['Demo B', '6.70', '34.0'],
    ['Demo C', '5.70', '24.0'],
  ]
  return [
    {
      name: 'bullets-5000.csv',
      bytes: enc(csv([bulletHeader, ...bulletRows(5000)])),
      note: '5,000 bullets with bad, repeated and changed rows',
    },
    {
      name: 'bullets-eu.csv',
      bytes: enc(`﻿${csv(eu, ';')}`),
      note: 'semicolon, decimal comma, mm and g',
    },
    {
      name: 'powders.csv',
      bytes: enc(csv(powders)),
      note: 'powders, spelled grain forms and bases',
    },
    { name: 'cartridges.csv', bytes: enc(csv(cartridges)), note: 'cartridges, bar' },
    {
      name: 'bullets.xlsx',
      bytes: workbookBytes('Bullets', sheet),
      note: 'the same bullets in a workbook',
    },
    { name: 'weather.csv', bytes: enc(csv(unrelated)), note: 'not a reloading table' },
    { name: 'demo.load', bytes: enc(load), note: 'load file of an invented text format' },
    {
      name: 'headers-only-length.csv',
      bytes: enc(csv(guess)),
      note: 'name, diameter and length only',
    },
    {
      name: 'notes.txt',
      bytes: enc('Range day, bring the chronograph.\nCheck the new scale.\n'),
      note: 'text without a table',
    },
  ]
}
