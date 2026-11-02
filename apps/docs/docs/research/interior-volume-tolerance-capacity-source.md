---
title: Volume tolerance from the capacity source
description: The pressure range's tolerance of the chamber volume set from where the case capacity comes from and from the bullet volume estimate, against the former flat 1 %, with its effect on rifle and handgun cases.
---

# Volume tolerance from the capacity source

## Question

Pressure range of the M3 interior model: should the tolerance of the chamber volume follow the source of the case capacity and the bullet length estimate instead of a flat 1 %?

## Method

Rule from the owner's comment on issue 836: a measured capacity with its spread takes spread over capacity, a measured one without a spread 0.5 %, capacity records of two or more makers their standard deviation over mean, any other record capacity 2 %. The capacity's part is converted to the volume behind the bullet, which the range moves, and the interval of an estimated bullet volume (the class length error of the effective density) adds to it, capped at the API's 0.2. Accept rule: a handgun case gets a wider tolerance than the former 1 % and wider than a rifle case of the same capacity rule; no default ships without its evidence named.

## Formulas

$f_V = \min(f_C\, C / V + h, 0.2)$, with $C$ the case capacity, $V$ the volume behind the bullet, $f_C$ the capacity's relative tolerance and $h$ the relative interval of an estimated bullet volume ([Case capacity, tolerance of the volume](../models/case-capacity.md#tolerance-of-the-volume)). The standard deviation of the makers' records is the sample one, $n - 1$ in the denominator.

## Numbers

Stand-in cases with a catalogue capacity of one maker ($f_C$ = 2 %): .308 with $C$ = 3.6 cm³ and $V$ = 3.1 cm³ gets $f_V$ = 2.3 %; 9 mm with $C$ = 0.86 cm³ and $V$ = 0.55 cm³ gets 3.1 %. Before the change both had 1 %.

Effect on the peak, from the owner's runs of the solver (peak change per 1 % of volume: .308 −1.90 %, .223 −2.43 %, 9 mm −1.42 %): a 2 % capacity tolerance moves the .308 peak by −3.71 / +3.8 %, the .223 by −4.73 %, the 9 mm by −2.79 %; 0.5 % for a measured capacity without a spread moves the .308 peak by −0.96 % and the 9 mm by −0.71 %.

Evidence for the defaults: within one lot of 50 cases a standard deviation of 0.26 % of capacity ([Ammolytics, brass sorting part one](https://blog.ammolytics.com/2020-01-08/brass-sorting-part-one.html), medium-low confidence); between four .308 makers 1.05 % (a magazine chart quoted in a forum, unverified).

## Result

Improved: adopted. The range of a catalogue capacity widens, most for small cases with a deep bullet, and a measured capacity with its spread narrows it. The 0.5 % and the 2 % remain assumptions; a typed volume keeps the former 1 %.

## Data basis

Analytic: the rule applied to stand-in volumes; the cited spreads are public but second-hand.

## Where in the app

- `apps/web/src/lib/volume-tolerance.ts`
- `apps/web/src/components/use-workbench-load.ts` (`runVolumeTolerance`)
- `apps/web/src/components/seating-preview.tsx` (`capacityOf`)
- `apps/web/src/components/workbench-readouts.tsx` (`volumeText`)
- `apps/web/test/volume-tolerance.test.ts`
- [Case capacity and seating](../models/case-capacity.md#tolerance-of-the-volume)
- [Pressure range](../models/interior-pressure-range.md)

## Confidence

Low: the rule follows the source of the capacity, but both defaults are assumptions and the between-maker evidence is unverified.
