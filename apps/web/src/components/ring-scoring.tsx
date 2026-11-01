'use client'

import { Button, NativeSelect, Select } from '@mantine/core'
import { useWindowEvent } from '@mantine/hooks'
import {
  type CalibrationReference,
  fromSi,
  type GroupFace,
  type ShotGroup,
  type TargetSheet,
  toSi,
} from '@open-reloading/schema'
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { fixedNumber, plainNumber } from '../i18n/number.ts'
import { msg, type Translator } from '../i18n/translate.ts'
import {
  disciplineChoice,
  disciplineFaces,
  disciplineOptions,
  disciplineValue,
  type FederationData,
  mappedFace,
  mappingOf,
} from '../lib/face-disciplines.ts'
import {
  compareEvents,
  compareTargetFaces,
  federationFaceIds,
  federationsWithDisciplines,
} from '../lib/face-order.ts'
import type { Face } from '../lib/face-organization.ts'
import {
  type FaceSummary,
  fetchAllFaces,
  fetchFace,
  fetchFaceSummaries,
  fetchFederationData,
} from '../lib/face-records.ts'
import type { FaceScope } from '../lib/face-sheet.ts'
import { type LabelScene, placeLabel } from '../lib/label-placement.ts'
import { nth } from '../lib/nth.ts'
import {
  type FaceMark,
  faceAlignment,
  onSheet,
  type RingScore,
  ringPath,
  scoreGroupOnFace,
} from '../lib/ring-scoring.ts'
import { type Frame, targetToView, viewToTarget } from '../lib/target-editor.ts'
import type { Point } from '../lib/target-geometry.ts'
import { controlSize } from '../lib/theme.ts'
import { mmLength, type UnitSystem } from '../lib/units.ts'
import { faceIdPrefix } from '../lib/user-faces.ts'
import type { Tool } from './target-canvas.tsx'
import { useUnits } from './units-settings.tsx'

type Scoring = ReturnType<typeof scoreGroupOnFace>

const offline = msg('Targets need the network')
const faceHelp = msg(
  'The rule-book target that scores the group. Scores follow every edit; excluded shots show their value and do not count in the total.',
)
const federationHelp = msg(
  'The federation whose disciplines the Discipline list shows. All: every discipline, then the target events no discipline names.',
)
const disciplineHelp = msg(
  'The discipline sets the target, the event and with it the scored hole. Type to search by name, number or federation.',
)
const eventHelp = msg(
  "A target no discipline names: the event's gauge is the scored hole, as the rule book says; a black-powder event scores the hole centre. Bullet: the bullet diameter of the load, else Marker.",
)
const ringHelp = msg(
  'The ring the next marks lie on; mark the outer edge of its line. Fit needs 4 marks on 2 rings.',
)
const ownRuleNote = msg(
  'Tenths in the 10 zone of this target: own rule. The 10 zone is wider than one ring and the rule book does not divide it; tenths of the ring width are counted inward from the touching edge, 10.9 for the rest of the centre.',
)

/** A shot's value as shown: tenths where the face has them, X for an inner ten. */
export const shotText = (s: RingScore) =>
  `${s.decimal !== undefined ? fixedNumber(s.decimal, 1) : plainNumber(s.value)}${s.innerTen ? ' X' : ''}`

/** A group's scoring when it scored: none while its face loads, after a failure or a refusal. */
export const scoredOnly = (r: Scoring | 'loading' | 'error' | undefined) =>
  r && typeof r === 'object' && !('error' in r) ? r : undefined

/** A group's score as one line: total, decimal total, inner tens. */
export function scoreLine(r: Scoring | 'loading' | 'error' | undefined) {
  const scored = scoredOnly(r)
  if (!scored) return
  const { total, decimalTotal, innerTenCount: xCount } = scored.score
  return `${plainNumber(total)}${decimalTotal !== undefined ? ` (${fixedNumber(decimalTotal, 1)})` : ''}, ${plainNumber(xCount)} X`
}

/** One group's score: none without a face, loading, failed, or the scoring. */
function scoreOne(
  g: ShotGroup,
  face: GroupFace,
  f: Face | 'error' | undefined,
  data: FederationData | undefined,
  bullet: number | undefined,
  t: Translator['t'],
): Scoring | 'loading' | 'error' {
  if (f === undefined) return 'loading'
  if (f === 'error') return f
  const gauge = mappingOf(data?.mappings ?? [], face)?.gaugeMm
  return scoreGroupOnFace(f, { ...face, gauge }, g, bullet, t)
}

/** The score of every group that has a face, by group id. */
function scoreGroups(
  groups: ShotGroup[],
  faces: Record<string, Face | 'error'>,
  data: FederationData | undefined,
  bullet: number | undefined,
  t: Translator['t'],
) {
  const out = new Map<string, Scoring | 'loading' | 'error'>()
  for (const g of groups)
    if (g.face) out.set(g.id, scoreOne(g, g.face, faces[g.face.id], data, bullet, t))
  return out
}

/** The line under the face rows: what the face and its alignment are, or why there is no score. */
function scoreStatus(o: {
  list: FaceSummary[] | 'loading' | 'error'
  choice: GroupFace | undefined
  face: Face | 'error' | undefined
  current: Scoring | 'loading' | 'error' | undefined
  result: ScoredGroup | undefined
  system: UnitSystem
  t: Translator['t']
}) {
  const { list, choice, face, current, result, system, t } = o
  if (list === 'error') return t(offline)
  if (!choice) return t('No target: no score.')
  if (face === 'error')
    return choice.id.startsWith(faceIdPrefix)
      ? t('This target design is deleted or no longer a valid target.')
      : t('Targets need the network: {id} could not be loaded.', { id: choice.id })
  if (current && typeof current === 'object' && 'error' in current) return current.error
  if (!result) return t('Loading the target…')
  if (!choice.marks) return t('Centred on the point of aim (or the origin) at the sheet scale.')
  const misfit = mmLength(system, fromSi('length', result.alignment.rms ?? 0))
  return t('Fitted to {count} marks, misfit {misfit}, scale {scale} %.', {
    count: choice.marks.length,
    misfit,
    scale: fixedNumber(result.alignment.scale * 100, 1),
  })
}

/** The label of the option `value`, for the title of a select whose text the column may cut. */
const optionLabel = (options: readonly { value: string; label: string }[], value: string | null) =>
  options.find((o) => o.value === value)?.label

/** The Face select's options: the discipline's stages in the rule book's order, else the faces. */
function faceOptionsOf(o: {
  list: FaceSummary[] | 'loading' | 'error'
  choice: GroupFace | undefined
  discipline: string | undefined
  ofDiscipline: ReturnType<typeof disciplineFaces>
  inFederation: Set<string> | undefined
  t: Translator['t']
}) {
  const { list, choice, discipline, ofDiscipline, inFederation, t } = o
  if (list === 'error') return [{ value: choice?.id ?? '', label: choice?.id ?? t(offline) }]
  const none = { value: '', label: t('None') }
  if (discipline) {
    const label = (id: string) => {
      const f = typeof list === 'object' && list.find((x) => x.id === id)
      return f ? `${f.organization} ${f.name}` : id
    }
    return [
      none,
      ...ofDiscipline.map((m) => ({
        value: m.face,
        label: `${label(m.face)}${m.stage ? `, ${m.stage}` : ''}`,
      })),
    ]
  }
  if (list === 'loading') return choice ? [none, { value: choice.id, label: choice.id }] : [none]
  return [
    none,
    ...list
      .filter((f) => !inFederation || inFederation.has(f.id) || f.id === choice?.id)
      .toSorted(compareTargetFaces)
      .map((f) => ({ value: f.id, label: `${f.organization} ${f.name}` })),
  ]
}

function DisciplineSelect({
  offline: unreachable,
  choices,
  value,
  onPick,
}: {
  offline: boolean
  choices: ReturnType<typeof disciplineOptions>
  value: ReturnType<typeof disciplineValue>
  onPick: (value: string | null) => void
}) {
  const { t } = useTranslation()
  return (
    <Select
      label={t('Discipline')}
      className="full-row"
      size={controlSize.row.input}
      searchable
      allowDeselect={false}
      labelProps={{ title: t(disciplineHelp) }}
      title={unreachable ? t(offline) : optionLabel(choices, value)}
      disabled={unreachable || !choices.length}
      placeholder={unreachable ? t(offline) : undefined}
      nothingFoundMessage={t('None found')}
      comboboxProps={{ width: 'max-content', position: 'bottom-end', keepMounted: false }}
      // the scrolling region is focusable (axe scrollable-region-focusable) and a group, so it may sit in the listbox (aria-required-children)
      scrollAreaProps={{
        viewportProps: { tabIndex: 0, role: 'group', 'aria-label': t('Disciplines') },
      }}
      data={choices}
      value={value}
      onChange={onPick}
    />
  )
}

function EventSelect({
  record,
  event,
  system,
  onEvent,
}: {
  record: Face
  event: string | undefined
  system: UnitSystem
  onEvent: (event: string) => void
}) {
  const { t } = useTranslation()
  const options = [
    ...record.events
      .toSorted((a, b) =>
        compareEvents(
          { distance: a.distance.value, name: a.name },
          { distance: b.distance.value, name: b.name },
        ),
      )
      .map((e) => ({
        value: e.id,
        label: `${e.name}${e.gauge ? `, ${mmLength(system, e.gauge.value)}` : ''}`,
      })),
    { value: '', label: t('Bullet') },
  ]
  return (
    <NativeSelect
      label={t('Event')}
      className="full-row"
      size={controlSize.row.input}
      description={t(eventHelp)}
      labelProps={{ title: t(eventHelp) }}
      title={optionLabel(options, event ?? '')}
      data={options}
      value={event ?? ''}
      onChange={(e) => onEvent(e.currentTarget.value)}
    />
  )
}

/**
 * Label boxes of the shot values of a group, view units: outward from the group centre, clear of
 * the shot marks, their numbers and each other (`placeLabel`).
 */
function shotLabels(
  frame: Frame,
  markerDiameter: number | undefined,
  g: ShotGroup,
  r: ScoredGroup,
  k: number,
) {
  const font = 11 * k
  const scene: LabelScene = {
    circles: [],
    segments: [],
    boxes: [],
    view: { x: -1e12, y: -1e12, w: 2e12, h: 2e12 },
    fontSize: font,
    gap: 3 * k,
  }
  const placed = g.shots.map((s) => ({ s, p: targetToView(frame, s) }))
  const pts = placed.map(({ p }) => p)
  placed.forEach(({ s, p }, i) => {
    const e = targetToView(frame, { x: s.x + (markerDiameter ?? 0) / 2, y: s.y })
    const rad = Math.max(Math.hypot(e.x - p.x, e.y - p.y), 8 * k)
    scene.circles.push({ ...p, r: rad })
    const digits = String(i + 1).length
    scene.boxes.push({
      x: p.x + rad + 2 * k,
      y: p.y - rad - font,
      w: 0.6 * font * digits,
      h: 1.2 * font,
    })
  })
  const c = {
    x: pts.reduce((t, p) => t + p.x, 0) / (pts.length || 1),
    y: pts.reduce((t, p) => t + p.y, 0) / (pts.length || 1),
  }
  // shortcut: placeLabel grows with the square of the shots; above 50 the values sit at a fixed
  // offset (bench groups are far smaller); memoize the placement if large groups need it
  if (pts.length > 50) return pts.map((p) => ({ x: p.x + 7 * k, y: p.y + 5 * k, w: 0, h: 0 }))
  return pts.map((p, i) => placeLabel(scene, shotText(nth(r.score.shots, i)), [p], c))
}

type ScoredGroup = NonNullable<ReturnType<typeof scoredOnly>>

/** The marks of the ring fit, crosses with their ring value. */
function RingMarks({ marks, frame, k }: { marks: FaceMark[]; frame: Frame; k: number }) {
  return marks.map((m, i) => {
    const p = targetToView(frame, m)
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: marks keep their order
      <g key={i} className="ring-mark">
        <path d={`M${p.x - 5 * k} ${p.y}h${10 * k}M${p.x} ${p.y - 5 * k}v${10 * k}`} />
        <text x={p.x + 6 * k} y={p.y - 4 * k} fontSize={10 * k}>
          {m.ring}
        </text>
      </g>
    )
  })
}

/** The rings and shot values of one scored group. */
function GroupRings({
  group: g,
  scored: r,
  face: f,
  frame,
  sheet,
  k,
}: {
  group: ShotGroup
  scored: ScoredGroup
  face: Face
  frame: Frame
  sheet: TargetSheet
  k: number
}) {
  const a = r.alignment
  const v = (q: Point) => targetToView(frame, q)
  const path = (pts: Point[]) => `M${pts.map((q) => `${v(q).x} ${v(q).y}`).join('L')}Z`
  return (
    <g className="face-rings" style={{ color: g.colour }}>
      {!sheet.photo && <path className="face-black" d={path(ringPath(a, f.blackDiameter.value))} />}
      {f.rings.map((x) => (
        <path key={x.value} d={path(ringPath(a, x.diameter.value))} />
      ))}
      {f.innerTen && (
        <path className="face-inner" d={path(ringPath(a, f.innerTen.diameter.value))} />
      )}
      {shotLabels(frame, sheet.markerDiameter, g, r, k).map((b, i) => (
        <text
          // biome-ignore lint/suspicious/noArrayIndexKey: shots keep their order
          key={i}
          className="shot-score"
          data-excluded={g.shots[i]?.excluded || undefined}
          x={b.x}
          y={b.y + 11 * k}
          fontSize={11 * k}
        >
          {shotText(nth(r.score.shots, i))}
        </text>
      ))}
    </g>
  )
}

/** The rings of the active group's face and the values of its shots; `still` leaves out marks. */
function FaceLayer({
  frame,
  sheet,
  group,
  rings,
  marks,
  faces,
  scored,
  k,
  still,
}: {
  frame: Frame
  sheet: TargetSheet
  group: ShotGroup | undefined
  rings: boolean
  /** The marks to draw: none outside the rings tool. */
  marks: FaceMark[]
  faces: Record<string, Face | 'error'>
  scored: (id: string) => ScoredGroup | undefined
  k: number
  still: boolean | undefined
}) {
  const shown = sheet.groups.filter((g) => rings && g.face && (g.id === group?.id || still))
  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: an SVG group is not focusable; it only draws (the values are in the shots' names and the table)
    <g className="face-layer" aria-hidden="true">
      {shown.map((g) => {
        const r = scored(g.id)
        const f = g.face && faces[g.face.id]
        if (!r || !f || f === 'error') return null
        return (
          <GroupRings key={g.id} group={g} scored={r} face={f} frame={frame} sheet={sheet} k={k} />
        )
      })}
      {!still && <RingMarks marks={marks} frame={frame} k={k} />}
    </g>
  )
}

type SetFace = (f: (x: GroupFace | undefined) => GroupFace | undefined) => void

/** What a click does in the rings tool: nothing (false), a refusal, or one more mark. */
function clickPoint(
  o: {
    tool: Tool
    frame: Frame | undefined
    ringValue: number | undefined
    count: number
    say: (text: string, alert?: boolean) => void
    addMark: (m: FaceMark) => void
    t: Translator['t']
  },
  p: Point,
): boolean {
  if (o.tool !== 'rings') return false
  if (!o.frame || o.ringValue === undefined) return true
  if (o.count >= 64) {
    o.say(o.t('At most 64 marks.'), true)
    return true
  }
  o.addMark({ ring: o.ringValue, ...viewToTarget(o.frame, p) })
  return true
}

/** Fits the face to the marks and leaves the rings tool, or says why the marks do not fit. */
function fitFace(o: {
  record: Face | undefined
  marks: FaceMark[]
  system: UnitSystem
  say: (text: string, alert?: boolean) => void
  setFace: SetFace
  startTool: (t: Tool) => void
  markButton: RefObject<HTMLButtonElement | null>
  t: Translator['t']
}) {
  const { record, marks, system, say, setFace, startTool, markButton, t } = o
  if (!record) return
  try {
    const a = faceAlignment(record, marks, undefined, t)
    setFace((x) => x && { ...x, marks })
    say(
      t('Target fitted to {count} marks, misfit {misfit}.', {
        count: marks.length,
        misfit: mmLength(system, fromSi('length', a.rms ?? 0)),
      }),
    )
    startTool('select')
    // the Fit button turns disabled: the focus goes back to Mark
    requestAnimationFrame(() => markButton.current?.focus())
  } catch (e) {
    say(t('The ring marks do not fit: {reason}.', { reason: (e as Error).message }), true)
  }
}

/** The fitted face as a scale reference: its outermost marked ring, centre and edge on the photo. */
function referenceOf(
  frame: Frame | undefined,
  record: Face | undefined,
  choice: GroupFace | undefined,
  result: ScoredGroup | undefined,
): CalibrationReference | undefined {
  if (!frame || !record || !choice?.marks || !result) return undefined
  const values = new Set(choice.marks.map((m) => m.ring))
  const d = Math.max(
    ...record.rings.filter((r) => values.has(r.value)).map((r) => r.diameter.value),
  )
  const a = result.alignment
  return {
    kind: 'ringCentre',
    centre: targetToView(frame, a.centre),
    edge: targetToView(frame, onSheet(a, { x: toSi('length', d / 2), y: 0 })),
    diameter: toSi('length', d),
  }
}

function ringHint(ringValue: number | undefined, marks: number, rings: number, t: Translator['t']) {
  return t(
    'Click points on ring {ring}; choose the ring in Ring. {marks} marks on {rings} rings; Fit needs 4 on 2 rings. Or arrow keys and Enter. Esc cancels.',
    { ring: ringValue ?? '?', marks, rings },
  )
}

/** The faces of the federation picked in Federation when no discipline is, else undefined. */
function federationOf(
  all: Face[],
  data: FederationData | undefined,
  fed: string,
  discipline: string | undefined,
) {
  return fed && !discipline && data ? federationFaceIds(all, data, fed) : undefined
}

/** A face chosen in Face: the event of its mapping, else its first event; the same face keeps its marks. */
function pickFace(
  id: string,
  ofDiscipline: ReturnType<typeof disciplineFaces>,
  setFace: SetFace,
  setFederation: (f: string | undefined) => void,
) {
  // a face of the discipline: the event of its mapping, the same face keeps its marks
  const m = ofDiscipline.find((x) => x.face === id)
  if (m) {
    setFace((x) => ({ id, event: m.event, ...(x?.id === id && x.marks && { marks: x.marks }) }))
    return
  }
  setFace(() => (id ? { id } : undefined))
  // a face from the federation's or every face shows the federation of its own discipline
  setFederation(undefined)
  // the first event: its gauge scores, as the rule book says
  if (id)
    fetchFace(id).then(
      (f) => {
        const event = f.events[0]?.id
        if (event) setFace((x) => (x && x.id === id && !x.event ? { ...x, event } : x))
      },
      () => {},
    )
}

/** A discipline chosen in Discipline: its face and event; the same face keeps its marks. */
function pickDiscipline(v: string | null, mappings: FederationData['mappings'], setFace: SetFace) {
  const picked = v && disciplineChoice(v, mappings)
  if (!picked) return
  const { id, event } = picked
  // the same face keeps its marks, as a change of Event does
  setFace((x) => ({ id, event, ...(x?.id === id && x.marks && { marks: x.marks }) }))
}

type PanelProps = {
  data: FederationData | undefined
  fed: string
  list: FaceSummary[] | 'loading' | 'error'
  choices: ReturnType<typeof disciplineOptions>
  choice: GroupFace | undefined
  mappings: FederationData['mappings']
  faceOptions: ReturnType<typeof faceOptionsOf>
  record: Face | undefined
  result: ScoredGroup | undefined
  status: string
  system: UnitSystem
  sheet: TargetSheet
  tool: Tool
  canFit: boolean
  hasFrame: boolean
  ringValue: number | undefined
  markButton: RefObject<HTMLButtonElement | null>
  onFederation: (id: string) => void
  onFace: (id: string) => void
  onDiscipline: (v: string | null) => void
  onFaceEdit: SetFace
  onRing: (value: number) => void
  onMark: () => void
  onFit: () => void
  onReference: () => void
}

function AlignRow(p: PanelProps) {
  const { choice, record, tool, canFit, markButton } = p
  const { t } = useTranslation()
  return (
    <div className="prop-row score-align">
      <span className="prop-label" title={p.status}>
        {t('Align')}
      </span>
      <span className="prop-value row-buttons">
        <Button
          size={controlSize.row.button}
          variant={choice && !choice.marks ? 'filled' : 'default'}
          disabled={!record}
          title={t('Centre the target on the point of aim (or the origin) at the sheet scale')}
          onClick={() => p.onFaceEdit((x) => x && { id: x.id, ...(x.event && { event: x.event }) })}
        >
          {t('On aim')}
        </Button>
        <Button
          ref={markButton}
          size={controlSize.row.button}
          variant={tool === 'rings' ? 'filled' : 'default'}
          disabled={!record || !p.hasFrame}
          title={t('Mark points on two or more rings of the target, then Fit')}
          onClick={p.onMark}
        >
          {t('Mark')}
        </Button>
        <Button
          size={controlSize.row.button}
          variant="default"
          disabled={tool !== 'rings' || !canFit}
          aria-label={t('Fit target')}
          title={t("Fit the target's centre and scale to the marks")}
          onClick={p.onFit}
        >
          {t('Fit')}
        </Button>
      </span>
    </div>
  )
}

function FaceSelects(p: PanelProps) {
  const { data, list, choice } = p
  const { t } = useTranslation()
  const federations = data ? federationsWithDisciplines(data) : []
  const federation = federations.find((f) => f.id === p.fed)
  return (
    <>
      <NativeSelect
        label={t('Federation')}
        className="full-row"
        size={controlSize.row.input}
        description={t(federationHelp)}
        labelProps={{ title: t(federationHelp) }}
        title={federation ? `${federation.abbreviation}: ${federation.name}` : t('All')}
        disabled={!federations.length}
        data={[
          { value: '', label: t('All') },
          ...federations.map((f) => ({ value: f.id, label: f.abbreviation })),
        ]}
        value={p.fed}
        onChange={(e) => p.onFederation(e.currentTarget.value)}
      />
      <DisciplineSelect
        offline={list === 'error'}
        choices={p.choices}
        value={disciplineValue(choice, p.mappings)}
        onPick={p.onDiscipline}
      />
      <NativeSelect
        label={t('Target')}
        className="full-row"
        size={controlSize.row.input}
        description={t(faceHelp)}
        labelProps={{ title: t(faceHelp) }}
        title={list === 'error' ? t(offline) : optionLabel(p.faceOptions, choice?.id ?? '')}
        disabled={list === 'error' || (list === 'loading' && !choice)}
        data={p.faceOptions}
        value={choice?.id ?? ''}
        onChange={(e) => p.onFace(e.currentTarget.value)}
      />
    </>
  )
}

function ScorePanel(p: PanelProps) {
  const { choice, record, result, status, system } = p
  const { t } = useTranslation()
  const rings = (record?.rings ?? []).map((x) => ({
    value: String(x.value),
    label: `${plainNumber(x.value)}: ${mmLength(system, x.diameter.value)}`,
  }))
  return (
    <>
      <FaceSelects {...p} />
      {/* the rows of a face keep their room without one, so choosing a face moves nothing */}
      <div className="prop-grid score-rows" data-off={choice ? undefined : true}>
        {/* a face a discipline names takes the event of its mapping, so only another face adds the row */}
        {record && !mappedFace(p.mappings, record.id) && (
          <EventSelect
            record={record}
            event={choice?.event}
            system={system}
            onEvent={(event) =>
              p.onFaceEdit(
                (x) =>
                  x && (event ? { ...x, event } : { id: x.id, ...(x.marks && { marks: x.marks }) }),
              )
            }
          />
        )}
        <AlignRow {...p} />
        <NativeSelect
          label={t('Ring')}
          className="full-row"
          size={controlSize.row.input}
          description={t(ringHelp)}
          labelProps={{ title: t(ringHelp) }}
          disabled={!record}
          title={optionLabel(rings, String(p.ringValue ?? ''))}
          data={rings}
          value={String(p.ringValue ?? '')}
          onChange={(e) => p.onRing(Number(e.currentTarget.value))}
        />
        <div className="prop-row">
          <span
            className="prop-label"
            title={t(
              'Add the fitted target as a scale reference of the sheet (Calibrate): its outermost marked ring at the rule-book diameter.',
            )}
          >
            {t('Scale ref.')}
          </span>
          <span className="prop-value row-buttons">
            <Button
              size={controlSize.row.button}
              variant="default"
              disabled={!p.sheet.photo || !choice?.marks || !result}
              aria-label={t('Add the target as a scale reference')}
              onClick={p.onReference}
            >
              {t('Add')}
            </Button>
          </span>
        </div>
        <p
          className="score-status wide"
          title={result?.usesOwnTenthRule ? `${status} ${t(ownRuleNote)}` : status}
        >
          {status}
        </p>
      </div>
    </>
  )
}

/**
 * Ring scoring in the target editor (`apps/docs/docs/models/ring-scoring.md`): the face and event of
 * the active group, its alignment (centred on the point of aim, or fitted to points marked on its
 * rings with the tool `rings`), the rings and values on the canvas, and every group's score.
 */
export function useRingScoring({
  sheet,
  frame,
  group,
  bullet,
  rings,
  onGroup,
  onReference,
  say,
  tool,
  startTool,
}: {
  sheet: TargetSheet
  frame: Frame | undefined
  group: ShotGroup | undefined
  /** Hole diameter without an event: the bullet (workbench) or the marker, m. */
  bullet: number | undefined
  /** The overlay switch: the face's rings and the shot values on the canvas. */
  rings: boolean
  onGroup: (f: (g: ShotGroup) => ShotGroup, key?: string) => void
  /** Adds a scale reference to the sheet (Calibrate). */
  onReference: (r: CalibrationReference) => void
  say: (text: string, alert?: boolean) => void
  tool: Tool
  startTool: (t: Tool) => void
}) {
  const { system } = useUnits()
  const { t } = useTranslation()
  const [list, setList] = useState<FaceSummary[] | 'loading' | 'error'>('loading')
  const [all, setAll] = useState<Face[]>([])
  const [data, setData] = useState<FederationData>()
  /** The federation picked for the Discipline list; undefined: the one of the group's discipline. */
  const [federation, setFederation] = useState<string>()
  const [faces, setFaces] = useState<Record<string, Face | 'error'>>({})
  /** Ring value of the next mark, and the marks so far, target m. */
  const [ring, setRing] = useState<number>()
  const [marks, setMarks] = useState<FaceMark[]>([])
  const markButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    fetchFaceSummaries().then(setList, () => setList('error'))
    fetchAllFaces().then(setAll, () => {})
    // without the federations the face events are the disciplines, as for a face no mapping names
    fetchFederationData().then(setData, () => {})
  }, [])
  const ids = [...new Set(sheet.groups.flatMap((g) => (g.face ? [g.face.id] : [])))]
  const idKey = ids.join(' ')
  // a face that failed to load is asked again once the browser is back online
  const [retry, setRetry] = useState(0)
  useWindowEvent('online', () => setRetry((n) => n + 1))
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a change of the faces used or a retry
  useEffect(() => {
    for (const id of ids)
      fetchFace(id).then(
        (f) => setFaces((x) => (x[id] === f ? x : { ...x, [id]: f })),
        () => setFaces((x) => ({ ...x, [id]: 'error' })),
      )
  }, [idKey, retry])
  useEffect(() => {
    if (tool !== 'rings') setMarks([])
  }, [tool])
  // another face (or group) has other rings: its ring choice and the marks so far go
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a change of the group or face only
  useEffect(() => {
    setRing(undefined)
    setMarks([])
  }, [group?.id, group?.face?.id])

  const scoring = useMemo(
    () => scoreGroups(sheet.groups, faces, data, bullet, t),
    [sheet.groups, faces, bullet, data, t],
  )
  /** The score of group `id`: undefined without a face. */
  const of = (id: string) => scoring.get(id)

  const choice = group?.face
  const mappings = data?.mappings ?? []
  const discipline = mappingOf(mappings, choice)?.discipline
  const own = data?.disciplines.find((d) => d.id === discipline)?.federation
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a change of the group only
  useEffect(() => setFederation(undefined), [group?.id])
  // a discipline of another federation (a face picked from all faces or found on the photo) shows its own
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a change of the discipline only
  useEffect(() => setFederation((f) => (f && own && f !== own ? undefined : f)), [discipline])
  const fed = federation ?? own ?? ''
  const choices = disciplineOptions(all, data, fed || undefined)
  const face = choice && faces[choice.id]
  const record = face && face !== 'error' ? face : undefined
  const current = group && of(group.id)
  const result = scoredOnly(current)
  /** The ring the next mark lies on: chosen, else the third ring from the centre. */
  const ringValue = ring ?? record?.rings.at(-3)?.value
  /** One undo step per run of face edits of a group. */
  const setFace = (f: (x: GroupFace | undefined) => GroupFace | undefined) =>
    onGroup(({ face: old, ...g }) => {
      const next = f(old)
      return next ? { ...g, face: next } : g
    }, `face ${group?.id}`)

  const onPoint = (p: Point) =>
    clickPoint(
      {
        tool,
        frame,
        ringValue,
        count: marks.length,
        say,
        addMark: (m) => setMarks((x) => [...x, m]),
        t,
      },
      p,
    )

  const ringsMarked = new Set(marks.map((m) => m.ring)).size
  const canFit = marks.length >= 4 && ringsMarked >= 2
  const fit = () => fitFace({ record, marks, system, say, setFace, startTool, markButton, t })

  /** The fitted face as a scale reference of the sheet. */
  const asReference = () => {
    const reference = referenceOf(frame, record, choice, result)
    if (reference) onReference(reference)
  }

  /** The outline of the face shown, view units: a drawn target fits to it. */
  const outline = useMemo(() => {
    if (!frame || !rings || !result || !record) return
    const outer = Math.max(record.blackDiameter.value, ...record.rings.map((x) => x.diameter.value))
    return ringPath(result.alignment, outer).map((q) => targetToView(frame, q))
  }, [frame, rings, result, record])

  const hint = tool === 'rings' ? ringHint(ringValue, marks.length, ringsMarked, t) : undefined

  /** The rings of the active group's face and the values of its shots; `still` leaves out marks. */
  const layer = (k: number, still?: boolean) =>
    frame ? (
      <FaceLayer
        frame={frame}
        sheet={sheet}
        group={group}
        rings={rings}
        marks={tool === 'rings' ? marks : []}
        faces={faces}
        scored={(id) => scoredOnly(of(id))}
        k={k}
        still={still}
      />
    ) : null

  const status = scoreStatus({ list, choice, face, current, result, system, t })
  const ofDiscipline = discipline ? disciplineFaces(mappings, discipline) : []
  const inFederation = federationOf(all, data, fed, discipline)

  const panel = group && (
    <ScorePanel
      data={data}
      fed={fed}
      list={list}
      choices={choices}
      choice={choice}
      mappings={mappings}
      faceOptions={faceOptionsOf({ list, choice, discipline, ofDiscipline, inFederation, t })}
      record={record}
      result={result}
      status={status}
      system={system}
      sheet={sheet}
      tool={tool}
      canFit={canFit}
      hasFrame={!!frame}
      ringValue={ringValue}
      markButton={markButton}
      onFederation={setFederation}
      onFace={(id) => pickFace(id, ofDiscipline, setFace, setFederation)}
      onDiscipline={(v) => pickDiscipline(v, mappings, setFace)}
      onFaceEdit={setFace}
      onRing={setRing}
      onMark={() => {
        setMarks([])
        startTool('rings')
      }}
      onFit={fit}
      onReference={asReference}
    />
  )

  const scope: FaceScope = { ...(fed && { federation: fed }), ...(data && { data }) }
  return { onPoint, hint, layer, panel, of, ownRuleNote: t(ownRuleNote), scope, outline }
}
