---
title: Drag estimate from the outline
description: Zero-yaw drag coefficient against Mach number estimated from the outline of a bullet, as a sum of head, skin friction, band, boat-tail and base drag.
---

# Drag estimate from the outline

`estimateDragFromOutline` estimates the zero-yaw drag coefficient $C_{D0}$ of a body of revolution at a list of Mach numbers from its outline: diameter, length, nose length and shape, meplat, boat tail and base. The method is the semi-empirical one of McCoy's report ARBRL-TR-02293: each part of the drag comes from a similarity rule or a fit to firings, and the parts add up. The result is a table that the [point mass](exterior-point-mass.md) takes as a custom drag curve, with one standard deviation per node and warnings where the outline or the Mach numbers lie outside the stated range of the method. It is an estimate, not a measured curve.

## Equations

All lengths are in calibers (divided by the reference diameter $d$). $L_T$ is the overall length, $L_N$ the nose length to the meplat plane, $L_{BT}$ the boat-tail length, $d_B$, $d_M$ and $d_{RB}$ the base, meplat and band diameters ($d_B \gt 1$ for a flare), $r = R_T / R$ the head shape (0 cone, 1 tangent ogive, secant ogives between).

### Total

$$
C_{D0} = C_{DH} + C_{DSF} + C_{DRB} + C_{DBT} + C_{DB}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `estimateDragFromOutline` (`nodes`).

The head part $C_{DH}$ includes the meplat term. The reference area is $\pi d^2 / 4$, the same as for the drag tables.

### Head

Thickness ratio of the nose:

$$
\tau = \frac{1 - d_M}{L_N}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `estimateDragFromOutline` (`tau`).

Supersonic ($M \gt 1$), a similarity rule in $\tau\sqrt{M^2 - 1}$ with fit constants $c_1$ to $c_4$ that are linear or quadratic in $r$. Below $M_f$ the similarity variable is held at its value there:

$$
C_{DH} = \frac{c_1(r) - c_2(r)\,\tau^2}{\zeta^2} \, (\tau \zeta)^{c_3(r) + c_4(r)\,\tau}, \qquad \zeta = \sqrt{\max(M, M_f)^2 - 1}, \qquad M_f = 1 + 0.368\,\tau^{1.85}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `headSupersonic`.

Subsonic and transonic ($M \le 1$), zero up to a critical Mach number that falls with the thickness ratio:

$$
C_{DH} = \begin{cases} 0, & M \le M_c \\ 0.368\,\tau^{1.8} + 1.6\,\tau\,\chi, & M \gt M_c \end{cases}, \qquad M_c = \left(1 + 0.552\,\tau^{0.8}\right)^{-1/2}, \qquad \chi = \frac{M^2 - 1}{2.4\,M^2}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `headTransonic`.

Meplat: the stagnation pressure on the flat face, from the isentropic stagnation pressure below Mach 1 and the pitot pressure behind a normal shock above, times a leakage factor $K$:

$$
\frac{P_0}{p} = \begin{cases} \left(1 + 0.2 M^2\right)^{3.5}, & M \le 1 \\ \left(1.2 M^2\right)^{3.5} \left(\dfrac{6}{7 M^2 - 1}\right)^{2.5}, & M \gt 1 \end{cases}, \qquad C_{DM} = K(M) \, \frac{1.122 \, (P_0/p - 1) \, d_M^2}{M^2}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `meplat` (`pitot`, `face`).

$$
K(M) = \begin{cases} 0, & M \le 0.91 \\ 0.254 + 2.88\,\chi, & 0.91 \lt M \lt 1.41 \\ 0.85, & M \ge 1.41 \end{cases}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `meplat`.

The factor 1.122 is $(\pi/4)(2/\gamma)$ with $\gamma = 1.4$. Above Mach 1.41 the report gives $K = 0.85$ in one place and 0.75 in its text. The code uses 0.85.

### Boat tail

With the boat-tail slope $t_B$ and a factor $r_{BT}$ for the length of the boat tail:

$$
t_B = \frac{1 - d_B}{2 L_{BT}}, \qquad r_{BT} = 1 - e^{-2 L_{BT}} + 2 t_B \left( e^{-2 L_{BT}} \left(L_{BT} + \tfrac{1}{2}\right) - \tfrac{1}{2} \right)
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `boatTail` (`tb`, `rbt`).

Subsonic and transonic, zero up to Mach 0.85:

$$
C_{DBT} = \begin{cases} 0, & M \le 0.85 \\ \dfrac{2 (2 t_B^2 + t_B^3) \, r_{BT}}{0.564 + 1250\,\chi^2}, & 0.85 \lt M \le 1 \\ 2 (2 t_B^2 + t_B^3) \, r_{BT} \, (1.774 - 9.3\,\chi), & 1 \lt M \le 1.1 \end{cases}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `boatTail`.

Supersonic ($M \gt 1.1$), with $\beta = \sqrt{M^2 - 1}$, a recovery factor $k$ and a term $a_1$ for the flow arriving from the head over the cylinder:

$$
C_{DBT} = \frac{4 A t_B}{k} \left( 1 - e^{-k L_{BT}} + 2 t_B \left( e^{-k L_{BT}} \left(L_{BT} + \frac{1}{k}\right) - \frac{1}{k} \right) \right), \qquad k = \frac{0.85}{\beta}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `boatTail` (`k`, `e`).

$$
A = a_1 \, e^{-1.1952 (L_T - L_N - L_{BT}) / M} - \frac{(2.4 M^4 - 4 \beta^2) \, t_B^2}{2 \beta^4} + \frac{2 t_B}{\beta}, \qquad a_1 = \left(1 - \frac{0.6\,r}{M}\right) \left( \frac{5 \tau}{6 \beta} + \frac{\tau^2}{4} - \frac{0.7435}{M^2} (\tau M)^{1.6} \right)
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `boatTail`.

A flat base ($L_{BT} = 0$) has no boat-tail drag.

### Skin friction

Reynolds number over the body length at sea level and 15 °C, with the diameter in mm:

$$
Re = 23296.3 \, M \, L_T \, d_\text{mm}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `skinFriction` (`re`).

Flat-plate friction coefficients, turbulent and laminar, each with a compressibility factor:

$$
C_{fT} = \frac{0.455}{(\log_{10} Re)^{2.58}} \left(1 + 0.21 M^2\right)^{-0.32}, \qquad C_{fL} = \frac{1.328}{\sqrt{Re}} \left(1 + 0.12 M^2\right)^{-0.12}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `skinFriction` (`cfT`, `cfL`).

Wetted areas of the nose and of the rest of the body, in square calibers, and the friction drag:

$$
S_N = \frac{\pi}{2} L_N \left(1 + \left(0.333 + \frac{0.02}{L_N^2}\right) r \right) \left(1 + \frac{1}{8 L_N^2}\right), \qquad S_C = \pi (L_T - L_N)
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `skinFriction` (`sNose`, `sCyl`).

$$
C_{DSF} = \frac{4}{\pi} \left( C_{fN} S_N + C_{fT} S_C \right)
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `skinFriction`.

$C_{fN}$ is $C_{fL}$ with a laminar nose and $C_{fT}$ otherwise. Without `boundaryLayer` the nose is laminar and the afterbody turbulent below a diameter of 20 mm, both turbulent from 20 mm.

Code: `packages/core/src/exterior/outline-drag.ts`, `estimateDragFromOutline` (`laminarNose`).

### Base

Base pressure over free-stream pressure, from a fit in Mach number with corrections for the afterbody length and the base diameter, and the base drag:

$$
\frac{p_B}{p_\infty} = P(M) \left(1 + 0.09 M^2 \left(1 - e^{L_N - L_T}\right)\right) \left(1 + 0.25 M^2 (1 - d_B)\right)
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `basePressure`.

$$
P(M) = \begin{cases} \left(1 + 0.1875 M^2 + 0.0531 M^4\right)^{-1}, & M \lt 1 \\ \left(1 + 0.2477 M^2 + 0.0345 M^4\right)^{-1}, & M \ge 1 \end{cases}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `basePressure`.

$$
C_{DB} = \frac{1.4286}{M^2} \left(1 - \frac{p_B}{p_\infty}\right) d_B^2
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `estimateDragFromOutline` (`baseDrag`).

1.4286 is $2/\gamma$ for $\gamma = 1.4$, rounded.

### Rotating band

$$
C_{DRB} = (d_{RB} - 1) \cdot \begin{cases} M^{12.5}, & M \lt 0.95 \\ 0.21 + 0.28 / M^2, & M \ge 0.95 \end{cases}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `band`.

Without a band ($d_{RB} = 1$) the part is zero.

### Standard deviation per node

One standard deviation of $C_{D0}$ as a fraction of $C_{D0}$, linear between readings $(M_j, s_j)$ of the report's error curve and held at the end readings outside (6 % at Mach 0.5 rising to 11 % at 0.95, 8 % at 1.0, 4 % at 1.1 to 1.3, 3.5 % at 1.4, 3 % from 1.8):

$$
\frac{\sigma}{C_{D0}}(M) = s_j + (s_{j+1} - s_j) \frac{M - M_j}{M_{j+1} - M_j}, \qquad M_j \le M \le M_{j+1}
$$

Code: `packages/core/src/exterior/outline-drag.ts`, `relativeSd` (`sdPercent`).

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $d$, $d_\text{mm}$ | Reference diameter | mm | m (mm in $Re$) |
| $L_T$ | Overall length over $d$ | 1 | 1 |
| $L_N$ | Nose length to the meplat plane over $d$ | 1 | 1 |
| $L_{BT}$ | Boat-tail or flare length over $d$ | 1 | 1 |
| $d_B$, $d_M$, $d_{RB}$ | Base, meplat and band diameter over $d$ | 1 | 1 |
| $r$ | Head shape $R_T / R$ | 1 | 1 |
| $\tau$ | Thickness ratio of the nose | 1 | 1 |
| $M$ | Mach number | 1 | 1 |
| $M_f$, $M_c$ | Mach numbers where the head rules change | 1 | 1 |
| $\chi$, $\zeta$, $\beta$ | Mach functions of the similarity rules | 1 | 1 |
| $c_1$ to $c_4$ | Fit constants of the supersonic head rule | 1 | 1 |
| $P_0 / p$ | Stagnation pressure on the meplat over static pressure | 1 | 1 |
| $K$ | Meplat leakage factor | 1 | 1 |
| $t_B$ | Boat-tail slope | 1 | 1 |
| $r_{BT}$, $k$, $A$, $a_1$ | Terms of the boat-tail rules | 1 | 1 |
| $Re$ | Reynolds number over the body length | 1 | 1 |
| $C_{fT}$, $C_{fL}$, $C_{fN}$ | Turbulent, laminar and nose friction coefficients | 1 | 1 |
| $S_N$, $S_C$ | Wetted areas of nose and afterbody, in square calibers | 1 | 1 |
| $p_B / p_\infty$ | Base pressure over free-stream pressure | 1 | 1 |
| $P(M)$ | Base pressure fit for a long cylinder | 1 | 1 |
| $\gamma$ | Ratio of specific heats of air | 1 | 1 |
| $C_{D0}$ | Zero-yaw drag coefficient | 1 | 1 |
| $C_{DH}$, $C_{DM}$, $C_{DSF}$, $C_{DRB}$, $C_{DBT}$, $C_{DB}$ | Head, meplat, skin friction, band, boat-tail and base parts | 1 | 1 |
| $\sigma / C_{D0}$ | Relative standard deviation of the estimate | 1 | 1 |

## Assumptions

- The body is a body of revolution: a nose (cone, tangent or secant ogive) with an optional flat meplat, a cylinder, an optional conical boat tail or flare, an optional rotating band.
- Zero yaw.
- The Reynolds number is that of sea level at 15 °C. The estimate does not change with air density or temperature.
- A hollow point or a plastic tip is seen as its outline only: a hollow point is a meplat.

## Limits

- Stated range of validity: Mach 0.5 to 5, reference diameter 4 to 400 mm. Outside, the result carries `mach-range` or `diameter-range`.
- The standard deviation per node is the error the report states for the method. The report names boat-tailed bodies for its largest transonic errors.
- Further warnings: `nose-short` (nose under 1 caliber), `boat-tail-long` (boat tail over 1.5 calibers), `base-small` (base under 0.65 caliber), `base-pressure-negative` (a flare too steep for the base pressure fit). The result is returned with the warning.
- An outline the method cannot take is refused with an `InputError`:
  - a head shape outside 0 to 1,
  - a meplat not under the diameter,
  - a band under the diameter,
  - nose and boat tail longer than the body,
  - any node whose drag is not finite and positive (a boat tail that is a step, a nose of almost no length, Mach near 0).
- Not covered: a sub-caliber boom tail, a hemispherical nose (too blunt for the head rules), yaw drag.
- The standard deviation curve is read from a plot to about 0.5 percentage points.

## Sources

- [McCoy 1981](../bibliography.md#mccoy-1981): abstract, p. 3 (range of validity and stated errors), section II, p. 10 (sum of the parts), eqs. 2 and 3, pp. 13 to 14 (supersonic head drag, thickness ratio), eq. 4, p. 14 (meplat), eq. 8, p. 16 (transonic head drag), eqs. 9 and 10, pp. 16 to 18 (boat tail), Figure 6, p. 18 (rotating band), eqs. 11 to 17, pp. 18 to 20 (skin friction, boundary layer options), eqs. 18 and 19, p. 21 (base pressure and base drag), eq. 20, p. 27 (head shape $R_T/R$), section VIII, p. 24 (error), Figure 25, p. 56 (standard deviation against Mach), Figures 26 to 28, pp. 57 to 59 (output Mach numbers), program listing, pp. 63 to 64 (constants and Mach cut-offs the text leaves out). Page numbers are those of the PDF file.
- Research log: [bullet inertia from the outline](../research/bullet-inertia-from-outline.md).
