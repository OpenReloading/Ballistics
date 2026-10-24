'use client'

import { ActionIcon, Button, Flex, NativeSelect, Popover } from '@mantine/core'
import {
  fromSi,
  type ShotGroup,
  type TargetFace,
  type TargetSheet,
  toSi,
} from '@open-reloading/schema'
import { ArrowClockwise, ArrowCounterClockwise, GearSix, X } from '@phosphor-icons/react'
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'
import { ellipsePoint } from '../lib/ellipse.ts'
import { fetchAllFaces, fetchFace } from '../lib/face-records.ts'
import { type FoundFace, faceGeometry } from '../lib/face-sheet.ts'
import type { FlaggedRegion, HoleProposal } from '../lib/hole-detection.ts'
import type { Rgb, WorkerReply, WorkerRequest } from '../lib/hole-detection-protocol.ts'
import {
  acceptProposals,
  confirmedHoleDiameters,
  type EditorProposal,
  expectedHoleSize,
  localPxPerM,
  MIN_HOLES_TO_LEARN_SIZE,
  proposalsClearOfShots,
  rectangleFromDiagonal,
} from '../lib/hole-proposals.ts'
import type { Frame } from '../lib/target-editor.ts'
import {
  type FaceFit,
  type FacePlane,
  type FaceSearch,
  faceLabel,
  fitDiameter,
  fitPicked,
} from '../lib/target-face.ts'
import { type Point, turnedBox } from '../lib/target-geometry.ts'
import { controlSize } from '../lib/theme.ts'
import { formatQuantity } from '../lib/units.ts'
import { storedPhoto } from '../lib/user-store.ts'
import { usePopoverReturn } from './popover-return.ts'
import { SiField } from './si-field.tsx'
import { arrows, viewPoint } from './svg-point.ts'
import type { Tool } from './target-canvas.tsx'
import { useUnits } from './units-settings.tsx'

type Choices = NonNullable<ShotGroup['detection']>
const defaultContrast = 0.15
const hex = (c: Rgb) => `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
const rgbOf = (h: string): Rgb => ({
  r: Number.parseInt(h.slice(1, 3), 16),
  g: Number.parseInt(h.slice(3, 5), 16),
  b: Number.parseInt(h.slice(5, 7), 16),
})

/** The guided steps; each shows only its own controls. */
const detectSteps = ['Rotate', 'Scale', 'Example', 'Detect', 'Review'] as const

/**
 * Hole detection in the target editor (`apps/docs/docs/models/hole-detection.md`):
 * one-click auto detection, else the guided steps (rotate, scale, one example hole, detect,
 * review) with the region, backing and threshold behind one Settings disclosure; a Web Worker run
 * with progress and cancel; the proposals, kept apart from the sheet in photo px until accepted, so
 * no statistic sees them.
 */
export function useHoleDetection({
  sheet,
  sheetId,
  frame,
  group,
  photo,
  bullet,
  onGroup,
  onTurn,
  openCalibrate,
  onFace,
  say,
  tool,
  startTool,
}: {
  sheet: TargetSheet
  /** The sheet's record id: a copy (Save as) shares the photo and the group ids. */
  sheetId: string
  frame: Frame | undefined
  group: ShotGroup | undefined
  /** The photo's size as shown; undefined while it loads or is missing. */
  photo: { width: number; height: number } | undefined
  /** Bullet diameter of the load, m (workbench). */
  bullet: number | undefined
  onGroup: (f: (g: ShotGroup) => ShotGroup, key?: string) => void
  /** Turns the photo to an angle, rad counter-clockwise (one undo step; `key` joins typed edits). */
  onTurn: (angle: number, key?: string) => void
  /** Opens Calibrate (the scale references). */
  openCalibrate: () => void
  /** Calibrates the sheet on a face found on the photo (one undo step). */
  onFace: (found: FoundFace) => void
  say: (text: string, alert?: boolean) => void
  tool: Tool
  startTool: (t: Tool) => void
}) {
  const [proposals, setProposals] = useState<EditorProposal[]>([])
  /** Regions too large to count: the user places their shots by hand; no statistic sees them. */
  const [flagged, setFlagged] = useState<FlaggedRegion[]>([])
  const [progress, setProgress] = useState<number>()
  const [shape, setShape] = useState<'rectangle' | 'polygon'>('rectangle')
  const [pending, setPending] = useState<Point[]>([])
  /** The guided step shown, 0 to 4; undefined: the one-click start. */
  const [step, setStep] = useState<number>()
  /** What the face search found on this photo (photo px), for the choice and the fallback. */
  const [found, setFound] = useState<FaceSearch>()
  /** The record of the active group's face, for the label the detection takes. */
  const [record, setRecord] = useState<TargetFace>()
  /** The black diameter typed when no face fits, m. */
  const [diameter, setDiameter] = useState<number>()
  /** A face was applied and the auto run waits for the sheet to follow. */
  const awaiting = useRef(false)
  const [settings, setSettings] = useState(false)
  const gear = useRef<HTMLButtonElement>(null)
  const worker = useRef<Worker | undefined>(undefined)
  /** View units per screen px, from the last drawing of the layer. */
  const unit = useRef(1)
  /** Photo px per m of the last run, for the measured hole of an accepted proposal. */
  const runScale = useRef(1)
  const turn = sheet.photoRotation ?? 0
  const { system } = useUnits()

  const choices: Choices = group?.detection ?? {}
  const size = group
    ? expectedHoleSize({
        typedDiameter: choices.expectedHoleDiameter,
        confirmedDiameters: confirmedHoleDiameters(group),
        bulletDiameter: bullet,
        markerDiameter: sheet.markerDiameter,
      })
    : undefined
  /** The face of the group on the photo as the sheet knows it (`faceGeometry`), for the detection. */
  const geometry = faceGeometry({
    sheet,
    group,
    record,
    toTarget: frame?.calibration && frame.toTarget,
  })
  /** The marked region, else the face, else the whole turned photo (for the local scale; the run finds the target). */
  const region =
    choices.region ??
    (geometry && size ? faceLabel(geometry, fromSi('length', size.diameter)).outline : undefined) ??
    (photo &&
      (() => {
        const b = turnedBox(photo.width, photo.height, turn)
        return rectangleFromDiagonal({ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h })
      })())

  /** Counts stops, so pending photo and face reads cannot resume a cancelled operation. */
  const stops = useRef(0)
  const stop = () => {
    stops.current++
    worker.current?.terminate()
    worker.current = undefined
    setProgress(undefined)
  }
  // another photo, sheet or group: its proposals and a run on the old one go
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a photo, sheet or group change only
  useEffect(() => {
    stop()
    setProposals([])
    setFlagged([])
    setStep(undefined)
    setFound(undefined)
    awaiting.current = false
    return stop
  }, [sheet.photo, sheetId, group?.id])
  // a turn moves the photo under the proposals
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a turn only
  useEffect(() => {
    stop()
    setProposals([])
    setFlagged([])
    setFound(undefined)
  }, [turn])
  // the record of the group's face
  const faceId = group?.face?.id
  useEffect(() => {
    setRecord(undefined)
    if (faceId) fetchFace(faceId).then(setRecord, () => {})
  }, [faceId])
  useEffect(() => {
    if (tool !== 'region') setPending([])
  }, [tool])
  /** The Settings control that started a point tool: Settings opens again with the focus on it. */
  const settingsReturnFrom = usePopoverReturn(
    tool,
    () => setSettings(true),
    (which) => document.querySelector<HTMLElement>(`[data-detect-set="${which}"]`),
  )
  const settingsTool = (which: string) => {
    settingsReturnFrom(which)
    setSettings(false)
  }

  const setChoice = (patch: Partial<Choices>, key: string) =>
    onGroup((g) => {
      const next: Record<string, unknown> = { ...g.detection, ...patch }
      for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k]
      return { ...g, detection: next as Choices }
    }, `detection ${key} ${group?.id}`)

  /** One request to a worker of its own; its replies until the last. */
  function ask(request: WorkerRequest, onReply: (m: WorkerReply) => void) {
    worker.current?.terminate()
    const w = new Worker(new URL('../lib/hole-detection.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.current = w
    w.onmessage = (e: MessageEvent<WorkerReply>) => {
      if (worker.current !== w) return
      const m = e.data
      if (m.kind === 'progress') return setProgress(m.done)
      stop()
      if (m.kind === 'error') return say(m.message, true)
      onReply(m)
    }
    w.onerror = () => {
      if (worker.current !== w) return
      stop()
      say('Hole detection failed in this browser.', true)
    }
    w.postMessage(request)
  }

  async function photoBlob() {
    if (!sheet.photo || !photo) return
    const stopped = stops.current
    const blob = await storedPhoto(sheet.photo).catch(() => undefined)
    if (stops.current !== stopped) return
    if (!blob) say('The photo is not in this browser.', true)
    return blob
  }

  const blocked = !sheet.photo
    ? 'Load a photo first.'
    : !photo
      ? 'The photo is not loaded.'
      : !frame?.calibration
        ? 'Set the scale first (step 2).'
        : !size
          ? 'Enter the hole size first (step 3).'
          : undefined

  /**
   * A run on the region (without one, on the target the module finds): `auto` takes the colour axis from the
   * strongest blobs of the region; without it the choices of the example and Settings apply. `found` gets the proposal count.
   */
  async function run(auto: boolean, over?: Choices, found?: (n: number) => void) {
    const c = { ...choices, ...over }
    const hole0 = c.expectedHoleDiameter ?? size?.diameter
    if (!frame?.calibration || !hole0 || !region || !photo || !group) return
    // running from the click on: a second click cannot start another run
    setProgress(0)
    const stopped = stops.current
    const blob = await photoBlob()
    if (stops.current !== stopped) return
    if (!blob) return setProgress(undefined)
    const pxPerM = localPxPerM(frame, region)
    runScale.current = pxPerM
    ask(
      {
        kind: 'detect',
        photo: blob,
        width: photo.width,
        height: photo.height,
        photoRotation: turn,
        ...(c.region && { region: c.region }),
        ...(geometry && { face: geometry }),
        pxPerM,
        holeDiameter: hole0,
        minContrast: c.minContrast ?? defaultContrast,
        ...(auto
          ? { auto: true }
          : {
              ...(c.backing && { backing: rgbOf(c.backing) }),
              ...(c.polarity && { polarity: c.polarity }),
            }),
      },
      (m) => {
        if (m.kind !== 'proposals') return
        const n = show(m, m.holeDiameter ?? hole0, pxPerM)
        // the size the holes show, for later runs
        if (n && auto && m.holeDiameter !== undefined)
          setChoice({ expectedHoleDiameter: m.holeDiameter }, 'auto')
        if (!n)
          say(
            auto
              ? 'No holes found: pick one example hole (step 3).'
              : `No holes proposed in the region.${flaggedNote(m.flagged)}`,
            auto,
          )
        found?.(n)
      },
    )
  }

  const flaggedNote = (f: FlaggedRegion[]) =>
    f.length
      ? ` ${f.length} ${f.length === 1 ? 'area' : 'areas'} to place by hand (dashed box).`
      : ''

  /** A run's proposals and flagged areas on the photo, step 5 when there are any; their count. */
  function show(
    m: { proposals: HoleProposal[]; flagged: FlaggedRegion[] },
    hole: number,
    pxPerM: number,
  ) {
    if (!group || !frame) return 0
    const list = proposalsClearOfShots(
      m.proposals.map((p, i) => ({ ...p, id: i })),
      group,
      frame,
      hole * pxPerM,
    )
    setProposals(list)
    setFlagged(m.flagged)
    if (list.length) {
      setStep(4)
      say(`${list.length} proposed; accept them to add shots.${flaggedNote(m.flagged)}`)
    }
    return list.length
  }

  /**
   * The face search over the whole photo: one face sets the scale, the centre and the group's
   * ring scoring face (`thenDetect`: and the auto run follows); two or more that the rings cannot
   * tell apart are a choice; none shows what was found (step 2).
   */
  async function recognise(thenDetect: boolean) {
    if (!photo) return
    setProgress(0)
    const stopped = stops.current
    const blob = await photoBlob()
    if (stops.current !== stopped) return
    if (!blob) return setProgress(undefined)
    let faces: TargetFace[]
    try {
      faces = await fetchAllFaces()
    } catch {
      if (stops.current !== stopped) return
      setProgress(undefined)
      setStep(0)
      return say('The target faces need the network: set the scale by hand (step 2).', true)
    }
    if (stops.current !== stopped) return
    ask(
      {
        kind: 'face',
        photo: blob,
        width: photo.width,
        height: photo.height,
        photoRotation: turn,
        faces,
        // a calibrated sheet gives the size, so faces of another size drop out of the search
        ...(frame?.calibration &&
          region && { pxPerMm: localPxPerM(frame, region) * toSi('length', 1) }),
      },
      (m) => {
        if (m.kind !== 'face') return
        setFound(m.search)
        const { fits, black } = m.search
        if (fits.length === 1 && m.search.sure) return applyFit(fits[0], thenDetect)
        // no black area at all: the steps as they were, from the photo's turn
        if (!black) {
          setStep(0)
          return say('Straighten the photo if needed, then set the scale (step 2).')
        }
        setStep(1)
        if (fits.length > 1)
          return say('More than one face fits these rings: choose the target in Target face.')
        if (fits.length === 1)
          return say(
            `The rings may be those of the ${fits[0].face.name}: choose it in Target face to use it.`,
          )
        say(
          'No face fits the rings found (dashed): choose a face, type the black diameter or set the scale.',
        )
      },
    )
  }

  /** The sheet calibrated on a face or on a black area of a typed diameter. */
  function applyFit(fit: FaceFit | FacePlane, thenDetect: boolean, event?: string) {
    const face = 'face' in fit ? fit.face : undefined
    onFace({
      ...(face && {
        id: face.id,
        ...(event && { event }),
        organization: face.organization,
        events: face.events.map((e) => ({
          name: e.name,
          distance: toSi('length', e.distance.value),
          ...(e.organization && { organization: e.organization }),
        })),
      }),
      centre: fit.centre,
      corners: fit.corners,
      outer: fit.outer,
    })
    awaiting.current = thenDetect
    say(
      face
        ? `${face.name}: scale and center from ${fit.ellipses} ellipses${fit.approximate ? ' (one ellipse, the center is approximate under tilt)' : ''}.`
        : 'Scale and center from the black area (approximate under tilt).',
    )
    if (!thenDetect) setStep(2)
  }

  // after a face calibrated the sheet and its record loaded: the one-click run goes on
  // biome-ignore lint/correctness/useExhaustiveDependencies: when the sheet or the record changes
  useEffect(() => {
    if (!awaiting.current || !frame?.calibration || !photo || (group?.face && !record)) return
    awaiting.current = false
    start()
  }, [frame, record, photo])

  /** The user picked a face (and its event) of the choice: its fit from the rings found. */
  async function pickFace(value: string) {
    if (!found || !value) return
    const stopped = stops.current
    const [id, event] = value.split('|')
    const fit =
      found.fits.find((f) => f.face.id === id) ??
      (await fetchFace(id).then(
        (f) => fitPicked(found, f),
        () => undefined,
      ))
    if (stops.current !== stopped) return
    if (!fit) return say('This face does not fit the ellipses found.', true)
    applyFit(fit, false, event)
  }

  /** The one-click start: the face search, auto detection, else the first guided step that needs the user. */
  function start() {
    if (!frame?.calibration) return void recognise(true)
    if (!size) {
      setStep(2)
      return say('Enter the hole size and pick one hole (step 3).')
    }
    run(true, undefined, (n) => {
      if (!n) setStep(2)
    })
  }

  function cancel() {
    stop()
    say('Detection cancelled.')
  }

  async function pickColour(at: Point) {
    const blob = await photoBlob()
    if (!blob || !photo) return
    // a quarter hole around the click: the middle of the hole, clear of its rim
    const radius = Math.max(1, ((size?.diameter ?? 0) * (frame ? localPxPerM(frame, [at]) : 0)) / 4)
    ask(
      {
        kind: 'colour',
        photo: blob,
        width: photo.width,
        height: photo.height,
        photoRotation: turn,
        at,
        radius,
      },
      (m) => {
        if (m.kind !== 'colour') return
        setChoice({ backing: hex(m.rgb) }, 'backing')
        say(`Backing color ${hex(m.rgb)}: the color axis of a run starts from it.`)
      },
    )
  }

  /**
   * Detection from the example hole under `at` (`detectFromExample`): the hole size the photo's holes
   * show, the contrast, polarity and colour become the choices, and its proposals show.
   */
  async function pickExample(at: Point) {
    const blob = await photoBlob()
    if (!blob || !photo || !frame?.calibration || !group) return
    const pxPerM = localPxPerM(frame, [at])
    runScale.current = pxPerM
    setProgress(0)
    ask(
      {
        kind: 'example',
        photo: blob,
        width: photo.width,
        height: photo.height,
        photoRotation: turn,
        at,
        ...(choices.region && { region: choices.region }),
        ...(geometry && { face: geometry }),
        pxPerM,
        holeDiameter: size?.diameter ?? 0.006,
        minContrast: choices.minContrast ?? defaultContrast,
      },
      (m) => {
        if (m.kind !== 'proposals') return
        const ex = m.example
        if (!ex || m.holeDiameter === undefined)
          return say('No holes found from there: click the middle of a hole clear of print.', true)
        // one undo step: the example's colour, size and polarity, and the default threshold
        setChoice(
          {
            backing: ex.backing && hex(ex.backing),
            expectedHoleDiameter: m.holeDiameter,
            minContrast: defaultContrast,
            polarity: ex.polarity,
          },
          'example',
        )
        if (!show(m, m.holeDiameter, pxPerM)) {
          setStep(3)
          say(`No holes proposed in the region.${flaggedNote(m.flagged)}`)
        }
      },
    )
  }

  /** A click of the region, backing or example tool; true when it was one. */
  function onPoint(p: Point): boolean {
    if (tool === 'backing') {
      startTool('select')
      pickColour(p)
      return true
    }
    if (tool === 'example') {
      startTool('select')
      pickExample(p)
      return true
    }
    if (tool !== 'region') return false
    const pts = [...pending, p]
    if (shape === 'rectangle') {
      if (pts.length < 2) {
        setPending(pts)
        return true
      }
      setChoice({ region: rectangleFromDiagonal(pts[0], pts[1]) }, 'region')
      startTool('select')
      return true
    }
    // a polygon closes on a click on its first point or a second click on its last (Enter twice)
    const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) <= 6 * unit.current
    const closes =
      pending.length >= 3 && (near(p, pending[0]) || near(p, pending[pending.length - 1]))
    if (!closes && pts.length < 64) {
      setPending(pts)
      return true
    }
    setChoice({ region: closes ? pending : pts }, 'region')
    startTool('select')
    return true
  }

  const take = (list: EditorProposal[]) => {
    if (!frame || !group || !list.length) return
    // as acceptProposals counts: up to the group's room of 1000 shots
    const added = Math.min(list.length, Math.max(0, 1000 - group.shots.length))
    onGroup((g) => acceptProposals(g, list, frame, runScale.current).group)
    const ids = new Set(list.slice(0, added).map((p) => p.id))
    setProposals((x) => x.filter((p) => !ids.has(p.id)))
    if (added < list.length) say('A group holds at most 1000 shots.', true)
  }
  const move = (id: number, p: Point) =>
    setProposals((x) => x.map((q) => (q.id === id ? { ...q, ...p } : q)))
  const remove = (id: number) => setProposals((x) => x.filter((q) => q.id !== id))

  const hint =
    tool === 'region'
      ? shape === 'rectangle'
        ? `Click two opposite corners of the region. Point ${pending.length + 1} of 2. Or arrow keys and Enter. Esc cancels.`
        : `Click the corners of the region; click the last one again (Enter twice) to close it. ${pending.length} points. Esc cancels.`
      : tool === 'backing'
        ? 'Click inside one hole: detection also looks for the color that shows through it. Or arrow keys and Enter.'
        : tool === 'example'
          ? 'Click the middle of one hole clear of print. Or arrow keys and Enter. Esc cancels.'
          : undefined

  const layer = (k: number) => {
    unit.current = k
    return (
      <ProposalLayer
        k={k}
        region={choices.region}
        ellipses={found && !found.fits.length ? found.ellipses.map((e) => polygon(e)) : []}
        pending={tool === 'region' ? pending : []}
        proposals={proposals}
        flagged={flagged}
        holePx={size && frame && region ? size.diameter * localPxPerM(frame, region) : 12 * k}
        drag={tool === 'select'}
        onAccept={(p) => take([p])}
        onMove={move}
        onRemove={remove}
      />
    )
  }

  const progressBar = progress !== undefined && (
    <div
      className="detect-progress"
      role="progressbar"
      aria-label="Hole detection"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <span style={{ width: `${progress * 100}%` }} />
    </div>
  )

  const running = progress !== undefined
  const runButton = (label: string, auto: boolean) =>
    running ? (
      <Button
        size={controlSize.row.button}
        variant="default"
        className="wide"
        data-detect-run
        onClick={cancel}
      >
        Cancel ({Math.round((progress ?? 0) * 100)} %)
      </Button>
    ) : (
      <Button
        size={controlSize.row.button}
        className="wide"
        data-detect-run
        disabled={!photo}
        title={
          auto
            ? 'Find the holes on the target or in the region; the photo stays in this browser.'
            : (blocked ?? 'Find the holes like the example hole.')
        }
        onClick={auto ? start : () => run(false)}
      >
        {label}
      </Button>
    )

  /**
   * What to choose from: for the faces that fit (several are ratio twins) each face with each of its
   * events and the distance, so the event or the distance shot tells them apart; without a fit the
   * ranking of the faces.
   */
  const faceChoices = !found
    ? []
    : found.fits.length
      ? found.fits.flatMap((f) =>
          f.face.events.map((e) => ({
            value: `${f.face.id}|${e.name}`,
            label: `${f.face.name}: ${e.name}, ${formatQuantity('range', system, toSi('length', e.distance.value))}`,
          })),
        )
      : found.ranked.slice(0, 4).map((r) => ({ value: r.id, label: r.name }))
  const chosen = group?.face && `${group.face.id}|${group.face.event ?? ''}`
  const turnBy = (d: number) => onTurn(turn + d)
  const stepBody = [
    // 1 Rotate
    <div key="rotate" className="prop-grid">
      <div className="prop-row">
        <span className="prop-label" title="Turn the photo by a quarter turn.">
          Quarter turn
        </span>
        <span className="prop-value row-buttons">
          <ActionIcon
            variant="default"
            size={controlSize.row.icon}
            aria-label="Turn left 90 degrees"
            title="Turn left 90 degrees"
            disabled={running}
            onClick={() => turnBy(Math.PI / 2)}
          >
            <ArrowCounterClockwise size={14} aria-hidden="true" />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size={controlSize.row.icon}
            aria-label="Turn right 90 degrees"
            title="Turn right 90 degrees"
            disabled={running}
            onClick={() => turnBy(-Math.PI / 2)}
          >
            <ArrowClockwise size={14} aria-hidden="true" />
          </ActionIcon>
        </span>
      </div>
      <SiField
        spec={{
          key: 'photoRotation',
          label: 'Photo angle',
          help: 'Turn of the photo on screen, counter-clockwise; type a small angle to straighten it. Holes, scale and aim point stay on the photo; the target axes stay on the screen.',
          quantity: 'angle',
        }}
        si={turn || undefined}
        placeholder="0"
        onCommit={(si) => onTurn(si ?? 0, 'photoRotation')}
      />
    </div>,
    // 2 Scale
    <div key="scale" className="prop-grid">
      <div className="prop-row">
        <span
          className="prop-label"
          title="A known distance on the target or the size of a face ring, marked on the photo in Calibrate."
        >
          Scale
        </span>
        <span className="prop-value">
          {frame?.calibration
            ? `${sheet.references.length} ${sheet.references.length === 1 ? 'reference' : 'references'}`
            : 'none'}
        </span>
      </div>
      <div className="prop-row">
        <span
          className="prop-label"
          title="The rule-book face on the photo: found from the black area and the ring lines, it sets the scale and the center and scores the group. More than one face may fit the rings: choose. Without a fit the faces are ranked by how well their rings match."
        >
          Target
        </span>
        <span className="prop-value">
          <NativeSelect
            size={controlSize.row.input}
            aria-label="Target face"
            disabled={!faceChoices.length || running}
            data={[{ value: '', label: faceChoices.length ? 'Choose' : 'none' }, ...faceChoices]}
            value={
              chosen && faceChoices.some((c) => c.value === chosen)
                ? chosen
                : (faceChoices.find((c) => c.value === group?.face?.id)?.value ?? '')
            }
            onChange={(e) => pickFace(e.currentTarget.value)}
          />
        </span>
      </div>
      <SiField
        spec={{
          key: 'blackDiameter',
          label: 'Black diameter',
          help: 'Diameter of the black area on the target, used when no face fits: it sets the scale and the center from the black area alone (the center is approximate on a tilted photo).',
          quantity: 'length',
          min: 0,
          positive: true,
        }}
        si={diameter}
        placeholder="size"
        deferred
        onCommit={(si) => {
          setDiameter(si)
          const plane = found && si ? fitDiameter(found, fromSi('length', si)) : undefined
          if (plane) applyFit(plane, false)
          else if (si) say('Find the face first: no black area is known.', true)
        }}
      />
      <span className="row-buttons wide">
        <Button
          size={controlSize.row.button}
          variant="default"
          disabled={!photo || running}
          onClick={() => recognise(false)}
        >
          Find face
        </Button>
        <Button size={controlSize.row.button} variant="default" onClick={openCalibrate}>
          Calibrate
        </Button>
      </span>
    </div>,
    // 3 Example
    <div key="example" className="prop-grid">
      <SiField
        spec={{
          key: 'expectedHoleDiameter',
          label: 'Hole size',
          help: `Expected hole diameter; an example hole sets it to the measured size. Empty: the median of the measured holes of ${MIN_HOLES_TO_LEARN_SIZE} or more accepted single holes, else the bullet diameter, else the marker.`,
          quantity: 'length',
          min: 0,
          positive: true,
        }}
        si={choices.expectedHoleDiameter}
        placeholder={size && size.source !== 'typed' ? size.source : 'size'}
        shown={size && size.source !== 'typed' ? size.diameter : undefined}
        onCommit={(si) => setChoice({ expectedHoleDiameter: si }, 'expectedHoleDiameter')}
      />
      <Button
        size={controlSize.row.button}
        className="wide"
        variant={tool === 'example' ? 'filled' : 'default'}
        disabled={!photo || !frame?.calibration || running}
        title={frame?.calibration ? 'Click one hole on the photo' : 'Set the scale first (step 2).'}
        onClick={() => startTool('example')}
      >
        Pick one hole
      </Button>
    </div>,
    // 4 Detect
    <div key="detect" className="prop-grid">
      {runButton('Detect holes', false)}
    </div>,
    // 5 Review
    <div
      key="review"
      className="prop-grid"
      title="Proposals are dashed on the photo; none counts until accepted. On the photo: double-click or Enter accepts one, drag or arrow keys move it, Delete removes it."
    >
      <Button
        size={controlSize.row.button}
        className="wide"
        disabled={!proposals.length}
        onClick={() => take(proposals)}
      >
        Accept all ({proposals.length})
      </Button>
      <span className="row-buttons wide">
        <Button
          size={controlSize.row.button}
          variant="default"
          disabled={!proposals.length && !flagged.length}
          aria-label="Clear proposals"
          title="Clear proposals and areas to place by hand"
          onClick={() => {
            setProposals([])
            setFlagged([])
          }}
        >
          Clear
        </Button>
      </span>
    </div>,
  ]

  const settingsPanel = (
    <div className="prop-grid">
      <div className="prop-row detect-wide">
        <span
          className="prop-label"
          title={`Where to look: a rectangle (two opposite corners) or a polygon (its corners); absent: the target found in the photo. Saved with the group. ${choices.region ? `Now ${choices.region.length} corners.` : 'None marked.'}`}
        >
          Region
        </span>
        <span className="prop-value row-buttons">
          {(['rectangle', 'polygon'] as const).map((s) => (
            <Button
              key={s}
              size={controlSize.row.button}
              variant={tool === 'region' && shape === s ? 'filled' : 'default'}
              disabled={!photo || !frame}
              title={`Mark a ${s} on the photo`}
              data-detect-set={s}
              onClick={() => {
                settingsTool(s)
                setShape(s)
                setPending([])
                startTool('region')
              }}
            >
              {s === 'rectangle' ? 'Rect.' : 'Polygon'}
            </Button>
          ))}
          <ActionIcon
            variant="subtle"
            size={controlSize.row.icon}
            aria-label="Region off"
            title="Region off: the target found in the photo"
            style={{ visibility: choices.region ? 'visible' : 'hidden' }}
            onClick={() => setChoice({ region: undefined }, 'region')}
          >
            <X size={12} aria-hidden="true" />
          </ActionIcon>
        </span>
      </div>
      <div className="prop-row detect-wide">
        <span
          className="prop-label"
          title="The color that shows through a hole on a dark area; an example hole lighter than its surroundings sets it. Pick, then click inside one hole."
        >
          Backing
        </span>
        <span className="prop-value row-buttons">
          <Button
            size={controlSize.row.button}
            variant={tool === 'backing' ? 'filled' : 'default'}
            disabled={!photo || !frame || running}
            data-detect-set="backing"
            onClick={() => {
              settingsTool('backing')
              startTool('backing')
            }}
            title="Click inside one hole to take its color"
          >
            Pick
          </Button>
          {/* the swatch and its cross keep their place when off, so nothing moves on a pick */}
          <span
            className="swatch"
            style={{ background: choices.backing ?? 'transparent' }}
            title={choices.backing ? `Backing color ${choices.backing}` : 'Backing color off'}
            role="img"
            aria-label={choices.backing ? `Backing color ${choices.backing}` : 'Backing color off'}
          />
          <ActionIcon
            variant="subtle"
            size={controlSize.row.icon}
            aria-label="Backing color off"
            title="Backing color off"
            style={{ visibility: choices.backing ? 'visible' : 'hidden' }}
            onClick={() => setChoice({ backing: undefined }, 'backing')}
          >
            <X size={12} aria-hidden="true" />
          </ActionIcon>
        </span>
      </div>
      <SiField
        spec={{
          key: 'minContrast',
          label: 'Threshold',
          help: 'Least contrast of a hole against its background, in % of the local paper white; an example hole sets it; empty: 15 %. Lower finds fainter holes and more false ones.',
          quantity: 'percent',
          min: 1,
          max: 100,
          positive: true,
        }}
        si={choices.minContrast}
        placeholder="15"
        onCommit={(si) => setChoice({ minContrast: si }, 'contrast')}
      />
    </div>
  )

  const panel = group && sheet.photo && (
    <>
      <Flex className="detect-head" align="flex-end" gap={4}>
        <h3 className="prop-head">Detect</h3>
        <Popover
          position="bottom-end"
          shadow="sm"
          returnFocus
          transitionProps={{ duration: 0 }}
          opened={settings}
          onChange={setSettings}
          // closed with the focus inside (Escape), it goes back to the gear
          onClose={() =>
            requestAnimationFrame(() => {
              if (document.activeElement === document.body) gear.current?.focus()
            })
          }
        >
          <Popover.Target>
            <ActionIcon
              ref={gear}
              variant="subtle"
              size={controlSize.row.icon}
              aria-label="Detection settings"
              title="Detection settings: region, backing color, threshold"
              onClick={() => setSettings((x) => !x)}
            >
              <GearSix size={14} aria-hidden="true" />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown className="toolbar-pop">
            <h2 className="prop-head">Detection settings</h2>
            {settingsPanel}
          </Popover.Dropdown>
        </Popover>
      </Flex>
      <ol className="detect-steps" aria-label="Detection steps">
        {detectSteps.map((name, i) => (
          <li key={name}>
            <button
              type="button"
              aria-current={step === i ? 'step' : undefined}
              onClick={() => setStep(i)}
            >
              {i + 1} {name}
            </button>
          </li>
        ))}
      </ol>
      <div className="detect-step" data-step={step === undefined ? 'start' : detectSteps[step]}>
        {step === undefined ? (
          <div className="prop-grid">{runButton('Detect holes', true)}</div>
        ) : (
          stepBody[step]
        )}
      </div>
      <span className="row-buttons detect-nav">
        <Button
          size={controlSize.row.button}
          variant="default"
          disabled={step === undefined}
          data-detect-after
          onClick={() => setStep((s) => (s ? s - 1 : undefined))}
        >
          Back
        </Button>
        <Button
          size={controlSize.row.button}
          variant="default"
          disabled={step === detectSteps.length - 1}
          onClick={() => setStep((s) => (s === undefined ? 0 : s + 1))}
        >
          Next
        </Button>
      </span>
    </>
  )

  return { onPoint, hint, layer, panel, progressBar }
}

/** The ellipse as a closed polygon of 72 points. */
const polygon = (e: Parameters<typeof ellipsePoint>[0]): Point[] =>
  Array.from({ length: 72 }, (_, i) => ellipsePoint(e, (2 * Math.PI * i) / 72))

/** The region and the proposals on the photo, view units (photo px). */
function ProposalLayer({
  k,
  region,
  ellipses,
  pending,
  proposals,
  flagged,
  holePx,
  drag,
  onAccept,
  onMove,
  onRemove,
}: {
  k: number
  region: Point[] | undefined
  /** The ellipses the face search found when no face fits, photo px. */
  ellipses: Point[][]
  pending: Point[]
  proposals: EditorProposal[]
  flagged: FlaggedRegion[]
  holePx: number
  /** Proposals are dragged (Select); with another tool a click goes on to the canvas. */
  drag: boolean
  onAccept: (p: EditorProposal) => void
  onMove: (id: number, p: Point) => void
  onRemove: (id: number) => void
}) {
  const dragging = useRef<number | undefined>(undefined)
  const pts = (list: Point[]) => list.map((p) => `${p.x},${p.y}`).join(' ')
  const pointOf = (e: PointerEvent<SVGElement>): Point | undefined =>
    viewPoint((e.currentTarget as SVGGraphicsElement).ownerSVGElement, e.clientX, e.clientY)
  /** After an accept or a removal by key, the next proposal takes the focus; after the last, Back. */
  const focusNext = (from: Element) => {
    const svg = from.closest('svg')
    requestAnimationFrame(() =>
      (
        svg?.querySelector<SVGElement>('[data-proposal]:not([data-gone])') ??
        document.querySelector<HTMLElement>('[data-detect-after]')
      )?.focus(),
    )
  }
  const onKey = (e: KeyboardEvent<SVGElement>, p: EditorProposal) => {
    const d = arrows[e.key]
    if (d) {
      e.preventDefault()
      const step = (e.shiftKey ? 10 : 1) * k
      onMove(p.id, { x: p.x + d[0] * step, y: p.y + d[1] * step })
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.currentTarget.setAttribute('data-gone', '')
      onAccept(p)
      focusNext(e.currentTarget)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      e.currentTarget.setAttribute('data-gone', '')
      onRemove(p.id)
      focusNext(e.currentTarget)
    }
  }
  return (
    <g>
      {region && <polygon className="detect-region" points={pts(region)} />}
      {ellipses.map((e) => (
        <polygon key={pts(e.slice(0, 2))} className="detect-region" points={pts(e)} />
      ))}
      {pending.length > 0 && (
        <>
          <polyline className="detect-region" points={pts(pending)} />
          {pending.map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: clicks keep their order
            <circle key={i} className="detect-corner" cx={p.x} cy={p.y} r={4 * k} />
          ))}
        </>
      )}
      {flagged.map((f, i) => {
        const label = `Area ${i + 1} to place by hand: about ${Math.round(f.holeAreas)} holes of area joined (touching holes or dark print); detection does not count it.`
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a run's areas keep their order
          <g key={i} className="detect-flag" data-flag>
            <title>{label}</title>
            <rect x={f.x} y={f.y} width={f.width} height={f.height} />
            <text className="detect-flag-label" x={f.x} y={f.y - 3 * k} fontSize={11 * k}>
              place by hand
            </text>
          </g>
        )
      })}
      {proposals.map((p, i) => {
        const r = Math.max(holePx / 2, 6 * k)
        const pct = Math.round(p.confidence * 100)
        const cluster = p.clusterSize > 1 ? `, one of ${p.clusterSize} in a cluster` : ''
        const label = `Proposal ${i + 1}, confidence ${pct} %${cluster}`
        return (
          <g key={p.id}>
            {/* biome-ignore lint/a11y/useSemanticElements: an SVG mark has no button element */}
            <circle
              role="button"
              tabIndex={0}
              aria-label={label}
              data-proposal={p.id}
              className="proposal"
              cx={p.x}
              cy={p.y}
              r={r}
              onKeyDown={(e) => onKey(e, p)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onAccept(p)
              }}
              onPointerDown={(e) => {
                if (!drag || e.button !== 0) return
                e.stopPropagation()
                e.currentTarget.setPointerCapture?.(e.pointerId)
                dragging.current = p.id
              }}
              onPointerMove={(e) => {
                if (dragging.current !== p.id) return
                const q = pointOf(e)
                if (q) onMove(p.id, q)
              }}
              onPointerUp={() => {
                dragging.current = undefined
              }}
              // a pinch swallows the up of its fingers: the capture still ends
              onLostPointerCapture={() => {
                dragging.current = undefined
              }}
              onPointerCancel={() => {
                dragging.current = undefined
              }}
            >
              <title>{`${label}. Double-click or Enter accepts it, drag or arrow keys move it, Delete removes it.`}</title>
            </circle>
            {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: SVG text is not focusable; the proposal's name holds it */}
            <text
              className="proposal-label"
              x={p.x + r + 2 * k}
              y={p.y - r}
              fontSize={11 * k}
              aria-hidden="true"
            >
              {pct} %{p.clusterSize > 1 ? ` (${p.clusterSize})` : ''}
            </text>
          </g>
        )
      })}
    </g>
  )
}
