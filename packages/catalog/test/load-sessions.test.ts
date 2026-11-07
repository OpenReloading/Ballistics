import { describe, expect, it } from 'vitest'
import type { Bundle } from '../src/records.ts'
import { checkLoadSessionReferences } from '../src/references.ts'

const bundle = (sessions: string[]) =>
  ({
    loads: [{ id: 'test-load', sessions }],
    chronoSessions: [{ id: 'test-session' }],
  }) as unknown as Pick<Bundle, 'loads' | 'chronoSessions'>

describe('checkLoadSessionReferences', () => {
  it('accepts a session that exists and names one that does not', () => {
    const errors: string[] = []
    checkLoadSessionReferences(bundle(['catalogue:test-session']), errors)
    expect(errors).toEqual([])
    checkLoadSessionReferences(bundle(['catalogue:missing']), errors)
    expect(errors).toEqual(['loads/test-load.json: unknown session "catalogue:missing"'])
  })
})
