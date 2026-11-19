---

title: Revolver cylinder gap and barrel length from the forcing cone
description: Where the cylinder face of a revolver lies for the travel and the gap leak, the discharge coefficient of the gap, and the velocity and pressure the gap costs a .357 Magnum like load.
---

# Revolver cylinder gap and barrel length from the forcing cone

## Question

Interior ballistics, revolvers: where does the cylinder face lie for the cylinder run and the start of the gap leak, which discharge coefficient does the gap take, and does a 0.10 mm gap on a 95 mm barrel cost about the -2.5 % to -3.6 % velocity that the question text gives for discharge coefficients 0.7 to 1?

## Method

Reference figures, from the question text: -2.5 % to -3.6 % muzzle velocity for a 0.10 mm gap on a 95 mm handgun barrel, discharge coefficient 0.7 to 1. Unverified: no source is cited for them.

Every number below is a simulation of a synthetic load, not load data. The .357 Magnum like load of `packages/ballistics/test/interior-cylinder-gap.test.ts`:

| Input                                   | Value                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Charge, volume behind the bullet        | 0.94 g, 1.2 cm³                                                                                                               |
| Bullet                                  | 10.24 g (158 gr), base 24 mm from the case head, COAL 40.0 mm                                                                 |
| Cartridge                               | L6 40.39 mm, land diameter 8.84 mm, groove diameter 9.07 mm                                                                   |
| Barrel                                  | 95 mm from the forcing cone, twist 469.9 mm                                                                                   |
| Propellant                              | specific energy 3.9 MJ/kg, $k = 1.23$, solid density 1600 kg/m³, covolume 1/1600 m³/kg, vivacity 1.5 per MPa s, constant form |
| Ignition pressure, start pressure, heat | 1 MPa, 0, none                                                                                                                |

Two places of the cylinder face, both from the breech face, each run without a gap and with a 0.10 mm gap at discharge coefficients 0.7 and 1:

- A: the cartridge length L3 (33.0 mm), the face the question text names.
- B: the larger of L6 and the seated COAL (40.39 mm).

Accept rule, set before the runs: the face and the discharge coefficient that give the higher simulated peak pressure are taken, and the velocity loss of the taken variant lies within a third of the reference figures.

## Formulas

The gap leak is the orifice flow of the [leakage and heat loss page](../models/interior-leakage-heat.md#cylinder-gap) through the side of a cylinder of the land diameter $d$ and the gap $g$, $A_\ell = \pi d g$, opened linearly while the base crosses the gap (after [AMCP 706-150](../bibliography.md#amcp-706-150), p. 2-48, choked flow through a gap). The travel from the forcing cone adds the cylinder run, $x_e = L_b + x_f + g - x_0$, with the face $x_f$ and the base $x_0$ from the breech face.

## Numbers

| Face            | Leak opens at, mm of travel | Velocity without gap, m/s | Velocity at 0.7, m/s | Change at 0.7 | Change at 1 | Peak pressure change at 0.7 |
| --------------- | --------------------------- | ------------------------- | -------------------- | ------------- | ----------- | --------------------------- |
| A, L3           | 9.0                         | 436.51                    | 419.47               | -3.90 %       | -5.55 %     | -2.3 %                      |
| B, max(L6,COAL) | 16.39                       | 444.71                    | 434.16               | -2.37 %       | -3.37 %     | 0                           |

- The peak breech pressure without a gap is 233.06 MPa at 12.9 mm of travel for both. With A the leak opens before the peak and lowers it to 227.70 MPa; with B it opens after the peak, so the peak is unchanged. A's shorter travel also gives the lower velocity without a gap.
- A leak that opens at 7 mm of travel, before the peak, lowers the peak by 4.57 %.
- B against the reference: 0.95 and 0.94 times -2.5 % and -3.6 %.

## Result

Improved: adopted with face B and the discharge coefficient 0.7. B gives the higher simulated peak pressure, and the lower discharge coefficient lets less gas out, which also keeps the simulated pressure higher. B's loss of -2.37 % to -3.37 % lies within a third of the reference figures.

## Data basis

Analytic: a synthetic load compared with unverified figures from the question text (no source cited).

## Where in the app

- `packages/ballistics/src/interior/cylinder-gap.ts`, `cylinderGapLeakage`, `cylinderGapDischarge`.
- `packages/svg-drawings/src/seating/seating.ts`, `seat` (`cylinder`).
- `packages/ballistics/test/interior-cylinder-gap.test.ts`.
- Model pages: [leakage and heat loss](../models/interior-leakage-heat.md#cylinder-gap), [case capacity and seating](../models/case-capacity.md).

## Confidence

Low: the reference figures are unverified, the load is synthetic, and the face of a real cylinder (chamber throat, case length cut) is not measured.
