---
title: Plausibility notes for simulated loads
description: Whether the mean-to-peak ratio, the efficiency, the curve shape, the velocity at the muzzle against the highest velocity in the bore and the fitted energy can flag input errors of an M3 run.
---

# Plausibility notes for simulated loads

## Question

Interior ballistics, [M3 model](../models/interior-m3.md): can a note from the shape of a simulated run (mean-to-peak ratio, efficiency, curve shape, a projectile that slows before the muzzle, the fitted energy of a powder) catch input mistakes without firing on ordinary loads?

## Method

Every M3 run is of one printed load row: 57,536 rows of published load tables that are not in the repository, with the powder records fitted to them, the cartridge records of the repository and the seated geometry and bore resistance of the load-table fit. 52,391 runs are valid; 5,145 are refused with `chamberVolume` and left out. The seeded errors are the same rows with the charge times 10, the charge times 2, the chamber volume times 2 and the bullet mass times 0.5. The accept rules were fixed before the runs:

1. Mean-to-peak ratio and efficiency: a band of each from the unmodified runs, a note outside either band. Adopted only if the band flags at least 90 % of each seeded error and under 2 % of the unmodified runs.
2. Velocity ratio: the muzzle velocity over the highest velocity of the curve, a note below 0.99. Adopted only if every flagged run is dominated by bore friction and no ordinary load row is flagged.
3. Curve shape: for each row with a printed peak pressure (not CUP), barrel length and muzzle velocity, the simulated peak position, velocity at the peak and muzzle pressure against the three empirical relations below. Adopted as a reference only if at least 80 % of rows lie within 15 % on all three.
4. Fitted energy: the fitted specific energy over the thermochemical value for every powder record with both. Accepted if at least 90 % lie between 0.6 and 0.95.

The fixture of the interior tests (`m3Load` with 0.6 g, a 1.5 m barrel and a friction pressure of 5 MPa) pins the definitions of item 2 and of the expansion ratio.

## Formulas

The equivalent constant pressure is the pressure that, held over the travel $L$, gives the projectile and half the charge the muzzle velocity $v_e$; its ratio to the peak breech pressure is the mean-to-peak ratio (piezometric efficiency, unverified):

$$
p_m = \frac{(m_p + m_c/2)\, v_e^2}{2 A L}, \qquad \chi = \frac{p_m}{p_\text{br,max}}
$$

The efficiency $\eta_b = E_0 / (m_c Q)$ is that of the [M3 page](../models/interior-m3.md#outputs) ([Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 82). The expansion ratio is $(V_c + A L) / V_c$ and the velocity ratio $v_e / \max v$ over the curve.

Shape relations for classical rifle loads (unverified, no open source): at $\chi$ = 0.40 the pressure peak lies at about 6 % of the travel, the velocity at the peak is about 35 % of $v_e$ and the mean pressure at the muzzle is about $0.30\, p_m$; at $\chi$ = 0.50 the values are 8.8 %, 38 % and $0.38\, p_m$. Each row is compared with the straight line through the two points at its $\chi$ from the printed values.

The thermochemical specific energy is the impetus of the powder's composition over $k - 1$ with the $k$ of its fit, so the ratio is $Q_\text{fit} (k - 1) / F$ ([M3 page](../models/interior-m3.md#free-volume-and-pressure)).

## Numbers

1. Over the valid runs, $\chi$ lies between 0.12 and 0.67 and $\eta_b$ between 0.076 and 0.49 for 99 % of runs (5th to 95th percentile 0.22 to 0.60 and 0.15 to 0.43). That band flags 1.7 % of the unmodified runs. Of the seeded runs, the charge times 10 makes 57,535 of 57,536 runs invalid (`chamberVolume`), the charge times 2 makes 49,997 invalid, so both are refused before any note. The band flags 33 % of the valid runs with twice the charge, 42 % with twice the chamber volume and 6 % with half the bullet mass, far below 90 %. A band that flags 3.5 % of the unmodified runs (1st to 99th percentile) catches 47 % and 16 % of the last two.
2. 99 of the 52,391 valid runs (0.19 %) end below 0.99 of their highest velocity (377 below 1), down to 0.59. All of them have a friction pressure of 4.5 MPa or more, muzzle velocities of 190 to 340 m/s and expansion ratios with a median of 20, so they are friction dominated. But they are printed start and maximum loads of 21 cartridges and 27 powders, ordinary loads, and their simulated muzzle velocity is 16 % below the printed one in the median (1 % over all runs): the deceleration comes from a bore friction the model holds too high for these slow loads, not from an input error. The fixture gives 189.4 m/s at the muzzle and 195.6 m/s as the highest velocity (ratio 0.968); its expansion ratio is 7.6 at 0.6 m and 4.3 at 0.3 m, its peak over muzzle mean pressure 4.2 and 2.0. Over all valid runs the expansion ratio has a median of 8.2 (5th to 95th percentile 5.5 to 15.7), so a design rule of 5 to 6 (unverified) would flag most published loads.
3. 21,882 rows qualify. 15 % lie within 15 % on all three relations; peak position 38 % (median deviation 22 %), velocity at the peak 75 % (9 %), muzzle pressure 32 % (28 %). With $\chi$ of the simulated run instead of the printed one, 19 % lie within.
4. 30 powder records have both a fitted energy and a thermochemical impetus. The ratio has a median of 0.78 and runs from 0.58 to 2.39; 27 of 30 (90 %) lie between 0.6 and 0.95.

## Result

No change. Items 1 to 3 are not adopted: the band of item 1 is too wide to catch a doubled chamber volume or a halved bullet mass, the note of item 2 fires on published loads, and the shape relations of item 3 hold for one row in seven. Item 4 meets its rule and is documented as reference values on the [powder fit page](../models/interior-powder-fit.md#limits); no check is added. The bands of item 1 and the deceleration of item 2 are documented as limits on the [M3 page](../models/interior-m3.md#limits), the deceleration with the fixture as a test.

## Data basis

Measured: 57,536 printed load rows and the powder fits that are not in the repository, aggregates only; the fixture numbers are analytic.

## Where in the app

- `packages/core/src/interior/model.ts`, `interior` (`efficiency`, `maxMeanPressure`, the `stall` event).
- `packages/core/test/interior-model.test.ts`, the test "a projectile that slows before the muzzle without stopping is a valid run".
- `packages/core/test/fixtures.ts`, `m3Load`.
- Model pages: [M3 interior model](../models/interior-m3.md), [powder fit](../models/interior-powder-fit.md).

## Confidence

Medium: the counts are over many published rows, but the load tables are one population of published rifle and handgun loads with the model's own fitted powders, and the shape relations and the design rule have no open source.
