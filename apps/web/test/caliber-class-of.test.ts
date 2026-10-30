import { describe, expect, it, vi } from 'vitest'
import {
  type ClassMembers,
  classDisciplinesHref,
  classOfCartridge,
  fetchClassMembers,
} from '../src/lib/caliber-class-of.ts'

const api = vi.hoisted(() => ({ records: new Map<string, unknown>(), status: 200 }))
vi.mock('../src/lib/api-fetch.ts', () => ({
  fetchRecord: async (kind: string, id: string) => api.records.get(`${kind}/${id}`),
  apiFetch: async () =>
    Response.json({ items: [{ id: 'rifle-308' }, { id: 'gone' }] }, { status: api.status }),
}))

const classes: ClassMembers[] = [
  { id: 'air-4-5', name: '4.5 mm (.177) air', cartridges: [] },
  { id: 'rifle-308', name: '.308 rifle', cartridges: ['308-win', '7-62x51'] },
]

describe('classOfCartridge', () => {
  it('finds the class whose members name the cartridge', () => {
    expect(classOfCartridge(classes, '7-62x51')?.id).toBe('rifle-308')
  })

  it('finds none for a cartridge in no class or no cartridge', () => {
    expect(classOfCartridge(classes, '22-lr')).toBeUndefined()
    expect(classOfCartridge(classes, undefined)).toBeUndefined()
  })
})

describe('classDisciplinesHref', () => {
  it('sets the class filter only', () => {
    expect(classDisciplinesHref('rifle-308')).toBe('/disciplines?class=rifle-308')
  })
})

describe('fetchClassMembers', () => {
  it('reads each listed class record and skips one that is missing', async () => {
    api.records.set('caliber-classes/rifle-308', { ...classes[1], diameter: { value: 7.82 } })
    expect(await fetchClassMembers()).toEqual([classes[1]])
  })

  it('throws on a failed list', async () => {
    api.status = 503
    await expect(fetchClassMembers()).rejects.toThrow('Error 503.')
    api.status = 200
  })
})
