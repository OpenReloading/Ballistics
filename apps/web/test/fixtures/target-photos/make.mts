/**
 * Writes the synthetic target photos of `scenes.ts` and `holes.json` (hole centres in photo px).
 * Run from apps/web: node test/fixtures/target-photos/make.mts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
// biome-ignore lint/correctness/noUndeclaredDependencies: optional dependency of next, hoisted to the root
import sharp from 'sharp'
import { render, scenes, tilted } from './scenes.ts'

const dir = import.meta.dirname
const photos: Record<string, unknown> = {}
for (const s of scenes) {
  await sharp(Buffer.from(render(s)), { raw: { width: s.width, height: s.height, channels: 3 } })
    .blur(s.blur)
    .jpeg({ quality: s.jpeg })
    .toFile(join(dir, s.file))
  photos[s.file] = {
    about: s.about,
    size: [s.width, s.height],
    pxPerMm: s.pxPerMm,
    caliberMm: s.caliberMm,
    visibleDiameterPx: s.caliberMm * s.visible * s.pxPerMm,
    holes: s.holes.map((h) => {
      const p = tilted(s, h)
      return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }
    }),
  }
}
writeFileSync(join(dir, 'holes.json'), `${JSON.stringify({ photos }, null, 2)}\n`)
