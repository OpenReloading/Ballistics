---
title: Bullet fit
description: Which bullet diameters fit a cartridge, from its C.I.P. projectile, land and groove diameters.
---

# Bullet fit

The bullet fit decides which bullet diameters fit a cartridge from the cartridge's C.I.P. values only. A bullet fits when its diameter lies above the middle of the barrel's land and groove diameters and at most at the projectile diameter $G_1$ of the cartridge drawing. The API filters the bullet list of a cartridge with it. The web app lists the cartridges a bullet fits.

## Equations

### Values read

From the C.I.P. sheet of a cartridge, the fit reads the smallest cartridge-side $G_1$ and the smallest chamber-side land diameter $F$ and groove diameter $Z$:

$$
G_1 = \min G_{1,\mathrm{cartridge}}, \qquad F = \min F_\mathrm{chamber}, \qquad Z = \min Z_\mathrm{chamber}
$$

Code: `packages/core/src/cartridge-specs.ts`, `cartridgeDiameters`.

### Window

$$
\frac{F + Z}{2} \lt d \le G_1 + \delta, \qquad \delta = 0.005\ \text{mm}
$$

Code: `packages/core/src/bullet-fit.ts`, `bulletWindow`, `bulletFits`, `cipRounding`.

$\delta$ is half the last printed digit of the two-decimal C.I.P. values, so a $G_1$ printed as 7.85 holds diameters up to 7.855 mm. A further $10^{-9}$ mm keeps a bullet exactly on the upper bound despite binary rounding.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $d$ | Bullet diameter | mm | mm |
| $G_1$ | Projectile diameter of the cartridge drawing, a maximum | mm | mm |
| $F$ | Land (bore) diameter of the barrel, a minimum | mm | mm |
| $Z$ | Groove diameter of the barrel, a minimum | mm | mm |
| $\delta$ | Half the last printed digit of a C.I.P. value | mm | mm |

## Assumptions

- C.I.P. prints $G_1$ as a maximum without a tolerance, and $F$ and $Z$ as minimums.
- The middle of $F$ and $Z$ is the lower bound: it is the tightest lower bound from C.I.P. values that still leaves a bullet for every cartridge, since $Z$ lies above $G_1$ for some cartridges.

## Limits

- Only C.I.P. values enter. A bullet manufacturer's stated cartridge, the throat of a particular chamber and the bullet construction are not considered.
- A cartridge whose C.I.P. sheet does not give $G_1$, $F$ and $Z$ has no fitting bullets.

## Sources

- [C.I.P. TDCC](../bibliography.md#cip-tdcc): the projectile diameter $G_1$ on the cartridge drawing and the land and groove diameters $F$ and $Z$ of the chamber, per cartridge sheet.
- Research log: [bullet fit window against C.I.P. values](../research/bullet-fit-cip-window.md).
