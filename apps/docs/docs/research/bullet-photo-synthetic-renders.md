---
title: Bullet from a photo on synthetic photographs
description: Whether the dimensions measured from rendered photographs of bullets of known size lie within their stated uncertainties, also under shadow, blur, noise and uneven light.
---

# Bullet from a photo on synthetic photographs

## Question

Bullet from a photo: do the lengths, diameters and ratios measured from a photograph lie within their stated standard uncertainties of the true values, and does a photograph the model cannot measure well get a warning rather than a confident wrong number?

## Method

`renderPhoto` draws the bullet drawing of known dimensions beside a 45 mm ruler at 24 px per mm, 4 degrees off horizontal, with a slight blur, and the test runs the cut-out, the outline fit and the measurement on it with the scale from the ruler. The true values come from the same drawing. Accept rules, set in the tests:

- Six bullets (tangent and secant ogive, flat base and boat tail, a 2.2 mm meplat, a cannelure): every value within 2 px (3 px for the cannelure width) and within 3 standard uncertainties of the truth; nose form and base type named correctly.
- The same at any angle with the nose to the left, with a lighting gradient, side shading, noise and blur, and for a light bullet on a dark background.
- Hard photographs (a pale tip, a reflection along the axis, black bars at the sides, a colour that differs at the same brightness, a bullet darker on one side and brighter on the other, a soft shadow, heavy blur, low contrast, a small bullet): as each test states, the values within the larger of 3 uncertainties and 2 px of the truth, the length within 0.2 mm, or a warning.
- No confident wrong number: a deep and a faint shadow, a blur of 7 px, a pale bullet, noise of 12 grey levels and a strong lighting gradient each give values within 3 uncertainties, or at least one warning.
- The scale from caliper sizes without a ruler, and its checks against a ruler and between two sizes.

## Formulas

The cut-out threshold maximises the between-class variance of the grey levels ([Otsu 1979](../bibliography.md#otsu-1979)); the axis is the principal axis of the cut-out's moments ([Hu 1962](../bibliography.md#hu-1962)); the nose arcs are geometric circle fits ([Coope 1993](../bibliography.md#coope-1993)) started from the algebraic fit ([Kasa 1976](../bibliography.md#kasa-1976)). A value $v = f/k$ in mm from a fitted pixel quantity $f$ and the scale $k$ has $u(v)^2 = (u_\mathrm{px}/k)^2 + (v\, u(k)/k)^2$, first-order propagation ([JCGM 100:2008](../bibliography.md#jcgm-100-2008), 5.1.2). A value within 3 standard uncertainties of the truth is the usual coverage check for an approximately normal error.

## Numbers

- Six bullets: every value within 2 px, 0.083 mm at 24 px per mm, and within 3 uncertainties; nose form and base type right in each.
- Each hard photograph and each fault: within the accept rule above.
- A photograph at 1.5 px per mm is withheld as unusable; the default render gets no hint.
- Not tested: real photographs. The renders share the bullet drawing with the truth, so an error of the camera, the lens or the ruler's placement that the renderer does not draw is not covered.

## Result

No change. The tests are adopted as regression tests; real photographs stay unverified.

## Data basis

Analytic: synthetic photographs rendered from bullet drawings of known size.

## Where in the app

- `apps/web/test/bullet-photo.test.ts`, `apps/web/test/bullet-photo-quality.test.ts`, `apps/web/test/bullet-photo-scale.test.ts`.
- `apps/web/src/lib/bullet-photo.ts`, `apps/web/src/lib/bullet-photo-outline.ts`, `apps/web/src/lib/bullet-photo-measure.ts`, `apps/web/src/lib/bullet-photo-sample.ts`.
- Model page: [bullet from a photo](../models/bullet-photo.md).

## Confidence

Low: the measurement meets its stated uncertainty on synthetic photographs only; on real photographs it is unverified.
