---
title: Hole detection
description: Bullet hole proposals on a target photo from a colour axis, a multi-scale blob detector, a top-hat shape test and a count per connected part.
---

# Hole detection

Hole detection proposes bullet holes on a target photo, inside a region or the printed target found on the photo:

1. A colour axis separates the colour seen through a hole from its surroundings.
2. A scale-normalised Hessian detector finds blobs on the projection onto that axis, at scales tied to the expected hole diameter.
3. A top-hat against a morphological opening gives the hole shape. Three tests keep the real peaks.
4. Each connected part of the hole mask counts as many shots as it holds peaks.

Detection starts when a photo is added to the sheet: the target search, then the run on the target found. Its result is one line with the target, the scale, the number of holes proposed and the caliber (the bullet's caliber and diameter, else the hole size and its source), each with a change link to its editor, and Accept. Where no bullet, marker, typed or learned size gives the hole size, the line holds the hole size field and the run follows once it is entered. A run without holes and a photo without one sure target go on in the guided steps. A photo below the minimum quality waits for Detect anyway (Photo quality).

The proposals stay apart from the shots until the user accepts them. The code is in `apps/web/src/lib/hole-detection.ts` and `apps/web/src/lib/hole-proposals.ts`.

Cancelling detection, changing the photo, sheet or group, or rotating the photo invalidates pending photo and target reads. Their results and errors cannot start a worker, apply a target or change the detection status.

## Equations

### Working image

The expected hole diameter in photo pixels is the bullet diameter (or a typed or learned hole size) times the local photo scale and the visible-hole factor $h$:

$$
D_\mathrm{px} = d_b \, k_\mathrm{px}\, h
$$

Code: `apps/web/src/lib/hole-detection.ts`, `validateInput` (`holePx`), `prepare`.

The region with a margin of $3 D_\mathrm{px}$ is averaged over square blocks of $b$ pixels, so a hole is about 16 working pixels across and the working image holds at most $2 \times 10^6$ pixels:

$$
b = \max\left(1,\, \operatorname{round}\frac{D_\mathrm{px}}{16},\, \left\lceil \sqrt{\frac{W H}{2 \times 10^6}} \right\rceil\right), \qquad D = \frac{D_\mathrm{px}}{b} \ge 4
$$

Code: `apps/web/src/lib/hole-detection.ts`, `workBlockSize`, `WORK_DIAMETER`, `MAX_WORK_PIXELS`.

Each block holds the logarithm of its mean colour per channel $c \in \{R, G, B\}$:

$$
F_c = \ln(\bar I_c + 8)
$$

Code: `apps/web/src/lib/hole-detection.ts`, `prepare`, `blockAverageLogRgb`.

The local photo scale is the mean photo length of 1 mm along the target $x$ and $y$ axes at the middle of the region, so a perspective calibration gives the scale near the holes:

$$
k_\mathrm{px} = 1000 \cdot \frac{\lvert T(q + e_x) - T(q) \rvert + \lvert T(q + e_y) - T(q) \rvert}{2}, \qquad \lvert e_x \rvert = \lvert e_y \rvert = 10^{-3}\ \text{m}
$$

Code: `apps/web/src/lib/hole-proposals.ts`, `localPxPerM`.

### Colour axis

The axis is Fisher's linear discriminant of the hole against the ring around it, in log RGB. The hole colour $\mu$ is the mean of the disc of radius $0.4 D$ at the picked hole ($0.28 D$ while the size is not known yet: $0.4$ times the smallest size $0.7 D$), or the logarithm of a backing colour the user picked. The surroundings are the pixels from $1.0 D$ to $2.4 D$ around the pick on the same kind of surface (black area or paper), or a sample of the region. With their per-channel median $m$ and covariance $\Sigma$ (regularised on the diagonal):

$$
w = \frac{(\Sigma + \epsilon I)^{-1} (\mu - m)}{\lVert (\Sigma + \epsilon I)^{-1} (\mu - m) \rVert}, \qquad \epsilon = \frac{0.02 \operatorname{tr}\Sigma}{3} + 10^{-5}
$$

Code: `apps/web/src/lib/colour-axis.ts`, `axisOf`, `fisherAxis`. `apps/web/src/lib/hole-detection.ts`, `MIN_SEP`.

The axis is refused when the separation $\Delta = w^\top (\mu - m)$ is below 0.02 (scaled by the contrast setting) or when fewer than 30 surrounding pixels are sampled.

Each working pixel is projected onto the axis, with the surroundings at 64 and a hole as separated as the picked one at 192:

$$
P = \operatorname{clamp}\left(64 + 128\, \frac{w^\top F - w^\top m}{\Delta},\, 0,\, 255\right)
$$

Code: `apps/web/src/lib/colour-axis.ts`, `project`.

### Blob response

Three passes of a box filter of radius $r$ approximate a Gaussian of standard deviation

$$
\sigma = \sqrt{\frac{(2r + 1)^2 - 1}{4}}
$$

Code: `apps/web/src/lib/blob-detector.ts`, `sigmaOf`, `radiiOf`.

The scales are $\sigma = f D$, with $f \in \{0.12, 0.17, 0.24, 0.34\}$ to find peaks plus $0.48$ to size holes, each realised by the nearest whole box radius of at least 1 (repeats dropped). The Hessian of the smoothed image $B$ comes from central differences. The scale-normalised response keeps blobs brighter than their surroundings in both directions. A ring line, with one eigenvalue near 0, gives none:

$$
\lambda_\mathrm{max} = \frac{L_{xx} + L_{yy}}{2} + \sqrt{\left(\frac{L_{xx} - L_{yy}}{2}\right)^2 + L_{xy}^2}, \qquad \mathcal{R} = \begin{cases} -\sigma^2 \lambda_\mathrm{max} & \lambda_\mathrm{max} \lt 0 \\ 0 & \text{otherwise} \end{cases}
$$

Code: `apps/web/src/lib/blob-detector.ts`, `response`, `space`.

Peaks are local maxima over space of the largest response over the scales, one per $0.8 D$, placed to sub-pixel by a parabola through the neighbours. A disc of radius $\rho$ gives its strongest response at $\sigma = \rho / \sqrt 2$, so the hole diameter at a peak is

$$
D_\mathrm{hole} = 2\sqrt{2}\, \sigma^\ast
$$

Code: `apps/web/src/lib/blob-detector.ts`, `peaksOf`, `sigmaAt`. `apps/web/src/lib/hole-detection.ts`, `D_OVER_SIGMA`.

with $\sigma^\ast$ the scale of the strongest response, refined by a parabola in $\ln\sigma$ through the neighbouring scales.

### Hole shape and tests

The top-hat is the projection blurred by a box of radius 1 ($P_\mathrm{s}$) minus its opening by a square of side about $2D$, computed on a copy shrunk by 2:

$$
\mathrm{hat} = P_\mathrm{s} - (P_\mathrm{s} \ominus Q) \oplus Q
$$

Code: `apps/web/src/lib/hole-detection.ts`, `pipeline` (`topHat`). `apps/web/src/lib/raster-ops.ts`, `open`, `morph`, `minMax`.

with erosion $\ominus$ and dilation $\oplus$ by the square $Q$, each a running minimum or maximum with three comparisons per pixel whatever the size.

With the median response $r_5$ and the median top-hat contrast $c_5$ (mean over $0.25 D$) of the five strongest peaks, the hole mask and the tests on a peak are

$$
\mathrm{mask} = \mathrm{hat} \gt 0.35\, c_5, \qquad \mathcal{R} \ge \kappa\, r_5, \qquad \sqrt{\max_{0.3 D} \delta^2} \ge 0.2 D, \qquad \frac{A_\mathrm{mask}(0.5 D)}{A(0.5 D)} \ge 0.3
$$

Code: `apps/web/src/lib/hole-detection.ts`, `pipeline` (`testPeaks`, `threshold`, `standsOut`), `KEEP`, `INSCRIBED`, `FILL`, `HAT`, `FLOOR`. `apps/web/src/lib/raster-ops.ts`, `distanceSquared`.

with:

- $\kappa = 0.35$ at the default contrast setting
- $\delta$ the inscribed radius: Euclidean distance of a mask pixel to the nearest pixel outside the mask
- the last ratio: filled share of the disc of radius $0.5 D$

Only peaks with a top-hat contrast of at least 40 count.

### Count per part

The kept peaks of one 8-connected part of the mask are its shots, each with the diameter of a disc of the part's area $A$ shared by its $k$ peaks. A part with more area than its peaks explain is print and is dropped:

$$
D_\mathrm{part} = \sqrt{\frac{4 A}{\pi k}}, \qquad D_\mathrm{part} \gt 3 D \Rightarrow \text{dropped}, \qquad \text{confidence} = \operatorname{clamp}\left(\frac{\mathcal{R}}{r_5}, 0, 1\right)
$$

Code: `apps/web/src/lib/hole-detection.ts`, `pipeline`, `shotsFromParts`, `MAX_PART`. `apps/web/src/lib/raster-ops.ts`, `components`.

A proposal with a confidence below 0.5 is shown as "maybe": the user can accept it on the photo, but Accept all and the proposal count leave it out. On the drawn test photos every true hole scores at least 0.63, so the tier loses none of them.

Code: `apps/web/src/lib/hole-proposals.ts`, `MAYBE_BELOW`, `isMaybe`.

### Hole size

From a picked hole, the size is the hole diameter at the strongest wide-scale peak within $D$ of the pick, clamped to 0.7 to 1.4 of the expected size. The median diameter of the five strongest kept peaks then refines it once, when it differs by more than 12 %:

$$
D' = \operatorname{clamp}\left(\operatorname{median}_{5} D_\mathrm{hole},\, 0.7 D_0,\, 1.4 D_0\right)
$$

Code: `apps/web/src/lib/hole-detection.ts`, `estimateHoleSize`, `pickedSize`, `estimateSize`, `SIZE_MIN`, `SIZE_MAX`.

The expected hole size, first match:

$$
D_0 = \begin{cases} D_\mathrm{typed} & \text{typed} \\ \operatorname{median}(D_\mathrm{confirmed}) & \text{at least 3 confirmed holes} \\ d_b & \text{bullet known} \\ d_\mathrm{marker} & \text{otherwise} \end{cases}
$$

Code: `apps/web/src/lib/hole-proposals.ts`, `expectedHoleSize`, `MIN_HOLES_TO_LEARN_SIZE`.

An accepted proposal that is the only shot of its part keeps its measured diameter:

$$
d_\mathrm{hole} = \frac{b\, D_\mathrm{part}}{k_\mathrm{px}}
$$

Code: `apps/web/src/lib/hole-proposals.ts`, `acceptProposals`.

### Caliber candidates

The result line offers the caliber classes of the group's discipline, the one its target event scores, as one button each; a group without a discipline offers the classes of every discipline on its target. Their order and the class preselected depend on where the hole size $D_0$ comes from.

A nominal size (a bullet or a marker) is compared with the classes' nominal diameters $d_c$. The class nearest to it comes first, with every class within the resolution of its diameter:

$$
|d_c - d_\mathrm{nearest}| < \Delta_d, \quad \Delta_d = 0.5\ \mathrm{mm}
$$

Code: `apps/web/src/lib/caliber-candidates.ts`, `caliberCandidates`, `HOLE_SIZE_RESOLUTION`.

Those classes share a hole size: a class of the user's firearms or loads (one of its cartridges) comes first among them. The other classes follow by $|d_c - D_0|$. The nearest class is preselected when no other shares its hole size, else none is.

A typed, learned or measured size is a hole in paper, which shows smaller than its bullet, so it preselects nothing. The classes it fits within the detector's band come first, the user's first among them, then by how near $D_0 / d_c$ is to 1:

$$
0.7\, d_c \le D_0 \le 1.4\, d_c
$$

Code: `apps/web/src/lib/caliber-candidates.ts`, `caliberCandidates`, `HOLE_BAND`.

Without a hole size the classes keep their order, the user's first, and none is preselected. Picking a class sets the hole size to its nominal diameter (one undo step) and the run follows; the Caliber item names the class until the size changes another way, such as the size an auto run measures. The class picked is not stored. Proposals stay out of the statistics until accepted.

### Strays

With four or more proposals, a proposal is dropped as print, stain or background when its nearest other proposal lies farther than four times the median of these nearest distances plus two hole diameters:

$$
\min_{j \ne i} \lvert p_i - p_j \rvert \gt 4\, \operatorname{median}_k \min_{j \ne k} \lvert p_k - p_j \rvert + 2 b D
$$

Code: `apps/web/src/lib/hole-detection.ts`, `dropStrays`, `toProposals`.

With a found target and no region drawn, the region is the target, and a flier on it is a shot: no proposal is dropped as a stray. A drawn region keeps the stray rule.

### Print on the target

A mark within half a hole of the working image's edge leaves a run: a ring line or the sheet's edge meets the photo's edge there. With a found target, these marks are print and leave it too:

- a dark mark on the black area or a light one on the paper whose confidence is below 0.8;
- the marks where the ring numerals stand, when the run or the seed runs hold three or more there. They stand on the target's axes, between two ring lines, within $\min(6\ \text{mm}, 0.3 g)$ of an axis, with $g$ the ring spacing;
- the marks where the quarter marks of the black area stand, when three or more stand on different axes: on an axis within $0.5$ hole diameters of it and within one hole diameter of the black area's edge. The numerals' evidence from the other runs does not count for them.

A hole on a numeral or a quarter mark makes a larger part than the print beside it. Of the marks where one kind of print stands, a mark whose part has a disc diameter $D_\mathrm{part}$ (the part's area per peak, as in the count per part) above 1.2 times the lower median of those of the group but within $1.4 D$ is a hole and stays. A larger part is print that merged with a neighbour, and the others are print:

$$
1.2\, \operatorname{median}_\mathrm{low} D_\mathrm{part} \lt D_\mathrm{part} \le 1.4\, D \Rightarrow \text{kept}
$$

Code: `apps/web/src/lib/hole-detection.ts`, `printAmong`, `HOLE_ON_PRINT`, `SIZE_MAX`.

The target plane is found without a turn of its own, so the axes are turned by the angle $\phi$ from the nearest axis that most marks in the numeral rings share within 2 degrees (when those give none, the marks where the quarter marks stand), the axes repeating every quarter turn. It needs three marks at least, two of them at one radius (within 3 %) on two axes as the numerals of a ring stand, else it is 0:

$$
\phi = \arg\max_{\phi_i} \#\left\{ j : \left\lvert \phi_j - \phi_i \right\rvert_{\mathrm{mod}\ 90^\circ} \le 2^\circ \right\}
$$

Code: `apps/web/src/lib/hole-detection.ts`, `dropPrintMarks`, `numeralRoll`, `ROLL_SPREAD`, `polar`, `PRINT_CONFIDENCE`, `NUMERALS_MIN`. `apps/web/src/lib/target-face.ts`, `faceLabel`, `QUARTER_WIDTH`, `QUARTER_REACH`.

### Target area

Without a marked region or a found target, the target is the convex hull of the largest light part of the photo. The luma of blocks of about 1/256 of the longer side is split at Otsu's threshold, the bin $t$ that maximises the between-class variance:

$$
Y = 0.299 R + 0.587 G + 0.114 B, \qquad t = \arg\max_t\, \omega_0(t)\, \omega_1(t) \left(\mu_0(t) - \mu_1(t)\right)^2
$$

Code: `apps/web/src/lib/target-paper.ts`, `paperOutline`, `otsu`, `luminance`, `convexHull`.

The whole photo is used when the light part covers less than a tenth of it or the class means differ by less than 40.

With a found target and no marked region, it is the target's outer ring grown by half a hole, without the parts that lie neither on its black area nor in that hull: the outer rings of a target on an insert card run past the card onto the table. A hull that leaves more than 5 % of the black area out is the lit part of a sheet in a shadow and cuts nothing.

Code: `apps/web/src/lib/hole-detection.ts`, `offSheet`.

### Target

The target search runs on the whole photo before a detection (`findFace`) and gives the scale, the centre and the target record:

1. Black area: the grey levels on a grid of about 500 pixels on the longer side are cut at nine thresholds between their 2nd and 98th percentile. Each compact grey component is filled and fitted by a robust ellipse through its outline. A component the photo's edge cuts is fitted to its outline inside the photo only, and is kept when half of the ellipse and its centre lie in the photo. A candidate needs paper about it: at least 60 % of the points 1.1 to 1.3 times out from its ellipse that lie in the photo are lighter than its threshold, so a disc inside the black area bounded by a light ring line is no candidate.
2. Ring lines: Hessian ridges on a crop of up to 2.8 black radii, averaged so the black area is at most about 500 pixels across (a zoomed photo's thick lines stay lines), grouped by their radius relative to the black edge, one robust ellipse per group. When the black edge's ellipse is flatter than 0.9 (a sheet seen at a slant), the outer rings are not concentric with it on the photo and their relative radii run into each other: the conic pencil of the black edge and the ring farthest from it in radius (its ratio within 6 % of the mean radii's) maps the photo onto the target's plane, and the ridges are grouped again by their radius there.
3. Targets: a target record with `photoSearch: false` is skipped. With a known scale (a calibrated sheet gives the photo's pixels per mm, `pxPerMm`) a target is skipped when the pixels per mm its black diameter needs for the black area's long semi-axis differ from that scale by more than 20 % (`SCALE_TOLERANCE`): targets with the same ring ratios at another size drop out. The black edge is the target's black diameter, which fixes a scale $s$ per target. A ring found at radius $\rho_j$ matches the target ring $r_i$ when $\lvert s r_i / \rho_j - 1 \rvert \le 0.03$, closest pairs first. A target ring is expected when it lies between 0.15 and 2.9 black radii and half of its line falls inside the photo: outer rings cut off by the photo's edge or beyond an insert card do not count against a target. With $a_j$ the share of the ring's ellipse its line covers, $e_j$ that relative error, $n_\mathrm{miss}$ the target rings expected and not found and $n_\mathrm{extra}$ the rings found that match none:

$$
S = \sum_j \left(0.6 + 0.4\, a_j\right) \left(1 - \frac{e_j}{0.06}\right) - 0.3\, n_\mathrm{miss} - 0.1\, n_\mathrm{extra}
$$

Code: `apps/web/src/lib/target-face.ts`, `matchFaces`, `scoreMatch`, `shareInFrame`.

4. Every target within 0.5 of the best score with at least 3 rings matched is offered. Targets whose rings the photo shows in the same ratios (an insert card shows rings shared by several targets) are a choice for the user.
5. The plane: the pair of matched ellipses farthest apart in radius gives the target plane by the conic pencil of two concentric circles, which removes the perspective. A plane whose ellipses do not rectify to circles of the target's radii within 1.5 % of the black radius (rms) drops its worst ring and tries again.

One target with at least 4 rings matched and a score of 2.5 calibrates the sheet without a question. Otherwise the editor shows what was found and opens the scale step: the user chooses the target, types the black diameter or marks a ring of known size in Calibrate.

The active group takes the target for ring scoring with the event the user chose, else the event of its discipline on this target, else the target's event at the group's distance: of the federation chosen for the Discipline list, else of the federation that publishes the target, else of the one federation that shoots the target there. Otherwise the group has no event and the Discipline list stays empty: no federation is guessed (`apps/web/src/lib/face-sheet.ts`, `calibrateSheetOnFace`).

Code: `apps/web/src/lib/target-face.ts`, `findFace`, `ringLines`, `ringPlane`, `matchFaces`, `scoreMatch`, `shareInFrame`, `fitFace`, `TIE`, `SCALE_TOLERANCE`, `BLACK_PX`. `apps/web/src/lib/face-image.ts`, `blackAreas`, `blobOf`, `shareInside`, `paperAround`. `apps/web/src/lib/ellipse.ts`, `ransacEllipse`, `concentricPlane`.

### Detection without a picked hole

1. The log luma is rescaled from its 0.5th to its 99.8th percentile in the region. Its four strongest blobs of each polarity each seed a colour axis and a run.
2. A run is kept when it finds at least two shots of alike size: no more than a quarter of the sizes lie off their median by more than 35 %, and that median is at least half the expected hole size. Grain of the photo, on a dark target with dark holes the strongest light blobs, gives alike blobs far below that size, and runs of them agree with each other more than the holes' runs do.
3. The run whose shots the other runs find again most often (within $0.5 D$) is proposed, then run again on the full working image. The seed runs use a working image with holes of about 12 pixels (0.75 times 16).

Code: `apps/web/src/lib/hole-detection.ts`, `autoDetect`, `runSeeds`, `SEED_MIN_SIZE`. `apps/web/src/lib/colour-axis.ts`, `rescale`, `logLuma`.

### Photo quality

The target search also checks the photo for what makes holes hard to find, on the photo resized to 2000 px on its longer side, and says what to change when retaking it. A problem has a level: fair (a note) or bad. A photo with a bad problem is below the minimum quality: when the target search finds exactly one sure fit, the run on an added photo applies the target and waits, and the button reads Detect anyway. With several fits or none the run goes on in the guided steps, which show no Detect anyway. Every other problem is a note beside the run. The check never says that a photo is good or that a detection is right.

With the black area found (ellipse axes $a \ge b$, centre $c$), the measures are:

$$
\theta = \arccos\frac{b}{a}, \qquad s_\mathrm{in} = \frac{\text{area of the ellipse inside the photo}}{\text{area of the ellipse}}
$$

Code: `apps/web/src/lib/photo-quality.ts`, `photoQuality`. `apps/web/src/lib/face-image.ts`, `shareInside`.

The paper level $P$ is the 75th percentile of the grey blocks in the ring from 1.12 to 1.4 radii of the ellipse, the black level $K$ the 20th percentile of the blocks inside 0.8 radii (a white zone inside the black area does not raise it), and the contrast is $P - K$. Without paper blocks in the frame (the black area fills it) there is no contrast. The grey blocks come from a grid of about 700 blocks on the longer side. Glare is the share of the ring's lit blocks (grey of 120 or more) that are saturated (250 or more), counted only while the median of the other lit blocks is at most 232, so a white scan is not glare. Uneven light is the spread of the median grey levels $m_j$ of the ring's four sides, left and right, above and below the centre (three sides suffice), relative to the largest:

$$
u = \frac{\max_j m_j - \min_j m_j}{\max_j m_j}
$$

Code: `apps/web/src/lib/photo-quality.ts`, `sidesDifference`.

Sharpness is the width of the black area's edge in holes. On 120 rays along the ellipse's normals the grey profile across the edge is aligned at its steepest rise and averaged. With the grey step $\Delta g$ and the steepest rise $g'$ per px, the edge width is $w = \Delta g / g'$, and the measure is $w / D_\mathrm{px}$. Rays whose step is below 25 grey levels are left out, and no measure is given when fewer than a quarter of the rays remain. Without a fitted target the hole diameter in this ratio is taken as 6 % of the black area's mean diameter.

Without a black area, or where its edge gives no measure, the sharpness is read from the edges the photo has, whatever the pattern of the target. On a lattice of 3 px the 6000 points of strongest grey gradient are tried in that order. At each the grey profile along the gradient, over 0.75 hole diameters to each side, gives the same width $w$ when its two ends differ by at least 40 grey levels (the edge of a filled zone or of a hole); thin lines do not qualify. The median of up to 300 widths is divided by $D_\mathrm{px}$, with the hole taken as one eightieth of the longer side without a fitted target. No measure is given when fewer than 20 points qualify, so a photo of thin rings and no hole, or of no edge at all, gets none.

The hole diameter on the photo as taken is $D_\mathrm{px} / k$ for the resize factor $k$ (the target's scale times the bullet diameter, or the same 6 % without a fitted target). A photo with no black area found is judged by its brightness, by glare and uneven light counted over the whole photo, and by its size, none of which needs a black area. Brightness $B$ is the 95th percentile of the grey blocks of the whole photo. The light is the spread of the 90th percentile of each quarter of the photo (as $u$ above), given when at least three quarters have a 90th percentile of 120 or more, so a photo filled by a black zone has none.

| Problem | Fair from | Bad from | Message and fix |
| --- | --- | --- | --- |
| Tilt, with the black area at least 0.9 inside | $\theta > 30^\circ$ | $55^\circ$ | "The target is photographed at a slant of about N degrees." Retake from straight above, with the camera parallel to the paper. |
| Framing, with no target selected or recognised | $s_\mathrm{in} < 0.9$ | $0.5$ | "The black area of the target is cut off by the edge of the photo." Retake with the whole target and some paper around it in the frame. |
| Sharpness | $w / D_\mathrm{px} > 0.3$ | $0.6$ | "The photo is soft: the edges of the target are blurred." Hold the camera steady or rest it on something, let it focus on the target and retake. |
| Hole size | under 6 px | 3.5 px | "A bullet hole is only about N px across in this photo." Move closer so the target fills more of the frame, or use the full resolution of the camera. |
| Contrast, with a black area | $P - K < 80$ | $45$ | "The black area and the paper are close in brightness." Retake with more light on the target and without a photo filter. |
| Brightness, without contrast | $B < 90$ | $50$, for a selected target without a black zone only | "The photo is dark: even its brightest part is dim." Retake with more light on the target and without a photo filter. |
| Glare | share $> 0.04$ | $0.15$ | "A bright reflection covers part of the paper." Retake with the light from the side, or turn the sheet a little to move the reflection off the target. |
| Uneven light | $u > 0.25$ | $0.45$ | "The light is uneven: one side of the target is much darker than another." Retake in an even light with no shadow of your hand or phone on the sheet. |

Without a black area and with no edge of a target or a hole found, the photo is reported at the bad level with "No edge of a target or a hole was found in this photo." and the fix "Retake with the target in the frame, in even light and held steady, or set the scale by hand." (the run is not held: with no target applied it already asks for the scale). With edges, a target without a black area (all white, or rings only) is not told that something is missing. Its size message reads "The photo is only N px on its longer side." with the hole size's fix, judged as a hole of one eightieth of the longer side (fair under 480 px, bad under 280 px).

A selected target (the group's target record, or the target found for sure) is a hint, never a requirement: the photo may show only its centre, cut through its rings or show the whole sheet, so no ring, outer border or size is expected and none is warned about. The one thing used is whether a ring's fill is black (`layoutOf`; a record with no fills gives none, as do most records today). With a black zone, a photo with no black area found (it may fill the frame) is not judged by its brightness, and its darkest 5 % above grey level 110 (fair) or 150 (bad) says "The black zones of the target look grey." With a target without a black zone, a dark photo is at the bad level; without a target it stays at the fair level, since a photo filled by a black zone looks the same. The framing note is left out as soon as a target is known, and tilt is not given for a black area the frame cuts.

Code: `apps/web/src/lib/photo-quality.ts`, `photoQuality`, `belowMinimum`, `layoutOf`, `limits`, `edgeWidth`, `edgeSharpness`, `gridMeasures`. `apps/web/src/lib/hole-detection.worker.ts`, `handleFace`. `apps/web/src/components/hole-detection.tsx`, `QualityNotes`.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `apps/web` |
| --- | --- | --- | --- |
| $d_b$ | Bullet diameter or expected hole diameter | mm | m |
| $k_\mathrm{px}$ | Photo pixels per m of the target near the region | no kind | px/m |
| $h$ | Visible hole diameter over the bullet diameter | 1 | 1 |
| $D_\mathrm{px}$, $D$ | Expected hole diameter in photo and in working pixels | no kind | px |
| $b$ | Block size, photo pixels per working pixel | 1 | 1 |
| $W$, $H$ | Width and height of the region with its margin | no kind | px |
| $\bar I_c$, $F_c$ | Mean colour of a block (0 to 255) and its logarithm | no kind | 1 |
| $\mu$, $m$, $\Sigma$ | Hole colour, median and covariance of the surroundings in log RGB | no kind | 1 |
| $w$, $\Delta$ | Unit colour axis and the separation of hole and surroundings along it | no kind | 1 |
| $\theta$, $s_\mathrm{in}$ | Tilt of the black area's plane and its share inside the photo | degree, 1 | degree, 1 |
| $P$, $K$, $u$ | Paper level, black level (0 to 255) and the relative difference of the light between the paper's four sides | no kind | 1 |
| $P$ | Projection onto the colour axis, 0 to 255 | no kind | 1 |
| $r$, $\sigma$, $f$ | Box radius, scale, scale over hole diameter | no kind | px, px, 1 |
| $L_{xx}, L_{yy}, L_{xy}$ | Second differences of the smoothed projection | no kind | 1/px² |
| $\mathcal{R}$ | Scale-normalised blob response | no kind | 1 |
| $D_\mathrm{hole}$, $D_\mathrm{part}$ | Hole diameter at a peak, disc diameter per shot of a part | no kind | px |
| $r_5$, $c_5$ | Median response and median top-hat contrast of the five strongest peaks | no kind | 1 |
| $\kappa$ | Share of $r_5$ a peak must reach | 1 | 1 |
| $\delta$ | Distance of a mask pixel to the nearest pixel outside the mask | no kind | px |
| $A$, $k$ | Area of a part, peaks in it | no kind, 1 | px², 1 |
| $D_0$, $D'$ | Expected hole size, refined size of a run | mm, no kind | m, px |
| $d_\mathrm{hole}$ | Measured hole diameter of an accepted shot | mm | m |
| $d_c$, $d_\mathrm{nearest}$, $\Delta_d$ | Nominal diameter of a caliber class, of the class nearest to the hole size, and the resolution under which classes share a hole size | mm | m |
| $Y$, $t$ | Luma, Otsu threshold | no kind | 0 to 255 |
| $\omega_0, \omega_1$, $\mu_0, \mu_1$ | Class weights and mean lumas below and above $t$ | no kind | 1 |
| $s$ | Photo pixels per mm of a target, from its black diameter | no kind | px/mm |
| $\rho_j$, $r_i$ | Mean radius of a ring found and radius of a target ring | no kind, mm | px, mm |
| $a_j$, $e_j$ | Share of a ring's ellipse its line covers, relative radius error of a match | 1 | 1 |
| $n_\mathrm{miss}$, $n_\mathrm{extra}$ | Target rings expected and not found, rings found that match none | 1 | 1 |
| $S$ | Score of a target | 1 | 1 |
| $g$, $\phi$ | Ring spacing, turn of the target's axes on the photo | mm, degree | mm, rad |

## Assumptions

- A hole shows one colour, the backing seen through it, that differs from the paper or the black area around it along one direction in log RGB.
- Holes are round blobs about the expected size, within 0.7 to 1.4 of it.
- Overlapping holes form one connected part whose area is shared equally by its peaks.
- With a found target, a dark mark on the black area and a light mark on the paper are print unless their confidence reaches 0.8, and marks where the ring numerals or the quarter marks of the black area stand are print when they appear at three or more places and are no larger than the print there (section Print on the target).
- Quarter marks are small marks about a hole's size on the four axes at the black area's edge. Where a target prints another kind of mark, it is proposed as a hole.

## Limits

- The thresholds and scale sets are the app's own values from a prototype, without a published source. So is the resolution $\Delta_d$ of the caliber candidates. So are the limits of the photo quality check.
- The photo quality check reads the black area's ellipse: a target whose black area is not found is judged by brightness, glare and light over the whole photo, edge sharpness and size. A tilt of a photo whose target shows no black area, and a reflection on the black area, are not measured. A black zone that fills the photo of a target that is not selected looks like a dark photo (a fair note). The blur of a photo with thin rings and no hole is not measured. A photo with none of the problems may still give wrong or missing holes.
- Torn or elongated holes, holes in a printed line and very close holes may be missed or miscounted. The user confirms, moves or deletes each proposal.
- A hole within half a hole of the photo's edge is not proposed.
- A shadow confined to the outer paper can be mistaken for the sheet edge while the black area stays lit, so holes in that shadow can be omitted. Marking a region bypasses the automatic sheet boundary.
- A hole whose backing is about as dark as the black area around it, with light torn rims, is often missed there.
- A hole where print stands (a numeral, a quarter mark) whose part has a disc diameter of up to 1.2 times the lower median of the print there is dropped with it. A hole on a numeral or beside it that makes a part above that stays, unless the part reaches past what a hole can be (1.4 times the expected size).
- Print whose parts differ by more than about a fifth in disc diameter (digits of quite different sizes on one target) can read as holes on print: numerals of 4 and 5 mm width pass, a 6.5 mm width among 4 mm ones does not (synthetic digits).
- A run whose strongest peaks are smaller than half the expected hole size is cut as grain, so holes visible at under about half the expected size are not found without a picked hole.
- A hole under 4 photo pixels across is refused. So is a region whose working image would leave a hole fewer than 4 working pixels.
- Without a known scale the search cannot tell targets of equal ring ratios and different size apart, and a target that is penalised for rings the photo does not show can rank behind a larger twin outside the tie window.
- The target search does not read the ring numerals: on a photo of an insert card the targets whose inner rings stand in the same ratios are offered for the user to choose.
- The photo scale comes from the sheet's calibration near the middle of the region. Perspective across the region is not corrected per hole.

## Sources

- [Fisher 1936](../bibliography.md#fisher-1936): linear discriminant of two classes, pp. 179 to 188, equation numbers unverified.
- [Lindeberg 1998](../bibliography.md#lindeberg-1998): scale-normalised derivatives and blob detection with automatic scale selection, section numbers unverified.
- [Serra 1982](../bibliography.md#serra-1982): erosion, dilation, opening and the top-hat, chapter numbers unverified.
- [van Herk 1992](../bibliography.md#van-herk-1992), pp. 517 to 521, and [Gil 1993](../bibliography.md#gil-1993), pp. 504 to 507: running minimum and maximum with three comparisons per pixel.
- [Felzenszwalb 2012](../bibliography.md#felzenszwalb-2012), pp. 415 to 428: Euclidean distance transform by the lower envelope of parabolas.
- [Otsu 1979](../bibliography.md#otsu-1979), pp. 62 to 66: threshold that maximises the between-class variance.
- [Andrew 1979](../bibliography.md#andrew-1979), pp. 216 to 219: convex hull by the monotone chain.
- [ITU-R BT.601](../bibliography.md#itu-r-bt-601): luma weights, section number unverified.
- [Fitzgibbon 1999](../bibliography.md#fitzgibbon-1999), pp. 476 to 480, in the form of [Halir 1998](../bibliography.md#halir-1998), pp. 125 to 132: direct least-squares ellipse fit.
- [Gurdjos 2006](../bibliography.md#gurdjos-2006), pp. 238 to 252, and [Gurdjos 2002](../bibliography.md#gurdjos-2002), pp. 252 to 266: the centre and the plane of concentric circles seen in perspective.
