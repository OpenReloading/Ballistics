---
title: Along-path stability warning
description: Whether Miller's rule evaluated with the local speed and air along the flight tracks the gyroscopic stability factor, how often it fires on ordinary loads, and what replaced it.
---

# Along-path stability warning

## Question

Exterior ballistics, [stability](../models/exterior-stability.md): the trajectory result flagged the first point where Miller's rule, evaluated with the speed and the air of the point, fell below 1. Does that value follow the gyroscopic stability factor of linear theory along a flight, and how often did it fire on ordinary loads?

## Method

Three comparisons on the same flights, fixed before the run.

1. Named cases: two .224 in loads that the warning flagged, three .308 in and 7.82 mm loads, and a 9.5 g 7.82 mm case. An unstated bullet length is solved from the stated Miller value at the muzzle (standard sea-level air), and the G7 ballistic coefficient so that the stated speed or along-path value is reproduced; where nothing is stated, both are assumed and marked.
2. A synthetic grid of 144 bullets: calibres .224, .243, .264, .284, .308 and .338 in, sectional density 0.15, 0.20, 0.25 and 0.30 lb/in², twist 30, 40 and 54 calibres per turn, muzzle speed 2400 and 3300 ft/s. Mass is sectional density times squared calibre; length is mass over (7600 kg/m³ times the cross-section), the effective density of a jacketed lead-core boat-tail bullet; the G7 coefficient is sectional density over a form factor of 1.1. Each bullet is flown over 0 to 1500 m in 25 m steps at standard sea-level air, zeroed at 100 m, once with the coefficient as stated and once at 80 and 120 percent of it.
3. The factor of the modified point mass ([modified point mass](../models/exterior-modified-point-mass.md)), with the constant moment slope it estimates from Miller's muzzle value, a spin damping coefficient of $-0.012$ and the speed, spin and air density of each point, against the along-path Miller value. The mean absolute difference is taken over 0 to 1000 m in 25 m steps.

Accept rule: if the old method flags at least one ordinary .224 case and the state factor none, the along-path warning is dropped; if it flags none, it is kept and relabelled. Bullets below 1 at the muzzle are left out of the grid counts: the muzzle check covers them and both methods flag them at 0 m.

## Formulas

In linear theory the gyroscopic factor is proportional to the squared spin rate over the air density, the squared speed and the overturning-moment slope ([McCoy 1999](../bibliography.md#mccoy-1999), chapter numbers unverified). Normalised to the muzzle:

$$
S_g(x) = S_g(0)\left(\frac{\omega(x)}{\omega_0}\right)^2\left(\frac{v_0}{v(x)}\right)^2\frac{\rho_0}{\rho(x)}\,\frac{C_{M_\alpha}(0)}{C_{M_\alpha}(x)}
$$

The modified point mass takes the spin from its decay law, $\mathrm{d}\ln\omega/\mathrm{d}s = C_{l_p}\,\pi\rho d^2/m$ per metre of path with a constant coefficient $C_{l_p} \lt 0$ (the equation of [spin decay](../models/exterior-modified-point-mass.md)), and the speed from drag, $\mathrm{d}\ln v/\mathrm{d}s = -C_D\,\pi\rho d^2/(8m)$ with $C_D$ on the area $\pi d^2/4$. With a constant moment slope and a constant density, derived here, the logarithm of $S_g$ then changes per metre by $(\pi\rho d^2/m)\,(2 C_{l_p} + C_D/4)$, so the factor rises for as long as $C_D \gt 8\,\lvert C_{l_p}\rvert$. At $\lvert C_{l_p}\rvert = 0.012$ that holds for any drag coefficient above 0.1.

The old value is Miller's rule with the local speed and air: $S_g(x) \propto v(x)^{1/3}\,T(x)/p(x)$ ([Miller 2005](../bibliography.md#miller-2005), pages unverified). Its speed term is a fit to the muzzle velocity at one twist, where the initial spin is proportional to the muzzle velocity; along a flight the spin is not proportional to the speed.

## Numbers

"Old" is the first point of the 25 m grid where Miller's rule with the local speed and air is below 1; "state" is the modified point mass factor.

| Case | Length (mm) | G7 BC (lb/in²) | Muzzle | Old value at the stated range | Old flag, BC −20 % / as set / +20 % (m) | State flag | Mean abs. difference 0–1000 m |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 55 gr .224 in, 3200 ft/s, 1 in 12 | 18.8 | 0.129 | 1.36 | 0.97 at 600 m | 450 / 575 / 675 | none | 3.9 |
| 77 gr .224 in, 2750 ft/s, 1 in 9 | 25.4 | 0.212 | 1.35 | 0.98 at 900 m | 675 / 850 / 1000 | none | 1.9 |
| 168 gr .308 in, 2600 ft/s, 1 in 12 | 31.1 | 0.216 | 1.66 | 1.38 at 600 yd, 1.21 at 1000 yd | none | none | 2.5 |
| 175 gr .308 in, 2600 ft/s, 1 in 12 (assumed 31.5 mm, 0.243) | 31.5 | 0.243 | 1.67 | 1.40 at 600 m | none | none | 2.1 |
| 175 gr .308 in, 2600 ft/s, 1 in 10 (same assumptions) | 31.5 | 0.243 | 2.40 | 2.01 at 600 m | none | none | 3.0 |
| 9.5 g 7.82 mm, 830 m/s, 12 in (length assumed) | 28.5 | 0.199 | 1.89 | 1.71 at 300 m | none | none | 3.1 |
| 11.34 g 7.82 mm, 790 m/s, 10 in | 31.2 | 0.276 | 2.46 | 2.17 at 500 m, 1.86 at 1000 m | none | none | 2.3 |

Stated values reproduced: 0.97 and 0.98 at the stated ranges (the 25 m grid flags both at 0.99, at 575 and 850 m, a step before the stated range), 1.38 and 1.21 at 600 and 1000 yd at 1503 and 1021 ft/s (stated 1019 ft/s), and 2.17 and 1.86 for the last case (stated 2.17 and 1.85). The 9.5 g case reproduces the fall of the speed by 26 percent over 300 m and the fall of the old value by 9.6 percent. Two stated figures differ. The spin falls by 4 percent over 300 m only with a damping coefficient of about $-0.0055$, which gives a state factor $1.68$ times its muzzle value at 300 m (stated: 67 percent more); at the common $-0.012$ the spin falls by 8.5 percent and the factor rises by 52 percent. The state factor of the 168 gr case is 3.73 at 600 yd and 6.67 at 1000 yd over a muzzle value of 1.66, against 3.5 and 5.7 over 1.70 from an integration with a moment slope that varies with Mach number; a constant slope has no rise toward Mach 1 to hold the ratio down.

With the moment-slope table of the last case (3.5 at Mach 0.7, 3.6 at 1.0, 3.0 at 1.4, 2.6 at 2.2), the state factor relative to its muzzle value is 1.21 at 250 m, 1.48 at 500 m, 2.35 at 1000 m and 2.78 at 1500 m. It does not dip below the muzzle value: the table rises by a ratio of 1.4 between Mach 2.3 and Mach 1.0, less than the gain from the speed.

Grid: 144 bullets, 30 below 1 at the muzzle left out, 114 counted:

| BC | Flagged by the old method | Flagged by the state factor | First flag, min / median / max (m) | Mean abs. difference 0–1000 m |
| --- | --- | --- | --- | --- |
| 80 % | 29 | 0 | 150 / 650 / 1350 | 7.9 |
| as set | 25 | 0 | 175 / 775 / 1425 | 5.4 |
| 120 % | 21 | 0 | 200 / 825 / 1500 | 3.8 |

Decision number: the old method flags 2 of 2 ordinary .224 in cases (575 m and 850 m) and 25 of 114 grid bullets; the state factor flags 0 and 0.

## Result

Improved. The along-path flag is removed (`firstLowStability`, `minStability`, the `lowStability` field of the web result and its line in the result notes); the model page states that the result carries Miller's factor at the muzzle only, and why. The muzzle value and the transonic-range line stay. Cost: a bullet that really loses stability near Mach 1 gets no flag from the path, which the model page states.

Not built: the state factor with a moment-slope table (option c). Bullet records carry no such table, so it would fire on nothing; add it when they do.

## Data basis

Analytic: closed-form scalings and a synthetic grid with stated lengths and coefficients. The repository holds no measured onset of instability along a flight, so the comparison shows what the old value tracks, not where a given bullet becomes unstable.

## Where in the app

- `packages/core/src/exterior/stability.ts`, `millerStability` (kept) and the removed `firstLowStability`.
- `packages/core/src/exterior/modified.ts`, `gyroscopicStability`.
- `packages/core/test/exterior-stability.test.ts`.
- `apps/web/src/lib/trajectory-input.ts`, `trajectoryResult`.
- `apps/web/src/components/trajectory-form.tsx`, the result notes.
- Model pages: [stability, spin drift and jump](../models/exterior-stability.md), [modified point mass](../models/exterior-modified-point-mass.md).

## Confidence

Medium: the trend and the counts follow from the stated lengths and coefficients and hold at 80 and 120 percent of the coefficient, but the grid is synthetic and the lengths of three named cases are assumed.
