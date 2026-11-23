import { expect, it } from 'vitest'
import localFont from '../src/platform/start/local-font.ts'

it('names the class that sets a font variable after the variable, as fonts.css does', () => {
  expect(localFont({ variable: '--font-drawing' }).variable).toBe('font-drawing')
})
