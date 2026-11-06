/**
 * The ring scoring of `@open-reloading/shot-groups` (packages/shot-groups/src/ring-scoring.ts) in the
 * language shown: ring marks that do not fit, or a group that cannot be scored, become the message
 * of the issue.
 */
import {
  faceAlignment as alignFace,
  type FaceAlignment,
  type FaceGroupScore,
  type FaceMark,
  type GroupIssue,
  type RingFitIssue,
  type ScoringFace,
  scoreGroupOnFace as scoreOnFace,
} from '@open-reloading/shot-groups'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import type { Point } from './target-geometry.ts'

export {
  type FaceMark,
  onSheet,
  type RingScore,
  ringPath,
  scoredHoleDiameter,
  scoreShot,
  usesOwnTenthRule,
} from '@open-reloading/shot-groups'

const fitWords = {
  'two-rings': msg('Marks on at least two rings are needed'),
  'four-points': msg('At least four points are needed'),
  'degenerate-points': msg('Points are degenerate'),
  'one-bull': msg('Ring marks fit a target with one bull'),
  'circular-rings': msg('Ring marks fit circular rings'),
  'no-ring': msg('The target has no ring {value}'),
} satisfies Record<RingFitIssue['code'], Message>

/** Why ring marks do not fit, in the language shown. */
const fitText = (issue: RingFitIssue, t: Translator['t']) => t(fitWords[issue.code], issue.params)

/** Why a group cannot be scored on its face, in the language shown. */
const groupText = (issue: GroupIssue, t: Translator['t']) =>
  issue.code === 'hole-size'
    ? t('No hole size: set Marker, or choose a discipline or event with a gauge.')
    : t('The ring marks do not fit: {reason}. Mark them again.', {
        reason: fitText(issue.params.fit, t),
      })

/** The face fitted to marks on its rings (`faceAlignment` of shot-groups); throws why they do not fit. */
export function faceAlignment(
  face: ScoringFace,
  marks: readonly FaceMark[] | undefined,
  aim: Point | undefined,
  t: Translator['t'],
): FaceAlignment {
  const alignment = alignFace(face, marks, aim)
  if ('issue' in alignment) throw new Error(fitText(alignment.issue, t))
  return alignment
}

/** A group scored on its face (`scoreGroupOnFace` of shot-groups), or why it cannot be. */
export function scoreGroupOnFace(
  face: ScoringFace,
  choice: Parameters<typeof scoreOnFace>[1],
  group: Parameters<typeof scoreOnFace>[2],
  bullet: number | undefined,
  t: Translator['t'],
): FaceGroupScore | { error: string } {
  const scored = scoreOnFace(face, choice, group, bullet)
  return 'issue' in scored ? { error: groupText(scored.issue, t) } : scored
}
