---
title: Stability, spin drift and jump
description: Miller's gyroscopic stability factor, the dynamic stability criterion of linear theory, and the empirical spin drift and aerodynamic jump of the point-mass trajectory.
---

# Stability, spin drift and jump

A point mass has no axis, so the [point-mass trajectory](exterior-point-mass.md) takes the spin effects from separate formulas. Miller's rule estimates the gyroscopic stability factor from mass, diameter, length and twist, corrected for muzzle velocity and air. Linear theory gives the dynamic stability criterion when aerodynamic coefficients are known. Spin drift and the vertical jump from a crosswind at the muzzle come from empirical fits in the gyroscopic stability factor and are added to the integrated path. The [modified point mass](exterior-modified-point-mass.md) computes stability, drift and jump from aerodynamic coefficients instead.

## Equations

### Miller gyroscopic stability factor

Miller's rule is a fit in customary units: mass $m_{\mathrm{gr}}$ in grains, diameter $d_{\mathrm{in}}$ in inches, twist and length in calibres, $t_c = T_w/d$ and $l_c = l/d$:

$$
S_{g,0} = \frac{30\,m_{\mathrm{gr}}}{t_c^2\,d_{\mathrm{in}}^3\,l_c\,(1 + l_c^2)}
$$

Code: `packages/core/src/exterior/stability.ts`, `millerStability` (`sg`).

Corrections for the muzzle velocity and for the air at the firing point (288.15 K is 59 degF). $S_g$ scales inversely with the air density:

$$
S_g = S_{g,0}\left(\frac{v_0}{2800\ \mathrm{ft/s}}\right)^{1/3}\frac{T}{288.15\ \mathrm{K}}\,\frac{29.92\ \mathrm{inHg}}{p}
$$

Code: `packages/core/src/exterior/stability.ts`, `millerStability` (`fv`, `fa`).

The function takes SI inputs and converts them. The trajectory evaluates $S_g$ once, at the muzzle, with the station air of the shot (the zero with the air of the zero).

### Stability along the trajectory

The result gives Miller's factor at the muzzle only, with no value or warning along the path. In linear theory the gyroscopic factor is proportional to $\omega^2 / (\rho\,v^2\,C_{M_\alpha})$, with the spin rate $\omega$, the air density $\rho$, the speed $v$ and the overturning-moment slope $C_{M_\alpha}$ ([McCoy 1999](../bibliography.md#mccoy-1999), chapter numbers unverified; the same ratio is `gyroscopicStability` in `packages/core/src/exterior/modified.ts`). In flat fire the speed falls faster than the spin, so at a constant moment slope the factor rises with range:

$$
S_g(x) = S_g(0)\left(\frac{\omega(x)}{\omega_0}\right)^2\left(\frac{v_0}{v(x)}\right)^2\frac{\rho_0}{\rho(x)}\,\frac{C_{M_\alpha}(0)}{C_{M_\alpha}(x)}
$$

Code: `packages/core/src/exterior/modified.ts`, `gyroscopicStability`, evaluated at the muzzle and at a point.

Miller's rule with the speed and the air of a point behaves the other way: its speed term is $v^{1/3}$, a fit to the muzzle velocity at one twist, where the initial spin is proportional to the muzzle velocity. Along a flight the spin is not proportional to the speed, so the term has no meaning there, and its value falls with the speed while the factor of linear theory rises. For ordinary rifle loads that start above 1 at the muzzle this value fell below 1 late in a long flight, which the factor of linear theory does not do at a constant moment slope. The numbers are in [Along-path stability warning](../research/along-path-stability-warning.md).

A bullet can lose stability in flight where the moment slope rises toward Mach 1, or from a low initial spin. Both need aerodynamic coefficients that Miller's inputs do not carry. Near Mach 1 the app gives no stability warning from the path; the result lists the transonic range instead.

### Dynamic stability

From linear theory, with the lift-force slope $C_{L_\alpha}$, the drag coefficient $C_D$, the Magnus-moment slope $C_{mp_\alpha}$ and the pitch-damping sum $C_{m_q} + C_{m_{\dot\alpha}}$:

$$
S_d = \frac{2\left(C_{L_\alpha} + \dfrac{m d^2}{I_x}\,C_{mp_\alpha}\right)}{C_{L_\alpha} - C_D - \dfrac{m d^2}{I_y}\left(C_{m_q} + C_{m_{\dot\alpha}}\right)}
$$

Code: `packages/core/src/exterior/stability.ts`, `dynamicStabilityFactor`.

The bullet is stable in linear theory when it is gyroscopically stable and $S_d$ lies inside the band the gyroscopic factor allows:

$$
S_g \gt 1 \quad \text{and} \quad \frac{1}{S_g} \lt S_d\,(2 - S_d)
$$

Code: `packages/core/src/exterior/stability.ts`, `isStable`.

These coefficients come from spark-range firings, not from the Miller inputs. The trajectory result reports $S_g$ only.

### Spin drift

Lateral drift in inches after the time of flight $t$ in seconds, toward the twist hand (right for right-hand twist):

$$
D_s = 1.25\,(S_g + 1.2)\,t^{1.83}\ \mathrm{in}
$$

Code: `packages/core/src/exterior/stability.ts`, `spinDrift` (`drift`).

$S_g$ is the muzzle value of Miller's rule and $t$ the time of flight at the output point. The trajectory adds $D_s$ to the windage after integration (`correct` in `packages/core/src/exterior/trajectory.ts`).

### Aerodynamic jump

A crosswind at the muzzle deflects the trajectory vertically by a fixed angle. With $W_\perp$ the lateral wind component of the first wind segment, positive when the wind blows to the right (comes from the left):

$$
\delta_J = \mp\left(0.01\,S_g - 0.0024\,l_c + 0.032\right)\frac{W_\perp}{1\ \mathrm{mph}}\ \mathrm{MOA}
$$

Code: `packages/core/src/exterior/stability.ts`, `aerodynamicJump` (`perMph`, `jump`).

The upper sign holds for right-hand twist: wind from the left lowers the shot, wind from the right raises it. Left-hand twist mirrors this. The [point-mass trajectory](exterior-point-mass.md#outputs-per-point) adds $s\tan\delta_J$ to the height.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $m$ | Bullet mass | g | kg |
| $m_{\mathrm{gr}}$ | Bullet mass in grains, inside the Miller fit | g | grain |
| $d$ | Bullet diameter | mm | m |
| $d_{\mathrm{in}}$ | Bullet diameter in inches, inside the Miller fit | mm | in |
| $l$ | Bullet length | mm | m |
| $T_w$ | Twist length per turn | mm | m |
| $t_c$, $l_c$ | Twist and length in calibres | 1 | 1 |
| $v_0$ | Muzzle velocity | m/s | m/s |
| $v$ | Speed at a point of the flight | m/s | m/s |
| $\omega$, $\omega_0$ | Spin rate along the flight and at the muzzle | no kind | rad/s |
| $\rho$, $\rho_0$ | Air density at a point and at the firing point | g/cm3 | kg/m3 |
| $C_{M_\alpha}$ | Overturning-moment slope, positive | 1 | 1/rad |
| $T$ | Air temperature at the firing point | degC | K |
| $p$ | Station pressure | bar | Pa |
| $S_{g,0}$, $S_g$ | Gyroscopic stability factor, before and after the corrections | 1 | 1 |
| $S_d$ | Dynamic stability factor | 1 | 1 |
| $C_{L_\alpha}$ | Lift-force coefficient slope | 1 | 1 |
| $C_D$ | Drag coefficient | 1 | 1 |
| $C_{mp_\alpha}$ | Magnus-moment coefficient slope | 1 | 1 |
| $C_{m_q} + C_{m_{\dot\alpha}}$ | Pitch-damping moment coefficient sum | 1 | 1 |
| $I_x$, $I_y$ | Axial and transverse moments of inertia | no kind | kg m² |
| $t$ | Time of flight | no kind | s |
| $D_s$ | Spin drift | mm | m |
| $W_\perp$ | Lateral wind at the muzzle | m/s | m/s |
| $\delta_J$ | Aerodynamic jump angle, positive up | deg | rad |
| $s$ | Slant range | mm | m |

## Assumptions

- Miller's rule describes ordinary jacketed rifle bullets.
- $S_g$ of the trajectory result is evaluated at the muzzle, with the muzzle velocity and the station air. The rise of the overturning moment toward Mach 1 and the decay of the spin are not modelled.
- Spin drift and jump are corrections outside the integration, from fits to flat-fire rifle trajectories.

## Limits

- Plastic tips and very long or very short bullets lie outside Miller's fit.
- The result has no stability warning along the flight.
- $S_g \lt 1$ predicts a tumbling bullet. The trajectory is still computed, and the caller shows the value.
- The point mass cannot detect a dynamically unstable bullet. Dynamic stability needs the aerodynamic coefficients.
- Steep and very long flights lie outside the spin drift fit.
- Spin drift and jump are left out (`omitted`) when length, twist or twist hand is missing or the option is off.

## Sources

- [Miller 2005](../bibliography.md#miller-2005): the stability rule and its velocity and atmosphere corrections (pages unverified, the article that states each correction unverified).
- [McCoy 1999](../bibliography.md#mccoy-1999): linear theory of angular motion, the dynamic stability factor and the stability criterion, aerodynamic jump (chapter numbers unverified).
- [McCoy 1990](../bibliography.md#mccoy-1990), eq. (12), p. 9: the direction of the jump by twist hand and wind side.
- [Litz 2015](../bibliography.md#litz-2015): the spin drift fit and the aerodynamic jump fit (chapter, equation and page numbers unverified, the length unit of the jump fit unverified).
