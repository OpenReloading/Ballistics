---
title: Cast bullet hardness against peak pressure
description: Whether a plain-base cast bullet harder than the simulated peak pressure should get a leak model or a warning, with the Brinell hardness of the cast records.
---

# Cast bullet hardness against peak pressure

## Question

Interior ballistics, bullet: should a plain-base cast bullet whose alloy is harder than the peak pressure upsets change the run (a leak past the bullet), or only carry a warning?

## Method

The rule of thumb for the upset pressure of a plain-base cast bullet was compared with the simulated peak breech pressure. The effect of a leak was tested by giving the solver's leak path a fixed area on two stand-in loads (9 mm Luger at 232 MPa and 332 m/s, a .308 Win. rifle load). Decided in advance: a leak model or a default leak area is adopted only with a published leak area or a controlled comparison of plain-base and gas-checked bullets; else a warning on the three conditions (cast, no gas check, hardness set) and no change of the run. The data step reads the "Brinell N" each Missouri Bullet record's pricing-page row prints into `construction.core.hardness`.

## Formulas

Upset pressure $p_\mathrm{ob} = 1422\ \mathrm{psi} \cdot \mathrm{BHN} \approx 9.80\ \mathrm{MPa} \cdot \mathrm{BHN}$ (Fryxell, "Cast Bullet Alloys and Obturation", via [Wikipedia, Obturation](https://en.wikipedia.org/wiki/Obturation); the essay was not retrieved, so the rule is from a secondary source, unverified). The warning fires when $p_\mathrm{ob} > p_\mathrm{max}$, the simulated peak breech pressure. The leak in the check runs is the leak of the [M3 model](../models/interior-m3.md) with a fixed area.

## Numbers

BHN 12 gives 118 MPa, BHN 18 176 MPa, BHN 22 216 MPa. Solver response to a leak area (issue #845, stand-in loads):

| Leak area (mm²) | 9 mm (232 MPa, 332 m/s) | .308 |
|---|---|---|
| 0.1 | -0.9 % p, -0.52 % v | -1.2 % p, -0.48 % v |
| 0.5 | -4.3 % p, -2.60 % v | -6.1 % p, -2.39 % v |
| 2 | -16.5 % p, -10.0 % v | about -21.9 % p |

Hardness of the cast records after the data step: Brinell 12 on 80, 18 on 110, 20 on 5 of the 195 Missouri Bullet records; every one is cast with no gas check (the maker: "We don't do gas-checked bullets").

## Result

No change of the run. Adopted in a reduced form: a warning "possible gas leakage" with no number, on the three conditions only. No leak area and no gas-check coefficient were added: no source gives the area a leak past an unsealed base opens, and no controlled comparison of plain-base and gas-checked bullets was found.

## Data basis

Analytic. The rule is a published rule of thumb; the leak-area table is the solver on stand-in loads, not a measurement.

## Where in the app

- `packages/core/src/interior/obturation.ts`, the rule and the three conditions.
- `apps/web/src/components/workbench-outcome.ts`, the warning of the result notes.
- `packages/schema/src/bullet.ts`, `construction.core.hardness` (lead or lead alloy core only).
- Model page: [M3, cast bullet hardness](../models/interior-m3.md#cast-bullet-hardness), data page: [bullet construction](../data/bullet-construction.md).

## Confidence

Low: the rule is a secondary quotation of an essay that was not read, and how much gas leaks past a hard base is not known.
