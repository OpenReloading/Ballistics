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
