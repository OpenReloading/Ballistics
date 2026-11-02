---
title: Placing a maximum pressure against the tolerance range
description: How often a cartridge's maximum pressure falls below, inside or above the simulated peak-pressure range of a reference load, which input dominates each case, and whether the three-way split is worth showing.
---

# Placing a maximum pressure against the tolerance range

## Question

Interior ballistics, [peak-pressure range](../models/interior-pressure-range.md): on the cartridge records with a stored maximum pressure, how often does that maximum lie below the low end, inside or above the high end of the tolerance range of a reference load, and is the three-way split informative enough to show?

## Method

- Ceiling: every `Pmax` value of a cartridge sheet measured by transducer or piezo, or with no method stated, the values the limit check compares. Crusher values are left out, as there.
- Range: `interiorPressureRange` with `pressureToleranceDefaults` (charge 0.5 %, volume 1 %, burn coefficient 3 %, temperature 5 K, start pressure 20 %, bullet mass 0) and the API's run options (`maxTime` 0.04 s, `maxSteps` 50000). The class is read as `placeMaximum` reads it: below the low end, above the high end, else inside. Dominant input: the single input whose two ends differ most in peak pressure.
- Reference load: needs a charge, a barrel length, a bullet mass, a powder record with a fitted interior model and a water capacity of the cartridge. The load is built as the load file route builds it (`powderModelValues`, `interiorLoad`, `recordResistance`). Volume: water capacity (capacity or case record, the lower median per cartridge) less the seated part of the bullet. Bore: the sheet's F, Z and Q. Twist 305 mm, propellant temperature 21 degC.
- Two tiers, one throwaway script (not in the repository build):
  1. The records of the repository only.
  2. The same plus records that are not in the repository: powder and capacity records, and the rows of published powder load tables flagged as maximum loads. Only counts are stated.
- A cartridge without a reference load is left out with the missing input. No accept rule was fixed in advance.

## Formulas

The range and the placement are those of the [model page](../models/interior-pressure-range.md#placing-an-entered-maximum): $p_\text{low}$ and $p_\text{high}$ over the single-input and combined cases, the class from $p_\text{max}$ against them. The dominant input is the $q$ with the largest $|p_q^{+} - p_q^{-}|$.

The chamber volume of a reference load is the water capacity $m_w$ over the density of water less a cylinder of the sheet's bullet diameter $G_1$ over the seated length:

$$
V_c = \frac{m_w}{\rho_w} - \frac{\pi}{4} G_1^2 \bigl(l_b - (L_6 - L_3)\bigr)
$$

No row states a bullet length, so $l_b$ is that of a solid cylinder of the bullet mass $m_p$ at $\rho_b$ = 10.5 g/cm³ over $G_1$:

$$
l_b = \frac{m_p}{\rho_b\, \pi G_1^2 / 4}
$$

$L_6$ and $L_3$ are lengths of the cartridge sheet ([case capacity](../models/case-capacity.md)).

## Numbers

Tier 1, repository records only: 589 `Pmax` values on 551 of 577 cartridges. Left out: 12 crusher values, 576 without a water capacity record and without a load row, 1 with a water capacity record (a demo case) but without a load row. Classified: 0. The repository holds 0 load records and 0 capacity records, 1 demo powder, 2 demo bullets and 1 demo case; no record stores a charge or a barrel length, so no cartridge has a reference load.

Tier 2, with records outside the repository: 248 powders (224 with an interior model), a water capacity for 53 cartridges, 35,232 maximum-flag rows.

- `Pmax` values left out: 12 crusher, 337 without a capacity and without a row, 187 without a capacity. 53 classified, one reference load per cartridge (the row with the lower-median nominal peak pressure).
- Rows left out: 12,832 without a water capacity record, 2,302 without bullet mass, charge or barrel length, 166 with a powder without an interior model, 138 with an invalid nominal run. 16,942 rows run. These account for 32,380 of the 35,232 rows; the log gives no reason for the other 2,852 and the script was not kept. One of the 53 per-cartridge ranges is incomplete (a case left the model).

| Class | Per cartridge (53) | Per row, start-pressure tolerance 20 % (16,942) | Per row, 10 % |
| --- | --- | --- | --- |
| Below the low end | 0 | 1,009 (6.0 %) | 1,131 (6.7 %) |
| Inside the range | 10 (19 %) | 3,760 (22.2 %) | 3,282 (19.4 %) |
| Above the high end | 43 (81 %) | 12,173 (71.9 %) | 12,529 (74.0 %) |

Dominant input per row (start-pressure tolerance 20 % / 10 %):

| Dominant input | Below | Inside | Above |
| --- | --- | --- | --- |
| Burn coefficient | 921 / 1,131 | 3,559 / 3,273 | 9,205 / 11,929 |
| Start pressure | 88 / 0 | 201 / 9 | 2,941 / 565 |
| Chamber volume | 0 / 0 | 0 / 0 | 27 / 35 |

Charge and temperature never dominate. Per cartridge: burn coefficient 46 and start pressure 7 at 20 %, 51 and 2 at 10 %.

Width and position per row (10th / 50th / 90th percentile): range width over nominal 0.235 / 0.272 / 0.303 (0.187 / 0.232 / 0.270 at 10 %); nominal over ceiling 0.55 / 0.76 / 1.06; low end over ceiling 0.48 / 0.67 / 0.92; high end over ceiling 0.62 / 0.87 / 1.22.

## Result

No change to the model. All three classes occur, but "above" is the common case because published maximum loads sit below the sheet's `Pmax` (median nominal about 76 % of it), and "below" is rare (6 to 7 % of rows, none of the 53 reference loads). The range is wide (about 23 to 27 % of the nominal peak), so "inside" says only that the number lies within about an eighth of the simulated peak, not that an input is right. The dominant input is the burn coefficient in 81 % of rows (96 % at a 10 % start-pressure tolerance). Adopted in a reduced form: the placement is a note for a maximum the user enters, never for a cartridge's stored limit, and its message states only where the number lies against the simulated range (`maximumCheck`). The limit check is unchanged.

## Data basis

Measured: tier 2 runs on published load table rows, powder fits and capacity records that are not in the repository, aggregates only. Tier 1 runs on the repository's records and classifies nothing.

## Where in the app

- `packages/core/src/interior/range.ts`, `interiorPressureRange`, `pressureToleranceDefaults`, `placeMaximum`.
- `packages/api/src/compute/limits.ts`, `maximumCheck` (the messages).
- Model page: [peak-pressure range](../models/interior-pressure-range.md#placing-an-entered-maximum).

## Confidence

Low: the powder models were fitted on tables of the same kind as the rows (in-sample, so "inside" is likely too high), every bullet length is estimated, the default tolerances have no source, model error is not in the range, the 53 cartridges with a water capacity are a biased set, and sheet maxima stand in for what users enter.
