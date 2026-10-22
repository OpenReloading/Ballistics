'use client'

import { Accordion } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { type FocusEvent, type ReactNode, useLayoutEffect, useState } from 'react'

type GridSection = { key: string; title: string; content: ReactNode }

/** The help of a focused field: its label and its description, as screen readers get them. */
export function helpOf(el: Element) {
  const label = (el as HTMLInputElement).labels?.[0]?.textContent
  const text = (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => (id ? document.getElementById(id)?.textContent : ''))
    .filter(Boolean)
    .join(' ')
  return label && text ? `${label}: ${text}` : undefined
}

/**
 * The designers' property grid: a panel titled `title` (its sections then `h3`), compact
 * sections of label and field rows (`.prop-grid`),
 * an Accordion only on phones, and one reserved line at the foot that shows the focused field's
 * help (a tap focuses too; hover has the label's title and the flag's tooltip), else `message`.
 * The line keeps its height, so nothing moves.
 */
export function PropertyGrid({
  title,
  head,
  sections,
  message,
}: {
  title?: string
  /** Above the sections, such as the start-from search. */
  head?: ReactNode
  sections: GridSection[]
  message?: string
}) {
  const phone = useMediaQuery('(max-width: 47.99em)', false, { getInitialValueInEffect: false })
  const [focused, setFocused] = useState<Element>()
  const [help, setHelp] = useState<string>()
  // after each commit: an edit changes the focused field's state, so its description
  useLayoutEffect(() => {
    const text = focused && helpOf(focused)
    if (text !== help) setHelp(text)
  })
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: follows the focus of the fields inside, takes none itself
    <div
      className="prop-form page-panel"
      onFocus={(e: FocusEvent) => setFocused(e.target)}
      onBlur={() => setFocused(undefined)}
    >
      {title && (
        <div className="page-panel-head">
          <h2 className="page-panel-title record-heading">{title}</h2>
        </div>
      )}
      {head}
      {phone ? (
        <Accordion
          multiple
          defaultValue={sections.map((s) => s.key)}
          order={title ? 3 : 2}
          className="panels"
        >
          {sections.map((s) => (
            <Accordion.Item key={s.key} value={s.key}>
              <Accordion.Control>{s.title}</Accordion.Control>
              <Accordion.Panel>{s.content}</Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      ) : (
        sections.map((s) => {
          const Heading = title ? 'h3' : 'h2'
          return (
            <div key={s.key}>
              <Heading className="prop-head">{s.title}</Heading>
              {s.content}
            </div>
          )
        })
      )}
      {/* the help repeats the field's description, which screen readers have already */}
      <p className="grid-help">{help ? <span aria-hidden="true">{help}</span> : message}</p>
    </div>
  )
}
