// Prints how far two labelers' sets of the same photos disagree in the quality bar's metric (apps/docs/docs/models/hole-detection.md), aggregates only: node scripts/label-agreement.mts <a.json> <b.json>
import { readFileSync } from 'node:fs'
import { correctionStats, corrections, type LabelSet, labelSet, matchHoles } from '../src/index.ts'

const [first, second] = process.argv.slice(2)
if (!first || !second) {
  console.error('usage: label-agreement.mts <a.json> <b.json>')
  process.exit(2)
}

function bySha(path: string) {
  const set: LabelSet = labelSet.parse(JSON.parse(readFileSync(path, 'utf8')))
  const photos = new Map(Object.values(set.photos).map((p) => [p.sha256, p]))
  if (photos.size !== Object.keys(set.photos).length) throw new Error(`${path} holds a photo twice`)
  return photos
}

const [a, b] = [bySha(first), bySha(second)]
if (a.size !== b.size || [...a.keys()].some((sha) => !b.has(sha)))
  throw new Error('the two sets hold different photos')

const pairs = [...a].flatMap(([sha, p]) => {
  const q = b.get(sha)
  return q ? [[p, q] as const] : []
})
const usable = pairs.filter(([p, q]) => p.usable && q.usable)
// a photo either labeler left unfinished would count its unmarked holes as disagreement
const compared = usable.filter(([p, q]) => p.complete && q.complete)
const perPhoto = compared.map(([p, q]) =>
  // the mean diameter keeps the figures the same when the labelers swap
  corrections(matchHoles(q.holes, p.holes, (p.visibleDiameterPx + q.visibleDiameterPx) / 2)),
)

console.log(
  JSON.stringify(
    {
      photos: pairs.length,
      usableDisagreements: pairs.filter(([p, q]) => p.usable !== q.usable).length,
      usableIncomplete: usable.length - compared.length,
      corrections: perPhoto.length > 0 ? correctionStats(perPhoto) : null,
    },
    null,
    2,
  ),
)
