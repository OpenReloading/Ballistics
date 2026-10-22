---
title: Case capacity and seating
description: Case volume from the water capacity, the volume the seated bullet takes from it, the volume behind the bullet, the bullet travel and the jump to the lands.
---

# Case capacity and seating

1. A case capacity is the mass of water that fills the case to the mouth. Divided by the density of water it becomes the case volume.
2. Seating a bullet by its cartridge overall length (COAL) or its cartridge base to ogive length (CBTO) places its base in the case. The volume of revolution of the bullet outline below the mouth comes off the case volume.
3. What is left is the chamber volume behind the bullet, in which the [M3 interior model](interior-m3.md) burns the charge. The distance from the base to the muzzle is the bullet travel.

The seating geometry is in `packages/drawing/src/seating/seating.ts`, the outline in `packages/drawing/src/bullet/outline.ts`.

## Equations

### Case volume

$$
V_\mathrm{case} = \frac{m_w}{\rho_w}, \qquad \rho_w = 0.9982\ \text{g/cm}^3
$$

Code: `packages/core/src/water.ts`, `waterDensityGramsPerCm3`, `packages/drawing/src/seating/seating.ts`, `seat` (`caseVolume`).

$\rho_w$ is the density of water at 20 °C. A case capacity the user measured, stored as a volume, takes the place of the record's water mass.

The display unit grain of water is the volume of one grain mass of water:

$$
1\ \text{gr H}_2\text{O} = \frac{m_\mathrm{gr}}{\rho_w}, \qquad m_\mathrm{gr} = 6.479891 \times 10^{-5}\ \text{kg}
$$

Code: `apps/web/src/lib/units.ts`, `grH2O`, `kilogramsPerGrain`.

### Seated bullet

The bullet base lies at $z_b$ from the case head. Seated by COAL, $z_b = \mathrm{COAL} - L_b$. Seated by CBTO, $z_b = \mathrm{CBTO} - L_\mathrm{bto}$. The seating depth below the case mouth (case length $L_3$ of the cartridge) and the bullet travel to the muzzle are

$$
s = L_3 - z_b, \qquad x_e = L_\mathrm{barrel} - z_b
$$

Code: `packages/drawing/src/seating/seating.ts`, `seat` (`basePosition`, `depthValue`, `travel`).

### Bullet volume below the mouth

The bullet outline is a half profile $r(z)$ from the base, a polyline through points $(r_k, z_k)$ that `bulletOutline` builds from the bullet's dimensions. The volume below the mouth is the sum of the frustums of revolution up to $c = \min(\max(s, 0), L_b)$:

$$
V_b = \sum_k \frac{\pi}{3} (z'_k - z_{k-1}) \left(r_{k-1}^2 + r_{k-1} r'_k + {r'_k}^2\right), \qquad z'_k = \min(z_k, c)
$$

Code: `packages/drawing/src/bullet/outline.ts`, `revolutionVolume`, `bulletOutline`.

with $r'_k$ the profile radius at $z'_k$, interpolated linearly along the segment. A boat tail counts as a frustum and a nose below the mouth with its own profile.

### Volume behind the bullet

$$
V_c = V_\mathrm{case} - V_b
$$

Code: `packages/drawing/src/seating/seating.ts`, `seat` (`volumeBehindBullet`).

The value is flagged approximate when the part of the outline below the mouth rests on an assumed proportion.

At fixed COAL a bullet length error $\Delta L$ moves the seating depth by $\Delta L$, and every slice of the bullet is at most the cylinder of the bullet diameter $d$, so

$$
\lvert \Delta V_b \rvert \le \frac{\pi}{4} d^2 \Delta L, \qquad \Delta L = \begin{cases} 0.05\ \text{mm} & \text{measured length} \\ 0.15\, L_b & \text{estimated length} \end{cases}
$$

Code: `packages/drawing/src/seating/seating.ts`, `intrusion`, `bulletLengthTolerance`.

The lower bound of $V_b$ is clamped at 0. Both tolerances are assumptions without a source.

### Leade contact and jump

The contact $z_\mathrm{c}$ is where the bullet diameter $d$ meets the leade, from the case head. It reads the chamber values of the C.I.P. sheet listed under Symbols:

$$
z_\mathrm{c} = L_{3,\mathrm{ch}} + s_\mathrm{ch} + \frac{G_1 - d}{2 \tan i}
$$

Code: `packages/drawing/src/seating/seating.ts`, `leadeContact`.

Without $s_\mathrm{ch}$ the leade starts at $L_{3,\mathrm{ch}} + G - (G_1 - F)/(2 \tan i)$. A bullet not above $F$ has no land contact, and one not below $G_1$ touches at the leade start. The jump is the distance from the ogive point at diameter $d$ to the contact:

$$
j = z_\mathrm{c} - (z_b + L_b - L_\mathrm{nose})
$$

Code: `packages/drawing/src/seating/seating.ts`, `leadeContact`, `seat` (`jumpValue`).

The contact position is derived here from the C.I.P. chamber drawing, not a C.I.P. value, and is not checked against a measurement. The jump is an estimate against the C.I.P. minimum chamber for either seating input: derived for a bullet seated by a measured CBTO, approximate from COAL.

### Seating ladder

A seating ladder runs the interior model at seating lengths spaced by $\Delta$ up, down or centred on the start, each with its own $V_c$ and $x_e$:

$$
\ell_i = \begin{cases} \ell_0 + i\,\Delta & \text{up} \\ \ell_0 - i\,\Delta & \text{down} \\ \ell_0 + \left(i - \frac{N - 1}{2}\right) \Delta & \text{around} \end{cases} \qquad i = 0, \dots, N - 1
$$

Code: `apps/web/src/lib/seating-ladder.ts`, `ladderLengths`, `seatingLadder`.

A step outside the seating range of the cartridge and bullet, or one with $V_c \le 0$, refuses the whole ladder with an error. No step runs.

## Symbols

| Symbol | Meaning | Stored unit | Unit in code |
| --- | --- | --- | --- |
| $m_w$ | Water capacity of the case to the mouth | g | g |
| $\rho_w$ | Density of water at 20 °C | g/cm3 | g/cm³ |
| $V_\mathrm{case}$ | Case volume to the mouth | no kind | cm³ (m³ in `core`) |
| $m_\mathrm{gr}$ | Mass of one grain | g | kg |
| $z_b$ | Position of the bullet base from the case head | mm | mm |
| $\mathrm{COAL}$, $\mathrm{CBTO}$ | Cartridge overall length, cartridge base to ogive | mm | mm |
| $L_b$, $L_\mathrm{bto}$, $L_\mathrm{nose}$ | Bullet length, base to ogive, nose length | mm | mm |
| $L_3$ | Case length of the cartridge (C.I.P.) | mm | mm |
| $s$ | Seating depth below the case mouth | mm | mm |
| $L_\mathrm{barrel}$, $x_e$ | Barrel length from the breech face, bullet travel | mm | mm (m in `core`) |
| $r(z)$, $r_k$, $z_k$ | Outline radius and points from the base | mm | mm |
| $c$ | Length of the bullet below the mouth | mm | mm |
| $V_b$ | Bullet volume below the mouth | no kind | cm³ |
| $V_c$ | Chamber volume behind the bullet | no kind | cm³ (m³ in `core`) |
| $d$ | Bullet diameter | mm | mm |
| $\Delta L$ | Bullet length tolerance | mm | mm |
| $L_{3,\mathrm{ch}}$, $s_\mathrm{ch}$, $G$ | Chamber case length, leade start and leade end past it (C.I.P.) | mm | mm |
| $G_1$, $F$ | Chamber diameter at the leade start, land diameter at the leade end (C.I.P.) | mm | mm |
| $i$ | Leade angle of the chamber to the axis | deg | deg |
| $z_\mathrm{c}$, $j$ | Leade contact from the case head, jump | mm | mm |
| $\ell_i$, $\Delta$, $N$ | Seating length of step $i$, step size, step count | mm, mm, 1 | m, m, 1 |

## Assumptions

- The water capacity is measured to the case mouth at 20 °C.
- The bullet is a solid of revolution with the outline `bulletOutline` builds. Missing dimensions take stated proportions, which the notes name.
- Only the mouth position bounds the bullet volume. The neck diameter and the case wall do not enter.
- The case does not change its volume with pressure or temperature.

## Limits

- A capacity measured with water at another temperature than 20 °C is not corrected.
- A bullet base in front of the case mouth gives $V_b = 0$ with a note, and a bullet wholly below the mouth counts its whole volume.
- The jump needs the chamber values and the bullet nose length. Without them it is not given.
- The bounds from the length tolerance cover the bullet length only, not the case capacity.

## Sources

- [Tanaka 2001](../bibliography.md#tanaka-2001): density of water at 20 °C, table, pp. 301 to 309 (the table value is unverified, not re-read from the paper).
- [C.I.P. TDCC](../bibliography.md#cip-tdcc): cartridge length $L_3$ and the chamber values $L_3$, $s$, $G$, $G_1$, $F$ and $i$, per cartridge sheet.
