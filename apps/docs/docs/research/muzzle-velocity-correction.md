---
title: Muzzle velocity from a speed measured downrange
description: How much an optical screen's reading downrange lies below the muzzle velocity at 5 m, and whether an inversion of the bullet's own drag law gives the flown muzzle velocity back, from seeded simulated shots.
---

# Muzzle velocity from a speed measured downrange

## Question

Exterior model: does correcting a speed read at the stored muzzle distance of a session back to the muzzle, with the bullet's own drag law, change a result by more than a shooter would notice?

## Method

Decided before the run.

- Bullets: synthetic, on the 12 most frequent bullet diameters (4 to 13 mm) of the cartridge records (5.7 to 9.55 mm), four bullets each, 48 combinations. The mass follows from a sectional density of 0.16, 0.22 (twice) and 0.28 lb/in2. The ballistic coefficient is the sectional density over an assumed form factor: 0.55 against G1 (0.16 and 0.22), 1.0 against G7 (0.22 and 0.28). Form factors are assumptions, not measurements. Sea-level standard air.
- Inversion: the muzzle velocity whose flown speed at the stored distance equals the measured one, found by moving a guess by the miss over the existing point-mass `trajectory` (horizontal bore, no wind, no Earth rotation, spin drift or jump). No new integrator. The closed-form exponential loss with a constant drag coefficient is kept as a cross-check only.
- Test 1: 1000 seeded shots, each a random combination, muzzle velocity 300 to 1000 m/s and distance 1 to 10 m. Fly the known velocity to the distance, correct the speed there back, compare. Accept: mean bias below 0.1 m/s. The forward and the backward run use the same model, so this checks the search, not the drag law. As an independent check, 1000 further shots on a constant drag coefficient of 0.3, where the closed form is the exact solution and serves as the truth.
- Test 2: a 68 gr, 6.17 mm bullet at 2.44 m and 975 m/s, and a 175 gr, 7.82 mm bullet at 4.0 m and 800 m/s (G7 coefficients 0.15 and 0.27 lb/in2, assumed). Accept: the corrected value equals the muzzle velocity flown within 0.3 m/s (1 ft/s).
- Test 3: the correction in m/s and in percent of the measured speed at 5 m for every combination at 350, 650 and 950 m/s (144 cases), and the closed form against the inversion.
- Rule: if the correction at 5 m is below 0.1 percent for every case, the result is no change and the distance is documented as ignorable up to that value. 0.1 percent stands for the accuracy of an optical chronograph and is a placeholder, unverified. The table is given so another limit can be applied.

Reproduce: `node tools/research/muzzle-velocity-correction.ts` from the repository root, on the branch `research/muzzle-velocity-correction`.

## Formulas

The speed along a flat path falls with distance as $\mathrm{d}v/\mathrm{d}s = -\tfrac{\pi}{8}\,\rho\,C_D(M)\,(d^2/m)\,v$, the point-mass equation of motion with the drag acceleration of the [drag page](../models/exterior-drag.md) ([McCoy 1999](../bibliography.md#mccoy-1999), chapter unverified). For a constant $C_D$ this gives $v(s) = v_0\,e^{-ks}$ with $k = \pi\rho C_D d^2/(8m)$. The inversion needs no closed form: the flown speed at $s$ rises with $v_0$ at a slope near one, so $v_0 \leftarrow v_0 + (v_\mathrm{measured} - v(s; v_0))$ shrinks the miss by about the relative loss per pass.

Since $d^2/m$ is the inverse of the sectional density, the relative loss depends on the bullet's sectional density and drag function, not on the calibre alone. To first order it is proportional to the distance.

## Numbers

Test 1, 1000 shots on the 48 combinations: mean bias $-1.4\times10^{-9}$ m/s, root mean square $3.8\times10^{-9}$ m/s, largest $5.1\times10^{-8}$ m/s (by construction, same model both ways). Mean correction 3.54 m/s. On a constant drag coefficient of 0.3 against the exact solution: mean bias $-1.2\times10^{-5}$ m/s, largest $1.6\times10^{-4}$ m/s.

Test 2, speed lost to the screen and the error after the correction:

| case | distance (m) | muzzle velocity (m/s) | flown (m/s) | loss (m/s) | corrected minus flown (m/s) | closed form, Cd 0.3 (m/s) |
| --- | --- | --- | --- | --- | --- | --- |
| 68 gr, 6.17 mm, Cd 0.3 | 2.44 | 975 | 972.038 | 2.962 | $-2.5\times10^{-10}$ | 2.971 |
| 68 gr, 6.17 mm, G7 0.15 | 2.44 | 975 | 972.291 | 2.709 | $-3.5\times10^{-12}$ | 2.971 |
| 175 gr, 7.82 mm, G7 0.27 | 4.0 | 800 | 797.749 | 2.251 | $-1.1\times10^{-11}$ | 2.494 |

Test 3, correction at 5 m. The percent is the same for every calibre of a bullet type (spread 0 over the 12 diameters). The last two columns give the closed form over the inversion: with the drag coefficient of the standard function at the launch Mach number, and with a fixed 0.3.

| bullet type | muzzle velocity (m/s) | correction (m/s) | percent | closed form, local Cd | closed form, Cd 0.3 |
| --- | --- | --- | --- | --- | --- |
| SD 0.16, G1 | 350 | 2.11 | 0.606 | 1.013 | 1.068 |
| SD 0.16, G1 | 650 | 4.62 | 0.716 | 1.006 | 0.905 |
| SD 0.16, G1 | 950 | 5.81 | 0.616 | 1.005 | 1.052 |
| SD 0.22, G1 | 350 | 1.54 | 0.441 | 1.010 | 1.064 |
| SD 0.22, G1 | 650 | 3.36 | 0.520 | 1.004 | 0.904 |
| SD 0.22, G1 | 950 | 4.23 | 0.447 | 1.004 | 1.050 |
| SD 0.22, G7 | 350 | 2.18 | 0.626 | 1.008 | 0.752 |
| SD 0.22, G7 | 650 | 3.06 | 0.474 | 1.004 | 0.992 |
| SD 0.22, G7 | 950 | 3.75 | 0.396 | 1.003 | 1.186 |
| SD 0.28, G7 | 350 | 1.71 | 0.492 | 1.006 | 0.751 |
| SD 0.28, G7 | 650 | 2.41 | 0.372 | 1.003 | 0.991 |
| SD 0.28, G7 | 950 | 2.94 | 0.311 | 1.002 | 1.185 |

All 144 cases lie between 0.311 and 0.716 percent; none is below 0.1 percent. With the loss proportional to distance, 0.1 percent is reached at about 1.6 m for the heaviest bullet type and 0.7 m for the lightest (analytic, from the 5 m values). The closed form with a fixed coefficient of 0.3 is off by minus 25 to plus 19 percent, with the largest deviations at 350 and 950 m/s, where the real coefficient is far from 0.3; with the local coefficient it is within 1.3 percent, which is why it only serves as a cross-check.

## Result

Improved. Rule: the correction at 5 m is 0.31 to 0.72 percent of the velocity in every case, above the 0.1 percent limit, so it is worth building. The inversion gives the flown muzzle velocity back to $10^{-7}$ m/s on a bullet with a standard drag function and to $2\times10^{-4}$ m/s against the exact solution of a constant coefficient, and both named cases agree within 0.3 m/s by a wide margin. Adopted as a core function `muzzleVelocityFromDownrange` with unit tests for test 1 and test 2, on the branch `research/muzzle-velocity-correction`, ready to cherry-pick. Not on the default branch with this entry.

Wiring for the web app, not built: in `chargeRows` (`apps/web/src/lib/measurements.ts`), when a session has a muzzle distance above zero and the saved load gives the bullet's mass, diameter and drag, call the function on the mean gate velocity and show the result as its own number next to the gate reading. The switch is off by default and switches the number off again. The comparison with the simulated muzzle velocity uses the corrected number only while the switch is on. Without a load there is no corrected number and no field is added to the session. The summary shows the corrected number labelled as a simulation.

## Data basis

Analytic: synthetic bullets with assumed sectional densities and form factors on bullet diameters from the cartridge records, and a seeded simulation of the same model. No measured sessions. The check on paired sessions with a second screen waits for measured sessions.

## Where in the app

- `packages/schema/src/chrono-session.ts`, `muzzleDistance` (stored, shown, not used in any calculation).
- `apps/web/src/lib/measurements.ts`, `chargeRows` (the gate mean against the simulated muzzle velocity).
- `packages/core/src/exterior/trajectory.ts`, `trajectory` (the forward run the inversion calls).
- Model page: [drag](../models/exterior-drag.md).

## Confidence

Medium: the search and the model agree to $10^{-7}$ m/s and the constant-coefficient case to $10^{-4}$ m/s, but the drag law at 1 to 10 m, the form factors and the 0.1 percent limit are unverified, and no measured session has been compared.
