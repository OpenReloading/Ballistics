import type { ReactElement } from 'react'
import { expect, it, vi } from 'vitest'
import type { NumberField } from '../src/components/number-field.tsx'
import { type FieldSpec, fieldValueFromText } from '../src/lib/field-spec.ts'
import { kilogramsPerGrain, presetUnits } from '../src/lib/units.ts'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./fake-hooks.ts')).fakeHooks,
}))
vi.mock('../src/components/units-settings.tsx', async () => {
  const { presetUnits } = await import('../src/lib/units.ts')
  return { useUnits: () => ({ system: presetUnits('us') }) }
})

const { renderHook } = await import('./fake-hooks.ts')
const { SiField } = await import('../src/components/si-field.tsx')

type Props = Parameters<typeof NumberField>[0]
const us = presetUnits('us')
const spec: FieldSpec = {
  key: 'charge',
  label: 'Charge mass',
  quantity: 'charge',
  required: true,
  min: 1,
}
/** What the field hands on when `text` is typed in grains. */
const typed = (text: string) => fieldValueFromText('charge', us, text)

function field(props: Partial<Parameters<typeof SiField>[0]> = {}) {
  const onCommit = vi.fn<(si: number | undefined) => void>()
  const view = renderHook(() => SiField({ spec, si: 40 * kilogramsPerGrain, onCommit, ...props }))
  const props_ = () => (view.rerender() as ReactElement<Props>).props
  return { onCommit, props: props_ }
}

it('shows the SI value in the units of the Settings and commits a typed value in SI', () => {
  const f = field()
  expect(f.props().value?.text).toBe('40')
  f.props().onChange(typed('46.5'))
  expect(f.onCommit).toHaveBeenCalledOnce()
  expect(f.onCommit.mock.calls[0]?.[0]).toBeCloseTo(46.5 * kilogramsPerGrain, 12)
  expect(f.props().value?.text).toBe('46.5')
})

it('refuses an empty required field and a value below the bound, with the message', () => {
  const f = field()
  f.props().onChange(typed(''))
  expect(f.onCommit).not.toHaveBeenCalled()
  const error = f.props().error
  expect(typeof error === 'function' && error(us)).toBe('Enter a number for Charge mass.')
  f.props().onChange(typed('0.5'))
  expect(f.onCommit).not.toHaveBeenCalled()
  // leaving the field drops the refused text: the stored value shows again
  f.props().onBlur?.()
  expect(f.props().value?.text).toBe('40')
  expect(f.props().error).toBeUndefined()
})

it('commits an emptied field that is not required', () => {
  const f = field({ spec: { ...spec, required: false } })
  f.props().onChange(typed(''))
  expect(f.onCommit).toHaveBeenCalledWith(undefined)
})

it('when deferred commits on Enter or when the field is left, never on a keystroke', () => {
  const f = field({ deferred: true })
  f.props().onChange(typed('42'))
  expect(f.onCommit).not.toHaveBeenCalled()
  f.props().onEnter?.()
  expect(f.onCommit.mock.calls[0]?.[0]).toBeCloseTo(42 * kilogramsPerGrain, 12)
  f.props().onChange(typed('43'))
  f.props().onBlur?.()
  expect(f.onCommit).toHaveBeenCalledTimes(2)
  // nothing typed since: leaving commits nothing
  f.props().onBlur?.()
  expect(f.onCommit).toHaveBeenCalledTimes(2)
})

it('when deferred drops a refused draft on Enter without a commit', () => {
  const f = field({ deferred: true })
  f.props().onChange(typed('0.5'))
  f.props().onEnter?.()
  expect(f.onCommit).not.toHaveBeenCalled()
  expect(f.props().value?.text).toBe('40')
})

it('writes a shown value before the placeholder in the units the field shows', () => {
  const f = field({ si: undefined, shown: 40 * kilogramsPerGrain, placeholder: 'from the record' })
  expect(f.props().value?.text).toBe('')
  const placeholder = f.props().placeholder
  expect(typeof placeholder === 'function' && placeholder(us)).toBe('40.0 from the record')
  expect(field({ placeholder: 'none' }).props().placeholder).toBe('none')
})
