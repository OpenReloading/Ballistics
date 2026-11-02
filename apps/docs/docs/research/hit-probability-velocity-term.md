---
title: Hit probability with a muzzle speed spread
description: Whether adding the height spread from the muzzle speed, and removing it from the reference group before the linear scaling, matches a seeded simulation of impact heights at 100 to 1000 m.
---

# Hit probability with a muzzle speed spread

## Question

Hit probability (`hit-probability.md`): does a vertical part $S_v\,\sigma_v$ from the muzzle speed spread, with the part already in the reference group taken out before the linear scaling, match the simulated vertical spread at 100 to 1000 m where scaling the whole group linearly does not?

## Method

Accept rule, decided before any run: build when the term agrees with the simulation within 5 percent at every distance of every load and the linear baseline does not (at some distance), and when the term is at least 5 percent of the vertical standard deviation at some distance for a speed standard deviation of 3 m/s or more. Otherwise document the size per distance under Limits and build nothing.

Synthetic inputs, fixed before the run, no measured load. Shot: 11.3 g, 7.82 mm, G7 ballistic coefficient as listed, sight 50 mm above the bore, standard sea-level atmosphere, no Coriolis, zero at 100 m. The bore angles come from `zeroAngles` once at the nominal speed and are passed unchanged to every other run, so a changed speed does not re-zero the shot.

| Load | Muzzle speed, m/s | G7 coefficient, lb/in² | Speed SD, m/s |
| --- | --- | --- | --- |
| 1 | 900 | 0.27 | 3 |
| 2 | 800 | 0.22 | 5 |
| 3 | 850 | 0.30 | 8 |
| 4 | 700 | 0.20 | 10 |
| 5 | 950 | 0.35 | 12 |

Distances 100, 200, ..., 1000 m (the range of the issue; the distance limit of the web form was not checked, unverified). Reference distance $D_0 = 100$ m. The velocity-independent vertical dispersion is 6 mm at $D_0$ (0.06 mrad) and grows linearly with the distance; a second case uses 20 mm (0.2 mrad).

Simulation: 5000 shots per load from a fixed seed (mulberry32), each with a normally drawn muzzle speed and one trajectory run, plus a normal draw of the velocity-independent part. The simulated value is the standard deviation of the heights at each distance (sampling error about $1/\sqrt{2N} = 1$ percent). The group a shooter measures at $D_0$ is the simulated one, with its speed part inside. The model gets that group, $S_v$ from one extra run at the speed plus 1 m/s, and the speed SD, and returns the vertical SD at each distance. The linear baseline scales the same group by $D/D_0$.

Run: `node packages/core/scripts/hit-probability-velocity.mts` (seeds fixed in the script).

## Formulas

The group's vertical standard deviation at $D_0$ is $\sigma_{g,y}$. To first order the height changes by $S_v\,\delta v$ for a speed change $\delta v$, so the speed part is $S_v\sigma_v$ (propagation of error, [NIST/SEMATECH](../bibliography.md#nist-sematech), 4.1.1, section number unverified). The velocity-independent part scales with the distance and the speed part is taken from the trajectory:

$$
\sigma_y(D) = \sqrt{\left(\sigma_{g,y}^2 - \left(S_{v,0}\sigma_v\right)^2\right)\left(\frac{D}{D_0}\right)^2 + \left(S_v(D)\,\sigma_v\right)^2}
$$

The linear baseline is $\sigma_{g,y}\,D/D_0$. For a flight in vacuum the height change per unit speed is $g t^2 / v$ with $t$ the time of flight, which grows as the square of the distance at constant speed; drag makes it grow faster (first-order argument, no source).

## Numbers

Velocity-independent SD 6 mm at 100 m. Speed part and its share of the model's vertical SD, simulated SD, model error and linear baseline error, at four of the ten distances:

| Load | Distance, m | Speed part, mm | Share | Simulated, mm | Model error | Linear error |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 100 | 0.43 | 7.1 % | 6.03 | 0.00 % | 0.00 % |
| 1 | 300 | 4.34 | 23.4 % | 18.57 | 0.00 % | -2.5 % |
| 1 | 600 | 21.21 | 50.6 % | 41.84 | +0.09 % | -13.5 % |
| 1 | 1000 | 81.66 | 80.5 % | 101.08 | +0.36 % | -40.3 % |
| 2 | 100 | 1.03 | 17.2 % | 5.98 | 0.00 % | 0.00 % |
| 2 | 300 | 10.82 | 52.2 % | 20.60 | +0.64 % | -12.9 % |
| 2 | 600 | 57.28 | 85.1 % | 66.54 | +1.17 % | -46.1 % |
| 2 | 1000 | 245.23 | 97.2 % | 249.24 | +1.20 % | -76.0 % |
| 3 | 100 | 1.34 | 22.1 % | 6.07 | 0.00 % | 0.00 % |
| 3 | 300 | 13.50 | 60.5 % | 22.38 | -0.34 % | -18.7 % |
| 3 | 600 | 64.72 | 87.7 % | 73.72 | +0.13 % | -50.6 % |
| 3 | 1000 | 240.67 | 97.1 % | 246.14 | +0.69 % | -75.4 % |
| 4 | 100 | 3.10 | 45.7 % | 6.78 | 0.00 % | 0.00 % |
| 4 | 300 | 33.69 | 88.1 % | 38.32 | -0.20 % | -46.9 % |
| 4 | 600 | 192.95 | 98.3 % | 197.11 | -0.41 % | -79.4 % |
| 4 | 1000 | 699.38 | 99.6 % | 703.51 | -0.22 % | -90.4 % |
| 5 | 100 | 1.43 | 22.9 % | 6.25 | 0.00 % | 0.00 % |
| 5 | 300 | 14.11 | 61.2 % | 22.96 | +0.46 % | -18.4 % |
| 5 | 600 | 65.33 | 87.3 % | 74.46 | +0.51 % | -49.6 % |
| 5 | 1000 | 225.72 | 96.6 % | 233.07 | +0.30 % | -73.2 % |

Over all ten distances and five loads the largest model error is 1.20 percent (load 2) and the largest linear error 90.4 percent (load 4). The speed part is 7.1 to 99.6 percent of the vertical SD, 7.1 percent at 100 m for the 3 m/s load.

With 20 mm of velocity-independent SD at 100 m the largest model error is 1.18 percent and the largest linear error 72.1 percent; the share is 2.1 to 96.1 percent. For load 1 (3 m/s) it is 2.1 percent at 100 m and 37.7 percent at 1000 m, and the linear baseline is off by 7.3 percent there, only just beyond the 5 percent line.

## Result

Improved. Adopted: the term is within 5 percent everywhere (largest 1.2 percent), the linear baseline is not (up to 90 percent), and the share is at least 7 percent at 100 m for 3 m/s with the 6 mm group. `pointDispersion` takes an optional speed spread (`sd`, `verticalPerSpeed`, `referenceVerticalPerSpeed`); empty means none and the result is unchanged. A speed part at $D_0$ that reaches the group's vertical SD is refused. Equation, assumption and Limits (height only, spin drift not varied) on the [model page](../models/hit-probability.md).

Web wiring, not built (at most ten lines): the optional field "Muzzle speed SD" in the hit-probability form, prefilled from the standard deviation of the chronograph session of the selected load (`apps/web/src/lib/string-stats.ts`) and empty meaning zero. `impactSensitivity` takes a second trajectory run with the speed plus 1 m/s at the same bore angles (`verticalPerSpeed` at each table range, `referenceVerticalPerSpeed` at the group's distance). The dispersion breakdown shows the speed part next to wind and range. The input of the group and the speed SD that make the subtraction non-positive show the refusal text.

## Data basis

Analytic: synthetic loads and a seeded simulation. Every number is a simulation, not a statement about a real load.

## Where in the app

- `packages/core/src/groups/hit-probability.ts` (`pointDispersion`)
- [Hit probability](../models/hit-probability.md)

## Confidence

High for the first-order term against the simulation it is built from (the agreement is 1.2 percent against a 1 percent sampling error); medium for the share figures, which depend on the chosen 6 mm and 20 mm velocity-independent dispersion.
