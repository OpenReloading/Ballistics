---
title: Ring scoring
description: Ring value, tenth-ring value and inner ten of a shot on a rule-book target, and the fit of a target to points marked on its rings.
---

# Ring scoring

Ring scoring gives each shot on a target:

- the value of the highest ring its hole touches, or under outward gauging the highest ring it lies wholly inside
- the tenth-ring value, where the target's rules allow it
- whether it is an inner ten
- the zone label of the bull it belongs to, on a target with several bulls

A target is placed on the target sheet by fitting its centre and scale to points marked on two or more of its rings. Target records hold ring diameters in mm. Shots are hole centres in target m from the target centre (the sheet centre on a target with several bulls). The group stores the target id and the id of the event, which `lib/ring-scoring.ts` looks up in the target. The target and event of a group come from the target mapping of the discipline picked ([Federations, disciplines and target mappings](../data/federations.md)). A target from the browser's target designer scores like a record: its events have no target mapping, so each is listed under User design and its gauge is the scored hole. The code is in `apps/web/src/lib/ring-scoring.ts`.

## Equations

### Scored hole

The scored hole has the radius $g$, 0 for an event that counts the hole centre (`scoring: centre`). An event with `scoring: touch`, or none where the rule book does not state the rule, counts the hole edge nearest the centre; an event with `scoring: outward` counts the edge furthest from it (below). $G$ is the gauge diameter of the event, else of the discipline's target mapping, where the rules fix one. $d_b$ is the bullet diameter of the load, else the marker diameter of the sheet:

$$
g = \begin{cases} 0 & \text{centre scoring} \\ G/2 & \text{gauge given} \\ d_b/2 & \text{otherwise} \end{cases}
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `scoredHoleDiameter`.

### Bull

A target with the list `bulls` has several scoring centres $c_k$ on one sheet, positions in mm from the sheet centre, all with the rings of the record. A shot belongs to the nearest bull, and the rings, the inner ten and the tenths are measured from that bull's centre. A shot at the same distance from two bulls belongs to the one listed first in the record. The shot carries the `zone` label of its bull, where the bull has one: two scoring zones on one card are two bulls with a label each. A target without `bulls` has one bull at the target centre.

$$
k^\ast = \arg\min_k \lvert p - c_k \rvert, \qquad p' = p - c_{k^\ast}
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `nearestBull`, `scoreShot`.

### Ring value

Ring $n$ bounds an area $A_n$ about the bull centre: a circle of radius $R_n$ (half its diameter), an axis-aligned oval of semi-axes $R_n$ (width) and $H_n$ (height, half the `height` of the record), a square of half edge $R_n$ (`shape: square`), or a stadium of half width $R_n$ and half height $H_n \ge R_n$ (`shape: stadium`): two straight vertical sides joined by a half circle of radius $R_n$ at each end. The hole of radius $g$ centred at $p'$ touches ring $n$ when its distance to the area is within $g$:

$$
\delta_n(p') \le g + \varepsilon, \qquad \delta_n(p') = \min_{q \in A_n} \lvert p' - q \rvert
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `touches`, `scoreShot`.

The distance $\delta_n$ is

$$
\delta_n = \begin{cases} \max(\lvert p' \rvert - R_n,\, 0) & \text{circle} \\ \text{distance to the ellipse} & \text{oval} \\ \sqrt{\max(\lvert x \rvert - R_n, 0)^2 + \max(\lvert y \rvert - R_n, 0)^2} & \text{square} \\ \max\left(\sqrt{x^2 + (y - \operatorname{clamp}(y, -L_n, L_n))^2} - R_n,\, 0\right) & \text{stadium} \end{cases}
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `touches`, `ellipseGap`. The stadium is the branch of `touches` on `shape: stadium`.

For a circle the condition is $\lvert p' \rvert \le R_n + g + \varepsilon$. The distance to an ellipse has no closed form. The code finds the closest point on the ellipse as the root of a monotone function by bisection ([Eberly 2013](../bibliography.md#eberly-2013)) and is 0 inside. Along both axes of an oval the condition reads $\lvert x \rvert \le R_n + g$ and $\lvert y \rvert \le H_n + g$. Away from the axes the hole is a disc, so its reach round an oval ring is the parallel curve of the ellipse, not an ellipse with the axes grown by $g$. A stadium is the set of points within $R_n$ of the segment from $(0, -L_n)$ to $(0, L_n)$ between the centres of its end half circles, $L_n = H_n - R_n$, so the distance has the closed form above, and the hole's reach is the same shape grown by $g$, with round corners. A square scores by its edge: a hole centre on the edge is inside, and the hole's reach is rounded at the corners. With $g = 0$ the square is the condition $\max(\lvert x \rvert, \lvert y \rvert) \le R_n$.

Here $\varepsilon = 10^{-12}$ m ($10^{-9}$ mm), so a hole edge on a ring line counts as touching it despite binary rounding. The shot scores the value $v_n$ of the innermost ring touched, 0 when it touches none.

An event with `scoring: outward` (outward gauging) is scored by the edge of the hole furthest from the bull centre. A ring keeps its value only while that edge stays inside the outer edge of the ring line; a hole whose edge reaches the outside of the line takes the next lower value, and one reaching the outside of the outermost ring scores 0. Outward gauging needs circular rings, so with $d = \lvert p' \rvert$ ring $n$ scores when

$$
d + g \lt R_n - \varepsilon
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `scoreShot` (`outward`), `scoreGroupOnFace`.

A far edge within $\varepsilon$ of the outer edge of the line counts as on the line, so it takes the lower value. A record with an outward event and oval, stadium or square rings, or with `decimal: true`, is refused ([NSRA 2024](../bibliography.md#nsra-2024), Rule 5.1.7 and Appendix B, Fig. 4).

### Inner ten

The inner ten counts only for a shot in the innermost ring. With the inner-ten radius $R_X$ and $d = \lvert p' \rvert$:

- `cover`: the hole covers the inner-ten circle completely.
- `touch`, or no rule on the record (the rule book does not state one): the hole touches it. An oval inner ten (`height`) uses the oval distance above, and the inner ten of a stadium target is a stadium.

$$
\text{cover: } d + R_X \le g + \varepsilon, \qquad \text{touch: } d \le R_X + g + \varepsilon
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `scoreShot`.

### Tenth-ring value

On targets whose rule book allows decimal scoring (`decimal: true`; the record then has circular rings only), each ring's scoring area is divided into ten equal parts counted inward from the touching position. For a hole in ring $n$ with ring width $w_n = R_n - R_{n+1}$ (for the innermost ring $w = R_{n-1} - R_n$):

$$
\text{decimal} = v_n + \frac{1}{10} \min\left(9,\, \max\left(0,\, \left\lfloor 10\, \frac{R_n + g - d}{w_n} + 10^{-9} \right\rfloor\right)\right)
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `scoreShot` (`depth`, `tenth`).

A target with `decimal: false`, or none where the rule book does not state it, is scored in whole rings.

Where the innermost zone, of radius $R_\mathrm{last} + g$, is wider than one ring width, the rule books do not state how the extra width is divided. The app then counts tenths of the ring width from the touching edge inward and gives .9 to the rest of the centre. That case is flagged by

$$
R_\mathrm{last} + g \gt R_\mathrm{last-1} - R_\mathrm{last} + \varepsilon
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `usesOwnTenthRule`. An outward event scores whole rings, so the flag is never raised for it.

### Group total

The total adds the ring values of the included shots. The decimal total adds the tenth-ring values as whole tenths, so it carries no rounding error:

$$
T = \sum_i v_i, \qquad T_\mathrm{dec} = \frac{1}{10} \sum_i \operatorname{round}(10\, \text{decimal}_i)
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `scoreGroup`, `scoreGroupOnFace`.

### Fit of a target to its rings

A point $p = (x, y)$ marked on a ring of radius $R$ satisfies $\lvert p - c \rvert = s R$ for the target centre $c$ and the scale $s$. Squared, with $u = s^2$ and $t = \lvert c \rvert^2$ taken as a free unknown, this is linear in $(c_x, c_y, u, t)$:

$$
2x\, c_x + 2y\, c_y + R^2 u - t = x^2 + y^2
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `fitRings`, `apps/web/src/lib/target-geometry.ts`, `solve`.

The system over all marked points is solved by linear least squares (normal equations, Gaussian elimination with partial pivoting) on normalised coordinates: points about their centroid at mean distance 1, radii at mean 1. This is the algebraic circle fit with one shared centre and one known radius per ring. At least two rings and four points are needed. The misfit is

$$
\mathrm{rms} = \sqrt{\frac{1}{N} \sum_{k=1}^{N} \left(\lvert p_k - c \rvert - s R_k\right)^2}
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `fitRings`, `apps/web/src/lib/target-geometry.ts`, `solve`.

A sheet point $p$ is scored at its position on the target, with the hole diameter left physical:

$$
q = \frac{p - c}{s}
$$

Code: `apps/web/src/lib/ring-scoring.ts`, `onFace`, `faceAlignment`.

Without marks the target is centred on the group's point of aim, or on the sheet origin without one, with $s = 1$.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `apps/web` |
| --- | --- | --- | --- |
| $d$ | Distance of the hole centre from the bull centre | mm | m |
| $c_k$ | Centre of bull $k$ from the sheet centre | mm | m |
| $p'$ | Hole centre relative to its bull | mm | m |
| $A_n$, $\delta_n$ | Area ring $n$ bounds, distance of the hole centre from it | mm | m |
| $H_n$ | Half the height of an oval or stadium ring | mm (stored as height) | m |
| $L_n$ | Half the length of the straight sides of a stadium ring, $H_n - R_n$ | mm | m |
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
| $c$ | Target centre on the sheet | mm | m |
| $s$ | Scale, sheet length per target length | 1 | 1 |
| $u$, $t$ | Unknowns $s^2$ and $\lvert c \rvert^2$ of the linear fit | no kind | no kind |
| $\mathrm{rms}$ | Root mean square radial misfit of the marked points | mm | m |
| $q$ | Shot position on the target | mm | m |

## Assumptions

- Rings about one bull are concentric: circles, axis-aligned ovals (target upright), stadiums (all rings and the inner ten) or squares (a square outer area with circles inside it, ovals on all rings or on none). The inner ten is a circle or an oval, or a stadium on a stadium target. Ring widths and heights run to the outside edge of the ring line, as the rule books measure them.
- Every bull of a target has the rings of the record, and a shot belongs to the bull whose centre is nearest, not to the bull whose rings it touches.
- A hole is a disc of the gauge or bullet diameter centred on the shot. The touch rule then is the distance condition above.
- The target fit has no perspective, rotation or ring-line thickness. Noise-free marks give the exact centre and scale.

## Limits

- Tenth-ring values need circular rings: a record with `decimal: true` and oval, stadium or square rings is refused, and an oval inner ten counts only by touch.
- Fitting a target to ring marks needs one bull and circular rings. The photo target search skips the DSU stadium targets, the NRA targets and the NSRA 1989 short-range 25 and 20 yards targets, several of whose rings share the ratios of targets it searches, and the NSRA 1989 long-range 100 yards and short-range 15 yards targets, whose aiming marks lie between two rings (`photoSearch: false`), the user picks one from the target list. On another target the marks are refused and the group shows the error. A group without marks is placed by its point of aim, or the sheet origin without one; with several bulls that point is taken as the sheet centre the bull positions are measured from, so a group aimed at one bull is offset by that bull's position.
- Zones with polygon outlines and targets that are hit or miss (symbols, plates) are not scored.
- The drawing of a target shows one bull, draws a square ring as a square but its black area and inner ten as ovals, a stadium ring, its black area and inner ten as stadiums, and the ring overlay on the photo draws every ring as a circle.
- Gauges are recorded only where the rule book gives one diameter for the event. Other events score with the bullet diameter, else the marker diameter.
- Excluded shots are scored and shown but not counted in the totals.
- The NSRA 1989 short-range 25 metres target is left out: its last printed ring is a 6, and a shot outside it but inside or touching the aiming mark scores 5 or 4 (NSRA Rule 5.1.7.1), which is not modelled.

## Sources

- [ISSF 2022](../bibliography.md#issf-2022), pp. 320 to 330: ring diameters to the outside edge of the line (rule 1.1.2), plug gauges and their measuring edges (rules 1.4.1 to 1.4.10), the higher value for a hole touching a ring line (rule 5.2.1).
- [ISSF 2025, Third Print](../bibliography.md#issf-2025-third), pp. 194 to 200: decimal scoring (rule 6.3.3.1, p. 194), inner ten (rules 6.3.4.1 to 6.3.4.6), the 10 m air rifle inner ten only when the dot is shot out (rule 6.3.4.3).
- [DSB 2027](../bibliography.md#dsb-2027): touch rule and measuring rings by calibre, Teil 0, 0.11.3 and 0.11.3.2 (Seite 40), targets in 0.20 (Teil 0, Seiten 62 to 70), hole centre for the muzzle-loader ball events, 7.7.5 (Teil 7, Seite 8).
- [BDMP 2026](../bibliography.md#bdmp-2026): touch rule, A.3.21.1.3, hole centre for black powder, A.3.21.4.1, targets in B.11.
- [DSU 2018](../bibliography.md#dsu-2018): the oval-ring targets b2 to b5 and b5 Präzision, Kapitel 1 (Seiten 12 to 16, PDF pp. 14 to 18), touch rule, Kapitel 1 (Seite 27), hole centre for black powder, Kapitel 4 (Besondere Auswertungsregeln, PDF p. 126).
- [KNSA 2026](../bibliography.md#knsa-2026): scoring and gauges by the ISSF rules, Deel IV artikelen 8.5.2, 12.1 and 12.4 (PDF pp. 87 to 88), the Woerden target in artikel 3.3 (PDF pp. 78 to 79).
- [NRA 2026](../bibliography.md#nra-2026): touch rule and X ring, Rule 14.3 (p. 48), targets in Section 4 (pp. 14 to 16).
- [NSRA 2024](../bibliography.md#nsra-2024): touch rule for inward gauging and X ring, Rules 5.1.6 and 5.1.9, the far hole edge for outward gauging, Rules 5.1.7 and 5.1.7.1 (PDF p. 8), targets in Appendix A (PDF pp. 29 to 30), gauges and the use of the 5.6 mm gauge on outward gauging targets in Appendix B, Fig. 4 (PDF p. 31).
- [ÖSB 2025](../bibliography.md#oesb-2025): scoring by the ISSF rules, 3.1.6 (p. 4), the national 100 m target in 7.1.7.3 (p. 15).
- [VdRBw](../bibliography.md#vdrbw): touch rule, rule 519, targets in Kapitel 8 to 10.
- [BDS 2025](../bibliography.md#bds-2025): targets Z1 to Z21 and Anhang 1, no scoring rule stated.
- [Eberly 2013](../bibliography.md#eberly-2013): distance from a point to an ellipse, closest-point condition and its bisection.
- [Kasa 1976](../bibliography.md#kasa-1976): algebraic circle fit, pp. 8 to 14.
- Research log: [ring scoring against the rule books](../research/ring-scoring-rule-book-faces.md).
