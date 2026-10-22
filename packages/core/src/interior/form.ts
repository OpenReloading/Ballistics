/**
 * Burn laws and form functions of the Noble-Abel interior model,
 * `apps/docs/docs/models/interior-burn-forms.md`. Dimensions in m.
 */

import { bisect } from '../bisect.ts'

/** Propellant grain by shape; dimensions in m, `perforationDiameter` is the diameter of one perforation. */
export type Grain =
  | { shape: 'sphere'; diameter: number }
  | { shape: 'cylinder'; diameter: number; length: number }
  | { shape: 'tube'; diameter: number; perforationDiameter: number; length: number }
  | { shape: 'sevenPerf'; diameter: number; perforationDiameter: number; length: number }

/** Form function phi = S/S0 of the vivacity burn law (`apps/docs/docs/models/interior-burn-forms.md`, "Vivacity forms"). */
export type VivacityForm =
  /** phi = 1. */
  | { kind: 'constant' }
  /** (1 + a z)^m up to z1, then falling as (1 - z)^q. */
  | { kind: 'twoStage'; a: number; m: number; q: number; z1: number }
  /** As `twoStage` up to z2, then falling as (1 - z)^r. */
  | { kind: 'threeStage'; a: number; m: number; q: number; z1: number; z2: number; r: number }

/** Burn law of a propellant: geometric (grain shape and burn rate) or vivacity (form function). */
export type Burn =
  /** r = coefficient p^exponent, coefficient in m s^-1 Pa^-exponent. */
  | { kind: 'geometric'; coefficient: number; exponent: number; grain: Grain }
  /** dz/dt = vivacity phi(z) (p/referencePressure)^exponent, vivacity in 1/s. */
  | {
      kind: 'vivacity'
      vivacity: number
      exponent: number
      referencePressure: number
      form: VivacityForm
    }

/** Form function of a burn law, as `burnForm` returns it. */
export interface BurnForm {
  /** Burnt fraction at the form variable f (f = y/e1 for grains, f = z for vivacity forms up to the third stage of `threeStage`). */
  z: (f: number) => number
  /** Factor on df/dt besides the pressure term: phi(z) for vivacity forms (phi2 in a third stage), 1 for grains. */
  phi: (f: number) => number
  /** Values of f where the right-hand side has a kink, ascending, below `end`. */
  breaks: readonly number[]
  /** f at z = 1. */
  end: number
  /** Half web e1, m; 1 for vivacity forms. */
  halfWeb: number
}

const one = () => 1

/** Area of the intersection of two disks of radii r1, r2 with centre distance d. */
export function lensArea(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2
  const a1 = Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1))
  const a2 = Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2))
  const k = Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2))
  return r1 * r1 * a1 + r2 * r2 * a2 - k / 2
}

/**
 * Cross-section of the twelve slivers of a seven-perforated grain after the web phase, at
 * perforation radius rho, outer radius r and perforation spacing s
 * (`apps/docs/docs/models/interior-burn-forms.md`, "Geometric grains"). Each area is found by inclusion and
 * exclusion over the triangle or 60 degree wedge that holds one sliver.
 */
export function sliverArea(rho: number, r: number, s: number): { inner: number; outer: number } {
  const halfLens =
    rho * rho * Math.acos(s / (2 * rho)) - (s / 2) * Math.sqrt(rho * rho - (s * s) / 4)
  const triangle = (Math.sqrt(3) / 4) * s * s
  const inner = rho >= s / Math.sqrt(3) ? 0 : triangle - (Math.PI * rho * rho) / 2 + 3 * halfLens
  const outer =
    (Math.sqrt(3) / 2) * s + Math.sqrt(rho * rho - (s * s) / 4) >= r
      ? 0
      : (Math.PI * r * r) / 6 -
        triangle -
        lensArea(r, rho, s) +
        (Math.PI * rho * rho) / 3 +
        halfLens
  return { inner: Math.max(0, inner), outer: Math.max(0, outer) }
}

function sevenPerf(diameter: number, perforation: number, length: number): BurnForm {
  const w = (diameter - 3 * perforation) / 4
  const e1 = w / 2
  const s = perforation + w
  const a0 = (Math.PI / 4) * (diameter ** 2 - 7 * perforation ** 2)
  const rho = (y: number) => perforation / 2 + y
  const r = (y: number) => diameter / 2 - y
  // the outer slivers burn longest; they vanish when the outer intersection of two perforation circles reaches the outer surface
  const yEnd = bisect(
    (y) => (Math.sqrt(3) / 2) * s + Math.sqrt(Math.max(0, rho(y) ** 2 - (s * s) / 4)) - r(y) < 0,
    e1,
    diameter / 2,
    200,
    false,
  )
  const area = (y: number) => {
    if (y <= e1) return (Math.PI / 4) * ((diameter - 2 * y) ** 2 - 7 * (perforation + 2 * y) ** 2)
    if (y >= yEnd) return 0
    const { inner, outer } = sliverArea(rho(y), r(y), s)
    return 6 * (inner + outer)
  }
  return {
    z: (f) => 1 - (area(e1 * f) * (length - 2 * e1 * f)) / (a0 * length),
    phi: one,
    breaks: [1, 1 + ((2 * s) / w) * (1 / Math.sqrt(3) - 1 / 2)],
    end: yEnd / e1,
    halfWeb: e1,
  }
}

/** The form function and the shape-specific checks of one kind of grain or vivacity form. */
interface FormEntry<T> {
  form: (value: T) => BurnForm
  /** Name of the first invalid field beyond the common checks, or undefined. */
  error?: (value: T) => string | undefined
}

/** One entry per grain shape: a new shape is one entry here and one member of `Grain`. */
const grainShapes: { [S in Grain['shape']]: FormEntry<Extract<Grain, { shape: S }>> } = {
  sphere: {
    form: (grain) => ({
      z: (f) => 1 - (1 - f) ** 3,
      phi: one,
      breaks: [],
      end: 1,
      halfWeb: grain.diameter / 2,
    }),
  },
  cylinder: {
    form: (grain) => {
      const { diameter: d, length: l } = grain
      const e1 = Math.min(d, l) / 2
      return {
        z: (f) => 1 - (1 - (2 * e1 * f) / d) ** 2 * (1 - (2 * e1 * f) / l),
        phi: one,
        breaks: [],
        end: 1,
        halfWeb: e1,
      }
    },
  },
  tube: {
    form: (grain) => {
      const w = (grain.diameter - grain.perforationDiameter) / 2
      return {
        z: (f) => 1 - (1 - f) * (1 - (w * f) / grain.length),
        phi: one,
        breaks: [],
        end: 1,
        halfWeb: w / 2,
      }
    },
    error: (g) => {
      if (!(g.perforationDiameter < g.diameter)) return 'propellant.burn.grain.perforationDiameter'
      if (!(g.length >= (g.diameter - g.perforationDiameter) / 2))
        return 'propellant.burn.grain.length'
      return
    },
  },
  sevenPerf: {
    form: (grain) => sevenPerf(grain.diameter, grain.perforationDiameter, grain.length),
    error: (g) => {
      if (!(3 * g.perforationDiameter < g.diameter))
        return 'propellant.burn.grain.perforationDiameter'
      const form = sevenPerf(g.diameter, g.perforationDiameter, g.length)
      if (!(g.length > 2 * form.halfWeb * form.end)) return 'propellant.burn.grain.length'
      return
    },
  },
}

/**
 * Forms of a vivacity law: f = z, except in the third stage of `threeStage`
 * (`apps/docs/docs/models/interior-burn-forms.md`, "Vivacity forms").
 */
const vivacityForms: {
  [K in VivacityForm['kind']]: FormEntry<Extract<VivacityForm, { kind: K }>>
} = {
  constant: {
    form: () => ({ z: (f: number) => f, end: 1, halfWeb: 1, phi: one, breaks: [] }),
  },
  twoStage: {
    form: ({ a, m, q, z1 }) => {
      const phi1 = (1 + a * z1) ** m
      return {
        z: (f: number) => f,
        end: 1,
        halfWeb: 1,
        // finite beyond z = 1, so an integrator step may cross burnout: 0 after a second stage with q > 0, phi1 otherwise (q = 0 or z1 = 1)
        phi: (z) =>
          z <= z1 ? (1 + a * z) ** m : z1 < 1 ? phi1 * (Math.max(0, 1 - z) / (1 - z1)) ** q : phi1,
        breaks: z1 < 1 ? [z1] : [],
      }
    },
    // q >= 1 lets phi fall like (1 - z)^q, so z = 1 is reached only asymptotically
    error: (f) =>
      [f.a, f.m, f.q, f.z1].every(Number.isFinite) &&
      f.z1 > 0 &&
      f.z1 <= 1 &&
      f.q >= 0 &&
      (f.q < 1 || f.z1 === 1) &&
      1 + f.a * f.z1 > 0
        ? undefined
        : 'propellant.burn.form',
  },
  threeStage: {
    form: ({ a, m, q, z1, z2, r }) => {
      const phi1 = (1 + a * z1) ** m
      const phi2 = phi1 * ((1 - z2) / (1 - z1)) ** q
      // third stage in f = z2 + (1 - z2) (1 - w^(1 - r)) / (1 - r), w = (1 - z)/(1 - z2): df/dt has the
      // constant factor phi2, so burnout is a linear crossing at f = end; in z it is reached as (t_b - t)^(1/(1 - r))
      const k = 1 / (1 - r)
      const u = (f: number) => 1 - (f - z2) / ((1 - z2) * k)
      return {
        // odd in u beyond f = end, so z stays smooth when an integrator step crosses burnout (z = f for r = 0)
        z: (f) => (f <= z2 ? f : 1 - (1 - z2) * Math.sign(u(f)) * Math.abs(u(f)) ** k),
        phi: (f) =>
          f <= z1 ? (1 + a * f) ** m : f <= z2 ? phi1 * ((1 - f) / (1 - z1)) ** q : phi2,
        breaks: [z1, z2],
        end: z2 + (1 - z2) * k,
        halfWeb: 1,
      }
    },
    // the third stage ends the burn, so q >= 1 is allowed; r >= 1 never reaches z = 1
    error: (f) =>
      [f.a, f.m, f.q, f.z1, f.z2, f.r].every(Number.isFinite) &&
      f.z1 > 0 &&
      f.z1 < f.z2 &&
      f.z2 < 1 &&
      1 + f.a * f.z1 > 0 &&
      f.q >= 0 &&
      f.r >= 0 &&
      f.r < 1
        ? undefined
        : 'propellant.burn.form',
  },
}

// the mapped entry types do not narrow on a union key, so these two lookups take the union
const grainEntry = (g: Grain) => grainShapes[g.shape] as FormEntry<Grain>
const vivacityEntry = (f: VivacityForm) => vivacityForms[f.kind] as FormEntry<VivacityForm>

/** Form function of a burn law (`apps/docs/docs/models/interior-burn-forms.md`, "Burn laws"). */
export function burnForm(burn: Burn): BurnForm {
  return burn.kind === 'geometric'
    ? grainEntry(burn.grain).form(burn.grain)
    : vivacityEntry(burn.form).form(burn.form)
}

/** Name of the first invalid field of a burn law, or undefined. */
export function burnError(burn: Burn): string | undefined {
  const pos = (v: number) => Number.isFinite(v) && v > 0
  if (!(burn.exponent >= 0 && Number.isFinite(burn.exponent))) return 'propellant.burn.exponent'
  if (burn.kind === 'vivacity') {
    if (!pos(burn.vivacity)) return 'propellant.burn.vivacity'
    if (!pos(burn.referencePressure)) return 'propellant.burn.referencePressure'
    return vivacityEntry(burn.form)?.error?.(burn.form)
  }
  if (!pos(burn.coefficient)) return 'propellant.burn.coefficient'
  const g = burn.grain
  const dims = Object.entries(g).filter(([k]) => k !== 'shape')
  for (const [k, v] of dims) if (!pos(v as number)) return `propellant.burn.grain.${k}`
  // `?.` on the entry (also above): an unlisted shape or form from an untyped caller gets no shape check
  return grainEntry(g)?.error?.(g)
}
