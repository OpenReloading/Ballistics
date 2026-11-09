/** Deterministic uniform numbers in [0, 1) from an unsigned 32-bit `seed`: the mulberry32 generator. */
export function seededUniforms(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-Muller from `uniform`, two uniforms each: the radius from the first, the angle from the second. */
export function normalsFrom(uniform: () => number): () => number {
  return () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform())
}
