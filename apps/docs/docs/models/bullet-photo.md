---
title: Bullet from a photo
description: The dimensions of a bullet from the silhouette in a photograph beside a ruler, each with a standard uncertainty, seeded into the bullet designer.
---

# Bullet from a photo

The bullet designer's "From a photo" tool measures a bullet in a photograph taken beside a ruler. It cuts the bullet out, finds its axis, fits the outline and gives the dimensions of the designer's bullet drawing, each with a standard uncertainty. "Open in designer" seeds a new design with them.

The photograph is read and processed in the browser and is not stored or uploaded. The code is in `apps/web/src/lib/bullet-photo.ts` (cut-out and scale), `bullet-photo-outline.ts` (axis and profile), `bullet-photo-measure.ts` (fits and uncertainties) and `bullet-photo-design.ts` (the seeded design). The steps run in a Web Worker (`bullet-photo.worker.ts`).

Measured values are never exact: the uncertainty shown with each is the model's, and a photograph that differs from the assumptions below can be off by more than it states.

## Equations

### Scale

The user places two points on the ruler's graduation and states their distance $L$ (one span, or two spans C to D and A to B). With the pixel distance $\ell$ of a span, its scale is

$$
k = \frac{\ell}{L}, \qquad \frac{u(k)}{k} = \frac{\sqrt{2}\, u_p}{\ell}
$$

Code: `apps/web/src/lib/bullet-photo.ts`, `scaleOf`, `pointUncertainty`.

with $u_p = 1$ px the standard uncertainty of one placed point (the aim and the width of a graduation line). Two spans give the mean $\bar k$, the placement terms averaged in quadrature and, for their disagreement, a rectangular distribution of half-width $\Delta/2$, $\Delta = k_\mathrm{max} - k_\mathrm{min}$, divided by $\sqrt{3}$:

$$
\frac{u(\bar k)}{\bar k} = \sqrt{\left(\frac{1}{n}\sqrt{\sum_i \frac{2\, u_p^2}{\ell_i^2}}\right)^2 + \left(\frac{\Delta}{2\sqrt{3}\,\bar k}\right)^2}
$$

Code: `apps/web/src/lib/bullet-photo.ts`, `scaleOf`.

**Sizes read off a caliper.** The user can also enter the bullet's diameter and overall length, measured with a caliper. Each gives a scale $k_i = \ell_i / L_i$ from the photograph's own measurement $\ell_i$ (px) of that size and its standard uncertainty $u(\ell_i)$, with the caliper's $u(L_i) = 0.02$ mm:

$$
\frac{u(k_i)}{k_i} = \sqrt{\left(\frac{u(\ell_i)}{\ell_i}\right)^2 + \left(\frac{u(L_i)}{L_i}\right)^2}
$$

Code: `apps/web/src/lib/bullet-photo-scale.ts`, `estimatesOf`.

Where the photograph has no ruler points, the scale is the mean of these weighted by $1/(u(k_i)/k_i)^2$, with the same rectangular term for the disagreement of the two as above. Where it has, the ruler's scale is used and each size is a check. A size is flagged when its scale is away from the ruler's (or the two sizes' scales from each other) by more than three standard uncertainties and 2 %. The note gives the difference in percent and names what to check: the scale points, the cut-out, and that the bullet lies flat and square to the camera. A tilted bullet shortens its length and not its diameter, so a flagged pair tells a tilt that the cut-out alone does not. Code: `apps/web/src/lib/bullet-photo-scale.ts`, `resolveScale`.

### Cut-out

1. The photograph is turned into luma with the weights of [ITU-R BT.601](../bibliography.md#itu-r-bt-601).
2. Otsu's threshold ([Otsu 1979](../bibliography.md#otsu-1979)) splits the greys. The side the median of the photograph's border pixels lies on is the background, so bars or a ruler along some of the edges do not decide it.
3. A plane $a + b x + c y$ is fitted by least squares to the background pixels and taken off (a lighting gradient), the background's mean kept. The threshold is then taken again on the flattened greys, with the mean greys of the two sides $g_\mathrm{bg}$ and $g_\mathrm{fg}$. Below a gap of 25 grey levels nothing is cut out; below 60 the cut-out carries a note that the outline may be rough.
4. First pass: the pixels a quarter of the way from $g_\mathrm{bg}$ to $g_\mathrm{fg}$ or further. Rows and columns along the photograph's edges that are 90 % or more of these pixels (bars) are cleared, and the largest connected part is taken (below).
5. Second pass: the bullet's own grey near each pixel replaces $g_\mathrm{fg}$. The rim of the first pass's part (the pixels 2 to 5 px inside its boundary) is averaged within a radius of 0.3 of the bullet's thickness, widened where the rim is out of reach, so a pale tip (bright metal) is told from the background by its own grey and not by the shank's. Each pixel's coverage is $\alpha = \operatorname{clamp}\left(\frac{g - g_\mathrm{bg}}{g_\mathrm{rim} - g_\mathrm{bg}}, 0, 1\right)$ and the pixels with $\alpha \ge 0.5$ form the mask.
6. The bullet is the largest connected part of the mask that is not within a few pixels of a point the user placed on the ruler (the ruler is a part of its own), preferring a part that does not touch the photograph's edge. When every part touches it, the largest is taken and the cut-out carries a frame-contact note (below). Holes in it (glare) are filled. A band of 2 px at its edge keeps $\alpha$, so the edge has a position finer than a pixel.

Code: `apps/web/src/lib/bullet-photo.ts`, `segment`, `coverOf`, `localLevels`, `clearBars`, `flatten`, `levels`. The user can correct the cut-out with a brush.

**Colour.** When the bullet is within 60 grey levels of the background in luma, the cut-out is also made on the colour distance of each pixel from the background colour along the line to the bullet's colour (the background's median colour of the border, the bullet's mean of the pixels furthest from it, not counting the colours at the points the user placed on the ruler), and the colour cut-out replaces the luma one only when its contrast is more than 1.5 times greater; otherwise the luma cut-out is kept. Code: `apps/web/src/lib/bullet-photo-colour.ts`, `segmentPhoto`, `colourSeparation`.

**Highlights and uneven backgrounds.** A bullet can be darker than the background on one side and brighter on the other (copper with a highlight on grey), so a cut-out by luma alone gives one side. A second cut is made on the distance of each pixel from the background of its row (of its column when the first cut-out spans more than 40% of the photograph's width and less than 40% of its height), in luma in either direction or in chroma weighted 1.5, the background being the median of the line's pixels outside the first cut-out. Where the background has two tones (a wall and a table) that is the background in each. This cut-out or the colour one replaces the first when it contains at least 80% of it and is more than 10% larger. The choice is made on the photograph reduced to 900 px on its longer side, and the photograph itself is cut the chosen way once, so a large photograph costs about one cut and not four.

**Ragged edges.** A cut-out whose edge, after a closing of 2 px that takes thin slits out, has more than 9 boundary pixels per root of its area is a patch of the background's texture, not a bullet: a smooth body of length L and width d has 2 (L + d) / sqrt(L d), 7 at ten diameters long. The largest of the other cut-outs with a smooth edge is taken instead. When none is, the user is told that the background may be textured or busy. Code: `segmentPhoto`, `pickCut`, `deviation`, `raggedness`.

**A second object.** When another part of the first pass is at least 30% as large as the part chosen (a second bullet, a cartridge, a ruler whose points are not placed yet), a note says so and asks the user to check that the one cut out is the bullet, to photograph one bullet alone or to paint the others out with the brush. The part chosen is the largest that does not touch the photograph's edge, else the largest. Code: `bestPart` in `apps/web/src/lib/bullet-photo.ts`.

**Edge spread.** The width $s$ the grey takes to go from the background to the bullet at the cut-out's edge is the contrast over the steepest slope, taken along the boundary and kept at its upper quartile (a shadow lies along one side only). A sharp edge reads 1 to 3 px. Above 4 px and 4 % of the bullet's thickness the cut-out carries a note that the edges are soft (a shadow beside the bullet, or an out-of-focus or moved photograph), and each edge position's standard uncertainty grows:

$$
u_e = \sqrt{0.3^2 + \max(0, s - 3)^2}\ \text{px}
$$

Code: `apps/web/src/lib/bullet-photo.ts`, `edgeSpreadOf`; `apps/web/src/lib/bullet-photo-outline.ts`, `edgeUncertaintyOf`. The spread is not kept for a cut-out the user has corrected by hand, which is taken as sharp.

### Axis and profile

The axis starts at the long axis of the cut-out's pixels, from their second moments ([Hu 1962](../bibliography.md#hu-1962)):

$$
\theta = \tfrac{1}{2} \operatorname{atan2}\left(2 \mu_{xy},\; \mu_{xx} - \mu_{yy}\right)
$$

Code: `apps/web/src/lib/bullet-photo-outline.ts`, `momentsOf`.

with $\mu$ the central second moments. It is then turned and shifted over four passes of a least squares line through the middles of the two edges of every column (columns at least 0.3 of the widest), until the middle of both edges lies on it: the symmetry line. Along it, the position of each edge at half coverage is found by linear interpolation of the bilinear coverage, at every pixel step. This gives the half width $r(z)$, with $z$ from the base to the tip. The ends of the bullet are where the axis leaves the cut-out; where a reflection or the mouth of a hollow point leaves the axis itself uncovered, an end the axis finds more than 3 px inside the extent of the cut-out is taken from the extent. The nose end is the end whose taper to 90 % of the widest width is longer; when the two differ by less than 15 % the tool says so and the user can flip the nose or type the axis direction.

Code: `apps/web/src/lib/bullet-photo-outline.ts`, `fitOutline`.

### Shank, base and nose

The shank radius $a$ is the median of $r(z)$ where a running median of five samples is within 1 % (at least one pixel) of its maximum; $\sigma_a$ is the scatter of those samples (1.4826 times their median absolute deviation) and

$$
u(a)^2 = \tfrac{1}{2} u_e^2 + \frac{\sigma_a^2}{\max(1, n/4)}
$$

Code: `apps/web/src/lib/bullet-photo-measure.ts`, `shankOf`.

with $u_e = 0.3$ px the standard uncertainty of an edge position at a sharp edge (a uniform rounding error of one pixel, $1/\sqrt{12} \approx 0.29$ px, plus the grey's noise; more where the edge is spread, above) and $n$ the number of samples. The diameter is $d = 2a$.

A **boat tail** is present when the radius at the base is lower than $a$ by more than 4 % (at least 2.5 px). Its cone is the line $r = r_0 + c z$ fitted to the middle of the cone (from a quarter to 85 % of the way to where the shank starts, clear of the rounded corner at the base and of the one where the cone meets the shank), and

$$
z_b = \frac{a - r_0}{c}, \qquad \text{base diameter } 2 r_0, \qquad \text{angle } \arctan c
$$

Code: `apps/web/src/lib/bullet-photo-measure.ts`, `boatTailOf`.

where $z_b$ is the boat tail length.

The **nose** is a circle of radius $\rho$ and centre $(r_c, z_c)$ in the $(r, z)$ plane, fitted by minimising the distances of the profile points between the shank and the tip to the circle (a geometric fit, [Coope 1993](../bibliography.md#coope-1993), started from the algebraic fit of [Kasa 1976](../bibliography.md#kasa-1976)) with Levenberg-Marquardt ([Levenberg 1944](../bibliography.md#levenberg-1944), [Marquardt 1963](../bibliography.md#marquardt-1963)). Two circles are fitted: a free one (a secant ogive) and one tangent to the shank, $r_c = a - \rho$. The secant circle is taken when it lowers the residual sum of squares by more than nine times the variance of the edge noise (three standard deviations); otherwise the tangent circle is taken. Then, with the circle's end on the shank $z_j$, the tip $z_t$ and the meplat radius $m$ where the circle meets $z_t$:

$$
\text{nose length } n = z_t - z_j, \qquad h = a - m, \qquad \frac{R_t}{R} = \frac{n^2 + h^2}{2 h \rho}
$$

Code: `apps/web/src/lib/bullet-photo-measure.ts`, `noseOf`, `noseFit`.

A tangent nose gives $R_t/R = 1$ and no radius to the designer; a secant nose gives its radius $\rho$ and the designer derives $R_t/R$ from the nose length. The meplat diameter is $2m$. The bearing length is $z_j - z_b$ and the length is the tip's position (a pointed tip is thinner than a pixel at its end, so the circle's end on the axis is taken then, with an uncertainty of 1 px).

A **cannelure** is the widest dip of the shank by more than $\max(2\ \text{px},\, 4 \sigma_a)$ over at least three samples. Its start, width and depth are read from that run.

A nose no circle fits (residual above 1.2 px) is not an ogive of the drawing: no radius or $R_t/R$ is given, the nose length is where the shank ends (within a range, a rectangular distribution), and the meplat is the width of the last samples.

Code: `apps/web/src/lib/bullet-photo-measure.ts`, `measureOutline`, `shankOf`, `boatTailOf`, `noseFit`, `cannelureOf`.

### Uncertainty

Each value is a function $f(p)$ of fitted parameters $p$ with the covariance $\Sigma = \sigma^2 (J^\mathsf{T} J)^{-1}$ of its least squares fit (residual standard deviation $\sigma$, not below $u_e$) and the shank's and tip's variances in blocks. The standard uncertainty in pixels follows by first-order propagation ([JCGM 100:2008](../bibliography.md#jcgm-100-2008), 5.1.2):

$$
u_\mathrm{px}(f)^2 = \nabla f^\mathsf{T}\, \Sigma\, \nabla f
$$

Code: `apps/web/src/lib/bullet-photo-measure.ts`, `propagate`.

with a numeric gradient. A value in mm is $v = f/k$ and the scale's relative uncertainty joins in quadrature:

$$
u(v)^2 = \left(\frac{u_\mathrm{px}}{k}\right)^2 + \left(v\, \frac{u(k)}{k}\right)^2
$$

Code: `apps/web/src/lib/bullet-photo-measure.ts`, `measureOutline`.

Ratios and angles take the scale out and carry the fit's uncertainty only. The fits' covariance comes from `lsq`.

### Quality of the photograph

A photograph too poor to measure gets sentences that say what is wrong and what to do, and no values, rather than a wrong outline. The outline stays on the canvas, so the cut-out can be corrected with the brush and measured again.

| Finding | When | What the user is told |
| --- | --- | --- |
| Too small | The bullet is narrower than 16 px | No values; take the photograph closer or crop to the bullet, at least 80 px across |
| Not a bullet's proportions | The cut-out is shorter than wide or more than 10 times as long | No values; brush the bullet in and the rest out, or retake it alone on a plain background |
| Narrow | Narrower than 40 px | Values, with the best case of their uncertainty ($\sqrt{2} u_e$ over the width, below 40 px it is more than 1 %) |
| Ragged | The scatter of the shank's sides is above 1.5 px and 2 % of the width | A reflection, a shadow or noise; retake in even soft light or brush the cut-out |
| Soft edges | Edge spread above 4 px and 4 % of the thickness | Shadow beside the bullet, or out of focus or moved; values are less certain |
| Low contrast | The cut-out used has the bullet within 60 grey levels of the background | The outline may be rough; a plainer or much lighter or darker background |
| Cut at the frame | The cut-out touches the photograph's edge | The whole bullet may not be in it |

Code: `apps/web/src/lib/bullet-photo-quality.ts`, `outlineHints`; `bullet-photo.ts`, `segment`.

## Symbols

| Symbol | Meaning | Stored unit | Unit in code |
| --- | --- | --- | --- |
| $k$ | Scale of the photograph | no kind | px/mm |
| $L$, $\ell$ | Distance on the ruler, its pixel distance | mm, no kind | mm, px |
| $u_p$ | Standard uncertainty of a placed point | no kind | 1 px |
| $u_e$ | Standard uncertainty of an edge position | no kind | 0.3 px |
| $r(z)$ | Half width of the bullet at $z$ along the axis | no kind | px |
| $a$, $d$ | Shank radius, diameter | mm | px, mm |
| $z_b$ | Boat tail length | mm | px, mm |
| $r_0$, $c$ | Radius of the boat tail cone at the base, its slope | mm, degrees | px, ratio |
| $h$ | Shank radius less the meplat radius | mm | px |
| $\rho$, $(r_c, z_c)$ | Radius and centre of the nose circle | mm | px |
| $n$, $m$ | Nose length, meplat radius | mm | px |
| $R_t/R$ | Ratio of the tangent ogive radius to the nose's | no kind | ratio |

## Assumptions

- The photograph is a side view of the bullet lying level, taken square on, with the ruler in the same plane as the bullet's axis. A ruler at another distance from the camera, or a bullet tilted towards the camera, changes the scale. This is not corrected and not part of the stated uncertainty.
- Lens distortion is not corrected: a wide-angle lens near its edge distorts lengths. Keep the bullet and the ruler near the middle, with a long focal length.
- The bullet is a body of revolution, so its silhouette is symmetric about the axis.
- The bullet differs from the background in brightness (at least 25 grey levels) or, where it does not, in colour.
- The two points a user places on the ruler are at known graduation marks, and a size entered from a caliper is the bullet's own (a diameter of the shank, an overall length from base to tip).

## Limits

- The mouth of a hollow point is not seen in a side silhouette: it is not measured, the meplat is the width of the rim.
- A hybrid or other nose that is not a circle arc is not classified: no ogive radius or $R_t/R$ is seeded, and a note says so.
- A rebated boat tail or a cone that is not straight raises a note; the line fit then represents it poorly.
- The standard uncertainties include the edge position, the fits and the scale's placement. They do not include the ruler's own error, lens distortion or perspective (a caliper size entered with the length and the diameter flags a tilt, not corrects it), and they are not a confidence interval of the real bullet's size: a manufacturing spread among bullets of one product is larger than the measurement uncertainty.
- The seeded design is a starting point. Its mass and manufacturer stay empty, and the note kept in it says the values are measured from a photograph, with the scale and every value's uncertainty. No image is stored.
- A shadow beside the bullet is not taken out of the cut-out. It is told by its soft edge, which raises the uncertainty and adds a note; brushing it out of the cut-out measures the bullet alone. A shadow with a sharp edge cannot be told from the bullet.
- Perspective is not detected: a bullet or a camera tilted so that one end is nearer makes the sides of the shank converge, and no note says so.
- A reflection that reaches the bullet's edge cuts into the outline there, with no note unless it makes the edge ragged.
- A photograph of more than 2400 px on its longer side is shrunk to that while it is read.
- Tested on synthetic photographs rendered from the bullet drawing with known size, lighting gradient, side shading, noise and blur (`apps/web/test/bullet-photo.test.ts`), and with a pale tip, a reflection along the axis, bars along the edges, a colour that differs from the background's at the same brightness, a bullet darker than the paper on one side and brighter on the other, a soft shadow, strong blur, low contrast and a small bullet (`apps/web/test/bullet-photo-quality.test.ts`), and the scale from caliper sizes without a ruler, and their checks against a ruler and each other (`apps/web/test/bullet-photo-scale.test.ts`). For each of these the values are within three uncertainties of the truth, or a note says they may not be, or none are given. Real photographs are unverified.

## Sources

- [Otsu 1979](../bibliography.md#otsu-1979): threshold that maximises the between-class variance.
- [Hu 1962](../bibliography.md#hu-1962): moments of a pattern and its principal axis.
- [Coope 1993](../bibliography.md#coope-1993): geometric circle fit by least squares; [Kasa 1976](../bibliography.md#kasa-1976): the algebraic fit that starts it.
- [Levenberg 1944](../bibliography.md#levenberg-1944), [Marquardt 1963](../bibliography.md#marquardt-1963): the damped least squares iteration.
- [JCGM 100:2008](../bibliography.md#jcgm-100-2008): first-order propagation of uncertainty and the rectangular distribution.
- [ITU-R BT.601](../bibliography.md#itu-r-bt-601): the luma weights.
- Research log: [synthetic photographs](../research/bullet-photo-synthetic-renders.md).
