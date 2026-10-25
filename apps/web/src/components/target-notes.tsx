'use client'

import { ActionIcon, Button, NativeSelect, Popover, Textarea } from '@mantine/core'
import type { GroupStatistics } from '@open-reloading/core'
import type { SheetNote, ShotGroup } from '@open-reloading/schema'
import { BracketsCurly, Plus, Trash } from '@phosphor-icons/react'
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react'
import { type Frame, screenNudge, targetToView, viewToTarget } from '../lib/target-editor.ts'
import type { Point } from '../lib/target-geometry.ts'
import { groupStatisticsOf } from '../lib/target-groups.ts'
import { notePlaceholders, readoutUnitName, resolveNote } from '../lib/target-notes.ts'
import { controlSize } from '../lib/theme.ts'
import type { UnitSystem } from '../lib/units.ts'
import { arrows, viewPoint } from './svg-point.ts'

/** The shown text of each note, statistics computed once per group. */
function shownTexts(notes: SheetNote[], groups: ShotGroup[], system: UnitSystem) {
  const stats = new Map<string, GroupStatistics>()
  return notes.map((n) => {
    const g = groups.find((x) => x.id === n.group)
    if (g && !stats.has(g.id)) stats.set(g.id, groupStatisticsOf(g))
    return resolveNote(n.text, g, system, g && stats.get(g.id))
  })
}

/**
 * The notes on the target: a box of text at its point in view units, `k` view units per
 * screen px, so the text is 12 screen px at any zoom. With Select a note is dragged; as a button
 * in the tab order the arrow keys move it by 1 mm (Shift: 10 mm), Delete removes it and Enter
 * opens its text field.
 */
export function NotesLayer({
  notes,
  groups,
  frame,
  k,
  system,
  selected,
  movable,
  onSelect,
  onMove,
  onNudge,
  onDelete,
  onEdit,
  still,
}: {
  notes: SheetNote[]
  groups: ShotGroup[]
  frame: Frame
  k: number
  /** An export or the print: not in the tab order. */
  still?: boolean
  system: UnitSystem
  selected?: string
  /** Select is the tool: notes take pointer drags; else a click goes to the target. */
  movable: boolean
  onSelect: (id: string) => void
  /** A drag to target point `q`; `first` starts an undo step. */
  onMove: (id: string, q: Point, first: boolean) => void
  /** A key move to `q`; a run of them is one undo step. */
  onNudge: (id: string, q: Point) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
}) {
  const drag = useRef<{ id: string; dx: number; dy: number; first: boolean }>(undefined)
  const texts = shownTexts(notes, groups, system)
  const font = 12 * k
  const pad = 4 * k
  const toPoint = (e: PointerEvent<SVGElement>) =>
    viewPoint((e.currentTarget as SVGGraphicsElement).ownerSVGElement, e.clientX, e.clientY)
  const onKey = (e: KeyboardEvent<SVGElement>, n: SheetNote) => {
    const d = arrows[e.key]
    if (d) {
      e.preventDefault()
      const q = screenNudge(frame, n, d[0], d[1], e.shiftKey ? 1e-2 : 1e-3)
      onNudge(n.id, q)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onDelete(n.id)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onEdit(n.id)
    }
  }
  return (
    <g className="notes">
      {notes.map((n, i) => {
        const at = targetToView(frame, n)
        const lines = texts[i].split('\n')
        const w = Math.max(...lines.map((l) => l.length), 1) * 0.6 * font + 2 * pad
        const h = lines.length * 1.25 * font + 2 * pad
        const colour = groups.find((g) => g.id === n.group)?.colour
        return (
          // biome-ignore lint/a11y/useSemanticElements: an SVG group has no button element
          <g
            key={n.id}
            role="button"
            tabIndex={still ? -1 : 0}
            aria-label={`Note ${i + 1}: ${texts[i]}`}
            className="sheet-note"
            data-note={n.id}
            data-selected={n.id === selected || undefined}
            style={colour ? { color: colour } : undefined}
            onFocus={() => onSelect(n.id)}
            onKeyDown={(e) => onKey(e, n)}
            onDoubleClick={() => onEdit(n.id)}
            onPointerDown={(e) => {
              if (!movable || e.button !== 0) return
              e.stopPropagation()
              const p = toPoint(e)
              if (!p) return
              e.currentTarget.setPointerCapture?.(e.pointerId)
              drag.current = { id: n.id, dx: p.x - at.x, dy: p.y - at.y, first: true }
              onSelect(n.id)
            }}
            onPointerMove={(e) => {
              const d = drag.current
              const p = d?.id === n.id && toPoint(e)
              if (!d || !p) return
              e.stopPropagation()
              onMove(n.id, viewToTarget(frame, { x: p.x - d.dx, y: p.y - d.dy }), d.first)
              d.first = false
            }}
            onPointerUp={() => {
              drag.current = undefined
            }}
            // a pinch swallows the up of its fingers: the capture still ends
            onLostPointerCapture={() => {
              drag.current = undefined
            }}
            onPointerCancel={() => {
              drag.current = undefined
            }}
          >
            <rect className="note-box" x={at.x} y={at.y} width={w} height={h} rx={2 * k} />
            <text className="note-text" x={at.x + pad} y={at.y + pad} fontSize={font}>
              {lines.map((l, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lines keep their order
                <tspan key={j} x={at.x + pad} dy={j === 0 ? font : 1.25 * font}>
                  {l || ' '}
                </tspan>
              ))}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** The value picker: one row per value, a button per unit; a click inserts the token. */
function PlaceholderPicker({
  system,
  onPick,
}: {
  system: UnitSystem
  onPick: (token: string) => void
}) {
  const [opened, setOpened] = useState(false)
  return (
    <Popover opened={opened} onChange={setOpened} position="left-start" shadow="sm" withinPortal>
      <Popover.Target>
        <ActionIcon
          variant="default"
          size={controlSize.row.icon}
          aria-label="Insert a value"
          title="Insert a value of the group; it follows the shots"
          onClick={() => setOpened((o) => !o)}
        >
          <BracketsCurly size={14} aria-hidden="true" />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <table className="placeholder-table">
          <caption className="visually-hidden">Values to insert</caption>
          <tbody>
            {notePlaceholders.map((p) => (
              <tr key={p.label}>
                <th scope="row" title={p.help}>
                  {p.label}
                </th>
                {p.tokens.map((t) => (
                  <td key={t.token} colSpan={t.unit ? 1 : 3}>
                    <Button
                      size={controlSize.row.button}
                      variant="default"
                      aria-label={`${p.label}${t.unit ? ` in ${readoutUnitName(t.unit, system)}` : ''}`}
                      onClick={() => {
                        onPick(t.token)
                        setOpened(false)
                      }}
                    >
                      {t.unit ? readoutUnitName(t.unit, system) : 'Insert'}
                    </Button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Popover.Dropdown>
    </Popover>
  )
}

/**
 * The Notes panel: Add note, then per note its text, the group whose values it shows, a value
 * picker and Delete.
 */
export function NotesPanel({
  notes,
  groups,
  system,
  canAdd,
  selected,
  onAdd,
  onChange,
  onDelete,
  fieldRef,
}: {
  notes: SheetNote[]
  groups: ShotGroup[]
  system: UnitSystem
  /** False until the sheet has a scale. */
  canAdd: boolean
  selected?: string
  onAdd: () => void
  /** A change of one note; `key` joins a run of typing into one undo step. */
  onChange: (id: string, patch: Partial<SheetNote>, key?: string) => void
  onDelete: (id: string) => void
  /** The text fields by note id, so Enter on a note on the target focuses its field. */
  fieldRef: { current: Map<string, HTMLTextAreaElement> }
}) {
  const insert = (n: SheetNote, token: string) => {
    const el = fieldRef.current.get(n.id)
    const [a, b] = el ? [el.selectionStart, el.selectionEnd] : [n.text.length, n.text.length]
    onChange(n.id, { text: n.text.slice(0, a) + token + n.text.slice(b) })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(a + token.length, a + token.length)
    })
  }
  return (
    <div className="notes-panel">
      <Button
        size={controlSize.row.button}
        variant="default"
        leftSection={<Plus size={12} aria-hidden="true" />}
        disabled={!canAdd || notes.length >= 50}
        title={
          canAdd
            ? 'A note on the target; values inserted from the picker follow the shots.'
            : 'Mark a reference first.'
        }
        onClick={onAdd}
      >
        Add note
      </Button>
      {notes.map((n, i) => (
        <div key={n.id} className="note-row" data-selected={n.id === selected || undefined}>
          <Textarea
            size={controlSize.row.input}
            label={`Note ${i + 1}`}
            autosize
            minRows={1}
            maxRows={4}
            maxLength={1000}
            value={n.text}
            ref={(el) => {
              if (el) fieldRef.current.set(n.id, el)
              else fieldRef.current.delete(n.id)
            }}
            onChange={(e) => onChange(n.id, { text: e.currentTarget.value }, `note ${n.id}`)}
          />
          <span className="note-tools">
            <NativeSelect
              size={controlSize.row.input}
              aria-label={`Group of note ${i + 1}`}
              title="The group whose values the note shows"
              data={[
                { value: '', label: 'No group' },
                ...groups.map((g) => ({ value: g.id, label: g.name })),
              ]}
              value={groups.some((g) => g.id === n.group) ? n.group : ''}
              onChange={(e) => onChange(n.id, { group: e.currentTarget.value || undefined })}
            />
            <PlaceholderPicker system={system} onPick={(t) => insert(n, t)} />
            <ActionIcon
              variant="subtle"
              size={controlSize.row.icon}
              aria-label={`Delete note ${i + 1}`}
              onClick={() => onDelete(n.id)}
            >
              <Trash size={14} aria-hidden="true" />
            </ActionIcon>
          </span>
        </div>
      ))}
    </div>
  )
}
