'use client'

import { Button, NativeSelect, Select } from '@mantine/core'
import { useWindowEvent } from '@mantine/hooks'
import type {
  CalibrationReference,
  GroupFace,
  ShotGroup,
  TargetFace,
  TargetSheet,
} from '@openreloading/schema'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  disciplineChoice,
  disciplineFaces,
  disciplineOptions,
  disciplineValue,
  type FederationData,
  mappedFace,
  mappingOf,
} from '../lib/face-disciplines.ts'
import { compareEvents, compareTargetFaces, federationFaceIds } from '../lib/face-order.ts'
import {
  type FaceSummary,
  fetchAllFaces,
  fetchFace,
  fetchFaceSummaries,
  fetchFederationData,
} from '../lib/face-records.ts'
import type { FaceScope } from '../lib/face-sheet.ts'
import { type LabelScene, placeLabel } from '../lib/label-placement.ts'
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
import { faceIdPrefix } from '../lib/user-faces.ts'
import { mmLength } from '../lib/workbench.ts'
import type { Tool } from './target-canvas.tsx'
import { useUnits } from './units-settings.tsx'

type Scoring = ReturnType<typeof scoreGroupOnFace>

const offline = 'Faces need the network'
const faceHelp =
  'The rule-book target face that scores the group. Scores follow every edit; excluded shots show their value and do not count in the total.'
const federationHelp =
  'The federation whose disciplines the Discipline list shows. All: every discipline, then the face events no discipline names.'
const disciplineHelp =
  'The discipline sets the face, the event and with it the scored hole. Type to search by name, number or federation.'
const eventHelp =
  "A face no discipline names: the event's gauge is the scored hole, as the rule book says; a black-powder event scores the hole centre. Bullet: the bullet diameter of the load, else Marker."
const ringHelp =
  'The ring the next marks lie on; mark the outer edge of its line. Fit needs 4 marks on 2 rings.'
const ownRuleNote =
  'Tenths in the 10 zone of this face: own rule. The 10 zone is wider than one ring and the rule book does not divide it; tenths of the ring width are counted inward from the touching edge, 10.9 for the rest of the centre.'

/** A shot's value as shown: tenths where the face has them, X for an inner ten. */
export const shotText = (s: RingScore) =>
  `${s.decimal !== undefined ? s.decimal.toFixed(1) : s.value}${s.innerTen ? ' X' : ''}`

/** A group's scoring when it scored: none while its face loads, after a failure or a refusal. */
export const scoredOnly = (r: Scoring | 'loading' | 'error' | undefined) =>
  r && typeof r === 'object' && !('error' in r) ? r : undefined

/** A group's score as one line: total, decimal total, inner tens. */
export function scoreLine(r: Scoring | 'loading' | 'error' | undefined) {
  const scored = scoredOnly(r)
  if (!scored) return
  const { total, decimalTotal, innerTenCount: xCount } = scored.score
  return `${total}${decimalTotal !== undefined ? ` (${decimalTotal.toFixed(1)})` : ''}, ${xCount} X`
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
  const [list, setList] = useState<FaceSummary[] | 'loading' | 'error'>('loading')
  const [all, setAll] = useState<TargetFace[]>([])
  const [data, setData] = useState<FederationData>()
  /** The federation picked for the Discipline list; undefined: the one of the group's discipline. */
  const [federation, setFederation] = useState<string>()
  const [faces, setFaces] = useState<Record<string, TargetFace | 'error'>>({})
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

  const scoring = useMemo(() => {
    const out = new Map<string, Scoring | 'loading' | 'error'>()
    for (const g of sheet.groups) {
      if (!g.face) continue
      const f = faces[g.face.id]
      out.set(
        g.id,
        f === undefined
          ? 'loading'
          : f === 'error'
            ? f
            : scoreGroupOnFace(
                f,
                { ...g.face, gauge: mappingOf(data?.mappings ?? [], g.face)?.gaugeMm },
                g,
                bullet,
              ),
      )
    }
    return out
  }, [sheet.groups, faces, bullet, data])
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

  function onPoint(p: Point): boolean {
    if (tool !== 'rings') return false
    if (!frame || ringValue === undefined) return true
    if (marks.length >= 64) {
      say('At most 64 marks.', true)
      return true
    }
    setMarks((m) => [...m, { ring: ringValue, ...viewToTarget(frame, p) }])
    return true
  }

  const ringsMarked = new Set(marks.map((m) => m.ring)).size
  const canFit = marks.length >= 4 && ringsMarked >= 2
  function fit() {
    if (!record) return
    try {
      const a = faceAlignment(record, marks, undefined)
      setFace((x) => x && { ...x, marks })
      say(`Face fitted to ${marks.length} marks, misfit ${mmLength(system, (a.rms ?? 0) * 1e3)}.`)
      startTool('select')
      // the Fit button turns disabled: the focus goes back to Mark
      requestAnimationFrame(() => markButton.current?.focus())
    } catch (e) {
      say(`The ring marks do not fit: ${(e as Error).message}.`, true)
    }
  }

  /** The fitted face as a scale reference: its outermost marked ring, centre and edge on the photo. */
  function asReference() {
    if (!frame || !record || !choice?.marks || !result) return
    const values = new Set(choice.marks.map((m) => m.ring))
    const d = Math.max(
      ...record.rings.filter((r) => values.has(r.value)).map((r) => r.diameter.value),
    )
    const a = result.alignment
    onReference({
      kind: 'ringCentre',
      centre: targetToView(frame, a.centre),
      edge: targetToView(frame, onSheet(a, { x: d * 5e-4, y: 0 })),
      diameter: d * 1e-3,
    })
  }

  const hint =
    tool === 'rings'
      ? `Click points on ring ${ringValue ?? '?'}; choose the ring in Ring. ${marks.length} marks on ${ringsMarked} rings; Fit needs 4 on 2 rings. Or arrow keys and Enter. Esc cancels.`
      : undefined

  /**
   * Label boxes of the shot values of `g`, view units: outward from the group centre, clear of the
   * shot marks, their numbers and each other (`placeLabel`).
   */
  const scoreLabels = (g: ShotGroup, k: number) => {
    const r = scoredOnly(of(g.id))
    if (!frame || !r) return []
    const font = 11 * k
    const scene: LabelScene = {
      circles: [],
      segments: [],
      boxes: [],
      view: { x: -1e12, y: -1e12, w: 2e12, h: 2e12 },
      fontSize: font,
      gap: 3 * k,
    }
    const pts = g.shots.map((s) => targetToView(frame, s))
    g.shots.forEach((s, i) => {
      const p = pts[i]
      const e = targetToView(frame, { x: s.x + (sheet.markerDiameter ?? 0) / 2, y: s.y })
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
    return pts.map((p, i) => placeLabel(scene, shotText(r.score.shots[i]), [p], c))
  }

  /** The rings of the active group's face and the values of its shots; `still` leaves out marks. */
  const layer = (k: number, still?: boolean) => {
    if (!frame) return null
    const v = (q: Point) => targetToView(frame, q)
    const path = (pts: Point[]) => `M${pts.map((q) => `${v(q).x} ${v(q).y}`).join('L')}Z`
    const marked =
      !still &&
      tool === 'rings' &&
      marks.map((m, i) => {
        const p = v(m)
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
    const shown = sheet.groups.filter((g) => rings && g.face && (g.id === group?.id || still))
    return (
      // biome-ignore lint/a11y/noAriaHiddenOnFocusable: an SVG group is not focusable; it only draws (the values are in the shots' names and the table)
      <g className="face-layer" aria-hidden="true">
        {shown.map((g) => {
          const r = scoredOnly(of(g.id))
          const f = g.face && faces[g.face.id]
          if (!r || !f || f === 'error') return null
          const a = r.alignment
          return (
            <g key={g.id} className="face-rings" style={{ color: g.colour }}>
              {!sheet.photo && (
                <path className="face-black" d={path(ringPath(a, f.blackDiameter.value))} />
              )}
              {f.rings.map((x) => (
                <path key={x.value} d={path(ringPath(a, x.diameter.value))} />
              ))}
              {f.innerTen && (
                <path className="face-inner" d={path(ringPath(a, f.innerTen.diameter.value))} />
              )}
              {scoreLabels(g, k).map((b, i) => (
                <text
                  // biome-ignore lint/suspicious/noArrayIndexKey: shots keep their order
                  key={i}
                  className="shot-score"
                  data-excluded={g.shots[i].excluded || undefined}
                  x={b.x}
                  y={b.y + 11 * k}
                  fontSize={11 * k}
                >
                  {shotText(r.score.shots[i])}
                </text>
              ))}
            </g>
          )
        })}
        {marked}
      </g>
    )
  }

  const status =
    list === 'error'
      ? offline
      : !choice
        ? 'No face: no score.'
        : face === 'error'
          ? choice.id.startsWith(faceIdPrefix)
            ? 'This face design is deleted or no longer a valid face.'
            : `${offline}: ${choice.id} could not be loaded.`
          : current && typeof current === 'object' && 'error' in current
            ? current.error
            : result
              ? choice.marks
                ? `Fitted to ${choice.marks.length} marks, misfit ${mmLength(system, (result.alignment.rms ?? 0) * 1e3)}, scale ${(result.alignment.scale * 100).toFixed(1)} %.`
                : 'Centred on the point of aim (or the origin) at the sheet scale.'
              : 'Loading the face…'

  const faceLabel = (id: string) => {
    const f = typeof list === 'object' && list.find((x) => x.id === id)
    return f ? `${f.organization} ${f.name}` : id
  }
  /** The faces of the discipline with their stages, else every face. */
  const ofDiscipline = discipline ? disciplineFaces(mappings, discipline) : []
  const inFederation = fed && !discipline && data ? federationFaceIds(all, data, fed) : undefined
  const faceOptions =
    list === 'error'
      ? [{ value: choice?.id ?? '', label: choice?.id ?? offline }]
      : [
          { value: '', label: 'None' },
          // the stages of a discipline keep the order of the rule book
          ...(discipline
            ? ofDiscipline.map((m) => ({
                value: m.face,
                label: `${faceLabel(m.face)}${m.stage ? `, ${m.stage}` : ''}`,
              }))
            : list === 'loading'
              ? choice
                ? [{ value: choice.id, label: choice.id }]
                : []
              : list
                  .filter((f) => !inFederation || inFederation.has(f.id) || f.id === choice?.id)
                  .toSorted(compareTargetFaces)
                  .map((f) => ({ value: f.id, label: `${f.organization} ${f.name}` }))),
        ]

  const panel = group && (
    <>
      <NativeSelect
        label="Federation"
        size={controlSize.row.input}
        description={federationHelp}
        labelProps={{ title: federationHelp }}
        disabled={!data?.federations.length}
        data={[
          { value: '', label: 'All' },
          ...(data?.federations ?? []).map((f) => ({ value: f.id, label: f.abbreviation })),
        ]}
        value={fed}
        onChange={(e) => setFederation(e.currentTarget.value)}
      />
      <Select
        label="Discipline"
        size={controlSize.row.input}
        searchable
        allowDeselect={false}
        labelProps={{ title: disciplineHelp }}
        title={list === 'error' ? offline : undefined}
        disabled={list === 'error' || !choices.length}
        placeholder={list === 'error' ? offline : undefined}
        nothingFoundMessage="None found"
        comboboxProps={{ width: 'max-content', position: 'bottom-end', keepMounted: false }}
        // the scrolling region is focusable (axe scrollable-region-focusable) and a group, so it may sit in the listbox (aria-required-children)
        scrollAreaProps={{
          viewportProps: { tabIndex: 0, role: 'group', 'aria-label': 'Disciplines' },
        }}
        data={choices}
        value={disciplineValue(choice, mappings)}
        onChange={(v) => {
          const picked = v && disciplineChoice(v, mappings)
          if (!picked) return
          const { id, event } = picked
          // the same face keeps its marks, as a change of Event does
          setFace((x) => ({ id, event, ...(x?.id === id && x.marks && { marks: x.marks }) }))
        }}
      />
      <NativeSelect
        label="Face"
        size={controlSize.row.input}
        description={faceHelp}
        labelProps={{ title: faceHelp }}
        title={list === 'error' ? offline : undefined}
        disabled={list === 'error' || (list === 'loading' && !choice)}
        data={faceOptions}
        value={choice?.id ?? ''}
        onChange={(e) => {
          const id = e.currentTarget.value
          // a face of the discipline: the event of its mapping, the same face keeps its marks
          const m = ofDiscipline.find((x) => x.face === id)
          if (m) {
            setFace((x) => ({
              id,
              event: m.event,
              ...(x?.id === id && x.marks && { marks: x.marks }),
            }))
            return
          }
          setFace(() => (id ? { id } : undefined))
          // a face from the federation's or every face shows the federation of its own discipline
          setFederation(undefined)
          // the first event: its gauge scores, as the rule book says
          if (id)
            fetchFace(id).then(
              (f) => {
                const event = f.events[0]?.name
                if (event) setFace((x) => (x && x.id === id && !x.event ? { ...x, event } : x))
              },
              () => {},
            )
        }}
      />
      {/* the rows of a face keep their room without one, so choosing a face moves nothing */}
      <div className="prop-grid score-rows" data-off={choice ? undefined : true}>
        {/* a face a discipline names takes the event of its mapping, so only another face adds the row */}
        {record && !mappedFace(mappings, record.id) && (
          <NativeSelect
            label="Event"
            size={controlSize.row.input}
            description={eventHelp}
            labelProps={{ title: eventHelp }}
            data={[
              ...(record?.events ?? [])
                .toSorted((a, b) =>
                  compareEvents(
                    { distance: a.distance.value, name: a.name },
                    { distance: b.distance.value, name: b.name },
                  ),
                )
                .map((e) => ({
                  value: e.name,
                  label: `${e.name}${e.gauge ? `, ${mmLength(system, e.gauge.value)}` : ''}`,
                })),
              { value: '', label: 'Bullet' },
            ]}
            value={choice?.event ?? ''}
            onChange={(e) => {
              const event = e.currentTarget.value
              setFace(
                (x) =>
                  x && (event ? { ...x, event } : { id: x.id, ...(x.marks && { marks: x.marks }) }),
              )
            }}
          />
        )}
        <div className="prop-row score-align">
          <span className="prop-label" title={status}>
            Align
          </span>
          <span className="prop-value row-buttons">
            <Button
              size={controlSize.row.button}
              variant={choice && !choice.marks ? 'filled' : 'default'}
              disabled={!record}
              title="Centre the face on the point of aim (or the origin) at the sheet scale"
              onClick={() => setFace((x) => x && { id: x.id, ...(x.event && { event: x.event }) })}
            >
              On aim
            </Button>
            <Button
              ref={markButton}
              size={controlSize.row.button}
              variant={tool === 'rings' ? 'filled' : 'default'}
              disabled={!record || !frame}
              title="Mark points on two or more rings of the face, then Fit"
              onClick={() => {
                setMarks([])
                startTool('rings')
              }}
            >
              Mark
            </Button>
            <Button
              size={controlSize.row.button}
              variant="default"
              disabled={tool !== 'rings' || !canFit}
              aria-label="Fit face"
              title="Fit the face's centre and scale to the marks"
              onClick={fit}
            >
              Fit
            </Button>
          </span>
        </div>
        <NativeSelect
          label="Ring"
          size={controlSize.row.input}
          description={ringHelp}
          labelProps={{ title: ringHelp }}
          disabled={!record}
          data={(record?.rings ?? []).map((x) => ({
            value: String(x.value),
            label: `${x.value}: ${mmLength(system, x.diameter.value)}`,
          }))}
          value={String(ringValue ?? '')}
          onChange={(e) => setRing(Number(e.currentTarget.value))}
        />
        <div className="prop-row">
          <span
            className="prop-label"
            title="Add the fitted face as a scale reference of the sheet (Calibrate): its outermost marked ring at the rule-book diameter."
          >
            Scale ref.
          </span>
          <span className="prop-value row-buttons">
            <Button
              size={controlSize.row.button}
              variant="default"
              disabled={!sheet.photo || !choice?.marks || !result}
              aria-label="Add the face as a scale reference"
              onClick={asReference}
            >
              Add
            </Button>
          </span>
        </div>
        <p
          className="score-status wide"
          title={result?.usesOwnTenthRule ? `${status} ${ownRuleNote}` : status}
        >
          {status}
        </p>
      </div>
    </>
  )

  /** The federation of the Discipline list and the mappings, for a face found on the photo. */
  const scope: FaceScope = { ...(fed && { federation: fed }), ...(data && { data }) }
  return { onPoint, hint, layer, panel, of, ownRuleNote, scope }
}
