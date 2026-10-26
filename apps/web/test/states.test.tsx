import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { Loading, Message, MessageSlot } from '../src/components/states.tsx'

const html = (node: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)

it('the inline loading state is the bare line: no status role, no ellipsis, no skeleton', () => {
  // no Mantine component, so no provider is needed
  expect(renderToStaticMarkup(<Loading what="the preview" inline />)).toBe(
    '<p>Loading the preview</p>',
  )
  const full = html(<Loading what="the preview" />)
  expect(full).toContain('role="status"')
  expect(full).toContain('Loading the preview…')
})

it('every severity says its word and has an icon, an error is announced at once and the rest politely', () => {
  for (const [severity, word, role] of [
    ['info', 'Note', 'status'],
    ['warning', 'Warning', 'status'],
    ['error', 'Error', 'alert'],
  ] as const) {
    const out = html(<Message severity={severity}>Text of it.</Message>)
    expect(out).toContain(`data-severity="${severity}"`)
    expect(out).toContain(`role="${role}"`)
    expect(out).toContain(`<span class="message-label">${word}:</span>`)
    expect(out).toContain('<svg')
    expect(out).toContain('Text of it.')
  }
})

it('a message with a title puts the word in the title', () => {
  const out = html(
    <Message severity="error" title="It failed.">
      Why.
    </Message>,
  )
  expect(out).toMatch(/message-label">Error:<\/span> It failed\./)
})

it('the message slot is one region of the same markup for none, one and many messages', () => {
  const slot = (n: number) =>
    html(
      <MessageSlot
        label="Messages"
        messages={Array.from({ length: n }, (_, k) => ({ severity: 'info', text: `m${k}` }))}
      />,
    )
  expect(slot(0)).toContain('aria-label="Messages"')
  // a polite region the messages appear in: its notes carry no role of their own
  expect(slot(0)).toContain('aria-live="polite"')
  expect(slot(1)).toContain('role="none"')
  expect(
    html(<MessageSlot label="Messages" messages={[{ severity: 'error', text: 'x' }]} />),
  ).toContain('role="alert"')
  expect(slot(0)).not.toContain('tabindex')
  // a list that may scroll takes focus
  for (const n of [1, 3, 10]) {
    const out = slot(n)
    expect(out).toContain('tabindex="0"')
    expect(out.match(/data-severity="info"/g)).toHaveLength(n)
  }
})
