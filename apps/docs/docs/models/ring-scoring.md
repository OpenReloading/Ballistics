---
title: Ring scoring
description: Ring value, tenth-ring value and inner ten of a shot on a rule-book target face, and the fit of a face to points marked on its rings.
---

# Ring scoring

Ring scoring gives each shot on a target face:

- the value of the highest ring its hole touches
- the tenth-ring value, where the face's rules allow it
- whether it is an inner ten

A face is placed on the target sheet by fitting its centre and scale to points marked on two or more of its rings. Face records hold ring diameters in mm. Shots are hole centres in target m from the face centre. The face and event of a group come from the target mapping of the discipline picked ([Federations, disciplines and target mappings](../data/federations.md)). The code is in `apps/web/src/lib/ring-scoring.ts`.

## Equations

### Scored hole

The scored hole has the radius $g$, 0 for an event that counts the hole centre (`scoring: centre`). An event with `scoring: touch`, or none where the rule book does not state the rule, counts the hole edge. $G$ is the gauge diameter of the event, else of the discipline's target mapping, where the rules fix one. $d_b$ is the bullet diameter of the load, else the marker diameter of the sheet:

$$
g = \begin{cases} 0 & \text{centre scoring} \\ G/2 & \text{gauge given} \\ d_b/2 & \text{otherwise} \end{cases}
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `scoredHoleDiameter`.

### Ring value

A hole centred at distance $d$ from the face centre touches ring $n$ (radius $R_n$, half its diameter) when

$$
d \le R_n + g + \varepsilon
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `scoreShot` (`touch`).

with $\varepsilon = 10^{-12}$ m ($10^{-9}$ mm), so a hole edge on a ring line counts as touching it despite binary rounding. The shot scores the value $v_n$ of the innermost ring touched, 0 when it touches none.

### Inner ten

The inner ten counts only for a shot in the innermost ring. With the inner-ten radius $R_X$:

- `cover`: the hole covers the inner-ten circle completely.
- `touch`, or no rule on the record (the rule book does not state one): the hole touches it.

$$
\text{cover: } d + R_X \le g + \varepsilon, \qquad \text{touch: } d \le R_X + g + \varepsilon
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `scoreShot`.

### Tenth-ring value

On faces whose rule book allows decimal scoring (`decimal: true`), each ring's scoring area is divided into ten equal parts counted inward from the touching position. For a hole in ring $n$ with ring width $w_n = R_n - R_{n+1}$ (for the innermost ring $w = R_{n-1} - R_n$):

$$
\text{decimal} = v_n + \frac{1}{10} \min\left(9,\, \max\left(0,\, \left\lfloor 10\, \frac{R_n + g - d}{w_n} + 10^{-9} \right\rfloor\right)\right)
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `scoreShot` (`depth`, `tenth`).

A face with `decimal: false`, or none where the rule book does not state it, is scored in whole rings.

Where the innermost zone, of radius $R_\mathrm{last} + g$, is wider than one ring width, the rule books do not state how the extra width is divided. The app then counts tenths of the ring width from the touching edge inward and gives .9 to the rest of the centre. That case is flagged by

$$
R_\mathrm{last} + g \gt R_\mathrm{last-1} - R_\mathrm{last} + \varepsilon
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `usesOwnTenthRule`.

### Group total

The total adds the ring values of the included shots. The decimal total adds the tenth-ring values as whole tenths, so it carries no rounding error:

$$
T = \sum_i v_i, \qquad T_\mathrm{dec} = \frac{1}{10} \sum_i \operatorname{round}(10\, \text{decimal}_i)
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `scoreGroup`, `scoreGroupOnFace`.

### Fit of a face to its rings

A point $p = (x, y)$ marked on a ring of radius $R$ satisfies $\lvert p - c \rvert = s R$ for the face centre $c$ and the scale $s$. Squared, with $u = s^2$ and $t = \lvert c \rvert^2$ taken as a free unknown, this is linear in $(c_x, c_y, u, t)$:

$$
2x\, c_x + 2y\, c_y + R^2 u - t = x^2 + y^2
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `fitRings`, `apps/web/src/lib/target-geometry.ts`, `solve`.

The system over all marked points is solved by linear least squares (normal equations, Gaussian elimination with partial pivoting) on normalised coordinates: points about their centroid at mean distance 1, radii at mean 1. This is the algebraic circle fit with one shared centre and one known radius per ring. At least two rings and four points are needed. The misfit is

$$
\mathrm{rms} = \sqrt{\frac{1}{N} \sum_{k=1}^{N} \left(\lvert p_k - c \rvert - s R_k\right)^2}
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `fitRings`, `apps/web/src/lib/target-geometry.ts`, `solve`.

A sheet point $p$ is scored at its position on the face, with the hole diameter left physical:

$$
q = \frac{p - c}{s}
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `onFace`, `faceAlignment`.

Without marks the face is centred on the group's point of aim, or on the sheet origin without one, with $s = 1$.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `apps/web` |
| --- | --- | --- | --- |
| $d$ | Distance of the hole centre from the face centre | mm | m |
| $R_n$ | Radius of ring $n$ to the outside edge of its line | mm (stored as diameter) | m |
| $R_X$ | Radius of the inner-ten circle | mm (stored as diameter) | m |
| $v_n$ | Value of ring $n$ | 1 | 1 |
| $G$ | Gauge diameter of the event, or its equivalent hole | mm | m |
| $d_b$ | Bullet diameter, else the marker diameter | mm | m |
| $g$ | Radius of the scored hole | mm | m |
| $\varepsilon$ | Touch tolerance | mm | m |
| $w_n$ | Width of ring $n$ | mm | m |
| $T$, $T_\mathrm{dec}$ | Group total and decimal total | 1 | 1 |
| $p = (x, y)$ | Point marked on a ring, on the sheet | mm | m |
| $c$ | Face centre on the sheet | mm | m |
| $s$ | Scale, sheet length per face length | 1 | 1 |
| $u$, $t$ | Unknowns $s^2$ and $\lvert c \rvert^2$ of the linear fit | no kind | no kind |
| $\mathrm{rms}$ | Root mean square radial misfit of the marked points | mm | m |
| $q$ | Shot position on the face | mm | m |

## Assumptions

- Rings are concentric circles. Ring diameters run to the outside edge of the ring line, as the rule books measure them.
- A hole is a disc of the gauge or bullet diameter centred on the shot. The touch rule then is the distance condition above.
- The face fit has no perspective, rotation or ring-line thickness. Noise-free marks give the exact centre and scale.

## Limits

- Scoring reads only the ring diameters about one centre: the height of an oval ring and the several bulls of a face are not used.
- Gauges are recorded only where the rule book gives one diameter for the event. Other events score with the bullet diameter, else the marker diameter.
- Excluded shots are scored and shown but not counted in the totals.

## Sources

- [ISSF 2022](../bibliography.md#issf-2022), pp. 320 to 330: ring diameters to the outside edge of the line (rule 1.1.2), plug gauges and their measuring edges (rules 1.4.1 to 1.4.10), the higher value for a hole touching a ring line (rule 5.2.1).
- [ISSF 2025, Third Print](../bibliography.md#issf-2025-third), pp. 194 to 200: decimal scoring (rule 6.3.3.1, p. 194), inner ten (rules 6.3.4.1 to 6.3.4.6), the 10 m air rifle inner ten only when the dot is shot out (rule 6.3.4.3).
- [DSB 2026](../bibliography.md#dsb-2026): touch rule and measuring rings by calibre, Teil 0, 0.11.3 and 0.11.3.2 (Seite 40), faces in 0.20 (Teil 0, Seiten 62 to 68), hole centre for the muzzle-loader ball events, 7.7.5 (Teil 7, Seite 8).
- [BDMP 2026](../bibliography.md#bdmp-2026): touch rule, A.3.21.1.3, hole centre for black powder, A.3.21.4.1, faces in B.11.
- [DSU 2018](../bibliography.md#dsu-2018): touch rule, Kapitel 1 (Seite 27), hole centre for black powder, Kapitel 4 (Besondere Auswertungsregeln, PDF p. 126).
- [VdRBw](../bibliography.md#vdrbw): touch rule, rule 519, faces in Kapitel 8 to 10.
- [BDS 2025](../bibliography.md#bds-2025): faces Z1 to Z21 and Anhang 1, no scoring rule stated.
- [Kasa 1976](../bibliography.md#kasa-1976): algebraic circle fit, pp. 8 to 14.
