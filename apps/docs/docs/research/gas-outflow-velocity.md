---
title: Gas outflow velocity after the muzzle
description: Whether the muzzle state of an M3 run gives a mean gas outflow velocity worth showing.
---

# Gas outflow velocity after the muzzle

## Question

Interior ballistics, muzzle exit: can the state of the M3 run at the muzzle give a mean gas outflow velocity worth showing?

## Method

Four estimates from the lumped state at muzzle exit for the workbench example load: the sonic velocity of the gas, a quasi-steady choked outflow, a mean outflow velocity from the muzzle velocity and a fixed sound speed, and a blowdown time constant after exit. The forms are published, unverified here. Accept rule: show a value only if the forms agree or a measurement can choose between them.

## Formulas

With the ratio of specific heats $k$, the gas constant $R$, the gas temperature $T_e$, pressure $p_e$ and covolume density term $\eta \rho$ at exit, the volume behind the projectile $V_r$ and the charge mass $m_c$:

$$
a = \frac{\sqrt{k R T_e}}{1 - \eta \rho}, \qquad v_m = \sqrt{\tfrac{1}{2}\, \Gamma\, \frac{p_e V_r}{m_c}}, \qquad \Gamma = k \left(\frac{2}{k + 1}\right)^{k / (k - 1)}
$$

The outflow velocity estimates are $\sqrt{v_0^2 + v_m^2}$ and $\sqrt{v_0^2 + a_0^2}$ with the muzzle velocity $v_0$ and a fixed sound speed $a_0 = 1000$ m/s; the second uses this fixed value, not the computed sonic velocity $a$.

## Numbers

For the workbench example load the estimates of the mean outflow velocity differ by a factor of 1.5, and none is validated. The only use found is the recoil impulse, which the gas factor of the [free recoil model](../models/free-recoil.md) already covers (1.50 times the muzzle velocity for pistols, 1.75 for rifles).

## Result

No change. Not adopted: no outflow velocity is shown. M3 ends at the muzzle event, no measurement exists to choose between the forms, and the recoil readout already covers the use.

## Data basis

Analytic: published forms evaluated on one example load; the forms are unverified.

## Where in the app

- `packages/core/src/recoil.ts`, `gasVelocityFactor`.
- Model pages: [free recoil](../models/free-recoil.md), [M3 model](../models/interior-m3.md).

## Confidence

Medium: the forms are unverified, and one example load was computed.
