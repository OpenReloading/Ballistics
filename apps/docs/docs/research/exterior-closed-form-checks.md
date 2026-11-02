---
title: Exterior model against closed forms
description: Whether the point mass and the modified point mass reproduce the closed forms of flat-fire drop, range wind, spin drift, free-fall earth rotation and the linear-theory yaw modes.
---

# Exterior model against closed forms

## Question

Exterior ballistics: do the point-mass and modified point-mass integrations reproduce the closed forms that hold for a constant drag coefficient, and do the stability functions satisfy the identities of linear theory?

## Method

Each case runs `trajectory` with a flat drag curve (one drag coefficient at every Mach number), no Coriolis term unless the case is about it, against a closed form evaluated in the test. Accept limits, set before the runs: $10^{-3}$ relative for the flat-fire drop and the spin drift, $10^{-8}$ for the exact range-wind form, 0.5 percent for the free-fall deflection, $10^{-12}$ for the yaw-mode identities.

- Flat-fire drop: 9.5 g, 7.82 mm, $c_d$ 0.4, 830 m/s, sea-level standard air, bore angle 0 and 0.3 degrees, 100 to 1000 m.
- Range wind: 11.3 g, 7.82 mm, $c_d$ 0.3, 850 m/s, no gravity, wind along the line of fire of -10, 10 and 50 m/s.
- Spin drift (modified point mass): 7.82 mm, 11.34 g, $C_D$ 0.30, $C_{L\alpha}$ 2.6, $C_{M\alpha}$ 3.0, $I_x$ 7.2e-8 kg m², 790 m/s, 254 mm right-hand twist, no Coriolis term, no jump, 100 to 400 m, with constant spin and with spin decaying as the speed.
- Earth rotation: a body released at rest in vacuum and falling 10,000 ft at 45 degrees north.
- Stability: the dynamic factor of a 168 gr bullet's launch coefficients, the damping exponents of its two yaw modes from the roots of the characteristic equation, and the two yaw modes of the spin-drift case.

## Formulas

With $K = \rho \pi d^2 c_d / (8 m)$ the flat-fire speed is $v_0 e^{-Kx}$ and the height is $x \tan\theta_0 - g (e^{2Kx} - 2Kx - 1) / (4 v_0^2 \cos^2\theta_0 K^2)$; at 1.225 kg/m³ and a G1 ballistic coefficient $BC$ in lb/in², $K = 0.00068422\,c_d / BC$ per m ([McCoy 1999](../bibliography.md#mccoy-1999), flat-fire chapter, equation numbers unverified).

In a range wind $W$ the airspeed falls as $u = u_0 / (1 + K u_0 t)$, $u_0 = v_0 - W$, and the ground distance is $W t + \ln(1 + K u_0 t)/K$. Differentiating at $W = 0$ gives the first-order change of the flight time to a fixed distance, $-W K t^2$.

The spin drift of the modified point mass in flat fire, with spin decaying as $e^{-\lambda x}$, is $z = \mathcal{K} (e^{a x} - a x - 1) / (a^2 V_0^3)$ with $a = 3k - \lambda$, $k = \rho A C_D / (2m)$ and $\mathcal{K} = C_{L\alpha} I_x p_0 g / (m d C_{M\alpha})$: the yaw of repose is proportional to $p / V^2$ and the lift to $V^2$ times the yaw, integrated twice along $x$ ([McCoy 1999](../bibliography.md#mccoy-1999), yaw of repose and drift, equation numbers unverified). Spin falling as the speed is $\lambda = k$, a spin-damping coefficient $C_{lp} = -C_D I_x / (m d^2)$.

A body falling from rest in vacuum drifts east by $\Omega g \cos\varphi\, t^3 / 3$ with $t = \sqrt{2h/g}$.

The yaw modes in radians per calibre of travel are $(P \pm \sqrt{P^2 - 4M})/2$ with $P = (I_x/I_y)(p d / V)$ and $M = \rho A d^3 C_{M\alpha} / (2 I_y)$; their sum is $P$, their product $M$, and $P^2/(4M)$ is the gyroscopic stability factor, which scales with the square of the spin ([McCoy 1999](../bibliography.md#mccoy-1999), linear theory, equation numbers unverified).

With the damping terms the complex yaw obeys $\xi'' + (H - iP)\xi' - (M + iPT)\xi = 0$ per calibre of travel. The real parts of its two roots are the damping exponents; the linear-theory forms $-\tfrac12 [H \mp P(2T - H)/(\phi'_f - \phi'_s)]$ approximate them, and both are negative exactly when $1/S_g < S_d (2 - S_d)$ with $S_d = 2T/H$ (same source). Here $H = \frac{\rho A d}{2m}\bigl(C_{L\alpha} - C_D - \frac{m d^2}{I_y}(C_{mq} + C_{m\dot\alpha})\bigr)$ is the yaw damping and $T = \frac{\rho A d}{2m}\bigl(C_{L\alpha} + \frac{m d^2}{I_x} C_{mp\alpha}\bigr)$ the lift and Magnus term, both per calibre (their ratio is the $S_d$ of [stability](../models/exterior-stability.md)), and $\phi'_f$, $\phi'_s$ are the fast and slow yaw modes $(P + \sqrt{P^2 - 4M})/2$ and $(P - \sqrt{P^2 - 4M})/2$ above.

## Numbers

- Flat-fire drop: height within $10^{-3}$ relative at 100 to 1000 m at both angles. Speed within $5 \times 10^{-5}$ up to 500 m; at 1000 m it differs by $1.04 \times 10^{-3}$ at 0.3 degrees, where the path is about 2 degrees steep and the form, which puts all drag along the line of fire, stops holding. The test allows $1.5 \times 10^{-3}$ for speed.
- Range wind: time and ground speed within $10^{-8}$ for all three winds. The first-order rule $-W K t^2$ holds within $2 \times 10^{-3}$ of the change at 0.5 m/s. The rule $t / (1 + 2W(t - R/v_0)/R)$ misses the change by 4, 8 and 13 percent at 300, 600 and 1000 m whatever the wind: it agrees with $-W K t^2$ only while $K v_0 t$ is small, so it is not used.
- Spin drift: within $10^{-3}$ of the closed form at 100 to 400 m in both cases. At 400 m the drift is 0.0272 m with spin falling as the speed and 0.0306 m with constant spin: spin decay lowers far-range drift by 11 percent.
- Free fall: 8.57 ft east, within 0.5 percent of the closed form.
- Stability: dynamic factor 0.1147 from the rounded inertia ratios (0.1148 published from the unrounded ones), `isStable(1.7035, 0.1147)` false. Rifle-scale case: gyroscopic factor 1.690, fast mode 269.9 Hz, slow mode 59.5 Hz, factor 1 at a 330 mm twist; sum, product and spin scaling within $10^{-12}$. Damping exponents of the 168 gr case at sea-level density from the roots: $-3.16 \times 10^{-4}$ (fast) and $+5.02 \times 10^{-5}$ (slow) per calibre; the linear-theory forms agree within $10^{-3}$ relative ($1 \times 10^{-4}$ and $6 \times 10^{-4}$). Over gyroscopic factors 1.2 to 20, `isStable` is true exactly where both exponents are negative (the switch lies between 4.5 and 4.8).
- Not tested: a rigid-body (six degrees of freedom) drift comparison and the published 7.62 mm earth-rotation rows at 500 to 2000 yd. Both need a public drag, lift, moment and spin-damping set over Mach for the bullet, which is not in the repository.

## Result

No change. The tests are adopted as regression tests; the range-wind time rule with $2W(t - R/v_0)/R$ is not adopted.

## Data basis

Analytic: closed forms and synthetic cases.

## Where in the app

- `packages/core/test/exterior-closed-form.test.ts`.
- `packages/core/src/exterior/trajectory.ts`, `packages/core/src/exterior/modified.ts`, `packages/core/src/exterior/stability.ts`.
- Model pages: [point mass](../models/exterior-point-mass.md), [modified point mass](../models/exterior-modified-point-mass.md).

## Confidence

High: each closed form is exact for its case or bounded by the stated approximation, and the integration agrees within the limits set before the runs.
