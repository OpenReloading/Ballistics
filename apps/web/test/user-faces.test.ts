import type { UserRecord } from '@open-reloading/schema'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch } from '../src/lib/api-fetch.ts'
import { fetchFace, fetchFaceSummaries, isFaceId } from '../src/lib/face-records.ts'
import { userFaceId } from '../src/lib/user-faces.ts'
import { storedRecords } from '../src/lib/user-store.ts'

vi.mock('../src/lib/api-fetch.ts', () => ({ apiFetch: vi.fn() }))
vi.mock('../src/lib/user-store.ts', () => ({ storedRecords: vi.fn() }))

const design = (id: string, name: string, data: object): UserRecord =>
  ({ kind: 'targetFaceDesign', id, name, saved: '2026-10-24T10:00:00.000Z', data }) as UserRecord

const complete = {
  rings: [
    { value: 1, diameter: 100 },
    { value: 2, diameter: 50 },
  ],
  blackDiameter: 50,
  events: [{ name: '10 m', distance: 10_000 }],
}

const listed = { id: 'issf-air', organization: 'ISSF', name: 'Air' }

beforeEach(() => {
  vi.mocked(storedRecords).mockResolvedValue({
    records: [
      design('a1', 'Club face', complete),
      design('b2', 'Half done', { rings: [{}], events: [] }),
    ],
    invalid: [],
  })
  vi.mocked(apiFetch).mockResolvedValue(Response.json({ items: [listed] }))
})

it('lists the designs that build a face after the catalogue faces, as the user organization', async () => {
  expect(await fetchFaceSummaries()).toEqual([
    listed,
    { id: 'user-a1', organization: 'User design', name: 'Club face' },
  ])
  expect(await isFaceId('user-a1')).toBe(true)
  expect(await isFaceId('user-b2')).toBe(false)
})

it('gives a design with any record id a valid face id', async () => {
  vi.mocked(storedRecords).mockResolvedValue({
    records: [design('My_Face 2', 'Odd id', complete)],
    invalid: [],
  })
  const id = userFaceId('My_Face 2')
  expect(id).toMatch(/^user-my-face-2-[a-z0-9]+$/)
  expect((await fetchFaceSummaries()).map((f) => f.id)).toContain(id)
})

it('keeps a record id as it is and gives ids that cut alike different faces', () => {
  expect(userFaceId('a-b')).toBe('user-a-b')
  expect(userFaceId('a_b')).not.toBe(userFaceId('a-b'))
  expect(userFaceId('a_b')).not.toBe(userFaceId('a b'))
  expect(userFaceId('___')).toMatch(/^user-design-/)
})

it('loads a design as a face of the tools that the photo search skips', async () => {
  const face = await fetchFace('user-a1')
  expect(face).toMatchObject({ id: 'user-a1', name: 'Club face', photoSearch: false })
  await expect(fetchFace('user-b2')).rejects.toThrow('No such target design')
})

it('keeps the designs when the catalogue cannot be fetched', async () => {
  // the catalogue list is cached for the page load: a fresh module has none
  vi.resetModules()
  const faces = await import('../src/lib/face-records.ts')
  vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 503 }))
  expect((await faces.fetchFaceSummaries()).map((f) => f.id)).toEqual(['user-a1'])
  expect((await faces.fetchAllFaces()).map((f) => f.id)).toEqual(['user-a1'])
  vi.mocked(storedRecords).mockResolvedValue({ records: [], invalid: [] })
  await expect(faces.fetchFaceSummaries()).rejects.toThrow('HTTP 503')
})
