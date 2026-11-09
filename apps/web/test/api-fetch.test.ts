import { describe, expect, it, vi } from 'vitest'

const refusal = {
  statusCode: 422,
  error: 'Unprocessable Entity',
  message: 'ladderLowestChargeNotPositive',
  code: 'ladderLowestChargeNotPositive',
  params: { charge: -0.0012 },
}

vi.mock('../src/lib/static-api.ts', () => ({
  staticFetch: async () => Response.json(refusal, { status: 422 }),
}))
vi.mock('../src/lib/refusal-words.ts', () => ({ refusalSentence: () => 'worded' }))

const { apiFetch } = await import('../src/lib/api-fetch.ts')

describe('apiFetch', () => {
  it('gives a typed refusal its sentence as the message', async () => {
    const res = await apiFetch('interior', { method: 'POST' })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ ...refusal, message: 'worded' })
  })
})
