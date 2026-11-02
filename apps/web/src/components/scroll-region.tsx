'use client'

import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

/** Calls `set` with whether `box` overflows, now and on every resize of it or its content. */
export function watchOverflow(box: HTMLElement, set: (over: boolean) => void) {
  const check = () => set(box.scrollWidth > box.clientWidth || box.scrollHeight > box.clientHeight)
  const observer = new ResizeObserver(check)
  observer.observe(box)
  // the content grows or shrinks with rows and filters, the box with the window
  for (const child of box.children) observer.observe(child)
  return () => observer.disconnect()
}

/**
 * The props of a box that scrolls by itself (spread them on it; `box` also receives the element): a
 * named region and a tab stop for keyboard scrolling only while its content overflows, as
 * `ScrollRegion` does.
 */
export function useScrollFocus<E extends HTMLElement>(label: string, box?: RefObject<E | null>) {
  const [node, setNode] = useState<E | null>(null)
  const [over, setOver] = useState(true)
  useEffect(() => (node ? watchOverflow(node, setOver) : undefined), [node])
  const ref = useCallback(
    (n: E | null) => {
      if (box) box.current = n
      setNode(n)
    },
    [box],
  )
  return { ref, ...(over && { role: 'region', 'aria-label': label, tabIndex: 0 }) }
}

/**
 * A wide table's container: narrow screens scroll it, not the page. While its content overflows it
 * is a named region and a tab stop for keyboard scrolling; otherwise neither, so a table that fits
 * adds no stop and no landmark. Both from the server HTML on: a box that overflows before hydration
 * stays reachable; the observer drops them once the content fits.
 */
export function ScrollRegion({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [over, setOver] = useState(true)
  // the edges with columns beyond them, for the fade that shows them (globals.css)
  const [more, setMore] = useState<'start' | 'end' | 'both'>()
  const edges = () => {
    const b = ref.current
    if (!b) return
    const left = Math.abs(b.scrollLeft)
    const start = left > 1
    const end = b.scrollWidth - b.clientWidth - left > 1
    setMore(start && end ? 'both' : start ? 'start' : end ? 'end' : undefined)
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: edges reads the ref only
  useEffect(
    () =>
      ref.current
        ? watchOverflow(ref.current, (o) => {
            setOver(o)
            edges()
          })
        : undefined,
    [],
  )
  return (
    // a scrollable region needs focus to scroll by keyboard
    <div
      ref={ref}
      className="scroll"
      data-more={more}
      onScroll={edges}
      {...(over && { role: 'region', 'aria-label': label, tabIndex: 0 })}
    >
      {children}
    </div>
  )
}

const tableRoles: Record<string, string> = {
  table: 'table',
  thead: 'rowgroup',
  tbody: 'rowgroup',
  tfoot: 'rowgroup',
  tr: 'row',
  td: 'cell',
}

/**
 * `node` with the ARIA role of every table element in it (through fragments, not into cells or
 * components): WebKit drops the table semantics of an element whose CSS `display` changes, as the
 * stacked phone tables do. A header cell is a row header with `scope="row"` or in the body.
 */
export function withTableRoles(node: ReactNode, inBody = false): ReactNode {
  return Children.map(node, (c) => {
    if (!isValidElement<{ children?: ReactNode | undefined; scope?: string | undefined }>(c))
      return c
    const type = typeof c.type === 'string' ? c.type : undefined
    const role = cellRole(type, c.props.scope, inBody)
    if (role) return cloneElement(c, { role } as object)
    if (c.type !== Fragment && !(type && type in tableRoles)) return c
    const kids = withTableRoles(c.props.children, inBody || type === 'tbody')
    return cloneElement(c, (type ? { role: tableRoles[type] } : {}) as object, kids)
  })
}

function cellRole(type: string | undefined, scope: string | undefined, inBody: boolean) {
  if (type === 'td') return 'cell'
  if (type !== 'th') return
  return scope === 'row' || (scope !== 'col' && inBody) ? 'rowheader' : 'columnheader'
}

/**
 * A panel's value table in a ScrollRegion (`withTableRoles`): its caption, one header row of `columns` (`numeric`:
 * every header cell `num`; a column given as `{ label, num: true }`: that header cell) and the body rows as children.
 */
export function PanelTable({
  label,
  className,
  testId,
  caption,
  columns,
  numeric = false,
  children,
}: {
  label: string
  className?: string
  testId?: string
  caption: ReactNode
  columns: readonly (string | { label: string; num: true })[]
  numeric?: boolean
  children: ReactNode
}) {
  return (
    <ScrollRegion label={label}>
      {withTableRoles(
        <table className={className} data-testid={testId}>
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const label = typeof c === 'string' ? c : c.label
                const num = numeric || typeof c !== 'string'
                return (
                  <th key={label} scope="col" className={num ? 'num' : undefined}>
                    {label}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>,
      )}
    </ScrollRegion>
  )
}
