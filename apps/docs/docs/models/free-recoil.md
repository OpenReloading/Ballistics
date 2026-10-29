---
title: Free recoil
description: Velocity and kinetic energy of a firearm that recoils without restraint, from the momentum of the projectile and the powder gas.
---

# Free recoil

The model gives the velocity and the kinetic energy of a firearm that recoils freely, with no shooter, rest or stock holding it. By conservation of momentum, the firearm takes up the momentum of the projectile and of the powder gas in the opposite direction.

## Equations

Momentum of projectile and gas, equal to the momentum of the firearm:

$$
I = m_p v_0 + m_c f v_0
$$

Code: `packages/core/src/recoil.ts`, `freeRecoil` (`momentum`).

Velocity and kinetic energy of the firearm:

$$
v_g = \frac{I}{m_g}, \qquad E_g = \tfrac{1}{2} m_g v_g^2
$$

Code: `packages/core/src/recoil.ts`, `freeRecoil` (`velocity`, `energy`).

Gas velocity factor by firearm type: $f = 1.75$ for high-powered rifles, $f = 1.50$ for pistols and revolvers.

Code: `packages/core/src/recoil.ts`, `gasVelocityFactor`.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $m_g$ | Mass of the firearm with scope and attachments | g | kg |
| $m_p$ | Mass of the projectile | g | kg |
| $m_c$ | Mass of the powder charge, taken as the mass of the gas | g | kg |
| $v_0$ | Muzzle velocity of the projectile | m/s | m/s |
| $f$ | Gas velocity over muzzle velocity | 1 | 1 |
| $I$ | Momentum of projectile and gas | no kind | kg m/s |
| $v_g$ | Velocity of the free firearm | m/s | m/s |
| $E_g$ | Kinetic energy of the free firearm | J | J |

## Assumptions

- The mass of the gas equals the mass of the powder charge.
- The gas leaves at $f$ times the muzzle velocity, one constant per firearm type.
- The firearm is free: no force from the shooter or a rest acts during the shot.

## Limits

- Muzzle brakes and suppressors redirect the gas. The model does not cover them.
- The result is the free recoil energy of the firearm. Not computed: felt recoil, which also depends on the recoil pad, the stock and the action, and the recoil force over time.
- The source lists further factors for shotguns (1.50 for average barrel length, 1.25 for long barrels). `gasVelocityFactor` holds only the rifle and pistol values.
- The real gas velocity varies with muzzle pressure and projectile velocity. The factor is a constant.
- Free recoil energy depends on the gas factor. Other published forms of it change the energy by about -12 % to +9 % for handgun and rifle loads with a typical outflow speed, and by up to -23 % to +35 % for a constant gas speed or a speed increment (comparison of model forms over ten typical loads, no measurement). Confidence low until measured free recoil is available.
- Research log: [published worked example](../research/free-recoil-worked-example.md), [gas factor against other model forms](../research/free-recoil-gas-factor.md).

## Sources

- [SAAMI 2018](../bibliography.md#saami-2018), "Free Recoil Energy": the momentum balance, the gas mass set equal to the charge mass, and the gas velocity factors by firearm type.
- [War Office 1929](../bibliography.md#war-office-1929): the origin of the gas velocity factors as SAAMI 2018 names it (not read).
