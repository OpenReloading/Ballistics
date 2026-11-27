'use client'

import type { I18n, MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
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
import { fromSi, toSi } from '@rangefoundry/schema'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { loadEnglish } from '../i18n/lingui.ts'
import { fixedNumber } from '../i18n/number.ts'
import type { Design } from '../lib/bullet-designer.ts'
import { paintPhoto } from '../lib/bullet-photo-canvas.ts'
import { type PhotoRow, storedText, valueText } from '../lib/bullet-photo-design.ts'
import { fieldError } from '../lib/field-error.ts'
import type { FieldValue } from '../lib/field-spec.ts'
import type { UnitSystem } from '../lib/units.ts'
import { sayLingui } from '../lib/wording.ts'
import englishMessages from '../locales/en/components/bullet-photo.json' with { type: 'json' }
import { AppModal } from './app-modal.tsx'
import { NumberField } from './number-field.tsx'
import { type MessageEntry, MessageSlot } from './states.tsx'
import { distanceSpec, useBulletPhoto } from './use-bullet-photo.ts'
import { type Tool, usePhotoPointer } from './use-photo-pointer.ts'

loadEnglish(englishMessages)

const tools: { value: Tool; label: MessageDescriptor }[] = [
  {
    value: 'scale',
    label: /*i18n*/ { id: 'bulletPhoto.placeScalePoints', message: 'Place scale points' },
  },
  { value: 'add', label: /*i18n*/ { id: 'bulletPhoto.brushAdd', message: 'Brush: add' } },
  { value: 'erase', label: /*i18n*/ { id: 'bulletPhoto.brushErase', message: 'Brush: erase' } },
]

type PhotoState = ReturnType<typeof useBulletPhoto>

/** The messages about the photograph and the cut-out. */
function stateMessages(p: PhotoState, i18n: I18n): MessageEntry[] {
  const outlined = p.found?.outline
  const empty = p.cut && !outlined && !p.busy
  return [
    // a failure is a message of the tool, else the browser's own text, which shows as written
    ...(p.failure ? [{ severity: 'error', text: sayLingui(i18n, p.failure) } as const] : []),
    ...p.warnings.map((w) => ({ severity: 'warning', text: sayLingui(i18n, w) }) as const),
    ...(p.found?.unusable
      ? [{ severity: 'error', text: sayLingui(i18n, p.found.unusable) } as const]
      : []),
    ...(p.found?.hints ?? []).map(
      (w) => ({ severity: 'warning', text: sayLingui(i18n, w) }) as const,
    ),
    ...(empty
      ? [
          {
            severity: 'warning',
            text: i18n._({
              id: 'bulletPhoto.noOutline',
              message:
                'No bullet is outlined: brush the bullet in, or place the scale points on the ruler.',
            }),
          } as const,
        ]
      : []),
    ...(outlined?.ambiguous
      ? [
          {
            severity: 'info',
            text: i18n._({
              id: 'bulletPhoto.noseByTaper',
              message:
                'The nose end was chosen by its longer taper, which is close here: flip the nose if it is wrong.',
            }),
          } as const,
        ]
      : []),
    ...(p.size && !p.scale
      ? [
          {
            severity: 'info',
            text: i18n._({
              id: 'bulletPhoto.needScale',
              message:
                'For values, place two points on the ruler and enter their distance, or enter a caliper diameter or overall length.',
            }),
          } as const,
        ]
      : []),
  ]
}

/** The messages about the values: what could not be told, and where the photograph and the chosen record disagree. */
function valueMessages(p: PhotoState, record: Design['origin'], i18n: I18n): MessageEntry[] {
  const differing = p.rows.filter((r) => r.differs).map((r) => i18n._(r.spec.label).toLowerCase())
  const values = differing.join(', ')
  return [
    ...(p.found?.measurement?.notes ?? []).map(
      (w) => ({ severity: 'info', text: i18n._(w) }) as const,
    ),
    ...(differing.length > 0
      ? [
          {
            severity: 'warning',
            text: record
              ? i18n._({
                  id: 'bulletPhoto.differsFromRecord',
                  message:
                    'The photograph differs from {record} in {values} by more than its uncertainty. Check the scale points and the cut-out; the record is not changed.',
                  values: { record: record.title, values },
                })
              : i18n._({
                  id: 'bulletPhoto.differsFromChosen',
                  message:
                    'The photograph differs from the chosen record in {values} by more than its uncertainty. Check the scale points and the cut-out; the record is not changed.',
                  values: { values },
                }),
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
  label: MessageDescriptor
  system: UnitSystem
  value: FieldValue
  onChange: (v: FieldValue) => void
}) {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const spec = { ...distanceSpec, label: i18n._(label) }
  return (
    <NumberField
      spec={spec}
      system={system}
      value={value}
      onChange={onChange}
      error={(shown) => fieldError(spec, value, shown, t, i18n)}
    />
  )
}

/** The scale controls: the two distances on the ruler and the sizes read off a caliper. */
function ScaleControls({ system, p }: { system: UnitSystem; p: PhotoState }) {
  const set = (i: 0 | 1) => (v: FieldValue) =>
    p.setDistances(([a, b]) => (i === 0 ? [v, b] : [a, v]))
  const setKnown = (i: 0 | 1) => (v: FieldValue) =>
    p.setKnown(([a, b]) => (i === 0 ? [v, b] : [a, v]))
  const { i18n } = useLingui()
  return (
    <>
      <Text fz="sm">
        {i18n._({
          id: 'bulletPhoto.scaleHelp',
          message:
            'Click two ruler graduations, A and B, and enter their distance. Drag a point to move it. A second pair, C and D, checks the first.',
        })}
      </Text>
      <DistanceField
        label={/*i18n*/ { id: 'bulletPhoto.distanceAB', message: 'Distance A to B' }}
        system={system}
        value={p.distances[0]}
        onChange={set(0)}
      />
      <DistanceField
        label={/*i18n*/ { id: 'bulletPhoto.distanceCD', message: 'Distance C to D (optional)' }}
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
        {i18n._({ id: 'bulletPhoto.clearScale', message: 'Clear the scale' })}
      </Button>
      <Text fz="sm">
        {i18n._({
          id: 'bulletPhoto.caliperHelp',
          message:
            'Caliper sizes give the scale without a ruler and check it with one. Together they reveal a tilted bullet or a shadow in the cut-out.',
        })}
      </Text>
      <DistanceField
        label={
          /*i18n*/ {
            id: 'bulletPhoto.caliperDiameter',
            message: 'Diameter, caliper (optional)',
          }
        }
        system={system}
        value={p.known[0]}
        onChange={setKnown(0)}
      />
      <DistanceField
        label={
          /*i18n*/ {
            id: 'bulletPhoto.caliperLength',
            message: 'Overall length, caliper (optional)',
          }
        }
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
  const { i18n } = useLingui()
  return (
    <Table
      className="field-table"
      aria-label={i18n._({
        id: 'bulletPhoto.valuesTable',
        message: 'Values measured from the photograph',
      })}
    >
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{i18n._({ id: 'bulletPhoto.value', message: 'Value' })}</Table.Th>
          <Table.Th>
            {i18n._({
              id: 'bulletPhoto.measured',
              message: 'Measured, with standard uncertainty',
            })}
          </Table.Th>
          {record && <Table.Th>{record.title}</Table.Th>}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((r) => (
          <Table.Tr key={r.spec.key} data-differs={r.differs || undefined}>
            <Table.Th scope="row">{i18n._(r.spec.label)}</Table.Th>
            <Table.Td>{valueText(r.spec, system, r.value)}</Table.Td>
            {record && (
              <Table.Td>
                {r.record === undefined
                  ? i18n._({ id: 'bulletPhoto.notGiven', message: 'not given' })
                  : storedText(r.spec, system, r.record)}
                {r.differs && ` ${i18n._({ id: 'bulletPhoto.differs', message: '(differs)' })}`}
              </Table.Td>
            )}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

/** Scale from two spans of the ruler, each value with its uncertainty, measured in a worker; the photograph never leaves the browser and is not stored. */
function PhotoTool({
  system,
  record,
  onOpen,
  onPhoto,
}: {
  system: UnitSystem
  record: Design['origin']
  onOpen: (d: Design) => Promise<boolean>
  /** Called with whether a photograph is loaded: the dialog widens for one. */
  onPhoto: (loaded: boolean) => void
}) {
  const p = useBulletPhoto(system, record)
  const { i18n } = useLingui()
  const id = useId()
  const { size, points, found, scale, drawing } = p
  const loaded = size !== undefined
  useEffect(() => onPhoto(loaded), [loaded, onPhoto])
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

  const outline = found?.outline
  const turned = outline && fromSi('angle', outline.angle)
  const messages = [...stateMessages(p, i18n), ...valueMessages(p, record, i18n)]
  return (
    <Flex gap="md" wrap="wrap" align="flex-start" className="bullet-photo">
      <div style={{ flex: '2 1 28rem', minWidth: 0 }}>
        <canvas
          ref={shown}
          width={size?.width ?? 1}
          height={size?.height ?? 1}
          tabIndex={size ? 0 : -1}
          // oxlint-disable-next-line jsx-a11y/no-interactive-element-to-noninteractive-role -- a canvas with its own keys is announced as an application, as the target sheet is
          role="application"
          aria-label={i18n._({
            id: 'bulletPhoto.photograph',
            message: 'Photograph of the bullet',
          })}
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
            border: '1px solid var(--line)',
          }}
        />
        <p id={`${id}-keys`} className="visually-hidden">
          {i18n._({
            id: 'bulletPhoto.keysHelp',
            message:
              'Arrow keys move the cursor, Shift for single pixels, Control for large steps. Enter places a scale point or paints with the brush.',
          })}
        </p>
        {!size && (
          <Text c="dimmed" fz="sm">
            {i18n._({
              id: 'bulletPhoto.chooseHelp',
              message:
                'Choose a photograph of the bullet beside a ruler, or try the sample. It is never uploaded.',
            })}
          </Text>
        )}
        <p role="status" className="visually-hidden">
          {p.busy ? i18n._(p.busy) : pointer.heard}
        </p>
      </div>
      <Flex direction="column" gap="sm" style={{ flex: '1 1 18rem', minWidth: 0 }}>
        <Flex gap="xs" wrap="wrap">
          <FileButton onChange={p.read} accept="image/*">
            {(props) => (
              <Button variant="default" {...props}>
                {i18n._({ id: 'bulletPhoto.choosePhotograph', message: 'Choose photograph' })}
              </Button>
            )}
          </FileButton>
          <Button variant="default" onClick={p.sample}>
            {i18n._({ id: 'bulletPhoto.trySample', message: 'Try a sample' })}
          </Button>
        </Flex>
        {size && (
          <>
            <SegmentedControl
              aria-label={i18n._({ id: 'bulletPhoto.tool', message: 'Tool' })}
              size="xs"
              value={tool}
              onChange={(v) => setTool(v as Tool)}
              data={tools.map((o) => ({ value: o.value, label: i18n._(o.label) }))}
            />
            {tool === 'scale' ? (
              <ScaleControls system={system} p={p} />
            ) : (
              <>
                <Text fz="sm">
                  {i18n._({
                    id: 'bulletPhoto.brushHelp',
                    message:
                      'Paint over the picture to add to the bullet or erase from it. Keys: arrows move the cursor, Enter paints.',
                  })}
                </Text>
                <Text component="label" fz="sm" htmlFor="photo-brush">
                  {i18n._({
                    id: 'bulletPhoto.brushRadiusValue',
                    message: 'Brush radius, {size, decimal} px',
                    values: { size: brush },
                  })}
                </Text>
                <Slider
                  id="photo-brush"
                  min={2}
                  max={80}
                  thumbLabel={i18n._({ id: 'bulletPhoto.brushRadius', message: 'Brush radius' })}
                  value={brush}
                  onChange={setBrush}
                />
              </>
            )}
            <Text fz="sm" aria-live="polite">
              {scale
                ? i18n._({
                    id: 'bulletPhoto.scaleValue',
                    message: 'Scale {scale} px/mm, uncertainty {uncertainty} %.',
                    values: {
                      scale: fixedNumber(scale.pxPerMm, 2),
                      uncertainty: fixedNumber(100 * scale.relUncertainty, 2),
                    },
                  })
                : i18n._({ id: 'bulletPhoto.noScale', message: 'No scale yet.' })}
            </Text>
            <Flex gap="xs" wrap="wrap">
              <Button variant="default" disabled={!p.cut} onClick={p.cutAgain}>
                {i18n._({ id: 'bulletPhoto.cutOutAgain', message: 'Cut out again' })}
              </Button>
              <Button
                variant="default"
                disabled={!outline}
                onClick={() => outline && p.setAxis(outline.angle + Math.PI)}
              >
                {i18n._({ id: 'bulletPhoto.flipNose', message: 'Flip nose' })}
              </Button>
              <Button
                variant="default"
                disabled={p.axis === undefined}
                onClick={() => p.setAxis(undefined)}
              >
                {i18n._({ id: 'bulletPhoto.findAxisAgain', message: 'Find the axis again' })}
              </Button>
            </Flex>
            <NumberInput
              label={i18n._({
                id: 'bulletPhoto.axisDirection',
                message: "Axis direction, degrees from the photograph's x axis",
              })}
              description={i18n._({
                id: 'bulletPhoto.axisHelp',
                message: 'Base to tip, y down. Typing a direction fixes the axis.',
              })}
              hideControls
              step={0.1}
              decimalScale={2}
              value={turned === undefined ? '' : Math.round(100 * turned) / 100}
              onChange={(v) => typeof v === 'number' && p.setAxis(toSi('angle', v))}
              disabled={!outline}
            />
            <Text component="label" fz="sm" htmlFor="photo-opacity">
              {i18n._({
                id: 'bulletPhoto.drawingOpacityValue',
                message: 'Drawing over the photograph, {percent, decimal} %',
                values: {
                  percent: Math.round(100 * opacity),
                },
              })}
            </Text>
            <Slider
              id="photo-opacity"
              thumbLabel={i18n._({ id: 'bulletPhoto.drawingOpacity', message: 'Drawing opacity' })}
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
      {/* data-idle: no reserved message room before a photograph (globals.css) */}
      <div style={{ flex: '1 1 100%' }} data-idle={!loaded}>
        <MessageSlot
          label={i18n._({ id: 'bulletPhoto.messages', message: 'Photograph messages' })}
          messages={messages}
        />
        {p.rows.length > 0 && <ValuesTable rows={p.rows} system={system} record={record} />}
        <Flex gap="xs" mt="sm" align="center" wrap="wrap">
          <Button
            disabled={!(p.ready && p.design && drawing)}
            onClick={() => p.design && void onOpen(p.design)}
          >
            {i18n._({ id: 'bulletPhoto.openDesigner', message: 'Open in designer' })}
          </Button>
          <Text fz="sm" c="dimmed">
            {i18n._({
              id: 'bulletPhoto.openHelp',
              message:
                'Opens the designer with these values; the design keeps them as measured from a photograph, with their uncertainties. The photograph is not stored.',
            })}
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
  const phone = useMediaQuery('(width < 48em)')
  const { i18n } = useLingui()
  // narrow while it only offers a photograph; the canvas and its controls side by side with one
  const [photo, setPhoto] = useState(false)
  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={i18n._({ id: 'bulletPhoto.title', message: 'Bullet from a photograph' })}
      size={photo ? 'min(72rem, 96vw)' : 'min(34rem, 96vw)'}
      fullScreen={phone}
      closeButton={{
        'aria-label': i18n._({
          id: 'bulletPhoto.close',
          message: 'Close the photograph tool',
        }),
      }}
    >
      <PhotoTool
        onPhoto={setPhoto}
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
