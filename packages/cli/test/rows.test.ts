import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../src/errors.ts'
import { parseRows, readRows } from '../src/rows.ts'

const head = 'cartridge,bullet,powder,charge_g,velocity_ms'

describe('parseRows', () => {
  it('reads required and optional columns, quotes, CRLF and a byte order mark', () => {
    const text = `﻿table,${head},pressure_bar,barrel_mm,temperature_c,coal_mm\r\n"a, b",c1,b1,p1,2.5,800,3500,600,-5,70\r\n\r\n,c2,b2,p2,1,700,,,,\r\n`
    expect(parseRows(text, 'f.csv')).toEqual([
      {
        line: 2,
        cartridge: 'c1',
        bullet: 'b1',
        powder: 'p1',
        charge: 2.5,
        velocity: 800,
        pressure: 3500,
        barrel: 600,
        temperature: -5,
        coal: 70,
        table: 'a, b',
      },
      {
        line: 4,
        cartridge: 'c2',
        bullet: 'b2',
        powder: 'p2',
        charge: 1,
        velocity: 700,
        pressure: undefined,
        barrel: undefined,
        temperature: undefined,
        coal: undefined,
        table: undefined,
      },
    ])
  })

  it('carries the optional columns the models may read later', () => {
    const text = `${head},pressure_basis,bearing_mm,muzzle_distance_m,session,rifle,lot\nc,b,p,1,2,piezo,9.5,3,s1,r1,l1\n`
    expect(parseRows(text, 'f.csv')[0]).toMatchObject({
      pressureBasis: 'piezo',
      bearing: 9.5,
      muzzleDistance: 3,
      session: 's1',
      rifle: 'r1',
      lot: 'l1',
    })
  })

  it('refuses a quote that is misplaced or not closed', () => {
    expect(() => parseRows(`${head}\nc,"b,p,1,2\n`, 'f.csv')).toThrow('f.csv:2: a quote')
    expect(() => parseRows(`${head}\nc,b"x,p,1,2\n`, 'f.csv')).toThrow('a quote')
  })

  it('counts the line of a row after a quoted line break', () => {
    const rows = parseRows(`${head},table\nc,b,p,1,2,"x\ny"\nc,b,p,1,2,z\n`, 'f.csv')
    expect(rows.map((r) => r.line)).toEqual([2, 4])
  })

  it.each(['0x1F', '0b11', '0o7', 'Infinity', '1e', '1,5'])('rejects %s as a number', (value) => {
    expect(() => parseRows(`${head}\nc,b,p,"${value}",800\n`, 'f.csv')).toThrow(
      'f.csv:2: charge_g is not a number',
    )
  })

  it('rejects a long run of digits with a bad tail without stalling', () => {
    const start = performance.now()
    expect(() => parseRows(`${head}\nc,b,p,"${'1'.repeat(100000)}x",800\n`, 'f.csv')).toThrow(
      'not a number',
    )
    // a backtracking regression takes seconds to minutes here, a coverage run on a loaded runner far less
    expect(performance.now() - start).toBeLessThan(5000)
  })

  it.each(['2', '2.5', '.5', '5.', '+2', '2e-1', '2E0'])('reads %s as a number', (value) => {
    expect(parseRows(`${head}\nc,b,p,${value},800\n`, 'f.csv')[0]?.charge).toBe(Number(value))
  })

  it('names file, line and column of each problem and never quotes a value', () => {
    const text = `${head},barrel_mm,temperature_c\nc,b,p,abc,800,,\nc,b,p,0,800,,\n,b,p,1,800,-1,\nc,b,p,1,800,,-300\nc,b,p\n`
    let message = ''
    try {
      parseRows(text, 'rows.csv')
    } catch (error) {
      message = (error as Error).message
    }
    expect(message.split('\n')).toEqual([
      'rows.csv:2: charge_g is not a number',
      'rows.csv:3: charge_g must be above 0',
      'rows.csv:4: cartridge is empty; barrel_mm must be above 0',
      'rows.csv:5: temperature_c must be above -273.15',
      'rows.csv:6: has 3 fields, the header has 7',
    ])
    expect(message).not.toContain('abc')
  })

  it('stops listing after ten problems and counts the rest', () => {
    const body = Array.from({ length: 13 }, () => 'c,b,p,x,800').join('\n')
    expect(() => parseRows(`${head}\n${body}\n`, 'f.csv')).toThrow(/\n3 more$/)
  })

  it.each([
    ['', 'the file is empty'],
    [`${head},extra\n`, 'unknown column'],
    [`${head},table,table\n`, 'repeats'],
    ['cartridge,bullet,powder\n', 'lacks charge_g, velocity_ms'],
  ])('refuses the header %j', (text, part) => {
    expect(() => parseRows(text, 'f.csv')).toThrow(part)
    expect(() => parseRows(text, 'f.csv')).toThrow(UsageError)
  })
})

describe('readRows', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-rows-test-'))
  mkdirSync(join(dir, 'tables'))
  writeFileSync(join(dir, 'tables', 'b.csv'), `${head}\nc2,b,p,1,2\n`)
  writeFileSync(join(dir, 'tables', 'a.csv'), `${head}\nc1,b,p,1,2\n`)
  writeFileSync(join(dir, 'tables', 'notes.txt'), 'not rows')
  mkdirSync(join(dir, 'empty'))
  writeFileSync(join(dir, 'none.csv'), `${head}\n`)

  it('reads a folder of .csv files in name order with their bytes', () => {
    const { rows, files } = readRows(join(dir, 'tables'))
    expect(rows.map((r) => r.cartridge)).toEqual(['c1', 'c2'])
    expect(files.map((f) => f.toString().split('\n')[1])).toEqual(['c1,b,p,1,2', 'c2,b,p,1,2'])
  })

  it('refuses a missing path, an empty folder and a file without rows', () => {
    expect(() => readRows(join(dir, 'missing'))).toThrow('does not exist')
    expect(() => readRows(join(dir, 'empty'))).toThrow('no .csv file')
    expect(() => readRows(join(dir, 'none.csv'))).toThrow('no row')
  })
})
