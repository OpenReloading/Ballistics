---
title: Point-mass trajectory
description: Three-dimensional point-mass trajectory with gravity, drag, segmented wind and Earth rotation, its zeroing and its Runge-Kutta integration.
---

# Point-mass trajectory

`trajectory` integrates the flight of a bullet as a point mass in three dimensions under gravity, [drag](exterior-drag.md) and the Coriolis acceleration of the Earth's rotation, with wind in range segments and the [atmosphere](exterior-atmosphere.md) changing along the path. Time is the independent variable. The bore angles come from a zero search or are given. Spin drift and aerodynamic jump from [empirical fits](exterior-stability.md) are added to the integrated path. The option `model: 'modified-point-mass'` selects the [modified point mass](exterior-modified-point-mass.md) instead.

## Equations

### Frames

The integration frame is fixed to the ground at the firing point: $x$ horizontal along the azimuth of fire, $y$ up, $z$ horizontal to the right, origin at the sight. The line of sight rises at the look angle $\theta$. Its unit vectors, and slant range, height above the line of sight and windage of a position $\vec r$:

$$
\hat u = (\cos\theta, \sin\theta, 0), \quad \hat n = (-\sin\theta, \cos\theta, 0), \quad \hat z = (0, 0, 1), \qquad s = \vec r\cdot\hat u, \quad h = \vec r\cdot\hat n, \quad w = \vec r\cdot\hat z
$$

Code: `packages/core/src/exterior/trajectory.ts`, `fly` (`slant`), `trajectoryPointAt`.

Drop is $-h$. The line of sight is an output projection only. Gravity stays on one axis and wind stays horizontal at any look angle.

### Initial state

The bore points at elevation $\delta_e$ and windage $\delta_w$ relative to the line of sight. The muzzle lies $h_s$ below the line of sight and $o_s$ to the left of the sight, so slant range 0 is the muzzle:

$$
\hat b = \cos\delta_e\cos\delta_w\,\hat u + \sin\delta_e\,\hat n + \cos\delta_e\sin\delta_w\,\hat z, \qquad \vec r_0 = -h_s\,\hat n - o_s\,\hat z, \qquad \vec v_0 = v_0\,\hat b
$$

Code: `packages/core/src/exterior/trajectory.ts`, `fly` (`y0`).

### Equations of motion

$$
\dot{\vec r} = \vec v, \qquad \dot{\vec v} = \vec a_D + \vec g + \vec a_C, \qquad \vec g = (0, -g, 0)
$$

Code: `packages/core/src/exterior/trajectory.ts`, `pointMassRhs`.

$\vec a_D$ is the [drag acceleration](exterior-drag.md#drag-acceleration) with the air at height $y$. Gravity is constant along the path, the `gravity` option (default the standard gravity $g_0$).

The WGS 84 normal gravity at a latitude, for a caller that passes it as `gravity` (Somigliana's closed formula):

$$
g(\varphi) = \frac{9.7803253359\,(1 + 0.00193185265241\,\sin^2\varphi)}{\sqrt{1 - 0.00669437999013\,\sin^2\varphi}}\ \mathrm{m/s^2}
$$

Code: `packages/core/src/exterior/trajectory.ts`, `normalGravity`.

### Wind

Segment $k$ applies from the horizontal distance $x_{k-1}$ up to $x_k$ (the last one without end), with horizontal speed $W_k$ blowing from the direction $\beta_k$ (clockwise from the line of fire: 0 headwind, $\pi/2$ from the right) and a vertical component $W_{v,k}$:

$$
\vec w_k = \left(-W_k\cos\beta_k,\ W_{v,k},\ -W_k\sin\beta_k\right)
$$

Code: `packages/core/src/exterior/trajectory.ts`, `windTable` (`wv`, `segmentFor`).

Wind enters only the air-relative velocity $\vec v_a = \vec v - \vec w_k$ of the drag term.

### Earth rotation

At latitude $\varphi$, firing at azimuth $\alpha$ (clockwise from true north), the Earth's angular velocity in the ground frame and the Coriolis acceleration on the ground-relative velocity:

$$
\vec\Omega = \Omega_E\,(\cos\varphi\cos\alpha,\ \sin\varphi,\ -\cos\varphi\sin\alpha), \qquad \vec a_C = -2\,\vec\Omega\times\vec v
$$

Code: `packages/core/src/exterior/trajectory.ts`, `earthRotation`, `earthRotationRate`, `pointMassRhs`.

- The vertical component $\Omega_E\sin\varphi$ deflects the bullet sideways (right in the northern hemisphere).
- The horizontal component gives the Eotvos effect: fire to the east rises, fire to the west drops.
- The acceleration is integrated with the other terms, so the air turning with the Earth also damps the deflection through the drag.
- Without a latitude both parts are left out (`omitted`: `coriolis`). Without an azimuth only the vertical component is kept (`omitted`: `coriolisVertical`).

### Outputs per point

Mach number with the speed of sound at the bullet's height, kinetic energy, and path angle above the horizontal:

$$
M = \frac{\lvert\vec v - \vec w_k\rvert}{a(y)}, \qquad E = \tfrac12 m\,\lvert\vec v\rvert^2, \qquad \gamma = \operatorname{atan2}\!\left(v_y,\ \sqrt{v_x^2 + v_z^2}\right)
$$

Code: `packages/core/src/exterior/trajectory.ts`, `trajectoryPointAt`, `machOf`.

Spin drift $D_s$ and the jump angle $\delta_J$ ([stability](exterior-stability.md)) are added after integration. The holds are the angles that move the impact back onto the line of sight:

$$
h' = h + s\tan\delta_J, \qquad w' = w + D_s, \qquad \text{hold}_e = -\operatorname{atan2}(h', s), \qquad \text{hold}_w = -\operatorname{atan2}(w', s)
$$

Code: `packages/core/src/exterior/trajectory.ts`, `correct`.

The holds are 0 at $s = 0$. A point is flagged `transonic` for $0.8 \le M \le 1.2$ and `subsonic` for $M \lt 1$.

### Zeroing

The zero is the pair $(\delta_e, \delta_w)$ for which the corrected impact lies on the line of sight at the zero range $s_z$: $h'(s_z) = 0$ and $w'(s_z) = 0$. The zero uses its own look angle, air and wind. The search starts from the flat-fire vacuum estimate:

$$
\delta_e^{(0)} = \arctan\frac{h_s + g\,s_z^2\cos\theta / (2 v_0^2)}{s_z}, \qquad \delta_w^{(0)} = 0
$$

Code: `packages/core/src/exterior/trajectory.ts`, `zeroWith`, `zeroAngles`.

One linear step follows, then a secant step on the elevation and a linear step on the windage per iteration:

$$
\delta_e \leftarrow \delta_e - h'(s_z)\,\frac{\delta_e - \delta_e^{\mathrm{prev}}}{h'(s_z) - h'^{\,\mathrm{prev}}(s_z)}, \qquad \delta_w \leftarrow \delta_w - \frac{w'(s_z)}{s_z}
$$

Code: `packages/core/src/exterior/trajectory.ts`, `zeroWith`.

The search stops when both misses are below `zeroTolerance` (default $10^{-6}$ m) and fails after 30 iterations. Only the low solution is sought.

### Numerical method

`rk45` integrates the state with the Dormand-Prince 5(4) pair: seven stages, the last stage of a step is the first of the next, the fifth-order solution is propagated and the embedded fourth-order solution estimates the error. The error norm is the root mean square over the state components of the error estimate $e_i$ scaled by the tolerances, and the step is accepted when it is at most 1:

$$
\mathrm{err} = \sqrt{\frac{1}{n}\sum_{i=1}^{n}\left(\frac{e_i}{\mathrm{atol} + \mathrm{rtol}\,\max(\lvert y_i\rvert, \lvert\hat y_i\rvert)}\right)^2} \le 1
$$

Code: `packages/core/src/exterior/rk45.ts`, `rk45` (`dormandPrinceStep`, `rms`).

The next step size, with the growth limited to 1 directly after a rejected step:

$$
\Delta t_{\mathrm{new}} = \Delta t\,\min\!\left(5,\ \max\!\left(0.2,\ 0.9\,\mathrm{err}^{-1/5}\right)\right)
$$

Code: `packages/core/src/exterior/rk45.ts`, `rk45`.

Each accepted step has a fourth-order continuous extension in $\sigma \in [0, 1]$ from the stages already computed, with coefficients $r_2$ to $r_5$ per component:

$$
y_i(t + \sigma\,\Delta t) = y_i + \sigma\left(r_2 + (1 - \sigma)\left(r_3 + \sigma\left(r_4 + (1 - \sigma)\,r_5\right)\right)\right)
$$

Code: `packages/core/src/exterior/rk45.ts`, `rk45` (`denseOutput`).

An event is a scalar function $g(t, \vec y)$ with a direction. When it changes sign over a step, its root is found on the continuous extension by the Illinois variant of regula falsi to $10^{-12}$ s (`root`). At a terminal event the step is repeated from its start with the step size that ends at the root, which gives a fifth-order state there.

| Event | Function | Effect |
| --- | --- | --- |
| Requested slant range $s_j$ | $\vec r\cdot\hat u - s_j$, rising | record the point, the largest range ends the run (`done`) |
| Wind segment boundary | $x - x_k$ | restart with the next or previous segment |
| BC band threshold | $\lvert\vec v_a\rvert - v_k$ | restart with the next or previous band |
| Drag table node | $M - M_k$ for both nodes of the active segment | restart with the next or previous segment |
| Slant range stops growing | $\vec v\cdot\hat u$, falling | stop (`apex`) |
| Altitude limit | $H_s + y = 11000$ m rising, $H_s + y = -5000$ m falling | stop (`atmosphere`) |

The active wind segment, BC band and drag table segment are held fixed within a step, so no step crosses a jump or a kink of the right-hand side. After a restart the driver moves each index past every boundary the restart state has already crossed (`settle`). The run also stops at `maxTime` (`maxTime`), and fails after `maxSteps` accepted and rejected steps or below a step of $10^{-12}$ s.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $\vec r = (x, y, z)$ | Position from the sight: downrange, up, right | mm | m |
| $\vec v$ | Ground-relative velocity | m/s | m/s |
| $v_0$ | Muzzle velocity along the bore | m/s | m/s |
| $\theta$ | Look angle of the line of sight | deg | rad |
| $\hat u$, $\hat n$, $\hat z$ | Unit vectors of the line-of-sight frame | 1 | 1 |
| $s$ | Slant range along the line of sight | mm | m |
| $h$, $w$ | Height above and windage right of the line of sight | mm | m |
| $h'$, $w'$ | Height and windage with jump and spin drift | mm | m |
| $\delta_e$, $\delta_w$ | Bore elevation and windage to the line of sight | deg | rad |
| $h_s$, $o_s$ | Sight height above the bore, sight offset right of the bore | mm | m |
| $g$ | Gravity | no kind | m/s² |
| $\varphi$, $\alpha$ | Latitude, azimuth of fire | deg | rad |
| $\Omega_E$ | Earth rotation rate, $7.292115\times10^{-5}$ rad/s | no kind | rad/s |
| $W_k$, $W_{v,k}$ | Horizontal and vertical wind speed of segment $k$ | m/s | m/s |
| $\beta_k$ | Direction the wind of segment $k$ blows from | deg | rad |
| $x_k$ | Horizontal distance where wind segment $k$ ends | mm | m |
| $M$ | Mach number | 1 | 1 |
| $a$ | Speed of sound | m/s | m/s |
| $m$ | Bullet mass | g | kg |
| $E$ | Kinetic energy | J | J |
| $\gamma$ | Path angle above the horizontal | deg | rad |
| $s_z$ | Zero range | mm | m |
| $t$, $\Delta t$ | Time of flight, integrator step size | no kind | s |
| $\sigma$ | Fraction of a step | 1 | 1 |
| $r_2$ to $r_5$ | Coefficients of the continuous extension, per component | no kind | m or m/s |
| $e_i$, $y_i$, $\hat y_i$ | Error estimate, state at the start and at the end of a step, component $i$ | no kind | m or m/s |
| $n$ | Length of the state | 1 | 1 |
| $\mathrm{err}$ | Error norm of a step | 1 | 1 |
| $\mathrm{rtol}$ | Relative tolerance of the integrator | 1 | 1 |
| $\mathrm{atol}$ | Absolute tolerance of the integrator | no kind | m, m/s or rad/s |
| $H_s$ | Altitude of the firing point | mm | m |

## Assumptions

- The bullet is a point mass flying at zero yaw. Spin drift and jump come from fits outside the integration.
- Flat Earth: gravity keeps its direction and magnitude along the path.
- Wind is constant over each horizontal range segment and does not change with height or time.
- The muzzle velocity is relative to the ground, along the bore.
- The zero includes spin drift and jump, as an actual zero on a target does.

## Limits

- No Earth curvature. The direction error of gravity grows with range over the Earth radius $R$: $x/R$ = 0.157 mrad at 1000 m with $R$ = 6357 km. A run with gravity pointing to the Earth's centre moved the height at 1000 m by 0.02 mm (0.00002 mrad) and at 1828.8 m (2000 yd) by 0.84 mm (0.0005 mrad), against the run with constant gravity (G7 BC 0.3 lb/in², 850 m/s, zero at 100 m). Both are far below 0.1 mrad ([research log](../research/exterior-reference-air-earth-curvature.md)).
- No terrain: the run ends at the last requested range, at the apex of the slant range, at the altitude limits, at `maxTime`, or (modified point mass) at the yaw limit. Ranges not reached are left out of the result.
- No wind gradient with height, no scope cant, no change of the gyroscopic stability along the path.
- The zero search also fails when the zero range is not reached.

## Sources

- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), section 5.3.1 (gravity, centrifugal and Coriolis accelerations, Eqs. 5.3:10 to 5.3:14), section 5.3.2 (drag), section 5.4.1 (equations of motion), section 5.4.4.1 (wind), section 5.4.7 (zeroing as a boundary-value problem).
- [McCoy 1999](../bibliography.md#mccoy-1999): point-mass trajectory, wind and Coriolis (chapter numbers unverified).
- [NIMA 2000](../bibliography.md#nima-2000): WGS 84 Earth rotation rate and the normal gravity formula.
- [Dormand 1980](../bibliography.md#dormand-1980): the embedded Runge-Kutta 5(4) pair.
- [Shampine 1986](../bibliography.md#shampine-1986): the continuous extension of the pair.
- [Hairer 1993](../bibliography.md#hairer-1993), section II.4 (step size control and starting step), section II.5 (the Dormand-Prince pair), section II.6 (dense output and discontinuities).
