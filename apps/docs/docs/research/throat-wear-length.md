---
title: Throat wear length input
description: Whether a typed throat wear length that adds its volume behind the bullet reproduces a published worn-barrel model, and what a round count can say without a rate.
---

# Throat wear length input

## Question

Interior ballistics, chamber volume: does adding the measured axial wear of a worn chamber as volume behind the bullet ($w A$) reproduce the change of peak pressure and muzzle velocity that a published worn-barrel model gives, and can the round count of a firearm set a default wear?

## Method

The 5.56x45 mm load of [Vuong 2026](../bibliography.md#vuong-2026), table 1, was entered in the [M3 model](../models/interior-m3.md): charge 1.8 g, projectile 4 g, chamber 1.85 cm³, bore area 2.43e-5 m², force 706079 J/kg, $\gamma$ 1.26, covolume 1e-3 m³/kg, primer pressure 2.94 MPa, shot start 29.42 MPa, travel 0.312 m of the 361 mm barrel. Their burn law (shape characteristics 1.6 and -0.6 with a linear burn rate) does not reach a burnt fraction of 1, so the constant form was used, with the vivacity (621.1 1/s) set so the new barrel peaks at their 350 MPa. The worn barrel adds the measured axial chamber wear of 5.42 mm (CMM, 49.20 to 54.62 mm after 16000 rounds) as $w A$. Accept rule from the issue: the velocity change within 1 percentage point of the authors' model; the pressure change was recorded.

## Formulas

$V_0' = V_0 + w A$, the added length times the bore area ([M3, throat wear](../models/interior-m3.md#throat-wear)); the rest of the model is unchanged. The measured velocity loss per 1000 rounds of Vuong 2026, table 3: $(821.3 / 840.6 - 1) / 8 = -0.29$ % from 0 to 8000, $(785.8 / 821.3 - 1) / 8 = -0.54$ % from 8000 to 16000.

## Numbers

| | Peak pressure | Muzzle velocity |
|---|---|---|
| M3, new barrel | 350.0 MPa | 809.0 m/s |
| M3, $w$ = 5.42 mm | -16.8 % | -5.5 % |
| Authors' model, 16000 rounds (table 2) | -15.6 % (350.0 to 295.5 MPa) | -5.1 % (854.56 to 811.19 m/s) |
| Measured, 16000 rounds (table 3) | | -6.5 % (840.6 to 785.8 m/s) |

The velocity change is 0.4 points from the authors' model and 1.0 point from the measurement; the pressure change is 1.2 points larger than theirs. A 7.62x39 slope of about 0.42 mm per 1000 rounds was derived on a proxy load in the issue (unverified).

## Result

Improved. Adopted: an optional Throat wear length with a default of 0, which adds $w A$ to the volume, and a note on a firearm with a round count that names the measured 5.56 rates as an example. No default wear from the round count: the rates do not carry over to other cartridges or firing regimes. The engraving ramp does not move with the wear; that is the jump of #839, not built here. Documented as a limit: the pressure change is 1.2 points larger than the authors' model, outside the 1 point the issue set for it.

## Data basis

Public. Vuong 2026, CC BY 4.0: tables 1 to 3 and the CMM chamber lengths, stored in `vuong2026`.

## Where in the app

- `packages/core/src/interior/throat-wear.ts`, `wornVolume`, `vuong2026`.
- `packages/core/src/interior/load-file.ts`, the `throatWear` value of a load.
- `apps/web/src/components/workbench-outcome.ts`, the round count note.
- Model page: [M3, throat wear](../models/interior-m3.md#throat-wear).

## Confidence

Medium: one barrel and one load; the vivacity was set to the authors' peak, not fitted to their burn law.
