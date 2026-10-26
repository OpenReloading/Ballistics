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

with $u_p = 1$ px the standard uncertainty of one placed point (the aim and the width of a graduation line). Two spans give the mean $\bar k$, the placement terms averaged in quadrature and, for their disagreement, a rectangular distribution of half-width $\Delta/2$, $\Delta = k_\mathrm{max} - k_\mathrm{min}$, divided by $\sqrt{3}$:

$$
\frac{u(\bar k)}{\bar k} = \sqrt{\left(\frac{1}{n}\sqrt{\sum_i \frac{2\, u_p^2}{\ell_i^2}}\right)^2 + \left(\frac{\Delta}{2\sqrt{3}\,\bar k}\right)^2}
$$

Code: `apps/web/src/lib/bullet-photo.ts`, `scaleOf`, `pointUncertainty`.

### Cut-out

1. The photograph is turned into luma with the weights of [ITU-R BT.601](../bibliography.md#itu-r-bt-601).
2. Otsu's threshold ([Otsu 1979](../bibliography.md#otsu-1979)) splits the greys. The side the photograph's border lies on is the background.
3. A plane $a + b x + c y$ is fitted by least squares to the background pixels and taken off (a lighting gradient), the background's mean kept. The threshold is then taken again on the flattened greys, with the mean greys of the two sides $g_\mathrm{bg}$ and $g_\mathrm{fg}$. Below a gap of 25 grey levels nothing is cut out.
4. Each pixel's coverage is $\alpha = \operatorname{clamp}\left(\frac{g - g_\mathrm{bg}}{g_\mathrm{fg} - g_\mathrm{bg}}, 0, 1\right)$. Pixels with $\alpha \ge 0.5$ form the mask.
5. The bullet is the largest connected part of the mask that does not touch the photograph's edge and is not within a few pixels of a point the user placed on the ruler (the ruler is a part of its own). Holes in it (glare) are filled. A band of 2 px at its edge keeps $\alpha$, so the edge has a position finer than a pixel.

Code: `apps/web/src/lib/bullet-photo.ts`, `segment`, `flatten`, `levels`. The user can correct the cut-out with a brush.

### Axis and profile

The axis starts at the long axis of the cut-out's pixels, from their second moments ([Hu 1962](../bibliography.md#hu-1962)):

$$
\theta = \tfrac{1}{2} \operatorname{atan2}\left(2 \mu_{xy},\; \mu_{xx} - \mu_{yy}\right)
$$

with $\mu$ the central second moments. It is then turned and shifted over four passes of a least squares line through the middles of the two edges of every column (columns at least 0.3 of the widest), until the middle of both edges lies on it: the symmetry line. Along it, the position of each edge at half coverage is found by linear interpolation of the bilinear coverage, at every pixel step. This gives the half width $r(z)$, with $z$ from the base to the tip. The nose end is the end whose taper to 90 % of the widest width is longer; when the two differ by less than 15 % the tool says so and the user can flip the nose or type the axis direction.

Code: `apps/web/src/lib/bullet-photo-outline.ts`, `fitOutline`.

### Shank, base and nose

The shank radius $a$ is the median of $r(z)$ where a running median of five samples is within 1 % (at least one pixel) of its maximum; $\sigma_a$ is the scatter of those samples (1.4826 times their median absolute deviation) and

$$
u(a)^2 = \tfrac{1}{2} u_e^2 + \frac{\sigma_a^2}{\max(1, n/4)}
$$

with $u_e = 0.3$ px the standard uncertainty of an edge position (a uniform rounding error of one pixel, $1/\sqrt{12} \approx 0.29$ px, plus the grey's noise) and $n$ the number of samples. The diameter is $d = 2a$.

A **boat tail** is present when the radius at the base is lower than $a$ by more than 4 % (at least 2.5 px). Its cone is the line $r = r_0 + c z$ fitted to the lower part of the cone, and

$$
z_b = \frac{a - r_0}{c}, \qquad \text{base diameter } 2 r_0, \qquad \text{angle } \arctan c
$$

where $z_b$ is the boat tail length.

The **nose** is a circle of radius $\rho$ and centre $(r_c, z_c)$ in the $(r, z)$ plane, fitted by minimising the distances of the profile points between the shank and the tip to the circle (a geometric fit, [Coope 1993](../bibliography.md#coope-1993), started from the algebraic fit of [Kasa 1976](../bibliography.md#kasa-1976)) with Levenberg-Marquardt ([Levenberg 1944](../bibliography.md#levenberg-1944), [Marquardt 1963](../bibliography.md#marquardt-1963)). Two circles are fitted: a free one (a secant ogive) and one tangent to the shank, $r_c = a - \rho$. The secant circle is taken when it lowers the residual sum of squares by more than nine times the variance of the edge noise (three standard deviations); otherwise the tangent circle is taken. Then, with the circle's end on the shank $z_j$, the tip $z_t$ and the meplat radius $m$ where the circle meets $z_t$:

$$
\text{nose length } n = z_t - z_j, \qquad h = a - m, \qquad \frac{R_t}{R} = \frac{n^2 + h^2}{2 h \rho}
$$

A tangent nose gives $R_t/R = 1$ and no radius to the designer; a secant nose gives its radius $\rho$ and the designer derives $R_t/R$ from the nose length. The meplat diameter is $2m$. The bearing length is $z_j - z_b$ and the length is the tip's position (a pointed tip is thinner than a pixel at its end, so the circle's end on the axis is taken then, with an uncertainty of 1 px).

A **cannelure** is the widest dip of the shank by more than $\max(2\ \text{px},\, 4 \sigma_a)$ over at least three samples. Its start, width and depth are read from that run.

A nose no circle fits (residual above 1.2 px) is not an ogive of the drawing: no radius or $R_t/R$ is given, the nose length is where the shank ends (within a range, a rectangular distribution), and the meplat is the width of the last samples.

Code: `apps/web/src/lib/bullet-photo-measure.ts`, `measureOutline`, `shankOf`, `boatTailOf`, `noseFit`, `cannelureOf`.

### Uncertainty

Each value is a function $f(p)$ of fitted parameters $p$ with the covariance $\Sigma = \sigma^2 (J^\mathsf{T} J)^{-1}$ of its least squares fit (residual standard deviation $\sigma$, not below $u_e$) and the shank's and tip's variances in blocks. The standard uncertainty in pixels follows by first-order propagation ([JCGM 100:2008](../bibliography.md#jcgm-100-2008), 5.1.2):

$$
u_\mathrm{px}(f)^2 = \nabla f^\mathsf{T}\, \Sigma\, \nabla f
$$

with a numeric gradient. A value in mm is $v = f/k$ and the scale's relative uncertainty joins in quadrature:

$$
u(v)^2 = \left(\frac{u_\mathrm{px}}{k}\right)^2 + \left(v\, \frac{u(k)}{k}\right)^2
$$

Ratios and angles take the scale out and carry the fit's uncertainty only.

Code: `apps/web/src/lib/bullet-photo-measure.ts`, `propagate`, `lsq`, `measureOutline`.

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
- The bullet differs in brightness from the background (at least 25 grey levels).
- The two points a user places on the ruler are at known graduation marks.

## Limits

- The mouth of a hollow point is not seen in a side silhouette: it is not measured, the meplat is the width of the rim.
- A hybrid or other nose that is not a circle arc is not classified: no ogive radius or $R_t/R$ is seeded, and a note says so.
- A rebated boat tail or a cone that is not straight raises a note; the line fit then represents it poorly.
- The standard uncertainties include the edge position, the fits and the scale's placement. They do not include the ruler's own error, lens distortion or perspective, and they are not a confidence interval of the real bullet's size: a manufacturing spread among bullets of one product is larger than the measurement uncertainty.
- The seeded design is a starting point. Its mass and manufacturer stay empty, and the note kept in it says the values are measured from a photograph, with the scale and every value's uncertainty. No image is stored.
- A photograph of more than 2400 px on its longer side is shrunk to that while it is read.
- Tested on synthetic photographs rendered from the bullet drawing with known size, lighting gradient, side shading, noise and blur (`apps/web/test/bullet-photo.test.ts`). Real photographs are unverified.

## Sources

- [Otsu 1979](../bibliography.md#otsu-1979): threshold that maximises the between-class variance.
- [Hu 1962](../bibliography.md#hu-1962): moments of a pattern and its principal axis.
- [Coope 1993](../bibliography.md#coope-1993): geometric circle fit by least squares; [Kasa 1976](../bibliography.md#kasa-1976): the algebraic fit that starts it.
- [Levenberg 1944](../bibliography.md#levenberg-1944), [Marquardt 1963](../bibliography.md#marquardt-1963): the damped least squares iteration.
- [JCGM 100:2008](../bibliography.md#jcgm-100-2008): first-order propagation of uncertainty and the rectangular distribution.
- [ITU-R BT.601](../bibliography.md#itu-r-bt-601): the luma weights.
