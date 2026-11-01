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
import { useTranslation } from '../i18n/language.ts'
import { fixedNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import type { Design } from '../lib/bullet-designer.ts'
import { paintPhoto } from '../lib/bullet-photo-canvas.ts'
import { type PhotoRow, storedText, valueText } from '../lib/bullet-photo-design.ts'
import { type FieldValue, fieldError } from '../lib/field-spec.ts'
import type { UnitSystem } from '../lib/units.ts'
import { say } from '../lib/wording.ts'
import { AppModal } from './app-modal.tsx'
import { NumberField } from './number-field.tsx'
import { type MessageEntry, MessageSlot } from './states.tsx'
import { distanceSpec, useBulletPhoto } from './use-bullet-photo.ts'
import { type Tool, usePhotoPointer } from './use-photo-pointer.ts'

const tools: { value: Tool; label: Message }[] = [
  { value: 'scale', label: msg('Place scale points') },
  { value: 'add', label: msg('Brush: add') },
  { value: 'erase', label: msg('Brush: erase') },
]

type PhotoState = ReturnType<typeof useBulletPhoto>

/** The messages about the photograph and the cut-out. */
function stateMessages(p: PhotoState, t: Translator['t']): MessageEntry[] {
  const outlined = p.found?.outline
  const empty = p.cut && !outlined && !p.busy
  return [
    // a failure is a message of the tool, else the browser's own text, which shows as written
    ...(p.failure ? [{ severity: 'error', text: t(p.failure as Message) } as const] : []),
    ...p.warnings.map((w) => ({ severity: 'warning', text: say(t, w) }) as const),
    ...(p.found?.unusable ? [{ severity: 'error', text: say(t, p.found.unusable) } as const] : []),
    ...(p.found?.hints ?? []).map((w) => ({ severity: 'warning', text: say(t, w) }) as const),
    ...(empty
      ? [
          {
            severity: 'warning',
            text: t(
              'No bullet is outlined: brush the bullet in, or place the scale points on the ruler.',
            ),
          } as const,
        ]
      : []),
    ...(outlined?.ambiguous
      ? [
          {
            severity: 'info',
            text: t(
              'The nose end was chosen by its longer taper, which is close here: flip the nose if it is wrong.',
            ),
          } as const,
        ]
      : []),
    ...(p.size && !p.scale
      ? [
          {
            severity: 'info',
            text: t(
              'Place two points on the ruler and enter the distance between them, or enter the diameter or overall length you measured with a caliper, to get values.',
            ),
          } as const,
        ]
      : []),
  ]
}

/** The messages about the values: what could not be told, and where the photograph and the chosen record disagree. */
function valueMessages(
  p: PhotoState,
  record: Design['origin'],
  t: Translator['t'],
): MessageEntry[] {
  const differing = p.rows.filter((r) => r.differs).map((r) => t(r.spec.label).toLowerCase())
  const values = differing.join(', ')
  return [
    ...(p.found?.measurement?.notes ?? []).map(
      (w) => ({ severity: 'info', text: say(t, w) }) as const,
    ),
    ...(differing.length > 0
      ? [
          {
            severity: 'warning',
            text: record
              ? t(
                  'The photograph differs from {record} in {values} by more than its uncertainty. Check the scale points and the cut-out; the record is not changed.',
                  { record: record.title, values },
                )
              : t(
                  'The photograph differs from the chosen record in {values} by more than its uncertainty. Check the scale points and the cut-out; the record is not changed.',
                  { values },
                ),
          } as const,
        ]
      : []),
  ]
}

/** A length typed for the scale, with the message for an entry the scale cannot use. */
export function DistanceField({
  label,
  system,
  value,
  onChange,
}: {
  label: Message
  system: UnitSystem
  value: FieldValue
  onChange: (v: FieldValue) => void
}) {
  const { t } = useTranslation()
  const spec = distanceSpec(label)
  return (
    <NumberField
      spec={spec}
      system={system}
      value={value}
      onChange={onChange}
      error={(shown) => fieldError(spec, value, shown, t)}
    />
  )
}

/** The scale controls: the two distances on the ruler and the sizes read off a caliper. */
function ScaleControls({ system, p }: { system: UnitSystem; p: PhotoState }) {
  const set = (i: 0 | 1) => (v: FieldValue) =>
    p.setDistances(([a, b]) => (i === 0 ? [v, b] : [a, v]))
  const setKnown = (i: 0 | 1) => (v: FieldValue) =>
    p.setKnown(([a, b]) => (i === 0 ? [v, b] : [a, v]))
  const { t } = useTranslation()
  return (
    <>
      <Text fz="sm">
        {t(
          'Click or tap the graduation of the ruler at two points, A and B, then enter their distance. Drag a point to move it. A second pair, C and D, checks the first.',
        )}
      </Text>
      <DistanceField
        label={msg('Distance A to B')}
        system={system}
        value={p.distances[0]}
        onChange={set(0)}
      />
      <DistanceField
        label={msg('Distance C to D (optional)')}
        system={system}
        value={p.distances[1]}
        onChange={set(1)}
      />
      <Button
        variant="default"
        disabled={p.points.length === 0}
        onClick={() => {
          p.setPoints([])
          p.setDistances([
            { text: '', si: undefined },
            { text: '', si: undefined },
          ])
        }}
      >
        {t('Clear the scale')}
      </Button>
      <Text fz="sm">
        {t(
          'Sizes measured with a caliper give the scale where the photograph has no ruler, and check the ruler where it has. Both together also show a bullet that is tilted or a cut-out that includes a shadow.',
        )}
      </Text>
      <DistanceField
        label={msg('Diameter, caliper (optional)')}
        system={system}
        value={p.known[0]}
        onChange={setKnown(0)}
      />
      <DistanceField
        label={msg('Overall length, caliper (optional)')}
        system={system}
        value={p.known[1]}
        onChange={setKnown(1)}
      />
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
  const { t } = useTranslation()
  return (
    <Table className="field-table" aria-label={t('Values measured from the photograph')}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t('Value')}</Table.Th>
          <Table.Th>{t('Measured, with standard uncertainty')}</Table.Th>
          {record && <Table.Th>{record.title}</Table.Th>}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((r) => (
          <Table.Tr key={r.spec.key} data-differs={r.differs || undefined}>
            <Table.Th scope="row">{t(r.spec.label)}</Table.Th>
            <Table.Td>{valueText(r.spec, system, r.value)}</Table.Td>
            {record && (
              <Table.Td>
                {r.record === undefined ? t('not given') : storedText(r.spec, system, r.record)}
                {r.differs && ` ${t('(differs)')}`}
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
  const p = useBulletPhoto(system, record)
  const { t } = useTranslation()
  const id = useId()
  const { size, points, found, scale, drawing } = p
  const shown = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('scale')
  const [brush, setBrush] = useState(12)
  const [opacity, setOpacity] = useState(0.6)
  const pointer = usePhotoPointer({
    size,
    tool,
    brush,
    points,
    setPoints: p.setPoints,
    stamp: p.stamp,
  })
  const { cursor } = pointer

  // the picture
  useEffect(() => {
    const g = shown.current?.getContext('2d')
    if (!(g && p.photo.current && p.tint.current)) return
    paintPhoto(g, p.photo.current, p.tint.current, {
      hasCut: p.cut !== undefined,
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
  }, [p.photo, p.tint, p.cut, found, drawing, scale, opacity, points, cursor, tool, brush])

  const turned = found?.outline && fromSi('angle', found.outline.angle)
  const messages = [...stateMessages(p, t), ...valueMessages(p, record, t)]
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
          aria-label={t('Photograph of the bullet')}
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
          {t(
            'Arrow keys move the cursor, Shift for single pixels, Control for large steps. Enter places a scale point or paints with the brush.',
          )}
        </p>
        {!size && (
          <Text c="dimmed" fz="sm">
            {t(
              'Choose a photograph of the bullet beside a ruler, or try the sample. It is read in this browser and never uploaded.',
            )}
          </Text>
        )}
        <p role="status" className="visually-hidden">
          {p.busy ? t(p.busy) : pointer.heard}
        </p>
      </div>
      <Flex direction="column" gap="sm" style={{ flex: '1 1 18rem', minWidth: 0 }}>
        <Flex gap="xs" wrap="wrap">
          <FileButton onChange={p.read} accept="image/*">
            {(props) => (
              <Button variant="default" {...props}>
                {t('Choose photograph')}
              </Button>
            )}
          </FileButton>
          <Button variant="default" onClick={p.sample}>
            {t('Try a sample')}
          </Button>
        </Flex>
        {size && (
          <>
            <SegmentedControl
              aria-label={t('Tool')}
              size="xs"
              value={tool}
              onChange={(v) => setTool(v as Tool)}
              data={tools.map((o) => ({ value: o.value, label: t(o.label) }))}
            />
            {tool === 'scale' ? (
              <ScaleControls system={system} p={p} />
            ) : (
              <>
                <Text fz="sm">
                  {t(
                    'Paint over the picture to add to the bullet or erase from it. Keys: arrows move the cursor, Enter paints.',
                  )}
                </Text>
                <Text component="label" fz="sm" htmlFor="photo-brush">
                  {t('Brush radius, {size} px', { size: brush })}
                </Text>
                <Slider
                  id="photo-brush"
                  min={2}
                  max={80}
                  thumbLabel={t('Brush radius')}
                  value={brush}
                  onChange={setBrush}
                />
              </>
            )}
            <Text fz="sm" aria-live="polite">
              {scale
                ? t('Scale {scale} px/mm, uncertainty {uncertainty} %.', {
                    scale: fixedNumber(scale.pxPerMm, 2),
                    uncertainty: fixedNumber(100 * scale.relUncertainty, 2),
                  })
                : t('No scale yet.')}
            </Text>
            <Flex gap="xs" wrap="wrap">
              <Button variant="default" disabled={!p.cut} onClick={p.cutAgain}>
                {t('Cut out again')}
              </Button>
              <Button
                variant="default"
                disabled={!found?.outline}
                onClick={() => found?.outline && p.setAxis(found.outline.angle + Math.PI)}
              >
                {t('Flip nose')}
              </Button>
              <Button
                variant="default"
                disabled={p.axis === undefined}
                onClick={() => p.setAxis(undefined)}
              >
                {t('Find the axis again')}
              </Button>
            </Flex>
            <NumberInput
              label={t("Axis direction, degrees from the photograph's x axis")}
              description={t('Base to tip, y down. Typing a direction fixes the axis.')}
              hideControls
              step={0.1}
              decimalScale={2}
              value={turned === undefined ? '' : Math.round(100 * turned) / 100}
              onChange={(v) => typeof v === 'number' && p.setAxis(toSi('angle', v))}
              disabled={!found?.outline}
            />
            <Text component="label" fz="sm" htmlFor="photo-opacity">
              {t('Drawing over the photograph, {percent} %', {
                percent: Math.round(100 * opacity),
              })}
            </Text>
            <Slider
              id="photo-opacity"
              thumbLabel={t('Drawing opacity')}
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
        <PhotoMessages photo={size !== undefined} messages={messages} />
        {p.rows.length > 0 && <ValuesTable rows={p.rows} system={system} record={record} />}
        <Flex gap="xs" mt="sm" align="center" wrap="wrap">
          <Button
            disabled={!(p.ready && p.design && drawing)}
            onClick={() => p.design && void onOpen(p.design)}
          >
            {t('Open in designer')}
          </Button>
          <Text fz="sm" c="dimmed">
            {t(
              'Seeds the designer with these values and a note that they are measured, with their uncertainties. The photograph is not stored.',
            )}
          </Text>
        </Flex>
      </div>
    </Flex>
  )
}

/** The messages of the tool; no reserved room before a photograph, unless one failed to read. */
function PhotoMessages({ photo, messages }: { photo: boolean; messages: MessageEntry[] }) {
  const { t } = useTranslation()
  return photo || messages.length > 0 ? (
    <MessageSlot label={t('Photograph messages')} messages={messages} />
  ) : null
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
  const { t } = useTranslation()
  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={t('Bullet from a photograph')}
      size="min(34rem, 96vw)"
      fullScreen={phone}
      closeButton={{ 'aria-label': t('Close the photograph tool') }}
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
