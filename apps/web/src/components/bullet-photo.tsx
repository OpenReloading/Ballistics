'use client'

import {
  Button,
  FileButton,
  Flex,
  NumberInput,
  SegmentedControl,
  Slider,
  Table,
  Text,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { fromSi, toSi } from '@open-reloading/schema'
import { useEffect, useId, useRef, useState } from 'react'
import type { Design } from '../lib/bullet-designer.ts'
import { paintPhoto } from '../lib/bullet-photo-canvas.ts'
import { type PhotoRow, storedText, valueText } from '../lib/bullet-photo-design.ts'
import type { FieldValue } from '../lib/field-spec.ts'
import type { UnitSystem } from '../lib/units.ts'
import { AppModal } from './app-modal.tsx'
import { NumberField } from './number-field.tsx'
import { type MessageEntry, MessageSlot } from './states.tsx'
import { distanceSpec, useBulletPhoto } from './use-bullet-photo.ts'
import { type Tool, usePhotoPointer } from './use-photo-pointer.ts'

const tools: { value: Tool; label: string }[] = [
  { value: 'scale', label: 'Place scale points' },
  { value: 'add', label: 'Brush: add' },
  { value: 'erase', label: 'Brush: erase' },
]

type PhotoState = ReturnType<typeof useBulletPhoto>

/** The messages about the photograph and the cut-out. */
function stateMessages(t: PhotoState): MessageEntry[] {
  const outlined = t.found?.outline
  const empty = t.cut && !outlined && !t.busy
  return [
    ...(t.failure ? [{ severity: 'error', text: t.failure } as const] : []),
    ...t.warnings.map((text) => ({ severity: 'warning', text }) as const),
    ...(empty
      ? [
          {
            severity: 'warning',
            text: 'No bullet is outlined: brush the bullet in, or place the scale points on the ruler.',
          } as const,
        ]
      : []),
    ...(outlined?.ambiguous
      ? [
          {
            severity: 'info',
            text: 'The nose end was chosen by its longer taper, which is close here: flip the nose if it is wrong.',
          } as const,
        ]
      : []),
    ...(t.size && !t.scale
      ? [
          {
            severity: 'info',
            text: 'Place two points on the ruler and enter the distance between them to get values.',
          } as const,
        ]
      : []),
  ]
}

/** The messages about the values: what could not be told, and where the photograph and the chosen record disagree. */
function valueMessages(t: PhotoState, record: Design['origin']): MessageEntry[] {
  const differing = t.rows.filter((r) => r.differs).map((r) => r.spec.label.toLowerCase())
  return [
    ...(t.found?.measurement?.notes ?? []).map((text) => ({ severity: 'info', text }) as const),
    ...(differing.length > 0
      ? [
          {
            severity: 'warning',
            text: `The photograph differs from ${record?.title ?? 'the chosen record'} in ${differing.join(', ')} by more than its uncertainty. Check the scale points and the cut-out; the record is not changed.`,
          } as const,
        ]
      : []),
  ]
}

/** The scale controls: the two distances and the readout. */
function ScaleControls({ system, t }: { system: UnitSystem; t: PhotoState }) {
  const set = (i: 0 | 1) => (v: FieldValue) =>
    t.setDistances(([a, b]) => (i === 0 ? [v, b] : [a, v]))
  return (
    <>
      <Text fz="sm">
        Click or tap the graduation of the ruler at two points, A and B, then enter their distance.
        Drag a point to move it. A second pair, C and D, checks the first.
      </Text>
      <NumberField
        spec={distanceSpec('Distance A to B')}
        system={system}
        value={t.distances[0]}
        onChange={set(0)}
      />
      <NumberField
        spec={distanceSpec('Distance C to D (optional)')}
        system={system}
        value={t.distances[1]}
        onChange={set(1)}
      />
      <Button
        variant="default"
        disabled={t.points.length === 0}
        onClick={() => {
          t.setPoints([])
          t.setDistances([
            { text: '', si: undefined },
            { text: '', si: undefined },
          ])
        }}
      >
        Clear the scale
      </Button>
    </>
  )
}

/** The values table: each value with its standard uncertainty and, with a record chosen, the record's value. */
function ValuesTable({
  rows,
  system,
  record,
}: {
  rows: PhotoRow[]
  system: UnitSystem
  record: Design['origin']
}) {
  return (
    <Table className="field-table" aria-label="Values measured from the photograph">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Value</Table.Th>
          <Table.Th>Measured, with standard uncertainty</Table.Th>
          {record && <Table.Th>{record.title}</Table.Th>}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((r) => (
          <Table.Tr key={r.spec.key} data-differs={r.differs || undefined}>
            <Table.Th scope="row">{r.spec.label}</Table.Th>
            <Table.Td>{valueText(r.spec, system, r.value)}</Table.Td>
            {record && (
              <Table.Td>
                {r.record === undefined ? 'not given' : storedText(r.spec, system, r.record)}
                {r.differs && ' (differs)'}
              </Table.Td>
            )}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

/**
 * The tool: a photograph of a bullet beside a ruler, its scale from two spans of the ruler, the
 * bullet cut out (corrected with a brush, by pointer, touch or keys), outlined along its symmetry
 * axis and measured, each value with its uncertainty, in a worker. The photograph never leaves the
 * browser and is not stored.
 */
function PhotoTool({
  system,
  record,
  onOpen,
}: {
  system: UnitSystem
  record: Design['origin']
  onOpen: (d: Design) => Promise<boolean>
}) {
  const t = useBulletPhoto(system, record)
  const id = useId()
  const { size, points, found, scale, drawing } = t
  const shown = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('scale')
  const [brush, setBrush] = useState(12)
  const [opacity, setOpacity] = useState(0.6)
  const pointer = usePhotoPointer({
    size,
    tool,
    brush,
    points,
    setPoints: t.setPoints,
    stamp: t.stamp,
  })
  const { cursor } = pointer

  // the picture
  useEffect(() => {
    const g = shown.current?.getContext('2d')
    if (!(g && t.photo.current && t.tint.current)) return
    paintPhoto(g, t.photo.current, t.tint.current, {
      hasCut: t.cut !== undefined,
      outline: found?.outline,
      drawing:
        drawing && scale
          ? { points: drawing.profile.outline.points, pxPerMm: scale.pxPerMm }
          : undefined,
      opacity,
      points,
      cursor,
      brush: tool === 'scale' ? undefined : brush,
    })
  }, [t.photo, t.tint, t.cut, found, drawing, scale, opacity, points, cursor, tool, brush])

  const turned = found?.outline && fromSi('angle', found.outline.angle)
  const messages = [...stateMessages(t), ...valueMessages(t, record)]
  return (
    <Flex gap="md" wrap="wrap" align="flex-start" className="bullet-photo">
      <div style={{ flex: '2 1 28rem', minWidth: 0 }}>
        {/* biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: a canvas with its own keys is announced as an application, as the target sheet is */}
        <canvas
          ref={shown}
          width={size?.width ?? 1}
          height={size?.height ?? 1}
          tabIndex={size ? 0 : -1}
          role="application"
          aria-label="Photograph of the bullet"
          aria-describedby={`${id}-keys`}
          onPointerDown={pointer.down}
          onPointerMove={pointer.move}
          onPointerUp={pointer.up}
          onPointerCancel={pointer.up}
          onPointerLeave={pointer.leave}
          onKeyDown={pointer.keys}
          style={{
            width: '100%',
            height: 'auto',
            display: size ? 'block' : 'none',
            touchAction: 'none',
            cursor: tool === 'scale' ? 'crosshair' : 'none',
            border: '1px solid var(--mantine-color-default-border)',
          }}
        />
        <p id={`${id}-keys`} className="visually-hidden">
          Arrow keys move the cursor, Shift for single pixels, Control for large steps. Enter places
          a scale point or paints with the brush.
        </p>
        {!size && (
          <Text c="dimmed" fz="sm">
            Choose a photograph of the bullet beside a ruler, or try the sample. It is read in this
            browser and never uploaded.
          </Text>
        )}
        <p role="status" className="visually-hidden">
          {t.busy ?? pointer.heard}
        </p>
      </div>
      <Flex direction="column" gap="sm" style={{ flex: '1 1 18rem', minWidth: 0 }}>
        <Flex gap="xs" wrap="wrap">
          <FileButton onChange={t.read} accept="image/*">
            {(props) => (
              <Button variant="default" {...props}>
                Choose photograph
              </Button>
            )}
          </FileButton>
          <Button variant="default" onClick={t.sample}>
            Try a sample
          </Button>
        </Flex>
        {size && (
          <>
            <SegmentedControl
              aria-label="Tool"
              size="xs"
              value={tool}
              onChange={(v) => setTool(v as Tool)}
              data={tools}
            />
            {tool === 'scale' ? (
              <ScaleControls system={system} t={t} />
            ) : (
              <>
                <Text fz="sm">
                  Paint over the picture to add to the bullet or erase from it. Keys: arrows move
                  the cursor, Enter paints.
                </Text>
                <Text component="label" fz="sm" htmlFor="photo-brush">
                  Brush radius, {brush} px
                </Text>
                <Slider
                  id="photo-brush"
                  min={2}
                  max={80}
                  thumbLabel="Brush radius"
                  value={brush}
                  onChange={setBrush}
                />
              </>
            )}
            <Text fz="sm" aria-live="polite">
              {scale
                ? `Scale ${scale.pxPerMm.toFixed(2)} px/mm, uncertainty ${(100 * scale.relUncertainty).toFixed(2)} %.`
                : 'No scale yet.'}
            </Text>
            <Flex gap="xs" wrap="wrap">
              <Button variant="default" disabled={!t.cut} onClick={t.cutAgain}>
                Cut out again
              </Button>
              <Button
                variant="default"
                disabled={!found?.outline}
                onClick={() => found?.outline && t.setAxis(found.outline.angle + Math.PI)}
              >
                Flip nose
              </Button>
              <Button
                variant="default"
                disabled={t.axis === undefined}
                onClick={() => t.setAxis(undefined)}
              >
                Find the axis again
              </Button>
            </Flex>
            <NumberInput
              label="Axis direction, degrees from the photograph's x axis"
              description="Base to tip, y down. Typing a direction fixes the axis."
              hideControls
              step={0.1}
              decimalScale={2}
              value={turned === undefined ? '' : Number(turned.toFixed(2))}
              onChange={(v) => typeof v === 'number' && t.setAxis(toSi('angle', v))}
              disabled={!found?.outline}
            />
            <Text component="label" fz="sm" htmlFor="photo-opacity">
              Drawing over the photograph, {Math.round(100 * opacity)} %
            </Text>
            <Slider
              id="photo-opacity"
              thumbLabel="Drawing opacity"
              min={0}
              max={1}
              step={0.05}
              label={null}
              value={opacity}
              onChange={setOpacity}
            />
          </>
        )}
      </Flex>
      <div style={{ flex: '1 1 100%' }}>
        <MessageSlot label="Photograph messages" messages={messages} />
        {t.rows.length > 0 && <ValuesTable rows={t.rows} system={system} record={record} />}
        <Flex gap="xs" mt="sm" align="center" wrap="wrap">
          <Button
            disabled={!(t.ready && t.design && drawing)}
            onClick={() => t.design && void onOpen(t.design)}
          >
            Open in designer
          </Button>
          <Text fz="sm" c="dimmed">
            Seeds the designer with these values and a note that they are measured, with their
            uncertainties. The photograph is not stored.
          </Text>
        </Flex>
      </div>
    </Flex>
  )
}

/** The dialog of the bullet photo tool; loaded when it first opens. */
export function BulletPhoto({
  opened,
  onClose,
  system,
  record,
  onOpen,
}: {
  opened: boolean
  onClose: () => void
  system: UnitSystem
  record: Design['origin']
  /** Resolves true when the designer took the design, false when the user kept their unsaved one. */
  onOpen: (d: Design) => Promise<boolean>
}) {
  const phone = useMediaQuery('(max-width: 47.99em)')
  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Bullet from a photograph"
      size="min(72rem, 96vw)"
      fullScreen={phone}
      closeButton={{ 'aria-label': 'Close the photograph tool' }}
    >
      <PhotoTool
        system={system}
        record={record}
        onOpen={async (d) => {
          const taken = await onOpen(d)
          if (taken) onClose()
          return taken
        }}
      />
    </AppModal>
  )
}
