import { expect, it } from 'vitest'
import { failedRun } from '../src/components/use-workbench-load.ts'

const steps = [{ charge: 0.002, error: { message: 'Error 500.' } }]

it('names a refusal only when the model refused every step', () => {
  const refused = failedRun(steps, new Response(null, { status: 422 }), undefined)
  expect(refused.outcome.status).toBe(422)
  expect(refused.text).toBe('The model refused the load. The error panel gives the reason.')
  const ladder = failedRun(steps, new Response(null, { status: 200 }), undefined)
  expect(ladder.outcome.status).toBe(422)
})

it('keeps the status of a failed request', () => {
  const failed = failedRun(steps, new Response(null, { status: 500 }), undefined)
  expect(failed.outcome.status).toBe(500)
  expect(failed.text).toBe('Error 500.')
})
