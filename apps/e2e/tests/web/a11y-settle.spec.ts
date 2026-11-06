import { expect, test } from '@playwright/test'
import { AxeBuilder } from './a11y.ts'

test('axe scans the colors a color scheme switch ends on, past endless and paused animations', async ({
  page,
}) => {
  await page.setContent(`<!doctype html><html lang="en"><title>Settle</title><style>
    main { background: #000 }
    p { color: #000; transition: color 2s linear }
    @media (prefers-color-scheme: dark) { p { color: #fff } }
    span { display: inline-block; width: 1em; height: 1em; animation: turn 1s linear infinite }
    b { display: inline-block; width: 1em; height: 1em; animation: turn 1s linear paused }
    @keyframes turn { to { transform: rotate(1turn) } }
  </style><main><p>Text<span></span><b></b></p></main></html>`)
  await page.emulateMedia({ colorScheme: 'dark' })
  const { violations } = await new AxeBuilder({ page }).include('main').analyze()
  expect(violations).toEqual([])
})
