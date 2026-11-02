import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ErrorView } from '../src/components/workbench-readouts.tsx'

const notice = 'simulation, not load data'

it('a schema error lists each issue with the notice', () => {
  const html = renderToStaticMarkup(
    <ErrorView
      outcome={{
        kind: 'error',
        status: 400,
        retryAfter: null,
        body: {
          statusCode: 400,
          error: 'Bad Request',
          message: 'request does not match the schema',
          issues: [{ path: ['load', 'charge'], message: 'Too small' }],
          notice,
        },
      }}
    />,
  )
  expect(html).toContain('<li>load.charge: Too small</li>')
  expect(html).toContain(`Notice: ${notice}`)
})

it.each([
  ['chamberVolume', 'The charge does not fit the chamber'],
  ['noShotStart', 'burned out before the bullet started to move'],
  ['stuck', 'The bullet stopped in the bore'],
  ['integration', 'The calculation did not converge'],
  ['maxTime', 'did not reach the muzzle'],
  ['input', 'A value is outside the model&#x27;s range'],
])('an invalid run with reason %s says what is wrong in words', (reason, text) => {
  const html = renderToStaticMarkup(
    <ErrorView
      outcome={{
        kind: 'error',
        status: 422,
        retryAfter: null,
        body: { statusCode: 422, message: `interior: ${reason}`, reason, notice },
      }}
    />,
  )
  expect(html).toContain(text)
  expect(html).not.toContain(`interior: ${reason}`)
  expect(html).toContain(`Reason: ${reason}`)
})

it('an unknown reason keeps the message of the answer', () => {
  const html = renderToStaticMarkup(
    <ErrorView
      outcome={{
        kind: 'error',
        status: 422,
        retryAfter: null,
        body: { statusCode: 422, message: 'a new kind of refusal', reason: 'other' },
      }}
    />,
  )
  expect(html).toContain('a new kind of refusal')
})
