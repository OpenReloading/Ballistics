---
title: Modified point mass
description: Static modified point-mass trajectory of a spin-stabilised bullet, with the yaw of repose, lift, Magnus force, spin decay and the jump of linear theory.
---

# Modified point mass

The modified point mass adds the yaw of repose of a spinning bullet to the [point-mass trajectory](exterior-point-mass.md). On a curving path the overturning moment makes the spin axis precess to a small, nearly steady yaw. Lift and Magnus force on that yaw move the bullet sideways (spin drift) and change its height. The model is the static variant: the yaw follows from the current state alone, without a yaw rate, and is integrated with the point-mass equations and an equation for the axial spin. It runs when `trajectory` gets `model: 'modified-point-mass'` and the projectile carries `aerodynamics`.

## Equations

### State and initial spin

The state is the point-mass state, position $\vec r$ and velocity $\vec v$ in the ground frame (x downrange, y up, z right), plus the axial spin rate $p$, positive for a right-hand twist. At the muzzle the spin follows from the twist, with the plus sign for a right-hand twist:

$$
p_0 = \pm \frac{2 \pi v_0}{T}
$$

Code: `packages/core/src/exterior/trajectory.ts`, `resolveAero` (`spin0`).

### Yaw of repose

With the air-relative velocity $\vec v_a = \vec v - \vec w$, the airspeed $V = \lvert \vec v_a \rvert$ and the point-mass acceleration $\vec a_\text{PM}$ (drag, gravity and Coriolis, see [point mass](exterior-point-mass.md)) taken as the rate of change of $\vec v_a$:

$$
\vec\alpha_R = -\frac{2 I_x p \, (\vec v_a \times \vec a_\text{PM})}{\rho A d \, C_{M\alpha}(M) \, V^4}, \qquad A = \frac{\pi d^2}{4}, \qquad M = \frac{V}{a}
$$

Code: `packages/core/src/exterior/modified.ts`, `yawOfRepose`, `packages/core/src/exterior/trajectory.ts`, `modifiedPointMassRhs`.

The vector is perpendicular to $\vec v_a$, its length is the yaw angle. At $V = 0$ it is zero. For a right-hand twist in level fire it points to the right.

### Lift, Magnus force and spin decay

The acceleration of the bullet is the point-mass acceleration plus lift along the yaw and the Magnus force perpendicular to yaw and airflow:

$$
\dot{\vec v} = \vec a_\text{PM} + \frac{\rho A}{2 m} C_{L\alpha}(M) \, V^2 \, \vec\alpha_R - \frac{\rho A d}{2 m} \, p \, C_{N_{p\alpha}}(M) \, (\vec\alpha_R \times \vec v_a)
$$

Code: `packages/core/src/exterior/trajectory.ts`, `modifiedPointMassRhs`.

The spin decays by the spin-damping moment:

$$
\dot p = \frac{\rho A d^2}{2 I_x} \, C_{l_p}(M) \, V \, p
$$

Code: `packages/core/src/exterior/trajectory.ts`, `modifiedPointMassRhs`.

Without `magnusForceSlope` the Magnus term is zero, without `spinDamping` the spin stays $p_0$. Both are then listed in `omitted` (`magnus`, `spinDecay`).

### Coefficients over Mach

Each coefficient is a constant or a table of Mach nodes, linear between the nodes and held at the end values outside:

$$
C(M) = C_k + (C_{k+1} - C_k) \frac{M - M_k}{M_{k+1} - M_k}, \qquad M_k \le M \lt M_{k+1}
$$

Code: `packages/core/src/exterior/modified.ts`, `coefficientAt`, `packages/core/src/exterior/trajectory.ts`, `modifiedPointMassRhs` (`coefficient`), `machGrid` (`grid`).

The integrator runs on the union of the Mach nodes of the drag table and every coefficient table and restarts at each node, so no step crosses a kink.

### Moments of inertia estimate

Without a given axial or transverse moment of inertia, the bullet is taken as a uniform solid cylinder of its mass, diameter and length:

$$
I_x = \frac{m d^2}{8}, \qquad I_y = m \left( \frac{d^2}{16} + \frac{l^2}{12} \right)
$$

Code: `packages/core/src/exterior/modified.ts`, `cylinderInertia`, `packages/core/src/exterior/trajectory.ts`, `estimateInertias`.

### Moments of inertia from the outline

With the outline of the bullet (diameter, length, nose length, $R_t/R$, boat-tail length, base and meplat diameter, the shape of [outline drag](exterior-outline-drag.md)) and its mass, the moments of a body of revolution of uniform density follow from the profile $r(z)$ measured from the base:

$$
V = \pi \int r^2 dz, \qquad I_x = \frac{\pi \rho}{2} \int r^4 dz, \qquad I_y = \rho \int \left( \frac{\pi r^4}{4} + \pi r^2 (z - z_\mathrm{cm})^2 \right) dz, \qquad \rho = \frac{m}{V}
$$

Code: `packages/core/src/exterior/outline-inertia.ts`, `outlineInertia`.

with $z_\mathrm{cm} = \pi \int r^2 z \, dz / V$. The split of density between jacket and core is not known from the outline, so the result is an estimate. [Research entry](../research/bullet-inertia-from-outline.md): on the 168 grain demo outline both moments fall below the cylinder, by 14 and 33 percent.

### Gyroscopic stability and the overturning-moment estimate

The gyroscopic stability factor of linear theory:

$$
S_g = \frac{2 I_x^2 p^2}{\pi I_y \rho V^2 d^3 C_{M\alpha}}
$$

Code: `packages/core/src/exterior/modified.ts`, `gyroscopicStability`, `packages/core/src/exterior/trajectory.ts`, `trajectory`.

The run reports it at the muzzle ($p = p_0$, $V = v_0$, station air, coefficients at $M_0 = v_0 / a$).

Without a given $C_{M\alpha}$, the same relation is solved for it at the muzzle, with $S_g$ from Miller's rule ([stability](exterior-stability.md)):

$$
C_{M\alpha} = \frac{2 I_x^2 p_0^2}{\pi I_y \rho v_0^2 d^3 S_{g,\text{Miller}}}
$$

Code: `packages/core/src/exterior/modified.ts`, `momentSlopeFromStability`, `packages/core/src/exterior/trajectory.ts`, `estimateMomentSlope` (`millerStability`).

The estimated inputs are listed in `estimated` of the result (`axialInertia`, `transverseInertia`, `momentSlope`).

### Spin drift column

Spin drift is part of the integrated windage. The reported spin drift at slant range $R$ is the windage minus the windage of a point-mass run with the same bore angles, air, wind and options:

$$
s(R) = z_\text{MPM}(R) - z_\text{PM}(R)
$$

Code: `packages/core/src/exterior/trajectory.ts`, `trajectory` (`twin`), `correct`.

The empirical spin-drift fit of the point mass is not applied.

### Aerodynamic jump

The static yaw has no memory, so the jump that a crosswind at the muzzle causes through the first yaw cycles is added after the integration, from linear theory:

$$
\delta_J = -\frac{I_x p_0}{m d v_0} \, \frac{C_{L\alpha}(M_0)}{C_{M\alpha}(M_0)} \, \frac{W_\perp}{v_0}, \qquad W_\perp = -w \sin \phi_w
$$

Code: `packages/core/src/exterior/modified.ts`, `linearJump`, `packages/core/src/exterior/trajectory.ts`, `correct` (`crosswind`).

$W_\perp$ is the component of the first wind segment toward the right ($w$ its speed, $\phi_w$ the direction it blows from, clockwise from the line of fire). A right-hand twist with wind from the left gives a downward jump. The jump adds to the height at each range:

$$
h_J(R) = R \tan \delta_J
$$

Code: `packages/core/src/exterior/trajectory.ts`, `correct` (`jumpAngle`).

### Yaw limit

The run stops with stop reason `yaw` when the yaw reaches the limit, at the muzzle, after a restart or by a rising crossing during a step:

$$
\lvert \vec\alpha_R \rvert \ge \alpha_\text{max}, \qquad \alpha_\text{max} = 0.1 \ \text{rad by default}
$$

Code: `packages/core/src/exterior/trajectory.ts`, `fly` (`yawAt`), `trajectoryDefaults` (`maxYaw`).

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $\vec r$, $R$ | Position, slant range | mm | m |
| $\vec v$, $v_0$ | Ground-relative velocity, muzzle velocity | m/s | m/s |
| $\vec w$, $w$ | Wind velocity, wind speed | m/s | m/s |
| $\vec v_a$, $V$ | Air-relative velocity, airspeed | m/s | m/s |
| $W_\perp$ | Crosswind of the first wind segment, positive to the right | m/s | m/s |
| $\phi_w$ | Direction the wind blows from, clockwise from the line of fire | deg | rad |
| $a$ | Local speed of sound | m/s | m/s |
| $M$, $M_0$ | Mach number, at the muzzle | 1 | 1 |
| $\rho$ | Local air density | g/cm3 | kg/m3 |
| $m$ | Bullet mass | g | kg |
| $d$ | Reference diameter | mm | m |
| $l$ | Bullet length | mm | m |
| $A$ | Reference area | mm2 | m2 |
| $T$ | Twist length per turn | mm | m |
| $p$, $p_0$ | Axial spin rate, at the muzzle | no kind | rad/s |
| $I_x$, $I_y$ | Axial and transverse moment of inertia about the centre of mass | no kind | kg m2 |
| $\vec a_\text{PM}$ | Point-mass acceleration | no kind | m/s2 |
| $\vec\alpha_R$ | Yaw of repose | deg | rad |
| $\alpha_\text{max}$ | Yaw at which the run stops | deg | rad |
| $C_{L\alpha}$ | Lift-force slope | 1 | 1/rad |
| $C_{M\alpha}$ | Overturning-moment slope, positive | 1 | 1/rad |
| $C_{N_{p\alpha}}$ | Magnus-force slope | 1 | 1/rad |
| $C_{l_p}$ | Spin-damping coefficient, negative | 1 | 1 |
| $S_g$ | Gyroscopic stability factor | 1 | 1 |
| $s$ | Spin drift | mm | m |
| $z$ | Windage, right of the line of sight | mm | m |
| $\delta_J$ | Aerodynamic jump angle, positive up | deg | rad |
| $h_J$ | Jump added to the height | mm | m |

## Assumptions

- The yaw is quasi-steady: its rate and acceleration are neglected, so it depends on the state alone.
- The yaw of repose uses the point-mass acceleration, not the acceleration including lift and Magnus force.
- Small-yaw linear aerodynamics: forces proportional to the yaw, no cubic or higher terms.
- $C_{M\alpha} > 0$ at every Mach node: a spin-stabilised bullet. A non-positive value is refused.
- The Magnus and spin-damping coefficients refer to the non-dimensional spin $p d / V$.
- Wind is constant within each segment, so the rate of change of $\vec v_a$ equals that of $\vec v$.
- Zero-yaw drag is the projectile's drag input, as in the point mass.

## Limits

- No epicyclic motion and no dynamic stability along the path. The dynamic variant that keeps the yaw rate is not implemented.
- No yaw drag, no Magnus moment, no pitch damping, no jump from an initial yaw rate.
- A wind change downrange gives no vertical deflection.
- The cylinder estimate puts more mass far from the axis and at the ends than an ogive or boat-tail bullet has, so it overestimates both moments of inertia.
- The overturning-moment estimate is one constant from Miller's rule at the muzzle, not a function of Mach.
- Near the apex of steep fire the quasi-static yaw grows with $V^{-3}$. The yaw limit ends the run there.
- When the point-mass twin run stops before a range the modified run reached, the spin drift column is not a number there.
- The model needs `liftSlope`, the twist and the twist hand. A missing moment of inertia or overturning moment needs the bullet length.

## Sources

- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), section 5.5.2.3 (static modified point mass, Eqs. 5.5:43 and 5.5:44), section 5.5.2.2 (spin decay, Eqs. 5.5:41 and 5.5:42), section 5.5.2.4 (dynamic variant, not implemented), section 2.2 (moment of inertia, Eq. 2.2:24), section 5.6.3 (gyroscopic stability factor, Eq. 5.6:10).
- [Lieske 1966](../bibliography.md#lieske-1966): the static modified point mass, cited after Kneubuehl 2018, section 5.5.2.3 (not read).
- [STANAG 4355](../bibliography.md#stanag-4355), equation numbers of its adoption ČOS 109001: section 7, eq. (10) and eq. (27) (Magnus force), eq. (11) (spin decay), eq. (13) (initial spin), eq. (14) (yaw of repose, without the cubic moment term), eq. (17) (velocity change at a wind change, same size and direction as the jump), eq. (26) (lift), note 12, eqs. (95a) to (97b) (definition of the Magnus and spin-damping coefficients).
- [McCoy 1999](../bibliography.md#mccoy-1999): modified point-mass trajectory, linearized angular motion and aerodynamic jump (chapter numbers unverified).
- [McCoy 1990](../bibliography.md#mccoy-1990), eq. (12), p. 10: vertical deflection from a crosswind, the same size and sign as $R \tan \delta_J$.
- [Miller 2005](../bibliography.md#miller-2005): the stability factor from which the overturning moment is estimated (pages unverified).
