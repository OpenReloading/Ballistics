'use client'

import { ActionIcon, Anchor, Button, Flex, NativeSelect, Popover } from '@mantine/core'
import {
  fromSi,
  type ShotGroup,
  type TargetFace,
  type TargetSheet,
  toSi,
} from '@open-reloading/schema'
import { ArrowClockwise, ArrowCounterClockwise, GearSix, X } from '@phosphor-icons/react'
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg, type Message as Text, type Translator } from '../i18n/translate.ts'
import { commonCaliber } from '../lib/caliber.ts'
import {
  type CandidateClass,
  caliberCandidates,
  caliberClassesOf,
  ownCartridges,
} from '../lib/caliber-candidates.ts'
import { ellipsePoint } from '../lib/ellipse.ts'
import { errorText } from '../lib/error-text.ts'
import { fetchAllFaces, fetchFace } from '../lib/face-records.ts'
import { type FoundFace, faceGeometry } from '../lib/face-sheet.ts'
import type { FlaggedRegion, HoleProposal } from '../lib/hole-detection.ts'
import type { Rgb, WorkerReply, WorkerRequest } from '../lib/hole-detection-protocol.ts'
import {
  acceptProposals,
  confirmedHoleDiameters,
  type EditorProposal,
  expectedHoleSize,
  isMaybe,
  isNominal,
  localPxPerM,
  proposalsClearOfShots,
  rectangleFromDiagonal,
} from '../lib/hole-proposals.ts'
import { belowMinimum, layoutOf, type QualityIssue } from '../lib/photo-quality.ts'
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
import { formatQuantity, type UnitSystem } from '../lib/units.ts'
import { storedPhoto } from '../lib/user-store.ts'
import { usePopoverReturn } from './popover-return.ts'
import { SiField } from './si-field.tsx'
import { Message } from './states.tsx'
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
const detectSteps = [
  msg('Rotate'),
  msg('Scale'),
  msg('Example'),
  msg('Detect'),
  msg('Review'),
] as const

/**
 * What the worker throws that a person can reach, as the lib writes it: shown translated, any other
 * text as it is.
 */
const workerErrors = [
  msg('The region is too large for holes this small; mark a smaller region'),
  msg('The hole must be at least 4 px across'),
  msg('A region needs at least 3 points'),
  msg('The photo decodes at another size than it is shown; detection is off for it.'),
  msg('No canvas to read the photo.'),
  msg('The point is outside the photo.'),
]

/**
 * Hole detection in the target editor (`apps/docs/docs/models/hole-detection.md`):
 * auto detection once a photo is added, its result in one line with Accept, else the guided
 * steps (rotate, scale, one example hole, detect, review) with the region, backing and threshold
 * behind one Settings disclosure; a Web Worker run
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
  const { t, tn } = useTranslation()
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
  /** The photo's quality problems from the last face search; undefined before one. */
  const [quality, setQuality] = useState<QualityIssue[]>()
  /** The one-click run waits for the user: the photo is below the minimum quality. */
  const [held, setHeld] = useState(false)
  /** A face was applied and the auto run waits for the sheet to follow. */
  const awaiting = useRef(false)
  /** The auto run's result line is shown in place of the start button. */
  const [result, setResult] = useState(false)
  /** The hole size field of the result line is open over a known size. */
  const [sizeOpen, setSizeOpen] = useState(false)
  /** The id of a photo just added: the auto run starts once it has loaded. */
  const addedPhoto = useRef<string | undefined>(undefined)
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
  const region = searchRegion(choices.region, geometry, size, photo, turn)

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
    setQuality(undefined)
    setHeld(false)
    setResult(false)
    setSizeOpen(false)
    awaiting.current = false
    return stop
  }, [sheet.photo, sheetId, group?.id])
  // a photo just added: the face search and the auto run start without a click
  // biome-ignore lint/correctness/useExhaustiveDependencies: once the added photo has loaded
  useEffect(() => {
    if (!addedPhoto.current || addedPhoto.current !== sheet.photo || !photo || !group) return
    addedPhoto.current = undefined
    start()
  }, [sheet.photo, photo, group?.id])
  // a turn moves the photo under the proposals
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a turn only
  useEffect(() => {
    stop()
    setProposals([])
    setFlagged([])
    setFound(undefined)
    setResult(false)
  }, [turn])
  // the record of the group's face
  const faceId = group?.face?.id
  useEffect(() => {
    setRecord(undefined)
    if (faceId) fetchFace(faceId).then(setRecord, () => {})
  }, [faceId])
  const { candidates, caliber, setCaliber } = useCaliberCandidates(group, size)
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
    // any detection run, from the Detect step or an example hole too, ends the wait
    if (request.kind !== 'face' && request.kind !== 'colour') setHeld(false)
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
      if (m.kind === 'error') {
        const known = workerErrors.find((e) => e === m.message)
        return say(known ? t(known) : m.message, true)
      }
      onReply(m)
    }
    w.onerror = (e) => {
      if (worker.current !== w) return
      failed(e.message)
    }
    w.postMessage(request)
  }

  const failed = (error?: unknown) => {
    stop()
    say(
      [
        t('Hole detection failed in this browser.'),
        error ? errorText(error) : '',
        t('Try a smaller photo or another browser.'),
      ]
        .filter(Boolean)
        .join(' '),
      true,
    )
  }

  async function photoBlob() {
    if (!sheet.photo || !photo) return
    const stopped = stops.current
    const blob = await storedPhoto(sheet.photo).catch(() => undefined)
    if (stops.current !== stopped) return
    if (!blob) say(t('The photo is not in this browser.'), true)
    return blob
  }

  const blocked = blockedReason(sheet.photo, photo, frame, size)

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
        const n = show(m, m.holeDiameter ?? hole0, pxPerM, auto)
        // the size the holes show, for later runs; a bullet or marker keeps its nominal size and source
        if (n && auto && !isNominal(size) && m.holeDiameter !== undefined)
          setChoice({ expectedHoleDiameter: m.holeDiameter }, 'auto')
        if (!n)
          say(
            auto
              ? t('No holes found: pick one example hole (step 3).')
              : `${t('No holes proposed in the region.')}${flaggedNote(m.flagged)}`,
            auto,
          )
        found?.(n)
      },
    )
  }

  const flaggedNote = (f: FlaggedRegion[]) =>
    f.length
      ? ` ${tn(f.length, '{count} area to place by hand (dashed box).', '{count} areas to place by hand (dashed box).')}`
      : ''

  /**
   * A run's proposals and flagged areas on the photo, the result line (`auto`) or step 5 when
   * there are any; their count.
   */
  function show(
    m: { proposals: HoleProposal[]; flagged: FlaggedRegion[] },
    hole: number,
    pxPerM: number,
    auto = false,
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
    const count = list.filter((p) => !isMaybe(p)).length
    if (list.length) {
      if (auto) {
        setStep(undefined)
        setResult(true)
      } else setStep(4)
      say(`${t('{count} proposed; accept them to add shots.', { count })}${flaggedNote(m.flagged)}`)
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
      return say(t('The targets need the network: set the scale by hand (step 2).'), true)
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
        ...(size && { holeDiameter: size.diameter }),
        layout: layoutOf(record),
      },
      (m) => {
        if (m.kind !== 'face') return
        setFound(m.search)
        setQuality(m.quality)
        const { fits } = m.search
        const [only] = fits
        if (only && fits.length === 1 && m.search.sure && m.search.alike.length < 2) {
          // below the minimum quality the face is applied and the run waits for Detect anyway
          const hold = thenDetect && belowMinimum(m.quality)
          setHeld(hold)
          applyFit(only, thenDetect && !hold)
          if (hold) setStep(undefined)
          return
        }
        const next = faceFollowUp(m.search, t)
        setStep(next.step)
        say(next.text)
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
        federation: face.federation,
        events: face.events.map((e) => ({
          id: e.id,
          distance: toSi('length', e.distance.value),
          ...(e.federation && { federation: e.federation }),
        })),
      }),
      centre: fit.centre,
      corners: fit.corners,
      outer: fit.outer,
    })
    awaiting.current = thenDetect
    say(
      face
        ? fit.approximate
          ? t(
              '{face}: scale and center from {count} ellipses (one ellipse, the center is approximate under tilt).',
              { face: face.name, count: fit.ellipses },
            )
          : t('{face}: scale and center from {count} ellipses.', {
              face: face.name,
              count: fit.ellipses,
            })
        : t('Scale and center from the black area (approximate under tilt).'),
    )
    if (!thenDetect) setStep(2)
  }

  // after a face calibrated the sheet and its record loaded: the one-click run goes on
  // biome-ignore lint/correctness/useExhaustiveDependencies: when the sheet or the record changes
  useEffect(() => {
    if (!awaiting.current || !frame?.calibration || !photo || (group?.face && !record)) return
    awaiting.current = false
    start()
  }, [frame, record, photo, size?.diameter])

  /** The user picked a face (and its event) of the choice: its fit from the rings found. */
  async function pickFace(value: string) {
    if (!found || !value) return
    const stopped = stops.current
    const [id = '', event] = value.split('|')
    const fit =
      [...found.fits, ...found.alike].find((f) => f.face.id === id) ??
      (await fetchFace(id).then(
        (f) => fitPicked(found, f),
        () => undefined,
      ))
    if (stops.current !== stopped) return
    if (!fit) return say(t('This target does not fit the ellipses found.'), true)
    applyFit(fit, false, event)
  }

  /**
   * The auto start: the face search, auto detection, else the hole size in the result line or the
   * first guided step that needs the user.
   */
  function start() {
    setHeld(false)
    setSizeOpen(false)
    if (!frame?.calibration) return void recognise(true).catch(failed)
    if (!size) {
      setStep(undefined)
      setResult(true)
      return say(t('Enter the hole size: the holes are found next.'))
    }
    run(true, undefined, (n) => {
      if (!n) setStep(2)
    }).catch(failed)
  }

  function cancel() {
    stop()
    say(t('Detection cancelled.'))
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
        say(
          t('Backing color {color}: the color axis of a run starts from it.', {
            color: hex(m.rgb),
          }),
        )
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
          return say(
            t('No holes found from there: click the middle of a hole clear of print.'),
            true,
          )
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
          say(`${t('No holes proposed in the region.')}${flaggedNote(m.flagged)}`)
        }
      },
    )
  }

  /** A click of the region, backing or example tool; true when it was one. */
  function onPoint(p: Point): boolean {
    if (tool === 'backing' || tool === 'example') {
      startTool('select')
      const pick = tool === 'backing' ? pickColour : pickExample
      pick(p).catch(failed)
      return true
    }
    if (tool !== 'region') return false
    const click = regionClick(shape, pending, p, 6 * unit.current)
    if ('pending' in click) {
      setPending(click.pending)
      return true
    }
    setChoice({ region: click.region }, 'region')
    startTool('select')
    return true
  }

  const take = (list: EditorProposal[]) => {
    if (!frame || !group || !list.length) return
    // as acceptProposals counts: up to the group's room of 1000 shots
    const added = Math.min(list.length, Math.max(0, 1000 - group.shots.length))
    onGroup((g) => acceptProposals(g, list, frame, runScale.current).group)
    const ids = new Set(list.slice(0, added).map((p) => p.id))
    if (added === proposals.length) setResult(false)
    setProposals((x) => x.filter((p) => !ids.has(p.id)))
    if (added < list.length) say(t('A group holds at most 1000 shots.'), true)
  }
  const move = (id: number, p: Point) =>
    setProposals((x) => x.map((q) => (q.id === id ? { ...q, ...p } : q)))
  const remove = (id: number) => setProposals((x) => x.filter((q) => q.id !== id))

  const sure = proposals.filter((p) => !isMaybe(p))

  const hint = toolHint(tool, shape, pending.length, t)

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
      aria-label={t('Hole detection')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <span style={{ width: `${progress * 100}%` }} />
    </div>
  )

  const running = progress !== undefined
  const runButton = (label: Text, auto: boolean) => (
    <RunButton
      label={label}
      auto={auto}
      progress={progress}
      photo={photo !== undefined}
      blocked={blocked}
      onCancel={cancel}
      onStart={start}
      onRun={() => run(false)}
    />
  )

  const choicesOfFaces = faceChoices(found, system, t)
  const turnBy = (d: number) => onTurn(turn + d)
  const commitDiameter = (si: number | undefined) => {
    setDiameter(si)
    const plane = found && si ? fitDiameter(found, fromSi('length', si)) : undefined
    if (plane) applyFit(plane, false)
    else if (si) say(t('Find the target first: no black area is known.'), true)
  }
  /** The number of scale references; undefined while the sheet has no scale. */
  const references = frame?.calibration ? sheet.references.length : undefined
  const stepBody = [
    <RotateStep key="rotate" turn={turn} running={running} onTurnBy={turnBy} onTurn={onTurn} />,
    <ScaleStep
      key="scale"
      references={references}
      choices={choicesOfFaces}
      chosen={chosenFace(group, choicesOfFaces)}
      running={running}
      canFind={Boolean(photo)}
      diameter={diameter}
      onPickFace={pickFace}
      onDiameter={commitDiameter}
      onFind={() => recognise(false)}
      onCalibrate={openCalibrate}
    />,
    <ExampleStep
      key="example"
      holeDiameter={choices.expectedHoleDiameter}
      size={size}
      tool={tool}
      canPick={Boolean(photo && frame?.calibration) && !running}
      calibrated={Boolean(frame?.calibration)}
      onHoleSize={(si) => setChoice({ expectedHoleDiameter: si }, 'expectedHoleDiameter')}
      onPick={() => startTool('example')}
    />,
    <div key="detect" className="prop-grid">
      {runButton(msg('Detect holes'), false)}
    </div>,
    <ReviewStep
      key="review"
      proposals={sure.length}
      maybe={proposals.length - sure.length}
      flagged={flagged.length}
      onAccept={() => take(sure)}
      onClear={() => {
        setProposals([])
        setFlagged([])
      }}
    />,
  ]

  const settingsPanel = (
    <SettingsPanel
      choices={choices}
      tool={tool}
      shape={shape}
      enabled={Boolean(photo && frame)}
      running={running}
      onShape={(s) => {
        settingsTool(s)
        setShape(s)
        setPending([])
        startTool('region')
      }}
      onRegionOff={() => setChoice({ region: undefined }, 'region')}
      onPickBacking={() => {
        settingsTool('backing')
        startTool('backing')
      }}
      onBackingOff={() => setChoice({ backing: undefined }, 'backing')}
      onThreshold={(si) => setChoice({ minContrast: si }, 'contrast')}
    />
  )

  /** The typed hole size of the result line: the auto run goes on with it. */
  const commitHoleSize = (si: number | undefined) => {
    if (!si) return
    setChoice({ expectedHoleDiameter: si }, 'expectedHoleDiameter')
    setSizeOpen(false)
    awaiting.current = true
  }
  const resultLine = (
    <ResultLine
      target={record?.name}
      references={references}
      proposals={sure.length}
      size={size}
      sizeOpen={sizeOpen}
      running={running}
      onTarget={() => setStep(1)}
      onScale={openCalibrate}
      onHoles={() => setStep(4)}
      onSize={() => setSizeOpen(true)}
      onHoleSize={commitHoleSize}
      candidates={candidates}
      caliber={caliber}
      onCaliber={(c) => {
        setCaliber(c)
        commitHoleSize(c.diameter)
      }}
      onAccept={() => take(sure)}
    />
  )

  const panel = group && sheet.photo && (
    <DetectPanel
      settings={settings}
      setSettings={setSettings}
      gear={gear}
      settingsPanel={settingsPanel}
      step={step}
      setStep={setStep}
      start={
        result ? resultLine : runButton(held ? msg('Detect anyway') : msg('Detect holes'), true)
      }
      notes={quality && <QualityNotes issues={quality} held={held} />}
      body={step === undefined ? undefined : stepBody[step]}
    />
  )

  /** A photo just added to the sheet: detection starts once it has loaded. */
  const photoAdded = (id: string) => {
    addedPhoto.current = id
  }

  return { onPoint, hint, layer, panel, progressBar, photoAdded }
}

/**
 * The caliber candidates of the group (`caliberCandidates`) and the class picked while the hole
 * size is its diameter, else the one preselected; loaded for each group, face and event.
 */
function useCaliberCandidates(
  group: ShotGroup | undefined,
  hole: { diameter: number; source: string } | undefined,
) {
  const [classes, setClasses] = useState<{ list: CandidateClass[]; mine: ReadonlySet<string> }>()
  const [picked, setCaliber] = useState<CandidateClass>()
  const face = group?.face
  // biome-ignore lint/correctness/useExhaustiveDependencies: on another group, face or event only
  useEffect(() => {
    setClasses(undefined)
    setCaliber(undefined)
    if (!face) return
    let live = true
    Promise.all([caliberClassesOf(face), ownCartridges()]).then(
      ([list, mine]) => live && setClasses({ list, mine }),
      () => {},
    )
    return () => {
      live = false
    }
  }, [group?.id, face?.id, face?.event])
  const { candidates, preselected } = caliberCandidates(
    classes?.list ?? [],
    hole,
    classes?.mine ?? new Set(),
  )
  const kept = picked && picked.diameter === hole?.diameter ? picked : undefined
  return {
    candidates,
    caliber: kept ?? candidates.find((c) => c.id === preselected),
    setCaliber,
  }
}

/** The marked region, else the face, else the whole turned photo. */
function searchRegion(
  marked: Point[] | undefined,
  geometry: ReturnType<typeof faceGeometry>,
  size: { diameter: number } | undefined,
  photo: { width: number; height: number } | undefined,
  turn: number,
) {
  if (marked) return marked
  const outline =
    geometry && size ? faceLabel(geometry, fromSi('length', size.diameter)).outline : undefined
  if (outline) return outline
  if (!photo) return
  const b = turnedBox(photo.width, photo.height, turn)
  return rectangleFromDiagonal({ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h })
}

/** Why a guided detection cannot run yet, none when it can. */
function blockedReason(
  photoId: string | undefined,
  photo: object | undefined,
  frame: Frame | undefined,
  size: object | undefined,
) {
  if (!photoId) return msg('Load a photo first.')
  if (!photo) return msg('The photo is not loaded.')
  if (!frame?.calibration) return msg('Set the scale first (step 2).')
  if (!size) return msg('Enter the hole size first (step 3).')
  return
}

/** What follows a face search that did not settle on one face: the step and the line to say. */
function faceFollowUp({ fits, alike, black }: FaceSearch, t: Translator['t']) {
  // no black area at all: the steps as they were, from the photo's turn
  if (!black)
    return { step: 0, text: t('Straighten the photo if needed, then set the scale (step 2).') }
  if (fits.length > 1 || alike.length > 1)
    return {
      step: 1,
      text: t('More than one target fits these rings: choose one in Target.'),
    }
  const [only] = fits
  if (only)
    return {
      step: 1,
      text: t('The rings may be those of the {face}: choose it in Target to use it.', {
        face: only.face.name,
      }),
    }
  return {
    step: 1,
    text: t(
      'No target fits the rings found (dashed): choose a target, type the black diameter or set the scale.',
    ),
  }
}

/**
 * A click of the region tool: the points so far, or the region once a rectangle has its two
 * corners or a polygon closes (a click on its first point or a second click on its last, Enter
 * twice, or 64 points).
 */
function regionClick(
  shape: 'rectangle' | 'polygon',
  pending: Point[],
  p: Point,
  reach: number,
): { pending: Point[] } | { region: Point[] } {
  const pts = [...pending, p]
  if (shape === 'rectangle') {
    const [a, b] = pts
    return a && b ? { region: rectangleFromDiagonal(a, b) } : { pending: pts }
  }
  const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) <= reach
  const [head] = pending
  const tail = pending[pending.length - 1]
  const closes =
    pending.length >= 3 &&
    head !== undefined &&
    tail !== undefined &&
    (near(p, head) || near(p, tail))
  if (!closes && pts.length < 64) return { pending: pts }
  return { region: closes ? pending : pts }
}

const toolHints: Partial<Record<Tool, Text>> = {
  backing: msg(
    'Click inside one hole: detection also looks for the color that shows through it. Or arrow keys and Enter.',
  ),
  example: msg(
    'Click the middle of one hole clear of print. Or arrow keys and Enter. Esc cancels.',
  ),
}

/** The line under the canvas for a point tool. */
function toolHint(tool: Tool, shape: 'rectangle' | 'polygon', placed: number, t: Translator['t']) {
  if (tool !== 'region') {
    const hint = toolHints[tool]
    return hint && t(hint)
  }
  return shape === 'rectangle'
    ? t(
        'Click two opposite corners of the region. Point {n} of 2. Or arrow keys and Enter. Esc cancels.',
        { n: placed + 1 },
      )
    : t(
        'Click the corners of the region; click the last one again (Enter twice) to close it. {count} points. Esc cancels.',
        { count: placed },
      )
}

/** The expected hole size's source, as the field's placeholder says it. */
const sourceNames = {
  typed: msg('typed'),
  learned: msg('learned'),
  bullet: msg('bullet'),
  marker: msg('marker'),
}

type FaceChoice = { value: string; label: string }

/**
 * What to choose from: for the faces that fit (several are ratio twins) each face with its outer
 * diameter and each of its events and the distance, so the size, the event or the distance shot
 * tells them apart; faces that match the same rings come first, smallest first; without a fit the
 * ranking of the faces.
 */
function faceChoices(
  found: FaceSearch | undefined,
  system: UnitSystem,
  t: Translator['t'],
): FaceChoice[] {
  if (!found) return []
  if (!found.fits.length)
    return found.ranked.slice(0, 4).map((r) => ({ value: r.id, label: r.name }))
  const alike = found.alike.length > 1 ? found.alike : []
  const fits = [...alike, ...found.fits.filter((f) => !alike.some((a) => a.face.id === f.face.id))]
  return fits.flatMap((f) =>
    f.face.events.map((e) => ({
      value: `${f.face.id}|${e.id}`,
      label: t('{face} ({outer}): {event}, {distance}', {
        face: f.face.name,
        outer: formatQuantity('length', system, toSi('length', 2 * f.outer)),
        event: e.name,
        distance: formatQuantity('range', system, toSi('length', e.distance.value)),
      }),
    })),
  )
}

/** The choice the group's face stands for, else the first with its face's id, else none. */
function chosenFace(group: ShotGroup | undefined, choices: FaceChoice[]) {
  const chosen = group?.face && `${group.face.id}|${group.face.event ?? ''}`
  if (chosen && choices.some((c) => c.value === chosen)) return chosen
  return choices.find((c) => c.value.split('|')[0] === group?.face?.id)?.value ?? ''
}

/** The photo's quality problems, each with what to change when retaking it; `held` says the run waits. */
function QualityNotes({ issues, held }: { issues: readonly QualityIssue[]; held: boolean }) {
  const { t } = useTranslation()
  if (!issues.length) return null
  return (
    <div className="quality-notes">
      {issues.map((i) => (
        <Message key={i.problem} severity={i.level === 'bad' ? 'warning' : 'info'}>
          {t(i.text, { n: i.n ?? 0 })} {t(i.fix)}
        </Message>
      ))}
      {held && (
        <Message severity="info">
          {t('Detection waits. Detect anyway runs it on this photo; check every proposed hole.')}
        </Message>
      )}
    </div>
  )
}

/**
 * The auto run's result in one line: the target, the scale, the holes proposed and the caliber
 * (the hole size, typed here when nothing gives it), each with a change link, then Accept.
 */
function ResultLine({
  target,
  references,
  proposals,
  size,
  sizeOpen,
  running,
  onTarget,
  onScale,
  onHoles,
  onSize,
  onHoleSize,
  candidates,
  caliber: picked,
  onCaliber,
  onAccept,
}: {
  target: string | undefined
  /** The number of scale references; undefined while the sheet has no scale. */
  references: number | undefined
  proposals: number
  size: { diameter: number; source: keyof typeof sourceNames } | undefined
  /** The hole size field shows in place of the caliber (always without a size). */
  sizeOpen: boolean
  running: boolean
  onTarget: () => void
  onScale: () => void
  onHoles: () => void
  onSize: () => void
  onHoleSize: (si: number | undefined) => void
  /** The caliber classes of the discipline, the likeliest first. */
  candidates: readonly CandidateClass[]
  /** The class picked or preselected; none while two share the hole size. */
  caliber: CandidateClass | undefined
  /** Picks a class: its nominal diameter becomes the hole size. */
  onCaliber: (c: CandidateClass) => void
  onAccept: () => void
}) {
  const { t, tn } = useTranslation()
  const { system } = useUnits()
  const diameter = size && formatQuantity('length', system, size.diameter)
  // only a bullet names a caliber: a hole in paper measures smaller than its bullet
  const caliber =
    size &&
    (picked?.diameter === size.diameter
      ? `${picked.name} (${diameter})`
      : size.source === 'bullet'
        ? `${commonCaliber(fromSi('length', size.diameter))} (${diameter})`
        : `${diameter} (${t(sourceNames[size.source])})`)
  const item = (label: string, value: string, change: string, onChange: () => void) => (
    <div className="prop-row detect-wide">
      <span className="prop-label">{label}</span>
      <span className="prop-value row-buttons">
        <span>{value}</span>
        <Anchor component="button" type="button" size="sm" aria-label={change} onClick={onChange}>
          {t('change')}
        </Anchor>
      </span>
    </div>
  )
  return (
    <div className="prop-grid detect-result" data-detect-result>
      {item(t('Target'), target ?? t('none'), t('Change the target'), onTarget)}
      {item(
        t('Scale'),
        references === undefined
          ? t('none')
          : tn(references, '{count} reference', '{count} references'),
        t('Change the scale'),
        onScale,
      )}
      {item(
        t('Holes'),
        t('{count} proposed', { count: proposals }),
        t('Change the holes'),
        onHoles,
      )}
      {sizeOpen || !caliber ? (
        <SiField
          spec={{
            key: 'expectedHoleDiameter',
            label: msg('Hole size'),
            help: msg(
              'Expected hole diameter; a typed size comes before the bullet and the marker. The holes are found once it is entered.',
            ),
            quantity: 'length',
            min: 0,
            positive: true,
          }}
          si={undefined}
          placeholder={t('size')}
          deferred
          onCommit={onHoleSize}
        />
      ) : (
        item(t('Caliber'), caliber, t('Change the hole size'), onSize)
      )}
      {candidates.length > 0 && (
        <div className="prop-row detect-wide">
          <span className="prop-label">{t('Caliber class')}</span>
          <span className="prop-value row-buttons caliber-chips">
            {candidates.map((c) => (
              <Button
                key={c.id}
                size={controlSize.row.button}
                variant={c.id === picked?.id ? 'filled' : 'default'}
                aria-pressed={c.id === picked?.id}
                onClick={() => onCaliber(c)}
              >
                {c.name}
              </Button>
            ))}
          </span>
        </div>
      )}
      <Button
        size={controlSize.row.button}
        className="wide"
        disabled={proposals === 0 || running}
        title={t(
          'Proposals are dashed on the photo; none counts until accepted. On the photo: double-click or Enter accepts one, drag or arrow keys move it, Delete removes it.',
        )}
        onClick={onAccept}
      >
        {t('Accept all ({count})', { count: proposals })}
      </Button>
    </div>
  )
}

function RunButton({
  label,
  auto,
  progress,
  photo,
  blocked,
  onCancel,
  onStart,
  onRun,
}: {
  label: Text
  auto: boolean
  progress: number | undefined
  photo: boolean
  blocked: Text | undefined
  onCancel: () => void
  onStart: () => void
  onRun: () => void
}) {
  const { t } = useTranslation()
  if (progress !== undefined)
    return (
      <Button
        size={controlSize.row.button}
        variant="default"
        className="wide"
        data-detect-run
        onClick={onCancel}
      >
        {t('Cancel ({pct} %)', { pct: Math.round(progress * 100) })}
      </Button>
    )
  const title = auto
    ? t('Find the holes on the target or in the region; the photo stays in this browser.')
    : t(blocked ?? msg('Find the holes like the example hole.'))
  return (
    <Button
      size={controlSize.row.button}
      className="wide"
      data-detect-run
      disabled={!photo}
      title={title}
      onClick={auto ? onStart : onRun}
    >
      {t(label)}
    </Button>
  )
}

function RotateStep({
  turn,
  running,
  onTurnBy,
  onTurn,
}: {
  turn: number
  running: boolean
  onTurnBy: (d: number) => void
  onTurn: (angle: number, key?: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="prop-grid">
      <div className="prop-row">
        <span className="prop-label" title={t('Turn the photo by a quarter turn.')}>
          {t('Quarter turn')}
        </span>
        <span className="prop-value row-buttons">
          <ActionIcon
            variant="default"
            size={controlSize.row.icon}
            aria-label={t('Turn left 90 degrees')}
            title={t('Turn left 90 degrees')}
            disabled={running}
            onClick={() => onTurnBy(Math.PI / 2)}
          >
            <ArrowCounterClockwise size={14} aria-hidden="true" />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size={controlSize.row.icon}
            aria-label={t('Turn right 90 degrees')}
            title={t('Turn right 90 degrees')}
            disabled={running}
            onClick={() => onTurnBy(-Math.PI / 2)}
          >
            <ArrowClockwise size={14} aria-hidden="true" />
          </ActionIcon>
        </span>
      </div>
      <SiField
        spec={{
          key: 'photoRotation',
          label: msg('Photo angle'),
          help: msg(
            'Turn of the photo on screen, counter-clockwise; type a small angle to straighten it. Holes, scale and aim point stay on the photo; the target axes stay on the screen.',
          ),
          quantity: 'angle',
        }}
        si={turn || undefined}
        placeholder="0"
        onCommit={(si) => onTurn(si ?? 0, 'photoRotation')}
      />
    </div>
  )
}

function ScaleStep({
  references,
  choices,
  chosen,
  running,
  canFind,
  diameter,
  onPickFace,
  onDiameter,
  onFind,
  onCalibrate,
}: {
  /** The number of scale references; undefined while the sheet has no scale. */
  references: number | undefined
  choices: FaceChoice[]
  chosen: string
  running: boolean
  canFind: boolean
  diameter: number | undefined
  onPickFace: (value: string) => void
  onDiameter: (si: number | undefined) => void
  onFind: () => void
  onCalibrate: () => void
}) {
  const { t, tn } = useTranslation()
  const scale =
    references === undefined ? t('none') : tn(references, '{count} reference', '{count} references')
  return (
    <div className="prop-grid">
      <div className="prop-row">
        <span
          className="prop-label"
          title={t(
            'A known distance on the target or the size of a target ring, marked on the photo in Calibrate.',
          )}
        >
          {t('Scale')}
        </span>
        <span className="prop-value">{scale}</span>
      </div>
      <div className="prop-row">
        <span
          className="prop-label"
          title={t(
            'The rule-book target on the photo: found from the black area and the ring lines, it sets the scale and the center and scores the group. More than one target may fit the rings: choose. Without a fit the targets are ranked by how well their rings match.',
          )}
        >
          {t('Target')}
        </span>
        <span className="prop-value">
          <NativeSelect
            size={controlSize.row.input}
            aria-label={t('Target on the photo')}
            disabled={!choices.length || running}
            data={[{ value: '', label: choices.length ? t('Choose') : t('none') }, ...choices]}
            value={chosen}
            onChange={(e) => onPickFace(e.currentTarget.value)}
          />
        </span>
      </div>
      <SiField
        spec={{
          key: 'blackDiameter',
          label: msg('Black diameter'),
          help: msg(
            'Diameter of the black area on the target, used when no target fits: it sets the scale and the center from the black area alone (the center is approximate on a tilted photo).',
          ),
          quantity: 'length',
          min: 0,
          positive: true,
        }}
        si={diameter}
        placeholder={t('size')}
        deferred
        onCommit={onDiameter}
      />
      <span className="row-buttons wide">
        <Button
          size={controlSize.row.button}
          variant="default"
          disabled={!canFind || running}
          onClick={onFind}
        >
          {t('Find target')}
        </Button>
        <Button size={controlSize.row.button} variant="default" onClick={onCalibrate}>
          {t('Calibrate')}
        </Button>
      </span>
    </div>
  )
}

function ExampleStep({
  holeDiameter,
  size,
  tool,
  canPick,
  calibrated,
  onHoleSize,
  onPick,
}: {
  holeDiameter: number | undefined
  size: { diameter: number; source: keyof typeof sourceNames } | undefined
  tool: Tool
  canPick: boolean
  calibrated: boolean
  onHoleSize: (si: number | undefined) => void
  onPick: () => void
}) {
  const { t } = useTranslation()
  const derived = size && size.source !== 'typed' ? size : undefined
  return (
    <div className="prop-grid">
      <SiField
        spec={{
          key: 'expectedHoleDiameter',
          label: msg('Hole size'),
          // the 3 is MIN_HOLES_TO_LEARN_SIZE: a spec's help takes no placeholder
          help: msg(
            'Expected hole diameter; an example hole sets it to the measured size. Empty: the median of the measured holes of 3 or more accepted single holes, else the bullet diameter, else the marker.',
          ),
          quantity: 'length',
          min: 0,
          positive: true,
        }}
        si={holeDiameter}
        placeholder={derived ? t(sourceNames[derived.source]) : t('size')}
        shown={derived?.diameter}
        onCommit={onHoleSize}
      />
      <Button
        size={controlSize.row.button}
        className="wide"
        variant={tool === 'example' ? 'filled' : 'default'}
        disabled={!canPick}
        title={calibrated ? t('Click one hole on the photo') : t('Set the scale first (step 2).')}
        onClick={onPick}
      >
        {t('Pick one hole')}
      </Button>
    </div>
  )
}

function ReviewStep({
  proposals,
  maybe,
  flagged,
  onAccept,
  onClear,
}: {
  proposals: number
  maybe: number
  flagged: number
  onAccept: () => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className="prop-grid"
      title={t(
        'Proposals are dashed on the photo; none counts until accepted. On the photo: double-click or Enter accepts one, drag or arrow keys move it, Delete removes it.',
      )}
    >
      <Button
        size={controlSize.row.button}
        className="wide"
        disabled={proposals === 0}
        onClick={onAccept}
      >
        {t('Accept all ({count})', { count: proposals })}
      </Button>
      <span className="row-buttons wide">
        <Button
          size={controlSize.row.button}
          variant="default"
          disabled={proposals + maybe + flagged === 0}
          aria-label={t('Clear proposals')}
          title={t('Clear proposals and areas to place by hand')}
          onClick={onClear}
        >
          {t('Clear')}
        </Button>
      </span>
    </div>
  )
}

function SettingsPanel({
  choices,
  tool,
  shape,
  enabled,
  running,
  onShape,
  onRegionOff,
  onPickBacking,
  onBackingOff,
  onThreshold,
}: {
  choices: Choices
  tool: Tool
  shape: 'rectangle' | 'polygon'
  /** A photo and its frame exist: the region and backing tools can start. */
  enabled: boolean
  running: boolean
  onShape: (shape: 'rectangle' | 'polygon') => void
  onRegionOff: () => void
  onPickBacking: () => void
  onBackingOff: () => void
  onThreshold: (si: number | undefined) => void
}) {
  const { t } = useTranslation()
  const backing = choices.backing
    ? t('Backing color {color}', { color: choices.backing })
    : t('Backing color off')
  return (
    <div className="prop-grid">
      <div className="prop-row detect-wide">
        <span
          className="prop-label"
          title={`${t(
            'Where to look: a rectangle (two opposite corners) or a polygon (its corners); absent: the target found in the photo. Saved with the group.',
          )} ${choices.region ? t('Now {count} corners.', { count: choices.region.length }) : t('None marked.')}`}
        >
          {t('Region')}
        </span>
        <span className="prop-value row-buttons">
          {(['rectangle', 'polygon'] as const).map((s) => (
            <Button
              key={s}
              size={controlSize.row.button}
              variant={tool === 'region' && shape === s ? 'filled' : 'default'}
              disabled={!enabled}
              title={
                s === 'rectangle'
                  ? t('Mark a rectangle on the photo')
                  : t('Mark a polygon on the photo')
              }
              data-detect-set={s}
              onClick={() => onShape(s)}
            >
              {s === 'rectangle' ? t('Rect.') : t('Polygon')}
            </Button>
          ))}
          <ActionIcon
            variant="subtle"
            size={controlSize.row.icon}
            aria-label={t('Region off')}
            title={t('Region off: the target found in the photo')}
            style={{ visibility: choices.region ? 'visible' : 'hidden' }}
            onClick={onRegionOff}
          >
            <X size={12} aria-hidden="true" />
          </ActionIcon>
        </span>
      </div>
      <div className="prop-row detect-wide">
        <span
          className="prop-label"
          title={t(
            'The color that shows through a hole on a dark area; an example hole lighter than its surroundings sets it. Pick, then click inside one hole.',
          )}
        >
          {t('Backing')}
        </span>
        <span className="prop-value row-buttons">
          <Button
            size={controlSize.row.button}
            variant={tool === 'backing' ? 'filled' : 'default'}
            disabled={!enabled || running}
            data-detect-set="backing"
            onClick={onPickBacking}
            title={t('Click inside one hole to take its color')}
          >
            {t('Pick')}
          </Button>
          {/* the swatch and its cross keep their place when off, so nothing moves on a pick */}
          <span
            className="swatch"
            style={{ background: choices.backing ?? 'transparent' }}
            title={backing}
            role="img"
            aria-label={backing}
          />
          <ActionIcon
            variant="subtle"
            size={controlSize.row.icon}
            aria-label={t('Backing color off')}
            title={t('Backing color off')}
            style={{ visibility: choices.backing ? 'visible' : 'hidden' }}
            onClick={onBackingOff}
          >
            <X size={12} aria-hidden="true" />
          </ActionIcon>
        </span>
      </div>
      <SiField
        spec={{
          key: 'minContrast',
          label: msg('Threshold'),
          help: msg(
            'Least contrast of a hole against its background, in % of the local paper white; an example hole sets it; empty: 15 %. Lower finds fainter holes and more false ones.',
          ),
          quantity: 'percent',
          min: 1,
          max: 100,
          positive: true,
        }}
        si={choices.minContrast}
        placeholder="15"
        onCommit={onThreshold}
      />
    </div>
  )
}

/** The Detect panel: its head with the Settings popover, the step list, the step shown and Back and Next. */
function DetectPanel({
  settings,
  setSettings,
  gear,
  settingsPanel,
  step,
  setStep,
  start,
  notes,
  body,
}: {
  settings: boolean
  setSettings: (update: boolean | ((open: boolean) => boolean)) => void
  gear: RefObject<HTMLButtonElement | null>
  settingsPanel: ReactNode
  step: number | undefined
  setStep: (update: number | undefined | ((s: number | undefined) => number | undefined)) => void
  /** The one-click start, shown before a step is chosen. */
  start: ReactNode
  /** The photo's quality problems, above the step. */
  notes: ReactNode
  /** The body of the step shown. */
  body: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <>
      <Flex className="detect-head" align="flex-end" gap={4}>
        <h3 className="prop-head">{t('Detect')}</h3>
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
              aria-label={t('Detection settings')}
              title={t('Detection settings: region, backing color, threshold')}
              onClick={() => setSettings((x) => !x)}
            >
              <GearSix size={14} aria-hidden="true" />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown className="toolbar-pop">
            <h2 className="prop-head">{t('Detection settings')}</h2>
            {settingsPanel}
          </Popover.Dropdown>
        </Popover>
      </Flex>
      <ol className="detect-steps" aria-label={t('Detection steps')}>
        {detectSteps.map((name, i) => (
          <li key={name}>
            <button
              type="button"
              aria-current={step === i ? 'step' : undefined}
              onClick={() => setStep(i)}
            >
              {i + 1} {t(name)}
            </button>
          </li>
        ))}
      </ol>
      {notes}
      <div className="detect-step" data-step={step === undefined ? 'start' : detectSteps[step]}>
        {step === undefined ? <div className="prop-grid">{start}</div> : body}
      </div>
      <span className="row-buttons detect-nav">
        <Button
          size={controlSize.row.button}
          variant="default"
          disabled={step === undefined}
          data-detect-after
          onClick={() => setStep((s) => (s ? s - 1 : undefined))}
        >
          {t('Back')}
        </Button>
        <Button
          size={controlSize.row.button}
          variant="default"
          disabled={step === detectSteps.length - 1}
          onClick={() => setStep((s) => (s === undefined ? 0 : s + 1))}
        >
          {t('Next')}
        </Button>
      </span>
    </>
  )
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
  const { t } = useTranslation()
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
        const label = t(
          'Area {n} to place by hand: about {count} holes of area joined (touching holes or dark print); detection does not count it.',
          { n: i + 1, count: Math.round(f.holeAreas) },
        )
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a run's areas keep their order
          <g key={i} className="detect-flag" data-flag>
            <title>{label}</title>
            <rect x={f.x} y={f.y} width={f.width} height={f.height} />
            <text className="detect-flag-label" x={f.x} y={f.y - 3 * k} fontSize={11 * k}>
              {t('place by hand')}
            </text>
          </g>
        )
      })}
      {proposals.map((p, i) => {
        const r = Math.max(holePx / 2, 6 * k)
        const pct = Math.round(p.confidence * 100)
        const maybe = isMaybe(p)
        const name =
          p.clusterSize > 1
            ? t('Proposal {n}, confidence {pct} %, one of {count} in a cluster', {
                n: i + 1,
                pct,
                count: p.clusterSize,
              })
            : t('Proposal {n}, confidence {pct} %', { n: i + 1, pct })
        const label = maybe ? `${name}, ${t('maybe')}` : name
        return (
          <g key={p.id}>
            {/* biome-ignore lint/a11y/useSemanticElements: an SVG mark has no button element */}
            <circle
              role="button"
              tabIndex={0}
              aria-label={label}
              data-proposal={p.id}
              className={maybe ? 'proposal maybe' : 'proposal'}
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
              <title>
                {t(
                  '{label}. Double-click or Enter accepts it, drag or arrow keys move it, Delete removes it.',
                  { label },
                )}
              </title>
            </circle>
            {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: SVG text is not focusable; the proposal's name holds it */}
            <text
              className="proposal-label"
              x={p.x + r + 2 * k}
              y={p.y - r}
              fontSize={11 * k}
              aria-hidden="true"
            >
              {maybe ? t('maybe {pct} %', { pct }) : t('{pct} %', { pct })}
              {p.clusterSize > 1 ? ` (${p.clusterSize})` : ''}
            </text>
          </g>
        )
      })}
    </g>
  )
}
