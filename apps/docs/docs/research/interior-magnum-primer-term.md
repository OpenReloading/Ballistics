---
title: Magnum primer factor on the ignition pressure
description: Whether a pooled factor on the ignition pressure of loads with magnum primers lowers the held-out velocity error of the load-table fit.
---

# Magnum primer factor on the ignition pressure

## Question

Interior ballistics, ignition: does the ignition pressure of loads with magnum primers differ from that of standard primers enough to lower the held-out velocity error of the load-table fit?

## Method

Primer product, size and a magnum flag were parsed from the printed note of each row. Ignition pressure of a magnum row: $k$ times 5.0 MPa; other rows 5.0 MPa. $k$ is the minimum of the training chi-square profile on the grid 0.05, 0.1, 0.2, 0.35, 0.5, 0.7, 1, 1.4, 2, 3, 5, powder parameters held, two rounds, every powder refitted (vivacity and energy); compared with $k = 1$.

Accept rule, fixed first: adopt when the validation median drops by more than 0.1 points, the P90 does not rise, the 95 % cartridge-bootstrap interval of the paired change on magnum rows excludes 0, and checks for confounding do not remove the effect. Rows parsed: training 4433 magnum, 13241 standard, 10501 without a size; validation 1373, 7379, 6619 (15371); 26 cartridges have both kinds. The table counts 14252 validation rows, the number the candidates of the [load-table fit](interior-load-table-fit-parameters.md) cover, and the fit 3764 training magnum rows: 1119 parsed validation rows (15371 - 14252) and 669 parsed training magnum rows (4433 - 3764) are not in them. The filter that removed them is not recorded and cannot be re-derived from the repository; that it is the coverage of the candidate fit is inferred from the equal count.

## Formulas

The run starts at the burnt fraction that gives the ignition pressure $p_i$ in the closed chamber, and the projectile is held until the mean pressure reaches the start pressure ([M3, shot start](../models/interior-m3.md#shot-start)). The factor sets $p_i = k \cdot 5.0$ MPa for a magnum row.

## Numbers

Fitted $k$ 0.050 (interval 0.050 to 2.105; 3764 training magnum rows from 57 cartridges), at the end of the grid: the profile has no interior minimum.

| Validation rows | $k = 1$ median / P90 % | fitted $k$ median / P90 % |
| --- | --- | --- |
| all 14252 | 3.33 / 9.20 | 3.32 / 9.19 |
| magnum 1184 | 3.16 / 8.07 | 3.12 / 8.04 |
| standard 6811 | 3.52 / 10.01 | 3.50 / 9.99 |

Paired change of the absolute error on magnum rows -0.032 points (-0.086 to -0.007); median drop over all rows 0.009 points against the 0.1 margin. Confounding: the magnum minus standard mean error at $k = 1$ is +0.99 points and is negative in 1 of 6 strata of capacity by powder form. Of 23806 groups with equal powder, cartridge, bullet mass (0.1 g) and charge (0.05 g), 64 hold two named primers and 2 a magnum and a standard primer. Without the rows where printed and tabulated primer size differ: $k$ 0.833 (0.108 to 2.067), medians 3.33 % and 3.32 %.

## Result

No change. Not adopted: the median rule is not met and the profile has no interior minimum. A primer takes no part in a calculation; it is stored with the load.

## Data basis

Measured. The measurements are not in the repository.

## Where in the app

- `packages/core/src/interior/model.ts`, the ignition pressure of a run.
- Model page: [M3 model](../models/interior-m3.md), data page: [primers](../data/primers.md).

## Confidence

Medium: the cause of the small nonzero change on magnum rows was not traced, and few groups compare primers at an equal load.
