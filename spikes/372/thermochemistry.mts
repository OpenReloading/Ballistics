/**
 * Thermochemistry checks of the 0.x pre-release (simulations, not load data). Self-contained: prints the
 * energy-scale shift and the Noble-Abel pressure of the reference case, and the virial against
 * Noble-Abel pressure of the main product gases. Run: node spikes/372/thermochemistry.mts
 */

const R = 8.314462618 // J/(mol K)
const NA = 6.02214076e23
const atomic = { C: 12.0107, H: 1.00794, N: 14.0067, O: 15.9994, K: 39.0983 }
type Formula = Partial<Record<keyof typeof atomic, number>>
const mass = (f: Formula) =>
  Object.entries(f).reduce((m, [e, n]) => m + atomic[e as keyof typeof atomic] * (n ?? 0), 0)

// --- Reference case: gaseous elements of 1 kg and the shift from enthalpy to energy of formation
/** C6H(10-x)O5(NO2)x with x from the nitrogen mass fraction. */
function nitrocellulose(n: number): Formula {
  const unit = mass({ C: 6, H: 10, O: 5 })
  const x = (unit * n) / (atomic.N - (mass({ N: 1, O: 2 }) - atomic.H) * n)
  return { C: 6, H: 10 - x, N: x, O: 5 + 2 * x }
}
const reference: [Formula, number][] = [
  [nitrocellulose(0.1325), 0.5723],
  [{ C: 3, H: 5, N: 3, O: 9 }, 0.4004], // nitroglycerine
  [{ K: 1, N: 1, O: 3 }, 0.0149], // potassium nitrate
  [{ C: 17, H: 20, N: 2, O: 1 }, 0.0074], // ethyl centralite
  [{ C: 2, H: 6, O: 1 }, 0.005], // ethanol
]
// mol of H2, N2 and O2 that form 1 kg: Delta u_f = Delta h_f + n_gas R T for condensed ingredients
const gasElements = reference.reduce((s, [f, w]) => {
  const m = mass(f) / 1000
  return s + (w * ((f.H ?? 0) + (f.N ?? 0) + (f.O ?? 0))) / 2 / m
}, 0)
console.log('Reference case')
console.log(
  `  gaseous elements ${gasElements.toFixed(2)} mol/kg, energy-scale shift ${((gasElements * R * 298.15) / 1e3).toFixed(1)} kJ/kg`,
)
const nobleAbel = (force: number, covolume: number, density: number) =>
  (force * density) / (1 - covolume * density)
console.log(
  `  Noble-Abel pressure from force 1170 kJ/kg and covolume 0.937 cm3/g at 210 kg/m3: ${(nobleAbel(1170e3, 0.937e-3, 210) / 1e6).toFixed(1)} MPa`,
)

// --- Lennard-Jones 12-6 virial coefficients, reduced by b0 = 2/3 pi N sigma^3
const mayer = (r: number, tStar: number) =>
  r === 0 ? -1 : Math.expm1((-4 * (r ** -12 - r ** -6)) / tStar)

/** B* and C* of a pair potential with Mayer function f(r), r in units of sigma, on a grid of step h. */
function reducedVirials(f: (r: number) => number, h = 0.004, rMax = 8): [number, number] {
  const n = Math.round(rMax / h)
  const fr = Array.from({ length: 2 * n + 1 }, (_, i) => f(i * h))
  // G(k) = integral of t f(t) dt from 0 to k h (trapezoid)
  const g = [0]
  for (let i = 1; i <= 2 * n; i++)
    g.push((g[i - 1] ?? 0) + (h * ((i - 1) * h * (fr[i - 1] ?? 0) + i * h * (fr[i] ?? 0))) / 2)
  let b = 0
  let c = 0
  for (let i = 1; i <= n; i++) {
    const fi = fr[i] ?? 0
    b += fi * (i * h) ** 2 * h
    for (let j = 1; j <= n; j++) {
      const inner = (g[i + j] ?? 0) - (g[Math.abs(i - j)] ?? 0)
      c += i * j * h * h * fi * (fr[j] ?? 0) * inner
    }
  }
  const b0 = (2 / 3) * Math.PI
  // B = -2 pi int f r^2 dr; C = -(8 pi^2 / 3) int int r s f(r) f(s) int_|r-s|^(r+s) t f(t) dt ds dr
  return [(-2 * Math.PI * b) / b0, ((-(8 * Math.PI ** 2) / 3) * c * h * h) / b0 ** 2]
}

// hard spheres: B* = 1, C* = 5/8 exactly
const [bHard, cHard] = reducedVirials((r) => (r < 1 ? -1 : 0), 0.004, 3)
if (Math.abs(bHard - 1) > 0.01 || Math.abs(cHard - 0.625) > 0.01)
  throw new Error(`hard-sphere check failed: B* ${bHard}, C* ${cHard}`)

/** Force constants sigma (Angstrom) and epsilon/k (K), NASA TR R-132 Table I. */
const species = {
  CO: [3.69, 91.7],
  CO2: [3.941, 195.2],
  H2: [2.827, 59.7],
  H2O: [2.641, 809.1],
  N2: [3.798, 71.4],
} as const
type Name = keyof typeof species
const names = Object.keys(species) as Name[]
/** Product mole fractions of the reference case, H2 taken as the rest to 100 %. */
const x: Record<Name, number> = { H2O: 0.284, CO: 0.282, CO2: 0.212, N2: 0.146, H2: 0.076 }

const cache = new Map<string, [number, number]>()
/** B and C (m3/mol, m6/mol2) of a pair with sigma and epsilon/k at T. */
function virials(sigma: number, eps: number, t: number): [number, number] {
  const key = `${sigma} ${eps} ${t}`
  let v = cache.get(key)
  if (!v) {
    const [bs, cs] = reducedVirials((r) => mayer(r, t / eps))
    const b0 = (2 / 3) * Math.PI * NA * (sigma * 1e-10) ** 3
    v = [bs * b0, cs * b0 * b0]
    cache.set(key, v)
  }
  return v
}
// unlike pairs: Lorentz-Berthelot rules; C_ijk = (C_ij C_ik C_jk)^(1/3)
const pair = (i: Name, j: Name, t: number) => {
  const [si, ei] = species[i]
  const [sj, ej] = species[j]
  return virials((si + sj) / 2, Math.sqrt(ei * ej), t)
}

console.log('\nPure gases: B (cm3/mol) and C/B^2 (Noble-Abel takes C/B^2 = 1)')
console.log(`| T (K) | ${names.join(' | ')} |`)
console.log(`|---|${names.map(() => '---').join('|')}|`)
for (const t of [2000, 3000, 4000]) {
  const cells = names.map((s) => {
    const [b, c] = pair(s, s, t)
    return `${(b * 1e6).toFixed(1)}, ${(c / b ** 2).toFixed(3)}`
  })
  console.log(`| ${t} | ${cells.join(' | ')} |`)
}

console.log(
  '\nReference product mixture: virial (to C) against Noble-Abel pressure, p_vir / p_NA - 1 in %',
)
console.log('Noble-Abel covolume b = sum x_i B_i (the model form); covolume fraction eta = b rho')
const etas = [0.1, 0.15, 0.2, 0.25, 0.3]
console.log(`| T (K) | b (cm3/mol) | ${etas.map((e) => `eta ${e}`).join(' | ')} |`)
console.log(`|---|---|${etas.map(() => '---').join('|')}|`)
let largest = 0
for (const t of [2000, 2500, 3000, 3500, 4000]) {
  const bLinear = names.reduce((s, i) => s + x[i] * pair(i, i, t)[0], 0)
  let bMix = 0
  let cMix = 0
  for (const i of names)
    for (const j of names) {
      bMix += x[i] * x[j] * pair(i, j, t)[0]
      for (const k of names)
        cMix +=
          x[i] * x[j] * x[k] * Math.cbrt(pair(i, j, t)[1] * pair(i, k, t)[1] * pair(j, k, t)[1])
    }
  const cells = etas.map((eta) => {
    const rho = eta / bLinear
    const zNa = 1 / (1 - eta)
    const zVir = 1 + bMix * rho + cMix * rho * rho
    const d = (zVir / zNa - 1) * 100
    if (Math.abs(d) > Math.abs(largest)) largest = d
    return d.toFixed(2)
  })
  console.log(`| ${t} | ${(bLinear * 1e6).toFixed(1)} | ${cells.join(' | ')} |`)
}
console.log(`largest difference ${largest.toFixed(2)} %`)
