---
title: Bullet geometry from photographs for records without it
description: How well the bullet photo tool measures catalogue bullets in own and product-style photographs, whether makers' online images can fill missing lengths, and what has to be measured instead.
---

# Bullet geometry from photographs for records without it

## Question

Seated volume and bullet records: can the [bullet from a photo](../models/bullet-photo.md) tool fill the length, nose and boat tail of bullet records that lack them from images found online, and how accurate is it on the catalogue's own bullets?

## Method

Decided before the run.

- **Data coverage.** Count the bullet records (`packages/data/records/bullets/`, 1,686 files on 2026-11-01) by maker and by geometry field.
- **Accuracy.** Truth: the drawing (`bulletDimensions`, `bulletOutline`) of up to six records with a length per maker, taken from its files in name order at a step of the maker's count over six (a maker with fewer than twelve gives its first six, one with six or fewer all of them): Cutting Edge, Hammer, Lehigh and Missouri Bullet six each, Berger 2, Nosler 1 and the two demo records, 29 bullets and three boat tails of the existing photo tests, 32 bullets from 10.5 to 58 mm long. A record with a boat-tail length and no base type (Berger) is drawn as a boat tail. Each bullet is rendered with `renderPhoto` in eight scenarios and measured with the steps of the tool's worker (`segmentPhoto`, `fitOutline`, `outlineHints`, `resolveScale`, `measureOutline`):
  - A: own photograph beside a ruler, 24 px per mm, scale from the ruler.
  - B, C, D: product-style image (light background, side shading, noise 3, blur 1 px, no ruler) with the bullet 900, 450 and 225 px long, scale from the record's diameter only.
  - E: C through a JPEG of quality 70. F: C with a soft drop shadow (offset 2 and 3 % of the length, depth 0.2). G: C with the scale from the diameter and the length. H: C with the bullet turned 10 degrees towards the camera.
- **Metric.** The median and P90 of the absolute error of the length, L/D, nose length, boat-tail length, outline volume and the volume seated one calibre deep (half the length below 2.5 calibres) at a fixed COAL. The count of length errors within 3 stated standard uncertainties, of false boat tails on flat bases and of photographs with a warning.
- **Accept rule.** A route is useful for a record when its length error at P90 moves the simulated peak pressure by less than the 1 % volume band the pressure range already uses (about 2 % peak on a rifle case, #836), and when its photograph can be checked to show the bullet at its true proportions.
- **Online sources.** For 20 records without a length (Hornady 6, Sierra 5, Sellier & Bellot 4, Sako 2, Lehigh 2, Missouri Bullet 1, Lapua 1), what the maker's product page and catalogue print (length, other geometry, a drawing), what images it has (side view, scale, rendering or photograph, size) and the site's terms. Robots rules followed, downloads kept outside the repository, no image committed.

## Formulas

The pipeline is the one of the model page. At a fixed COAL the seating depth moves with the bullet length, so a length error $\Delta L$ moves the volume below the mouth by $\Delta V \approx \frac{\pi}{4} d^2 \Delta L$ (`intrusion` in `packages/drawing/src/seating/seating.ts`). With the scale from the diameter alone, $k = d_\mathrm{px} / d$, every length is $L = L_\mathrm{px}\, d / d_\mathrm{px}$, so the relative error of $L$ is that of $L_\mathrm{px}/d_\mathrm{px}$: only the ratio is measured. A bullet turned by $\varphi$ towards the camera keeps its diameter and shows $L \cos\varphi$, $1 - \cos 10^\circ = 1.5\,\%$. The peak pressure moves by about 1.9 % per 0.5 mm of seating depth in a rifle case and 9.9 % in a 9 x 19 mm case (solver runs of #836); the existing length regression has an rms of 10.5 % of the length, which moves the peak pressure by about 7 to 8 % (rifle) and 17 to 30 % (9 x 19 mm) (#860, #823).

## Numbers

**Coverage.** 697 of 1,686 records have no `length` (Hornady 314 of 314, Sierra 240 of 240, Sellier & Bellot 105 of 105, Sako 23 of 23, Lehigh 10, Missouri Bullet 3, Lapua 1, Hammer 1). `noseLength` is on 254 (Hammer 250), a boat-tail length on 3, an ogive on 3, a meplat on 2. Only 4 records (2 Berger, 2 demo) have length, nose and base together.

**Accuracy** (32 bullets per scenario, all measured, median / P90 of the absolute error):

| Scenario | Length % | L/D % | Nose % | Boat tail mm | False tails | Seated volume % | Within 3 u | Warned |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A ruler, 24 px/mm | 0.13 / 0.21 | 0.12 / 0.18 | 0.20 / 0.33 | 0.007 / 0.012 | 0 of 26 | 0.39 / 0.91 | 32 | 0 |
| B 1000 px, diameter | 0.12 / 0.20 | 0.12 / 0.20 | 0.19 / 0.38 | 0.003 / 0.006 | 0 of 26 | 0.39 / 1.1 | 32 | 0 |
| C 500 px, diameter | 0.22 / 0.37 | 0.22 / 0.37 | 0.40 / 0.77 | 0.012 / 0.018 | 0 of 26 | 0.79 / 1.9 | 32 | 0 |
| D 250 px, diameter | 0.45 / 0.74 | 0.45 / 0.74 | 0.85 / 1.7 | 0.052 / 0.072 | 0 of 26 | 1.4 / 3.5 | 32 | 1 |
| E 500 px, JPEG 70 | 0.22 / 0.41 | 0.22 / 0.41 | 0.39 / 0.79 | 0.025 / 0.037 | 0 of 26 | 0.79 / 2.0 | 32 | 0 |
| F 500 px, drop shadow | 10 / 12 | 10 / 12 | 21 / 29 | 0.47 / 0.72 | 26 of 26 | 43 / 59 | 32 | 24 |
| G 500 px, diameter and length | 0.025 / 0.039 | 0.22 / 0.37 | 0.19 / 0.41 | 0.011 / 0.018 | 0 of 26 | 0.43 / 0.73 | 32 | 0 |
| H 500 px, tilted 10 degrees | 1.8 / 1.9 | 1.8 / 1.9 | 1.9 / 2.3 | 0.077 / 0.097 | 0 of 26 | 6.0 / 8.7 | 2 | 0 |

In millimetres the length P90 is 0.050 (A), 0.14 (C), 0.27 (D), 4.3 (F) and 0.69 mm (H). The drop shadow widens the cut-out on one side, so the scale from the diameter is too large, every length too short, and the shadow's taper at the base reads as a boat tail on every flat base; its stated uncertainty grows to about 6 % of the length, so the error stays within 3 u, and 8 of 32 photographs get no warning while 1.7 to 5.5 % short (one 3.0 % long). The tilt is not seen at all: 30 of 32 lengths lie outside 3 u with no warning.

**Pressure.** The length P90 converted at 1.9 % per 0.5 mm (rifle, 31 mm bullet) and 9.9 % per 0.5 mm (9 x 19 mm, 15 mm bullet): A 0.25 and 0.6 %, C 0.4 and 1.1 %, D 0.9 and 2.2 %, H 2.2 and 5.6 %, F above 14 and 30 %. A caliper reading (0.05 mm, `bulletLengthTolerance.measured`) gives 0.19 and 1.0 %; the regression 7 to 8 and 17 to 30 %.

**Online sources** (20 records, pages read 2026-11-01):

- No product page or current catalogue of Hornady, Sierra, Sellier & Bellot, Sako, Missouri Bullet or Lapua prints a bullet length, nose length, boat tail, meplat or a dimensioned drawing for these bullets; none publishes CAD. Sierra's load data prints the cartridge length per bullet, Sako's reloading PDF weight, BC and cartridge length. Lehigh's old store interface had length and ogive-length fields (the source of its 121 records with a length); the domain now redirects to Wilson Combat, whose pages show neither.
- Images: Hornady product images are 600 x 624 px side-view renders filling the frame; the 162 gr 7 mm and the 220 gr .30 ELD-X give the same L/D (5.217) and the same height in pixels, so they are fitted to the frame, not drawn to scale. Sierra has 540 x 600 px side views on white without a scale; Sellier & Bellot a group photograph of boxes and bullets; Sako mood photographs at an angle; Lehigh/Wilson Combat a box and three bullets in perspective; Lapua real photographs without a scale (not used, see below). No image of any maker carries a ruler or a grid.
- The Hornady 2026 catalogue's small side-view pictures (about 100 to 170 by 23 to 34 px) give a picture height over printed diameter of about 101.8 px per inch, within about 1 %, from .243 to .338: they may share one scale. At about 0.25 mm per pixel that would be about 1 to 2 % of the length, unverified against any bullet of known length.

## Result

No change. Measuring catalogue geometry from online images is not adopted: the tool is accurate enough on a true side view at a known scale (P90 below 0.8 % of the length down to 225 px, also through JPEG), but the makers' images are not true side views at a known scale, a drop shadow or a tilt of 10 degrees takes it beyond the accept rule, and the tool gave no warning on the tilt and is not built to tell a frame-fitted render from a true one; whether either can be told from an image at all was not tested. The evaluation is kept as an opt-in research test. Lengths have to come from a printed source (#860) or a caliper; follow-ups are in the issues linked from the pull request.

## Data basis

Analytic: synthetic photographs rendered from the drawings of bullet records and test shapes; the survey of the makers' pages only reports what they print, and no value from it is stored.

## Where in the app

- `apps/web/test/bullet-photo-catalogue.test.ts` (the evaluation; run with `BULLET_PHOTO_EVAL=<out.json>`).
- `apps/web/src/lib/bullet-photo-colour.ts`, `apps/web/src/lib/bullet-photo-outline.ts`, `apps/web/src/lib/bullet-photo-measure.ts`, `apps/web/src/lib/bullet-photo-scale.ts`, `apps/web/src/lib/bullet-photo-sample.ts`.
- `packages/drawing/src/seating/seating.ts` (seated volume and its length band).
- Model pages: [bullet from a photo](../models/bullet-photo.md), [case capacity](../models/case-capacity.md). Earlier entry: [synthetic photographs](./bullet-photo-synthetic-renders.md).

## Confidence

Medium for the conclusion, low for the absolute accuracy: renders share the drawing with the truth and miss the lens, perspective, render liberties and lot spread of real images, while the survey found the makers' images unusable for a scale on its own.
