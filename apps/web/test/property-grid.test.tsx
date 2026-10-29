import { Accordion } from '@mantine/core'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./fake-hooks.ts')).fakeHooks,
}))
const media = vi.hoisted(() => ({ phone: false }))
vi.mock('@mantine/hooks', async (original) => ({
  ...(await original<typeof import('@mantine/hooks')>()),
  useMediaQuery: () => media.phone,
}))

const { renderHook } = await import('./fake-hooks.ts')
const { helpOf, PropertyGrid } = await import('../src/components/property-grid.tsx')

/** Descriptions by element id, as `document.getElementById` finds them. */
const texts = new Map([
  ['d1', 'Measured at the base.'],
  ['d2', 'From the record.'],
])
beforeEach(() => {
  media.phone = false
  vi.stubGlobal('document', {
    getElementById: (id: string) => (texts.has(id) ? { textContent: texts.get(id) } : null),
  })
})
afterEach(() => vi.unstubAllGlobals())

/** A field labelled `label` and described by the ids `describedBy`. */
const input = (label: string | undefined, describedBy: string | null) =>
  ({
    labels: label === undefined ? [] : [{ textContent: label }],
    getAttribute: (name: string) => (name === 'aria-describedby' ? describedBy : null),
  }) as unknown as Element

it('reads the help of a field as a screen reader gets it: label, then its descriptions', () => {
  expect(helpOf(input('Diameter', 'd1 d2'))).toBe(
    'Diameter: Measured at the base. From the record.',
  )
  // an id without an element and a double space add nothing
  expect(helpOf(input('Diameter', 'd1  gone'))).toBe('Diameter: Measured at the base.')
  expect(helpOf(input(undefined, 'd1'))).toBeUndefined()
  expect(helpOf(input('Diameter', null))).toBeUndefined()
  expect(helpOf(input('Diameter', 'gone'))).toBeUndefined()
})

type Props = Parameters<typeof PropertyGrid>[0]
const sections = [
  { key: 'size', title: 'Size', content: 'size rows' },
  { key: 'form', title: 'Form', content: 'form rows' },
]
const kids = (node: ReactNode): ReactElement<{ children?: ReactNode }>[] =>
  Children.toArray(node).filter(isValidElement) as ReactElement<{ children?: ReactNode }>[]

function grid(props: Partial<Props> = {}) {
  const view = renderHook(
    () =>
      PropertyGrid({ sections, message: 'Pick a field.', ...props }) as ReactElement<{
        children: ReactNode
        onFocus: (e: { target: Element }) => void
        onBlur: () => void
      }>,
  )
  const root = () => view.rerender()
  /** The help line at the foot: its text and whether screen readers skip it. */
  const help = () => {
    const p = kids(root().props.children).at(-1)
    const child = p?.props.children
    return isValidElement<{ children: string; 'aria-hidden': string }>(child)
      ? { text: child.props.children, hidden: child.props['aria-hidden'] === 'true' }
      : { text: child, hidden: false }
  }
  return { root, help }
}

it('shows the focused field help in the foot line in place of the message, until the focus leaves', () => {
  const g = grid()
  expect(g.help()).toEqual({ text: 'Pick a field.', hidden: false })
  g.root().props.onFocus({ target: input('Diameter', 'd1') })
  g.root()
  // screen readers have the description from the field already
  expect(g.help()).toEqual({ text: 'Diameter: Measured at the base.', hidden: true })
  g.root().props.onBlur()
  g.root()
  expect(g.help()).toEqual({ text: 'Pick a field.', hidden: false })
})

it('keeps the message for a focused field without help', () => {
  const g = grid()
  g.root().props.onFocus({ target: input('Notes', null) })
  g.root()
  expect(g.help().text).toBe('Pick a field.')
})

it('heads the sections one level below the panel title, and folds them on a phone', () => {
  const headings = (props: Partial<Props>) =>
    kids(grid(props).root().props.children)
      .flatMap((k) => kids(k.props.children))
      .filter((k) => k.props.children === 'Size' || k.props.children === 'Form')
      .map((k) => k.type)
  expect(headings({})).toEqual(['h2', 'h2'])
  expect(headings({ title: 'Bullet' })).toEqual(['h3', 'h3'])
  media.phone = true
  const accordion = kids(grid({ title: 'Bullet' }).root().props.children).find(
    (k) => k.type === Accordion,
  ) as ReactElement<{ order: number; defaultValue: string[] }> | undefined
  expect(accordion?.props.order).toBe(3)
  expect(accordion?.props.defaultValue).toEqual(['size', 'form'])
})
