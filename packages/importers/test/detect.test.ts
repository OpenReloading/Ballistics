import { describe, expect, it } from 'vitest'
import { detectFormat } from '../src/index.ts'
import { shotViewEnglish, shotViewGerman, template } from './fixtures.ts'

describe('detectFormat', () => {
  it('tells each format by its shape', () => {
    expect(detectFormat(shotViewEnglish)).toBe('shotview-csv')
    expect(detectFormat(shotViewGerman)).toBe('shotview-csv')
    expect(detectFormat(template)).toBe('openreloading-csv')
    expect(detectFormat('velocity;velocityUnit\n812,5;m/s')).toBe('openreloading-csv')
    expect(detectFormat('String,Velocity\nA,2795\n')).toBe('openreloading-csv')
    expect(detectFormat('string,velocity,velocityUnit,\nA,2795,fps,\n')).toBe('openreloading-csv')
  })

  it('returns null for an empty or unknown file', () => {
    expect(detectFormat('')).toBeNull()
    expect(detectFormat('date,velocity\n2026-03-01,800')).toBeNull()
    expect(detectFormat('#,SPEED,TIME\n1,2800,10:00')).toBeNull()
    expect(detectFormat('2800\n2810\n2795')).toBeNull()
    expect(detectFormat('2800,2810,2795')).toBeNull()
    expect(detectFormat('Speed,Unit\n2800,fps')).toBeNull()
  })
})
