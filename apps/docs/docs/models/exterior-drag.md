---
title: Drag
description: Drag acceleration from a ballistic coefficient against a standard drag function or from the bullet's own drag curve, with linear or monotone cubic interpolation in Mach.
---

# Drag

The drag of a bullet enters the [point-mass model](exterior-point-mass.md) as an acceleration against the air-relative velocity. It comes from one of two inputs: a ballistic coefficient (BC) against one of the BRL standard drag functions, in one or more velocity bands, or the bullet's own drag coefficient curve against Mach number. Between the nodes of a table the drag coefficient is read linearly (default) or with a monotone cubic.

## Equations

### Drag acceleration

The drag force $\tfrac12 \rho\,v_a^2\,C_D\,A$ on the reference area $A = \pi d^2/4$ acts against the air-relative velocity $\vec v_a = \vec v - \vec w$. Divided by the mass, and written without a division by the speed:

$$
\vec a_D = -\frac{\pi}{8}\,\frac{\rho\,C_D(M)}{S}\,\lvert\vec v_a\rvert\,\vec v_a, \qquad M = \frac{\lvert\vec v_a\rvert}{a}
$$

Code: `packages/core/src/exterior/trajectory.ts`, `pointMassRhs`.

$\rho$ and $a$ are the density and speed of sound of the air at the bullet's height ([atmosphere](exterior-atmosphere.md)).

### Ballistic coefficient and drag curve

For a BC input, the bullet's drag coefficient is its form factor $i$ times the standard function $C_G$ of the named model, and the BC is $C = m/(i\,d^2)$. Both $i$ and $d$ drop out:

$$
\frac{\rho\,C_D}{m/d^2} = \frac{\rho\,i\,C_G(M)}{m/d^2} = \frac{\rho\,C_G(M)}{C}, \qquad S = \begin{cases} C & \text{BC against a standard function} \\ m/d^2 & \text{own drag curve} \end{cases}
$$

Code: `packages/core/src/exterior/trajectory.ts`, `dragBandTable` (`bands`), `packages/core/src/exterior/drag.ts`, `dragTableOf`.

A published BC in lb/in² converts exactly to kg/m²:

$$
C_{\mathrm{SI}} = C_{\mathrm{lb/in^2}} \cdot \frac{0.45359237}{0.0254^2}\ \mathrm{kg/m^2}
$$

Code: `packages/core/src/exterior/drag.ts`, `lbPerSqInToKgPerSqM`.

A BC names the reference atmosphere it was reduced to (`reference`: `icao` or `metro`). The model stores the reference and checks its value. It does not scale the drag by it: the standard functions are dimensionless and carry no air density, so every BC is used as given.

The two references differ in sea-level air density. The older US Army standard ([AMCP 706-140](../bibliography.md#amcp-706-140)) uses 0.075126 lb/ft³ (1.2034 kg/m³), the ICAO atmosphere 1.2250 kg/m³ ([ICAO 1993](../bibliography.md#icao-1993), [U.S. Standard Atmosphere, 1976](https://ntrs.nasa.gov/citations/19770009539)), 1.8 % more. A BC reduced to the older density converts to the ICAO density by the factor 1.018 (1.2250 / 1.2034). The model does not apply it, so a `metro` BC used as given can differ by up to that factor ([research log](../research/exterior-reference-air-earth-curvature.md)).

### Velocity bands

A BC input holds one or more bands $(C_k, v_k)$: band $k$ applies while the airspeed is at least $v_k$. The band with the highest threshold not above the airspeed is active, and the lowest band applies below every threshold:

$$
k = \max\{\,j : v_j \le \lvert\vec v_a\rvert\,\}, \qquad k = 0 \ \text{when no } v_j \le \lvert\vec v_a\rvert
$$

Code: `packages/core/src/exterior/trajectory.ts`, `dragBandTable` (`bandFor`).

The integrator holds the band within a step and restarts at each threshold crossing ([point-mass model](exterior-point-mass.md#numerical-method)).

### Standard drag functions

`dragTables` holds the BRL standard drag functions G1, G2, G5, G6, G7, G8, GI and the 9/16 in sphere (GS) as pairs of Mach number and drag coefficient, Mach rising from 0, with the values as printed. The tables end at Mach 5, GS at Mach 4.

Code: `packages/core/src/drag-tables.ts`, `dragTables`, `packages/core/src/exterior/drag.ts`, `dragModels`.

### Linear interpolation

Nodes $(M_j, c_j)$, $j = 0, \dots, n$, Mach strictly rising. On segment $k$, $M_k \le M \lt M_{k+1}$:

$$
C(M) = c_k + (c_{k+1} - c_k)\,\frac{M - M_k}{M_{k+1} - M_k}
$$

Code: `packages/core/src/exterior/drag.ts`, `onSegment`, `dragCoefficient`.

### Monotone cubic interpolation

With spacing $h_j = M_{j+1} - M_j$ and secant $\Delta_j = (c_{j+1} - c_j)/h_j$, the slope at an interior node is the three-point parabola slope $p_j$, limited so that the cubic stays between its node values:

$$
p_j = \frac{\Delta_{j-1} h_j + \Delta_j h_{j-1}}{h_{j-1} + h_j}, \qquad d_j = \bigl(\operatorname{sgn}\Delta_{j-1} + \operatorname{sgn}\Delta_j\bigr)\,\min\!\left(\lvert\Delta_{j-1}\rvert,\ \lvert\Delta_j\rvert,\ \tfrac12\lvert p_j\rvert\right)
$$

Code: `packages/core/src/exterior/drag.ts`, `nodeSlope`.

The end nodes take the end secants, $d_0 = \Delta_0$ and $d_n = \Delta_{n-1}$. On segment $k$, with $t = (M - M_k)/h_k$, the cubic Hermite form:

$$
C(M) = c_k\,(1 + 2t)(1 - t)^2 + h_k d_k\,t(1 - t)^2 + c_{k+1}\,t^2(3 - 2t) + h_k d_{k+1}\,t^2(t - 1)
$$

Code: `packages/core/src/exterior/drag.ts`, `onSegment`.

A segment with $c_k = c_{k+1}$ returns $c_k$. The slope limit keeps $\lvert d_j\rvert \le 2\min(\lvert\Delta_{j-1}\rvert, \lvert\Delta_j\rvert)$, inside the monotonicity region of the cubic Hermite form. So:

- the cubic stays within its two node values,
- a local extremum at a node keeps slope 0,
- a curve of non-negative nodes stays non-negative.

### Table ends

Outside the nodes the end values are held, never extrapolated:

$$
C(M) = c_0 \ \text{for}\ M \le M_0, \qquad C(M) = c_n \ \text{for}\ M \ge M_n
$$

Code: `packages/core/src/exterior/drag.ts`, `dragCoefficient`, `segmentCoefficient`, `inDragTable`.

A trajectory point whose Mach number lies outside the table is flagged `dragClamped`.

### Segments held at their node values

Within one integration step the integrator reads one table segment, extended past its nodes as the same line or cubic. A narrow segment, or (drag tables only) one steep relative to its values, is held at its node values instead, by clamping $M$ to $[M_k, M_{k+1}]$ before the segment is evaluated:

$$
M_{k+1} - M_k \lt 10^{-6} \quad \text{or} \quad \lvert c_{k+1} - c_k\rvert \gt 100\,(M_{k+1} - M_k)\,\max(\lvert c_k\rvert, \lvert c_{k+1}\rvert)
$$

Code: `packages/core/src/exterior/drag.ts`, `heldSegment` (`narrowSegment`, `steepSegment`), `segmentCoefficient`.

The extension of such a segment can reach zero or negative drag within one trial step. No segment of the standard tables meets either condition.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $\vec a_D$ | Drag acceleration | no kind | m/s² |
| $\vec v$, $\vec w$, $\vec v_a$ | Ground velocity, wind, air-relative velocity | m/s | m/s |
| $\rho$ | Air density | g/cm3 | kg/m³ |
| $a$ | Speed of sound | m/s | m/s |
| $M$ | Mach number | 1 | 1 |
| $C_D$ | Drag coefficient of the bullet on area $\pi d^2/4$ | 1 | 1 |
| $C_G$ | Drag coefficient of a standard drag function | 1 | 1 |
| $i$ | Form factor, $C_D/C_G$ | 1 | 1 |
| $m$ | Bullet mass | g | kg |
| $d$ | Reference diameter | mm | m |
| $C$, $C_k$ | Ballistic coefficient, of band $k$ | lb/in2 | kg/m² |
| $v_k$ | Lowest airspeed of band $k$ | m/s | m/s |
| $S$ | Mass per area in the drag term | lb/in2 | kg/m² |
| $M_j$, $c_j$ | Mach number and drag coefficient of node $j$ | 1 | 1 |
| $h_j$, $\Delta_j$ | Mach spacing and secant of segment $j$ | 1 | 1 |
| $d_j$ | Slope of the monotone cubic at node $j$ | 1 | 1 |

## Assumptions

- Drag acts along the air-relative velocity. The bullet flies at zero yaw (the [modified point mass](exterior-modified-point-mass.md) adds yaw-dependent forces).
- A BC input describes the bullet as a constant multiple of one standard function within each band.
- Bands are selected by airspeed, the speed the drag depends on.

## Limits

- A BC against the wrong standard function (for example a G1 BC read against G7) cannot be detected. The result names the drag model used (`dragModel`).
- A drag curve needs at least two nodes, strictly rising Mach and $C_D \ge 0$. A BC must be positive, and bands need distinct thresholds.
- With the standard tables the two interpolations differ most after the bullet turns transonic or subsonic. A sparse custom curve depends more on the choice than the standard tables.
- Research log: [monotone cubic against hand-computed values](../research/drag-monotone-cubic-closed-form.md), [reference air and Earth curvature](../research/exterior-reference-air-earth-curvature.md).

## Sources

- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), section 5.3.2.1 (drag force) and section 5.4.2.4, Eqs. 5.4:24 to 5.4:31 (ballistic coefficient, density ratio, form factor).
- [McCoy 1999](../bibliography.md#mccoy-1999): drag force and drag coefficient (chapter number unverified).
- [AMCP 706-140](../bibliography.md#amcp-706-140), pp. 3 and 4, eqs. (19), (21) and (22): practical drag coefficient, form factor and ballistic coefficient, standard air density of the US Army before 1956.
- [Ingalls 1918](../bibliography.md#ingalls-1918), introduction: ballistic coefficient and density ratio.
- [BRL standard drag functions](../bibliography.md#brl-drag-functions): the tables of `dragTables`.
- [Fritsch 1980](../bibliography.md#fritsch-1980): cubic Hermite form and the monotonicity region of its node slopes.
- [Steffen 1990](../bibliography.md#steffen-1990): the limited three-point node slopes (equation numbers unverified).
