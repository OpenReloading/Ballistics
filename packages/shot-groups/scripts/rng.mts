// Fixed-seed normal draws for the hit-probability research scripts: mulberry32 uniforms, Box-Muller pairs.

/** Deterministic uniform numbers in (0, 1): the mulberry32 generator, never exactly 0. */
export function uniforms(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (((t ^ (t >>> 14)) >>> 0) + 0.5) / 4294967296
  }
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
