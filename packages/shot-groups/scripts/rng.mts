// Fixed-seed normal draws for the hit-probability research scripts: mulberry32 uniforms, Box-Muller pairs.
import { seededUniforms } from '@open-reloading/statistics'

/** Deterministic uniform numbers in (0, 1): half a step above mulberry32's, so never 0 for the log. */
function uniforms(seed: number): () => number {
  const u = seededUniforms(seed)
  return () => u() + 0.5 / 4294967296
}

/** Standard normal draws from `seed`, two per pair of uniforms. */
export function normals(seed: number): () => number {
  const u = uniforms(seed)
  let spare: number | undefined
  return () => {
    if (spare !== undefined) {
      const s = spare
      spare = undefined
      return s
    }
    const r = Math.sqrt(-2 * Math.log(u()))
    const t = 2 * Math.PI * u()
    spare = r * Math.sin(t)
    return r * Math.cos(t)
  }
}
