---
title: Free recoil gas factor against other model forms
description: How far other forms of the powder gas term change the free recoil energy of typical handgun and rifle loads, and why the constant factors stay until measured free recoil is available.
---

# Free recoil gas factor against other model forms

## Question

Free recoil: does a gas term other than the constant factor (1.75 for rifles, 1.50 for pistols) change the free recoil energy of typical loads enough to matter, and can measurements decide between the forms?

## Method

The plan was to compare each form with measured free recoil (recoil velocity or impulse) of at least ten loads over several muzzle velocities, by the relative error. The repository holds no such measurements, and none with projectile mass, charge mass, muzzle velocity and firearm mass all known were at hand, so the forms were compared with each other instead: the energy of each form over the energy with today's factor, for ten typical loads (five handgun, five rifle, masses and velocities rounded), with the same firearm mass. Accept rule, set in advance: no change without measurements; if the forms differ by less than 5 % in energy for most loads, the model page states a band of plus or minus 5 %.

## Formulas

The momentum of projectile and gas in the [free recoil model](../models/free-recoil.md) is $I = (m_p + f\, m_c)\, v_0$, with the energy $E_g = I^2 / (2 m_g)$, so for a fixed firearm the energy ratio of two forms is the square of their momentum ratio. Forms of $f$ compared, after [SAAMI 2018](../bibliography.md#saami-2018) for today's factor and a table of mean gas speed over muzzle velocity that falls from about 3 at 400 m/s to about 1 at 1400 m/s (a nearly constant mean gas speed of 1200 to 1330 m/s, source unverified here):

- today: $f = 1.75$ (rifle), $f = 1.50$ (pistol);
- constant gas speed: $f = V_{gas} / v_0$ with $V_{gas} = 1250$ m/s;
- the same as an increment on the in-bore gas momentum: $f = 0.5 + V_{gas} / v_0$;
- outflow speed: $f = 0.5 + v_a / v_0$, half the charge moving with the projectile in the bore plus the charge leaving at the outflow speed $v_a$, with typical values of 500 to 650 m/s for handguns and 850 to 1050 m/s for rifles.

## Numbers

Loads (projectile g, charge g, muzzle velocity m/s, outflow speed m/s): handgun 8.0, 0.35, 360, 600; 14.9, 0.36, 260, 550; 10.2, 0.25, 270, 500; 10.2, 1.0, 430, 650; 15.6, 1.4, 420, 650. Rifle 3.6, 1.6, 990, 1000; 9.0, 2.7, 820, 950; 9.7, 2.6, 800, 900; 11.7, 3.4, 820, 950; 11.7, 4.5, 900, 1050.

Change of free recoil energy against today's factor, smallest to largest over the five loads of each kind:

| Form | Handgun | Rifle |
| --- | --- | --- |
| constant gas speed 1250 m/s | +15.3 % to +25.5 % | -22.9 % to -6.7 % |
| increment, $0.5 + 1250 / v_0$ | +17.9 % to +35.3 % | +0.6 % to +11.7 % |
| outflow speed, $0.5 + v_a / v_0$ | +4.1 % to +8.9 % | -11.6 % to -3.5 % |

The rifle extreme of the outflow form is the light, fast load (3.6 g at 990 m/s), where the charge is almost half the projectile mass. The test "energy spread of other gas factor forms over ten typical loads" in `packages/core/test/recoil.test.ts` reproduces every range of the table.

## Result

No change. The forms differ by more than 5 % for most loads, so the fallback band of plus or minus 5 % does not hold, but without measurements none of them is shown to be better. All three forms are not adopted. Documented as a limit: the model page states the spread between the forms, not a measured error.

## Data basis

Analytic: a comparison of model forms over synthetic typical loads, no measurement.

## Where in the app

- `packages/core/src/recoil.ts`, `freeRecoil` and `gasVelocityFactor`.
- `packages/core/test/recoil.test.ts`, the test of the energy spread.
- Model page: [free recoil](../models/free-recoil.md).

## Confidence

Low: the spread between forms is exact for the stated loads, but which form is closer to real free recoil needs measured free recoil, which is not available.
