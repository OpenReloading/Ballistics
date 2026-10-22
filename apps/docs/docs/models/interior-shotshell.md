---
title: Shotshell interior model
description: The experimental shotshell model, a shotshell load mapped onto the M3 interior model, with the crimp as the shot-start pressure.
---

# Shotshell interior model

`shotshellInterior` runs the [M3 interior model](interior-m3.md) on a shotshell load, with no physics beyond M3. Every result, valid or invalid, carries `experimental: true`: the model is not compared with measured shotshell pressures.

## Equations

### Mapping onto M3

The bore area is the circle of the bore diameter, the projectile is wad plus shot, the barrel has no rifling, and the crimp opening pressure is the shot-start pressure:

$$
A = \frac{\pi}{4} d^2, \qquad m_p = m_s + m_w, \qquad L_\text{tw} = 0, \qquad p_\text{st} = p_c
$$

Code: `packages/core/src/interior/shotshell.ts`, `shotshellInteriorLoad` (the result fields `boreArea`, `twist`, `mass` and `startPressure`).

The powder space $V_c$, the wad travel $x_e$ and every other input (charge, propellant, temperature, ignition pressure, resistance, leakage, gradient, heat) pass to M3 unchanged. With $L_\text{tw} = 0$ the rotation factor of M3 is 1, so the column has no rotational energy.

### Crimp

M3 holds the projectile until the mean pressure reaches $p_\text{st}$ (see [shot start](interior-m3.md)).

- A crimp opening force $F_c$ measured on a hull converts to the opening pressure $p_c = F_c / A$.
- Resistance while the crimp folds straighten, wad friction, the forcing cone and the choke are resistance pressures over travel of M3.
- Gas that blows past the wad before it seals is the leak area of M3 (see [leakage and heat loss](interior-leakage-heat.md)).

### Input checks

`shotshellInterior` returns an invalid result with reason `input` and the shotshell field name when:

- the bore diameter, the travel or the shot mass is not a positive finite number
- the wad mass or the crimp pressure is not a non-negative finite number

`interior` checks all other fields under their M3 names. `shotshellInteriorLoad` performs no checks.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $V_c$ | Powder space: hull volume behind the seated wad | no kind | m3 |
| $d$ | Bore diameter of the smooth bore | mm | m |
| $A$ | Bore area | mm2 | m2 |
| $x_e$ | Wad travel from its seated position to the muzzle | mm | m |
| $m_s$ | Shot mass | g | kg |
| $m_w$ | Wad mass | g | kg |
| $m_p$ | Projectile mass of the M3 run | g | kg |
| $L_\text{tw}$ | Twist length | mm | m |
| $p_c$ | Mean pressure at which the crimp opens | bar | Pa |
| $p_\text{st}$ | Shot-start pressure of M3 | bar | Pa |
| $F_c$ | Crimp opening force | no kind | N |

## Assumptions

- Wad and shot form one rigid mass. The pressure-gradient coefficients of M3 apply with that mass.
- The crimp is a threshold on the mean pressure, as the M3 shot start.
- The powder space stays fixed during the shot.

## Limits

- Not modelled: collapse of the wad cushion, compression of the shot column, pellet deformation and pellet contact with the bore, a crimp opening law over time or travel, hull expansion, hull and wad material properties.
- Crimp-fold resistance, wad friction, forcing-cone and choke resistance and the leak area past the wad are inputs without defaults. No reusable value or law for them was found in the sources below.
- Crimp forces measured on hulls are quasi-static, not forces during firing.
- Discrete and finite element models of the wad and the individual pellets show wad deformation and pellet interaction during the barrel travel. A model with one gas state does not represent them.
- The muzzle energy and efficiency of the result include the wad.
- Everything the [M3 interior model](interior-m3.md) does not contain.

## Sources

- [Bilenko 2011](../bibliography.md#bilenko-2011): crimp opening forces of 12 gauge roll and fold crimps measured quasi-statically, and the statement that gas leakage past the wad is not modelled in the literature it reviews (pages unverified).
- [Deng 2022](../bibliography.md#deng-2022): discrete element model of wad, shot cup and pellets in a shotgun barrel (full text not read, unverified).
