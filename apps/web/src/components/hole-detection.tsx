'use client'

import type { I18n, MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { ActionIcon, Anchor, Button, NativeSelect } from '@mantine/core'
import {
  fromSi,
  type ShotGroup,
  type TargetFace,
  type TargetSheet,
  toSi,
} from '@rangefoundry/schema'
import {
  type FaceFit,
  type FacePlane,
  type FaceSearch,
  type FlaggedRegion,
  faceLabel,
  fitDiameter,
  fitPicked,
  type HoleProposal,
} from '@rangefoundry/target-recognition'
import { RotateCcw, RotateCw, X } from 'lucide-react'
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { storedPhoto } from '@/platform/user-store.ts'
import { loadEnglish, ungrouped } from '../i18n/lingui.ts'
import { msg } from '../i18n/translate.ts'
import { commonCaliber } from '../lib/caliber.ts'
import {
  type CandidateClass,
  caliberCandidates,
  caliberClassesOf,
  ownCartridges,
} from '../lib/caliber-candidates.ts'
import { devModelRoot } from '../lib/dev-model.ts'
import { photoGuide } from '../lib/docs-url.ts'
import { ellipsePoint } from '../lib/ellipse.ts'
import { errorText } from '../lib/error-text.ts'
import { fetchAllFaces, fetchFace } from '../lib/face-records.ts'
import { type FoundFace, faceGeometry } from '../lib/face-sheet.ts'
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
import { belowMinimum, guideRule, layoutOf, type QualityIssue } from '../lib/photo-quality.ts'
import type { Frame } from '../lib/target-editor.ts'
import { type Point, turnedBox } from '../lib/target-geometry.ts'
import { controlSize } from '../lib/theme.ts'
import { formatQuantity, type UnitSystem } from '../lib/units.ts'
import englishMessages from '../locales/en/components/hole-detection.json' with { type: 'json' }
import photoQualityEnglish from '../locales/en/lib/photo-quality.json' with { type: 'json' }
import { SiField } from './si-field.tsx'
import { Message } from './states.tsx'
import { arrows, viewPoint } from './svg-point.ts'
import type { Tool } from './target-canvas.tsx'
import { useUnits } from './units-settings.tsx'

// its own English and photo-quality.ts's: that module runs in a worker too, so it leaves its English to the modules that show it
loadEnglish(englishMessages, photoQualityEnglish)

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
  /*i18n*/ { id: 'holeDetection.rotate', message: 'Rotate' },
  /*i18n*/ { id: 'holeDetection.scale', message: 'Scale' },
  /*i18n*/ { id: 'holeDetection.example', message: 'Example' },
  /*i18n*/ { id: 'holeDetection.detect', message: 'Detect' },
  /*i18n*/ { id: 'holeDetection.review', message: 'Review' },
] as const

/** What the worker throws that a person can reach, as the lib writes it: shown translated, any other text as it is. */
const workerErrors = [
  /*i18n*/ {
    id: 'holeDetection.regionTooLargeHoles',
    message: 'The region is too large for holes this small; mark a smaller region',
  },
  /*i18n*/ { id: 'holeDetection.holeMustLeast4', message: 'The hole must be at least 4 px across' },
  /*i18n*/ { id: 'holeDetection.regionNeedsLeast3', message: 'A region needs at least 3 points' },
  /*i18n*/ {
    id: 'holeDetection.photoDecodesAnotherSize',
    message: 'The photo decodes at another size than it is shown; detection is off for it.',
  },
  /*i18n*/ { id: 'holeDetection.noCanvas', message: 'No canvas to read the photo.' },
]

/** Everything a run takes from the sheet and the group. */
function detectionInputs(o: {
  sheet: TargetSheet
  group: ShotGroup | undefined
  record: TargetFace | undefined
  frame: Frame | undefined
  bullet: number | undefined
  photo: { width: number; height: number } | undefined
}) {
  const { sheet, group, record, frame, bullet, photo } = o
  const turn = sheet.photoRotation ?? 0
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
  return { turn, choices, size, geometry, region }
}

/** The proposals stay apart from the sheet, in photo px, until accepted, so no statistic sees them; the steps are in `apps/docs/docs/models/hole-detection.md`. */
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
  const { i18n } = useLingui()
  const [proposals, setProposals] = useState<EditorProposal[]>([])
  /** Regions too large to count: the user places their shots by hand; no statistic sees them. */
  const [flagged, setFlagged] = useState<FlaggedRegion[]>([])
  const [progress, setProgress] = useState<number>()
  const [fellBack, setFellBack] = useState(false)
  const [shape, setShape] = useState<'rectangle' | 'polygon'>('rectangle')
  const [pending, setPending] = useState<Point[]>([])
  /** The guided step shown, 0 to 4; undefined: the one-click start. */
  const [step, setStep] = useState<number>()
  /** What the face search found on this photo (photo px), for the choice and the fallback. */
  const [found, setFound] = useState<FaceSearch<TargetFace>>()
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
  const worker = useRef<Worker | undefined>(undefined)
  /** View units per screen px, from the last drawing of the layer. */
  const unit = useRef(1)
  /** Photo px per m of the last run, for the measured hole of an accepted proposal. */
  const runScale = useRef(1)
  const { system } = useUnits()
  const { turn, choices, size, geometry, region } = detectionInputs({
    sheet,
    group,
    record,
    frame,
    bullet,
    photo,
  })

  /** Counts stops, so pending photo and face reads cannot resume a cancelled operation. */
  const stops = useRef(0)
  const stop = () => {
    stops.current++
    worker.current?.terminate()
    worker.current = undefined
    setProgress(undefined)
  }
  // another photo, sheet or group: its proposals and a run on the old one go
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
  useEffect(() => {
    if (!addedPhoto.current || addedPhoto.current !== sheet.photo || !photo || !group) return
    addedPhoto.current = undefined
    start()
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once the added photo has loaded
  }, [sheet.photo, photo, group?.id])
  // a turn moves the photo under the proposals
  useEffect(() => {
    stop()
    setProposals([])
    setFlagged([])
    setFound(undefined)
    setResult(false)
  }, [turn])
  const faceId = group?.face?.id
  useEffect(() => {
    setRecord(undefined)
    if (faceId) fetchFace(faceId).then(setRecord, () => {})
  }, [faceId])
  const { candidates, caliber, setCaliber } = useCaliberCandidates(group, size)
  useEffect(() => {
    if (tool !== 'region') setPending([])
  }, [tool])
  const setChoice = (patch: Partial<Choices>, key: string) =>
    onGroup((g) => {
      const next: Record<string, unknown> = { ...g.detection, ...patch }
      for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k]
      return { ...g, detection: next as Choices }
    }, `detection ${key} ${group?.id}`)

  /** One request to a worker of its own; its replies until the last. */
  function ask(request: WorkerRequest, onReply: (m: WorkerReply) => void) {
    // any detection run, from the Detect step or an example hole too, ends the wait
    if (request.kind !== 'face') setHeld(false)
    worker.current?.terminate()
    const w = new Worker(new URL('../lib/hole-detection.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.current = w
    w.onmessage = (e: MessageEvent<WorkerReply>) => {
      if (worker.current !== w) return
      const m = e.data
      if (m.kind === 'progress') return setProgress(m.done)
      if (m.kind === 'fallback') return setFellBack(true)
      stop()
      if (m.kind === 'error') {
        const known = workerErrors.find((e) => e.message === m.message)
        return say(known ? i18n._(known) : m.message, true)
      }
      onReply(m)
    }
    w.onerror = (e) => {
      if (worker.current !== w) return
      failed(e.message)
    }
    if (request.kind !== 'face') setFellBack(false)
    w.postMessage(request.kind === 'face' ? request : { ...request, model: devModelRoot() })
  }

  const failed = (error?: unknown) => {
    stop()
    say(
      [
        i18n._({
          id: 'holeDetection.holeDetectionFailedBrowser',
          message: 'Hole detection failed in this browser.',
        }),
        error ? errorText(error) : '',
        i18n._({
          id: 'holeDetection.trySmallerPhotoAnother',
          message: 'Try a smaller photo or another browser.',
        }),
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
    if (!blob)
      say(
        i18n._({
          id: 'holeDetection.photoNotInBrowser',
          message: 'The photo is not in this browser.',
        }),
        true,
      )
    return blob
  }

  const blocked = blockedReason(sheet.photo, photo, frame, size)

  /** Without a region, on the target the module finds; `auto` takes the color axis from the region's strongest blobs, else the example's choices apply; `found` gets the proposal count. */
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
        minContrast: defaultContrast,
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
              ? i18n._({
                  id: 'holeDetection.noHolesPickOne',
                  message: 'No holes found: pick one example hole (step 3).',
                })
              : `${i18n._({ id: 'holeDetection.noHolesProposed', message: 'No holes proposed in the region.' })}${flaggedNote(m.flagged)}`,
            auto,
          )
        found?.(n)
      },
    )
  }

  const flaggedNote = (f: FlaggedRegion[]) =>
    f.length
      ? ` ${i18n._('holeDetection.areasByHand', { count: f.length }, { message: '{count, plural, one {# area to place by hand (dashed box).} other {# areas to place by hand (dashed box).}}', formats: ungrouped })}`
      : ''

  /** Shows a run's proposals and flagged areas on the photo, and the result line (`auto`) or step 5 when there are any; returns their count. */
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
      // only maybes: the Review step, where Accept maybes is
      if (auto && count) {
        setStep(undefined)
        setResult(true)
      } else setStep(4)
      say(
        `${i18n._({ id: 'holeDetection.proposedMaybeAcceptThem', message: '{count, decimal} proposed, {maybe, decimal} maybe: accept them to add shots.', values: { count, maybe: list.length - count } })}${flaggedNote(m.flagged)}`,
      )
    }
    return list.length
  }

  /** One face sets the scale, the center and the ring scoring face (`thenDetect`: the auto run follows); faces the rings cannot tell apart are a choice; none shows what was found (step 2). */
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
      return say(
        i18n._({
          id: 'holeDetection.targetsNeedNetworkSet',
          message: 'The targets need the network: set the scale by hand (step 2).',
        }),
        true,
      )
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
        const next = faceFollowUp(m.search, i18n)
        setStep(next.step)
        say(next.text)
      },
    )
  }

  /** The sheet calibrated on a face or on a black area of a typed diameter. */
  function applyFit(fit: FaceFit<TargetFace> | FacePlane, thenDetect: boolean, event?: string) {
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
          ? i18n._({
              id: 'holeDetection.scaleCenterEllipsesOne',
              message:
                '{face}: scale and center from {count, decimal} ellipses (one ellipse, the center is approximate under tilt).',
              values: { face: face.name, count: fit.ellipses },
            })
          : i18n._({
              id: 'holeDetection.scaleCenterEllipses',
              message: '{face}: scale and center from {count, decimal} ellipses.',
              values: {
                face: face.name,
                count: fit.ellipses,
              },
            })
        : i18n._({
            id: 'holeDetection.scaleCenterBlackArea',
            message: 'Scale and center from the black area (approximate under tilt).',
          }),
    )
    if (!thenDetect) setStep(2)
  }

  // after a face calibrated the sheet and its record loaded: the one-click run goes on
  useEffect(() => {
    if (!awaiting.current || !frame?.calibration || !photo || (group?.face && !record)) return
    awaiting.current = false
    start()
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- when the sheet or the record changes
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
    if (!fit)
      return say(
        i18n._({
          id: 'holeDetection.targetNotFitEllipses',
          message: 'This target does not fit the ellipses found.',
        }),
        true,
      )
    applyFit(fit, false, event)
  }

  /** Face search, then auto detection; else the result line asks the hole size, or the first guided step that needs the user shows. */
  function start() {
    setHeld(false)
    setSizeOpen(false)
    if (!frame?.calibration) return void recognise(true).catch(failed)
    if (!size) {
      setStep(undefined)
      setResult(true)
      return say(
        i18n._({
          id: 'holeDetection.enterHoleSizeHoles',
          message: 'Enter the hole size: the holes are found next.',
        }),
      )
    }
    run(true, undefined, (n) => {
      if (!n) setStep(2)
    }).catch(failed)
  }

  function cancel() {
    stop()
    say(i18n._({ id: 'holeDetection.detectionCancelled', message: 'Detection cancelled.' }))
  }

  /** The example's hole size, contrast, polarity and color become the choices (`detectFromExample`), and its proposals show. */
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
        minContrast: defaultContrast,
      },
      (m) => {
        if (m.kind !== 'proposals') return
        const ex = m.example
        if (!ex || m.holeDiameter === undefined)
          return say(
            i18n._({
              id: 'holeDetection.noHolesFromThere',
              message: 'No holes found from there: click the middle of a hole clear of print.',
            }),
            true,
          )
        // one undo step: the example's color, size and polarity, and the default threshold
        setChoice(
          {
            backing: ex.backing && hex(ex.backing),
            expectedHoleDiameter: m.holeDiameter,
            minContrast: undefined,
            polarity: ex.polarity,
          },
          'example',
        )
        if (!show(m, m.holeDiameter, pxPerM)) {
          setStep(3)
          say(
            `${i18n._({ id: 'holeDetection.noHolesProposed', message: 'No holes proposed in the region.' })}${flaggedNote(m.flagged)}`,
          )
        }
      },
    )
  }

  /** A click of the region or example tool; true when it was one. */
  function onPoint(p: Point): boolean {
    if (tool === 'example') {
      startTool('select')
      pickExample(p).catch(failed)
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
    if (added < list.length)
      say(
        i18n._({
          id: 'holeDetection.groupHoldsMost1000',
          message: 'A group holds at most 1000 shots.',
        }),
        true,
      )
    else
      say(
        i18n._(
          'holeDetection.shotsAdded',
          { count: added },
          {
            message: '{count, plural, one {# shot added.} other {# shots added.}}',
            formats: ungrouped,
          },
        ),
      )
  }
  const move = (id: number, p: Point) =>
    setProposals((x) => x.map((q) => (q.id === id ? { ...q, ...p } : q)))
  const remove = (id: number) => setProposals((x) => x.filter((q) => q.id !== id))

  const sure = proposals.filter((p) => !isMaybe(p))
  /** A step chosen by the user: the message of the step before goes. */
  const goStep = (update: number | undefined | ((s: number | undefined) => number | undefined)) => {
    setStep(update)
    say('')
  }

  const hint = toolHint(tool, shape, pending.length, i18n)

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
      aria-label={i18n._({ id: 'holeDetection.title', message: 'Hole detection' })}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <span style={{ width: `${progress * 100}%` }} />
    </div>
  )

  const running = progress !== undefined
  const runButton = (label: MessageDescriptor, auto: boolean) => (
    <>
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
      {fellBack && (
        <Message severity="info" compact>
          {i18n._({
            id: 'holeDetection.modelFellBack',
            message: 'The hole model did not load; the classical detector ran instead.',
          })}
        </Message>
      )}
    </>
  )

  const regionRow = (
    <RegionRow
      region={choices.region}
      tool={tool}
      shape={shape}
      enabled={Boolean(photo && frame)}
      onShape={(sh) => {
        setShape(sh)
        setPending([])
        startTool('region')
      }}
      onRegionOff={() => setChoice({ region: undefined }, 'region')}
    />
  )

  const choicesOfFaces = faceChoices(found, system, i18n)
  const turnBy = (d: number) => onTurn(turn + d)
  const commitDiameter = (si: number | undefined) => {
    setDiameter(si)
    const plane = found && si ? fitDiameter(found, fromSi('length', si)) : undefined
    if (plane) applyFit(plane, false)
    else if (si)
      say(
        i18n._({
          id: 'holeDetection.findTargetFirstBlack',
          message: 'Find the target first: no black area is known.',
        }),
        true,
      )
  }
  const calibrated = Boolean(frame?.calibration)
  /** The number of scale references; undefined while the sheet has no scale. */
  const references = calibrated ? sheet.references.length : undefined
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
      canPick={Boolean(photo) && calibrated && !running}
      calibrated={calibrated}
      regionRow={regionRow}
      onHoleSize={(si) => setChoice({ expectedHoleDiameter: si }, 'expectedHoleDiameter')}
      onPick={() => startTool('example')}
    />,
    <div key="detect" className="prop-grid">
      {runButton(/*i18n*/ { id: 'holeDetection.detectHoles', message: 'Detect holes' }, false)}
    </div>,
    <ReviewStep
      key="review"
      proposals={sure.length}
      maybe={proposals.length - sure.length}
      flagged={flagged.length}
      onAccept={() => take(sure)}
      onAcceptMaybe={() => take(proposals.filter(isMaybe))}
      onClear={() => {
        setProposals([])
        setFlagged([])
      }}
    />,
  ]

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
      maybe={proposals.length - sure.length}
      size={size}
      sizeOpen={sizeOpen}
      running={running}
      onTarget={() => goStep(1)}
      onScale={openCalibrate}
      onHoles={() => goStep(4)}
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
      step={step}
      setStep={goStep}
      start={
        result
          ? resultLine
          : runButton(
              held
                ? /*i18n*/ { id: 'holeDetection.detectAnyway', message: 'Detect anyway' }
                : /*i18n*/ { id: 'holeDetection.detectHoles', message: 'Detect holes' },
              true,
            )
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

/** The class picked while the hole size is its diameter, else the one preselected; loaded for each group, face and event. */
function useCaliberCandidates(
  group: ShotGroup | undefined,
  hole: { diameter: number; source: string } | undefined,
) {
  const [classes, setClasses] = useState<{ list: CandidateClass[]; mine: ReadonlySet<string> }>()
  const [picked, setCaliber] = useState<CandidateClass>()
  const face = group?.face
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- on another group, face or event only
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
  if (!photoId)
    return /*i18n*/ { id: 'holeDetection.loadPhotoFirst', message: 'Load a photo first.' }
  if (!photo)
    return /*i18n*/ { id: 'holeDetection.photoNotLoaded', message: 'The photo is not loaded.' }
  if (!frame?.calibration)
    return /*i18n*/ {
      id: 'holeDetection.setScaleFirstStep',
      message: 'Set the scale first (step 2).',
    }
  if (!size)
    return /*i18n*/ {
      id: 'holeDetection.enterHoleSizeFirst',
      message: 'Enter the hole size first (step 3).',
    }
  return
}

/** What follows a face search that did not settle on one face: the step and the line to say. */
function faceFollowUp({ fits, alike, black }: FaceSearch<TargetFace>, i18n: I18n) {
  // no black area at all: the steps as they were, from the photo's turn
  if (!black)
    return {
      step: 0,
      text: i18n._({
        id: 'holeDetection.straightenPhotoIfNeeded',
        message: 'Straighten the photo if needed, then set the scale (step 2).',
      }),
    }
  if (fits.length > 1 || alike.length > 1)
    return {
      step: 1,
      text: i18n._({
        id: 'holeDetection.moreThanOneTarget',
        message: 'More than one target fits these rings: choose one in Target.',
      }),
    }
  const [only] = fits
  if (only)
    return {
      step: 1,
      text: i18n._({
        id: 'holeDetection.ringsMayThoseChoose',
        message: 'The rings may be those of the {face}: choose it in Target to use it.',
        values: {
          face: only.face.name,
        },
      }),
    }
  return {
    step: 1,
    text: i18n._({
      id: 'holeDetection.noTargetFitsRings',
      message:
        'No target fits the rings found (dashed): choose a target, type the black diameter or set the scale.',
    }),
  }
}

/** A rectangle ends with its two corners, a polygon on a click of its first point, a second click on its last, Enter twice or 64 points. */
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

const toolHints: Partial<Record<Tool, MessageDescriptor>> = {
  example: /*i18n*/ {
    id: 'holeDetection.clickMiddleOneHole',
    message: 'Click the middle of one hole clear of print. Or arrow keys and Enter. Esc cancels.',
  },
}

/** The line under the canvas for a point tool. */
function toolHint(tool: Tool, shape: 'rectangle' | 'polygon', placed: number, i18n: I18n) {
  if (tool !== 'region') {
    const hint = toolHints[tool]
    return hint && i18n._(hint)
  }
  return shape === 'rectangle'
    ? i18n._({
        id: 'holeDetection.clickTwoOppositeCorners',
        message:
          'Click two opposite corners of the region. Point {n, decimal} of 2. Or arrow keys and Enter. Esc cancels.',
        values: { n: placed + 1 },
      })
    : i18n._({
        id: 'holeDetection.clickCornersRegionClick',
        message:
          'Click the corners of the region; click the last one again (Enter twice) to close it. {count, decimal} points. Esc cancels.',
        values: { count: placed },
      })
}

/** The expected hole size's source, as the field's placeholder says it. */
const sourceNames = {
  typed: /*i18n*/ { id: 'holeDetection.typed', message: 'typed' },
  learned: /*i18n*/ { id: 'holeDetection.learned', message: 'learned' },
  bullet: /*i18n*/ { id: 'holeDetection.bullet', message: 'bullet' },
  marker: /*i18n*/ { id: 'holeDetection.marker', message: 'marker' },
}

type FaceChoice = { value: string; label: string }

/** Fitting faces (several are ratio twins) each with its outer diameter, events and distance, so size, event or distance tells them apart; same-ring matches first, smallest first; without a fit the faces' ranking. */
function faceChoices(
  found: FaceSearch<TargetFace> | undefined,
  system: UnitSystem,
  i18n: I18n,
): FaceChoice[] {
  if (!found) return []
  if (!found.fits.length)
    return found.ranked.slice(0, 4).map((r) => ({ value: r.id, label: r.name }))
  const alike = found.alike.length > 1 ? found.alike : []
  const fits = [...alike, ...found.fits.filter((f) => !alike.some((a) => a.face.id === f.face.id))]
  return fits.flatMap((f) =>
    f.face.events.map((e) => ({
      value: `${f.face.id}|${e.id}`,
      label: i18n._({
        id: 'holeDetection.faceChoice',
        message: '{face} ({outer}): {event}, {distance}',
        values: {
          face: f.face.name,
          outer: formatQuantity('length', system, toSi('length', 2 * f.outer)),
          event: e.name,
          distance: formatQuantity('range', system, toSi('length', e.distance.value)),
        },
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
  const { i18n } = useLingui()
  if (!issues.length) return null
  return (
    <div className="quality-notes">
      {issues.map((i) => (
        <Message key={i.problem} severity={i.level === 'bad' ? 'warning' : 'info'}>
          {i18n._(i.text)} {i18n._(i.fix)}
          {photoGuide && (
            <>
              {' '}
              <Anchor
                href={`${photoGuide}#${guideRule[i.problem].anchor}`}
                target="_blank"
                rel="noopener"
              >
                {i18n._({
                  id: 'holeDetection.photoGuide',
                  message: 'Photo guide: {rule}',
                  values: { rule: i18n._(guideRule[i.problem].name) },
                })}
              </Anchor>
            </>
          )}
        </Message>
      ))}
      {held && (
        <Message severity="info">
          {i18n._({
            id: 'holeDetection.detectionWaitsDetectAnyway',
            message:
              'Detection waits. Detect anyway runs it on this photo; check every proposed hole.',
          })}
        </Message>
      )}
    </div>
  )
}

/** Each with a change link, then Accept; the hole size is typed here when nothing gives it. */
function ResultLine({
  target,
  references,
  proposals,
  maybe,
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
  /** The sure proposals; `maybe` the less certain ones. */
  proposals: number
  maybe: number
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
  const { i18n } = useLingui()
  const { system } = useUnits()
  const diameter = size && formatQuantity('length', system, size.diameter)
  // only a bullet names a caliber: a hole in paper measures smaller than its bullet
  const caliber =
    size &&
    (picked?.diameter === size.diameter
      ? `${picked.name} (${diameter})`
      : size.source === 'bullet'
        ? `${commonCaliber(fromSi('length', size.diameter))} (${diameter})`
        : `${diameter} (${i18n._(sourceNames[size.source])})`)
  const item = (label: string, value: string, change: string, onChange: () => void) => (
    <div className="prop-row detect-wide">
      <span className="prop-label">{label}</span>
      <span className="prop-value row-buttons">
        <span>{value}</span>
        <Anchor component="button" type="button" size="sm" aria-label={change} onClick={onChange}>
          {i18n._({ id: 'holeDetection.change', message: 'change' })}
        </Anchor>
      </span>
    </div>
  )
  return (
    <div className="prop-grid detect-result" data-detect-result>
      {item(
        i18n._({ id: 'holeDetection.target', message: 'Target' }),
        target ?? i18n._({ id: 'holeDetection.none', message: 'none' }),
        i18n._({ id: 'holeDetection.changeTarget', message: 'Change the target' }),
        onTarget,
      )}
      {item(
        i18n._({ id: 'holeDetection.scale', message: 'Scale' }),
        references === undefined
          ? i18n._({ id: 'holeDetection.none', message: 'none' })
          : i18n._(
              'holeDetection.referenceCount',
              { count: references },
              {
                message: '{count, plural, one {# reference} other {# references}}',
                formats: ungrouped,
              },
            ),
        i18n._({ id: 'holeDetection.changeScale', message: 'Change the scale' }),
        onScale,
      )}
      {item(
        i18n._({ id: 'holeDetection.holes', message: 'Holes' }),
        i18n._({
          id: 'holeDetection.proposedMaybe',
          message: '{count, decimal} proposed, {maybe, decimal} maybe',
          values: { count: proposals, maybe },
        }),
        i18n._({ id: 'holeDetection.changeHoles', message: 'Change the holes' }),
        onHoles,
      )}
      {sizeOpen || !caliber ? (
        <SiField
          spec={{
            key: 'expectedHoleDiameter',
            label: msg('Hole size'),
            help: msg(
              'Expected hole diameter; a typed size overrides the bullet and the marker. Detection runs once it is entered.',
            ),
            quantity: 'length',
            min: 0,
            positive: true,
          }}
          si={undefined}
          placeholder={i18n._({ id: 'holeDetection.size', message: 'size' })}
          deferred
          onCommit={onHoleSize}
        />
      ) : (
        item(
          i18n._({ id: 'holeDetection.caliber', message: 'Caliber' }),
          caliber,
          i18n._({ id: 'holeDetection.changeHoleSize', message: 'Change the hole size' }),
          onSize,
        )
      )}
      {candidates.length > 0 && (
        <div className="prop-row detect-wide">
          <span className="prop-label">
            {i18n._({ id: 'holeDetection.caliberClass', message: 'Caliber class' })}
          </span>
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
        title={i18n._({
          id: 'holeDetection.proposalsDashedNoneCounts',
          message:
            'Proposals are dashed; none counts until accepted. On the photo, double-click or Enter accepts one, drag or arrow keys move it, Delete removes it.',
        })}
        onClick={onAccept}
      >
        {i18n._({
          id: 'holeDetection.acceptSure',
          message: 'Accept sure ({count, decimal})',
          values: { count: proposals },
        })}
      </Button>
    </div>
  )
}

export function RunButton({
  label,
  auto,
  progress,
  photo,
  blocked,
  onCancel,
  onStart,
  onRun,
}: {
  label: MessageDescriptor
  auto: boolean
  progress: number | undefined
  photo: boolean
  blocked: MessageDescriptor | undefined
  onCancel: () => void
  onStart: () => void
  onRun: () => void
}) {
  const { i18n } = useLingui()
  const reason = useId()
  if (progress !== undefined)
    return (
      <Button
        size={controlSize.row.button}
        variant="default"
        className="wide"
        data-detect-run
        onClick={onCancel}
      >
        {i18n._({
          id: 'holeDetection.cancelPercent',
          message: 'Cancel ({pct, decimal} %)',
          values: { pct: Math.round(progress * 100) },
        })}
      </Button>
    )
  // the one-click start finds the scale and the hole size itself; the guided run needs both
  const why = auto ? undefined : blocked
  const title = auto
    ? i18n._({
        id: 'holeDetection.findHolesTargetRegion',
        message: 'Find the holes on the target or in the region; the photo stays in this browser.',
      })
    : i18n._({
        id: 'holeDetection.findHolesLikeExample',
        message: 'Find the holes like the example hole.',
      })
  return (
    <>
      <Button
        size={controlSize.row.button}
        className="wide"
        data-detect-run
        disabled={!photo || !!why}
        title={title}
        aria-describedby={why ? reason : undefined}
        onClick={auto ? onStart : onRun}
      >
        {i18n._(label)}
      </Button>
      {why && (
        <p id={reason} className="detect-blocked wide" data-detect-blocked>
          {i18n._(why)}
        </p>
      )}
    </>
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
  const { i18n } = useLingui()
  return (
    <div className="prop-grid">
      <div className="prop-row">
        <span className="prop-label">
          {i18n._({ id: 'holeDetection.quarterTurn', message: 'Quarter turn' })}
        </span>
        <span className="prop-value row-buttons">
          <ActionIcon
            variant="default"
            size={controlSize.row.icon}
            aria-label={i18n._({
              id: 'holeDetection.turnLeft90Degrees',
              message: 'Turn left 90 degrees',
            })}
            title={i18n._({
              id: 'holeDetection.turnLeft90Degrees',
              message: 'Turn left 90 degrees',
            })}
            disabled={running}
            onClick={() => onTurnBy(Math.PI / 2)}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size={controlSize.row.icon}
            aria-label={i18n._({
              id: 'holeDetection.turnRight90Degrees',
              message: 'Turn right 90 degrees',
            })}
            title={i18n._({
              id: 'holeDetection.turnRight90Degrees',
              message: 'Turn right 90 degrees',
            })}
            disabled={running}
            onClick={() => onTurnBy(-Math.PI / 2)}
          >
            <RotateCw size={14} aria-hidden="true" />
          </ActionIcon>
        </span>
      </div>
      <SiField
        spec={{
          key: 'photoRotation',
          label: msg('Photo angle'),
          help: msg(
            'Counter-clockwise turn of the photo on screen; type a small angle to straighten it. Holes, scale and aim point turn with the photo, the target axes do not.',
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
  const { i18n } = useLingui()
  const scale =
    references === undefined
      ? i18n._({ id: 'holeDetection.none', message: 'none' })
      : i18n._(
          'holeDetection.referenceCount',
          { count: references },
          {
            message: '{count, plural, one {# reference} other {# references}}',
            formats: ungrouped,
          },
        )
  return (
    <div className="prop-grid">
      <div className="prop-row">
        <span
          className="prop-label"
          title={i18n._({
            id: 'holeDetection.knownDistanceTargetSize',
            message:
              'A known distance on the target or the size of a target ring, marked on the photo in Calibrate.',
          })}
        >
          {i18n._({ id: 'holeDetection.scale', message: 'Scale' })}
        </span>
        <span className="prop-value">{scale}</span>
      </div>
      <div className="prop-row">
        <span
          className="prop-label"
          title={i18n._({
            id: 'holeDetection.ruleBookTargetFound',
            message:
              'The rule-book target, found from the black area and the ring lines. It sets the scale and center and scores the group. If several fit, choose one; without a fit, targets are ranked by how well their rings match.',
          })}
        >
          {i18n._({ id: 'holeDetection.target', message: 'Target' })}
        </span>
        <span className="prop-value">
          <NativeSelect
            size={controlSize.row.input}
            aria-label={i18n._({ id: 'holeDetection.targetPhoto', message: 'Target on the photo' })}
            disabled={!choices.length || running}
            data={[
              {
                value: '',
                label: choices.length
                  ? i18n._({ id: 'holeDetection.choose', message: 'Choose' })
                  : i18n._({ id: 'holeDetection.none', message: 'none' }),
              },
              ...choices,
            ]}
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
            'Diameter of the black area, used when no target fits: it sets scale and center from the black area alone (center approximate on a tilted photo).',
          ),
          quantity: 'length',
          min: 0,
          positive: true,
        }}
        si={diameter}
        placeholder={i18n._({ id: 'holeDetection.size', message: 'size' })}
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
          {i18n._({ id: 'holeDetection.findTarget', message: 'Find target' })}
        </Button>
        <Button size={controlSize.row.button} variant="default" onClick={onCalibrate}>
          {i18n._({ id: 'holeDetection.calibrate', message: 'Calibrate' })}
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
  regionRow,
  onHoleSize,
  onPick,
}: {
  holeDiameter: number | undefined
  size: { diameter: number; source: keyof typeof sourceNames } | undefined
  tool: Tool
  canPick: boolean
  calibrated: boolean
  /** Where to look: the Region row. */
  regionRow: ReactNode
  onHoleSize: (si: number | undefined) => void
  onPick: () => void
}) {
  const { i18n } = useLingui()
  const derived = size && size.source !== 'typed' ? size : undefined
  return (
    <div className="prop-grid">
      <SiField
        spec={{
          key: 'expectedHoleDiameter',
          label: msg('Hole size'),
          // the 3 is MIN_HOLES_TO_LEARN_SIZE: a spec's help takes no placeholder
          help: msg(
            'Expected hole diameter; an example hole sets it to its measured size. Empty: the median of 3 or more accepted single holes, else the bullet diameter, else the marker.',
          ),
          quantity: 'length',
          min: 0,
          positive: true,
        }}
        si={holeDiameter}
        placeholder={
          derived
            ? i18n._(sourceNames[derived.source])
            : i18n._({ id: 'holeDetection.size', message: 'size' })
        }
        shown={derived?.diameter}
        onCommit={onHoleSize}
      />
      <Button
        size={controlSize.row.button}
        className="wide"
        variant={tool === 'example' ? 'filled' : 'default'}
        disabled={!canPick}
        title={
          calibrated
            ? undefined
            : i18n._({
                id: 'holeDetection.setScaleFirstStep',
                message: 'Set the scale first (step 2).',
              })
        }
        onClick={onPick}
      >
        {i18n._({ id: 'holeDetection.pickOneHole', message: 'Pick one hole' })}
      </Button>
      {regionRow}
    </div>
  )
}

export function ReviewStep({
  proposals,
  maybe,
  flagged,
  onAccept,
  onAcceptMaybe,
  onClear,
}: {
  proposals: number
  maybe: number
  flagged: number
  onAccept: () => void
  onAcceptMaybe: () => void
  onClear: () => void
}) {
  const { i18n } = useLingui()
  const help = useId()
  return (
    <div className="prop-grid">
      <Button
        size={controlSize.row.button}
        className="wide"
        disabled={proposals === 0}
        aria-describedby={help}
        onClick={onAccept}
      >
        {i18n._({
          id: 'holeDetection.acceptSure',
          message: 'Accept sure ({count, decimal})',
          values: { count: proposals },
        })}
      </Button>
      <span className="row-buttons wide">
        <Button
          size={controlSize.row.button}
          variant="default"
          disabled={maybe === 0}
          aria-describedby={help}
          onClick={onAcceptMaybe}
        >
          {i18n._({
            id: 'holeDetection.acceptMaybes',
            message: 'Accept maybes ({count, decimal})',
            values: { count: maybe },
          })}
        </Button>
        <Button
          size={controlSize.row.button}
          variant="default"
          disabled={proposals + maybe + flagged === 0}
          aria-label={i18n._({ id: 'holeDetection.clearProposals', message: 'Clear proposals' })}
          title={i18n._({
            id: 'holeDetection.clearProposalsAreasPlace',
            message: 'Clear proposals and areas to place by hand',
          })}
          onClick={onClear}
        >
          {i18n._({ id: 'holeDetection.clear', message: 'Clear' })}
        </Button>
      </span>
      <p id={help} className="review-help wide">
        {i18n._({
          id: 'holeDetection.proposalsDashedNoneCounts',
          message:
            'Proposals are dashed; none counts until accepted. On the photo, double-click or Enter accepts one, drag or arrow keys move it, Delete removes it.',
        })}
      </p>
    </div>
  )
}

function RegionRow({
  region,
  tool,
  shape,
  enabled,
  onShape,
  onRegionOff,
}: {
  region: Point[] | undefined
  tool: Tool
  shape: 'rectangle' | 'polygon'
  /** A photo and its frame exist: the region tool can start. */
  enabled: boolean
  onShape: (shape: 'rectangle' | 'polygon') => void
  onRegionOff: () => void
}) {
  const { i18n } = useLingui()
  return (
    <div className="prop-row detect-wide">
      <span
        className="prop-label"
        title={`${i18n._({ id: 'holeDetection.whereLookRectangleTwo', message: 'Where to look: a rectangle (two opposite corners) or a polygon; none: the target found in the photo. Saved with the group.' })} ${region ? i18n._({ id: 'holeDetection.nowCorners', message: 'Now {count, decimal} corners.', values: { count: region.length } }) : i18n._({ id: 'holeDetection.noneMarked', message: 'None marked.' })}`}
      >
        {i18n._({ id: 'holeDetection.region', message: 'Region' })}
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
                ? i18n._({
                    id: 'holeDetection.markRectanglePhoto',
                    message: 'Mark a rectangle on the photo',
                  })
                : i18n._({
                    id: 'holeDetection.markPolygonPhoto',
                    message: 'Mark a polygon on the photo',
                  })
            }
            onClick={() => onShape(s)}
          >
            {s === 'rectangle'
              ? i18n._({ id: 'holeDetection.rect', message: 'Rect.' })
              : i18n._({ id: 'holeDetection.polygon', message: 'Polygon' })}
          </Button>
        ))}
        <ActionIcon
          variant="subtle"
          size={controlSize.row.icon}
          aria-label={i18n._({ id: 'holeDetection.regionOff', message: 'Region off' })}
          title={i18n._({
            id: 'holeDetection.regionOffTargetFound',
            message: 'Region off: the target found in the photo',
          })}
          style={{ visibility: region ? 'visible' : 'hidden' }}
          onClick={onRegionOff}
        >
          <X size={12} aria-hidden="true" />
        </ActionIcon>
      </span>
    </div>
  )
}

/** The Detect panel: its head, the step list, the step shown and Back and Next. */
export function DetectPanel({
  step,
  setStep,
  start,
  notes,
  body,
}: {
  step: number | undefined
  setStep: (update: number | undefined | ((s: number | undefined) => number | undefined)) => void
  /** The one-click start, shown before a step is chosen. */
  start: ReactNode
  /** The photo's quality problems, above the step. */
  notes: ReactNode
  /** The body of the step shown. */
  body: ReactNode
}) {
  const { i18n } = useLingui()
  return (
    <>
      <h3 className="prop-head">{i18n._({ id: 'holeDetection.detect', message: 'Detect' })}</h3>
      <ol
        className="detect-steps"
        aria-label={i18n._({ id: 'holeDetection.detectionSteps', message: 'Detection steps' })}
      >
        {detectSteps.map((name, i) => (
          <li key={name.id}>
            <button
              type="button"
              title={i18n._(name)}
              aria-current={step === i ? 'step' : undefined}
              onClick={() => setStep(i)}
            >
              {i + 1} {i18n._(name)}
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
          {i18n._({ id: 'holeDetection.back', message: 'Back' })}
        </Button>
        <Button
          size={controlSize.row.button}
          variant="default"
          disabled={step === detectSteps.length - 1}
          onClick={() => setStep((s) => (s === undefined ? 0 : s + 1))}
        >
          {i18n._({ id: 'holeDetection.next', message: 'Next' })}
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
  const { i18n } = useLingui()
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
            // oxlint-disable-next-line react/no-array-index-key -- clicks keep their order
            <circle key={i} className="detect-corner" cx={p.x} cy={p.y} r={4 * k} />
          ))}
        </>
      )}
      {flagged.map((f, i) => {
        const label = i18n._({
          id: 'holeDetection.areaPlaceHandAbout',
          message:
            'Area {n, decimal} to place by hand: about {count, decimal} holes of area joined (touching holes or dark print); detection does not count it.',
          values: { n: i + 1, count: Math.round(f.holeAreas) },
        })
        return (
          // oxlint-disable-next-line react/no-array-index-key -- a run's areas keep their order
          <g key={i} className="detect-flag" data-flag>
            <title>{label}</title>
            <rect x={f.x} y={f.y} width={f.width} height={f.height} />
            <text className="detect-flag-label" x={f.x} y={f.y - 3 * k} fontSize={11 * k}>
              {i18n._({ id: 'holeDetection.placeHand', message: 'place by hand' })}
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
            ? i18n._({
                id: 'holeDetection.proposalConfidenceOneCluster',
                message:
                  'Proposal {n, decimal}, confidence {pct, decimal} %, one of {count, decimal} in a cluster',
                values: {
                  n: i + 1,
                  pct,
                  count: p.clusterSize,
                },
              })
            : i18n._({
                id: 'holeDetection.proposalConfidence',
                message: 'Proposal {n, decimal}, confidence {pct, decimal} %',
                values: { n: i + 1, pct },
              })
        const label = maybe
          ? `${name}, ${i18n._({ id: 'holeDetection.maybe', message: 'maybe' })}`
          : name
        return (
          <g key={p.id}>
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
                {i18n._({
                  id: 'holeDetection.doubleClickEnterAccepts',
                  message:
                    '{label}. Double-click or Enter accepts it, drag or arrow keys move it, Delete removes it.',
                  values: { label },
                })}
              </title>
            </circle>
            <text
              className="proposal-label"
              x={p.x + r + 2 * k}
              y={p.y - r}
              fontSize={11 * k}
              aria-hidden="true"
            >
              {maybe
                ? i18n._({
                    id: 'holeDetection.maybePercent',
                    message: 'maybe {pct, decimal} %',
                    values: { pct },
                  })
                : i18n._({
                    id: 'holeDetection.percent',
                    message: '{pct, decimal} %',
                    values: { pct },
                  })}
              {p.clusterSize > 1 ? ` (${p.clusterSize})` : ''}
            </text>
          </g>
        )
      })}
    </g>
  )
}
