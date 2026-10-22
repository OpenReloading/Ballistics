import { expect, it } from 'vitest'
import { AppPopover } from '../src/components/app-popover.tsx'

it('returns the focus to the trigger and has the medium shadow unless a caller says otherwise', () => {
  expect(AppPopover({}).props).toMatchObject({ returnFocus: true, shadow: 'md' })
  expect(AppPopover({ shadow: 'sm' }).props.shadow).toBe('sm')
})
