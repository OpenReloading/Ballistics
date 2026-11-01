---
title: Case capacity and seating
description: Case volume from the water capacity, the volume the seated bullet takes from it, the volume behind the bullet, the bullet travel and the jump to the lands.
---

# Case capacity and seating

1. A case capacity is the mass of water that fills the case to the mouth. Divided by the density of water it becomes the case volume.
2. Seating a bullet by its cartridge overall length (COAL) or its cartridge base to ogive length (CBTO) places its base in the case. The volume of revolution of the bullet outline below the mouth comes off the case volume.
3. What is left is the chamber volume behind the bullet, in which the [M3 interior model](interior-m3.md) burns the charge. The distance from the base to the muzzle is the bullet travel.

The cartridge designer seats a bullet in the case and chamber of its own values: the case length and the chamber values come from the design (its base record's values with the design's overrides applied), the case volume only from a case capacity the user measured. Without it the volumes are not given.

## Which capacity a load uses

A load can name a case record (`case.record`, [Brass](../data/cases.md): a catalogue product, or a group of the user's own cases) and a case capacity record (`capacity`). A group of the user's cases names the capacity record that holds the water the user measured on it, and choosing the group in the workbench makes that record the load's capacity. The capacity record is a figure the user measured on fired cases, or a catalogue figure chosen for the cartridge. The case record states the water capacity of the product as its manufacturer gives it. The capacity record takes precedence; without one the stated capacity of the case record is the default, and without either the capacity is not given. A stated capacity is never saved into the load: opening a load reads it again from the case record. Code: `packages/schema/src/case-capacity.ts`, `loadWaterCapacity`.

The seating geometry is in `packages/drawing/src/seating/seating.ts`, the outline in `packages/drawing/src/bullet/outline.ts`.

## Equations

### Case volume

$$
V_\mathrm{case} = \frac{m_w}{\rho_w}, \qquad \rho_w = 0.9982\ \text{g/cm}^3
$$

Code: `packages/core/src/water.ts`, `waterDensityGramsPerCm3`, `packages/drawing/src/seating/seating.ts`, `seat` (`caseVolume`).

$\rho_w$ is the density of water at 20 °C. The `convention` of a case capacity record (free text: fill level, water temperature, primer state) says how its water was filled. It is recorded and echoed (the `capacities` of `GET /cartridges/:id`) and does not enter $V_\mathrm{case}$: the same mass gives the same volume under any convention. A record without a `convention` follows the default under Assumptions. A case capacity the user measured, stored as a volume, takes the place of the record's water mass.

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

The bullet outline is a half profile $r(z)$, a polyline through points $(r_k, z_k)$ that `bulletOutline` builds from the bullet's dimensions, closed along the axis. It starts at the base centre, or at the apex of the cavity of a hollow base, and ends at the tip. The volume below the mouth is the sum of the frustums of revolution of its segments up to $c = \min(\max(s, 0), L_b)$. A segment running up adds its frustum and a segment running down, the wall of a cavity, takes it off:

$$
V_b = \sum_k \sigma_k \frac{\pi}{3} (z'_\mathrm{hi} - z_\mathrm{lo}) \left(r_\mathrm{lo}^2 + r_\mathrm{lo} r'_\mathrm{hi} + {r'_\mathrm{hi}}^2\right), \qquad z'_\mathrm{hi} = \min(z_\mathrm{hi}, c)
$$

Code: `packages/drawing/src/bullet/outline.ts`, `revolutionVolume`, `bulletOutline`.

with $z_\mathrm{lo} < z_\mathrm{hi}$ the ends of segment $k$ in z, $r_\mathrm{lo}$ its radius at $z_\mathrm{lo}$, $r'_\mathrm{hi}$ its radius at $z'_\mathrm{hi}$, interpolated linearly along the segment, and $\sigma_k = +1$ for a rising segment, $-1$ for a falling one. A boat tail counts as a frustum and a nose below the mouth with its own profile.

### Hollow base

A hollow base (`conical-hollow-base`, `rounded-hollow-base`) has a cavity open to the powder in the base face, of the diameter $2 r_c$ where it opens. The base face may sit on a boat tail described by the tail length, base diameter and angle, else it is flat. The cavity is not bullet volume: it enters the profile as the falling segments above, so $V_b$ is the metal below the mouth and the cavity inside the mouth is free volume behind the bullet.

The depth of the cavity is not an input. A depth would be a second dimension that only a section cut gives, while the diameter at the opening is printed or measured on the base. The depth follows from the shape instead: a cone of half angle 45° ($h = r_c$), or a hemisphere ($h = r_c$). A cavity of another depth moves the result, so the volume of a bullet with a cavity is flagged approximate and the cavity is drawn dashed. The part of the cavity below the mouth, cone and hemisphere:

$$
V_\mathrm{cone}(c) = \frac{\pi}{3} r_c^2 h \left(1 - \left(1 - \frac{c}{h}\right)^3\right), \qquad V_\mathrm{hemi}(c) = \pi \left(r_c^2 c - \frac{c^3}{3}\right), \qquad c \le h = r_c
$$

Code: `packages/drawing/src/bullet/outline.ts`, `cavityGeometry`, `revolutionVolume`.

From $c = h$ on the whole cavity counts: $V_\mathrm{cone} = \pi r_c^3 / 3$ and $V_\mathrm{hemi} = 2 \pi r_c^3 / 3$. The outline samples the hemisphere in 24 equal angle steps, which undercounts its volume by less than 0.3 %. A cavity part beyond the mouth lies outside the case volume and is not counted. For a cylinder of diameter $d$ seated past the cavity ($c \ge h$):

$$
V_b = \frac{\pi}{4} d^2 c - V_\mathrm{cavity}
$$

Code: `packages/drawing/src/seating/seating.ts`, `intrusion`, `seat`, `packages/drawing/src/bullet/outline.ts`, `revolutionVolume`.

A bullet without a cavity diameter, whatever its base type, is drawn and counted as before. A hollow base type without a cavity diameter is drawn with a flat face and a note.

The workbench takes the base type, the boat-tail length, the base face diameter and the cavity diameter typed over the bullet record's (`apps/web/src/lib/bullet.ts`, `typedBullet`): the outline and $V_b$ follow them. A flat base keeps no diameter, angle or cavity, a boat tail no cavity. A typed boat-tail length drops the record's bearing length, and a typed boat-tail length or base diameter its boat-tail angle: the outline derives them from the other dimensions, which would otherwise contradict the typed value.

### Volume behind the bullet

$$
V_c = V_\mathrm{case} - V_b
$$

Code: `packages/drawing/src/seating/seating.ts`, `seat` (`volumeBehindBullet`).

No volume behind the bullet is given, with a note, when the seating depth is above the case length (the base would sit behind the case head) or when $V_c \le 0$ (the bullet below the mouth takes the whole case volume).

The value is flagged approximate when the part of the outline below the mouth rests on an assumed proportion, or when the bullet has a cavity and any of it is below the mouth.

At fixed COAL a bullet length error $\Delta L$ moves the seating depth by $\Delta L$, and every slice of the bullet, a cavity taken off, is at most the cylinder of the bullet diameter $d$, so

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

Code: `packages/drawing/src/seating/seating.ts`, `leadeContact`, `jumpOf`.

The contact position is derived here from the C.I.P. chamber drawing, not a C.I.P. value, and is not checked against a measurement. The jump is an estimate against the C.I.P. minimum chamber for either seating input: derived for a bullet seated by a measured CBTO, approximate from COAL.

#### Measured lands contact

A firearm record can hold the cartridge length at which one bullet touched the lands: a CBTO, a COAL, or both, with the bullet it was measured with. For that bullet the base position at contact $z_{b,\mathrm{c}}$ is the measured CBTO less the bullet base-to-ogive $B$ (used when the bullet has one), else the measured COAL less the bullet length $L_b$:

$$
z_{b,\mathrm{c}} = \mathrm{CBTO}_\mathrm{lands} - B
\qquad\text{or}\qquad
z_{b,\mathrm{c}} = \mathrm{COAL}_\mathrm{lands} - L_b
$$

Code: `packages/drawing/src/seating/seating.ts`, `landsBase`, `landsContactCoal`.

The jump is the distance the base moves from the seated position to the contact, and the COAL of contact is $z_{b,\mathrm{c}} + L_b$:

$$
j = z_{b,\mathrm{c}} - z_b
$$

Code: `packages/drawing/src/seating/seating.ts`, `jumpOf`.

A jump of 0 or less is contact. The bullet and the chamber values do not enter, so this jump is given without a nose length or chamber values and is tagged derived: it holds the measured contact and the entered length, and assumes the same comparator and bullet as the measurement. A contact measured with another bullet is not used for the chosen one: the jump then comes from the chamber values above, and the row says so.

The workbench matches the contact to the chosen bullet in `landsFor` (`apps/web/src/lib/firearm.ts`).

### Seating ladder

A seating ladder runs the interior model at seating lengths spaced by $\Delta$ up, down or centred on the start, each with its own $V_c$ and $x_e$:

$$
\ell_i = \begin{cases} \ell_0 + i\,\Delta & \text{up} \\ \ell_0 - i\,\Delta & \text{down} \\ \ell_0 + \left(i - \frac{N - 1}{2}\right) \Delta & \text{around} \end{cases} \qquad i = 0, \dots, N - 1
$$

Code: `apps/web/src/lib/seating-ladder.ts`, `ladderValues`, `seatingLadder`.

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
| $r_c$, $h$ | Radius of the cavity at the base face, its depth | mm | mm |
| $V_\mathrm{cone}$, $V_\mathrm{hemi}$, $V_\mathrm{cavity}$ | Cavity volume below the mouth (cone, hemisphere), the whole cavity | no kind | mm³ |
| $\sigma_k$ | Sign of segment $k$ of the profile: rising $+1$, falling $-1$ | 1 | 1 |
| $V_c$ | Chamber volume behind the bullet | no kind | cm³ (m³ in `core`) |
| $d$ | Bullet diameter | mm | mm |
| $\Delta L$ | Bullet length tolerance | mm | mm |
| $L_{3,\mathrm{ch}}$, $s_\mathrm{ch}$, $G$ | Chamber case length, leade start and leade end past it (C.I.P.) | mm | mm |
| $G_1$, $F$ | Chamber diameter at the leade start, land diameter at the leade end (C.I.P.) | mm | mm |
| $i$ | Leade angle of the chamber to the axis | deg | deg |
| $z_\mathrm{c}$, $j$ | Leade contact from the case head, jump | mm | mm |
| $z_{b,\mathrm{c}}$ | Bullet base position at the measured lands contact | mm | mm |
| $\ell_i$, $\Delta$, $N$ | Seating length of step $i$, step size, step count | mm, mm, 1 | m, m, 1 |

## Assumptions

- The default convention of a capacity record without `convention`: the water fills the case to the mouth, at 20 °C. The primer state is not part of the default: `caseCondition` does not define one.
- The bullet is a solid of revolution with the outline `bulletOutline` builds. Missing dimensions take stated proportions, which the notes name.
- The cavity of a hollow base is a cone of half angle 45° or a hemisphere, as deep as its radius, and it is empty: no wad or lubricant in it.
- Only the mouth position bounds the bullet volume. The neck diameter and the case wall do not enter.
- The case does not change its volume with pressure or temperature.

## Limits

- A capacity measured with water at another temperature than 20 °C is not corrected, whatever its `convention` says.
- A bullet base in front of the case mouth gives $V_b = 0$ with a note, and a bullet wholly below the mouth counts its whole volume.
- The jump needs the chamber values and the bullet nose length, or a measured lands contact of the firearm for the same bullet. Without either it is not given.
- A cavity of a different depth than its radius is not described. The cavity diameter must be below the base face diameter and its depth below the bullet length, else the outline is refused.
- The bounds from the length tolerance cover the bullet length only, not the case capacity.
- Effects on the capacity that were looked at and are left out:
  - Cannelure: a groove 0.002 in deep and 0.030 in wide, as in two patents on a frangible .223 bullet ([US 7,322,297 B2](../bibliography.md#us-7322297), [US 7,143,679 B2](../bibliography.md#us-7143679)), takes 1 to 7 mm³ below the mouth (unverified estimate), 0.03 to 0.23 % of a .308 case and 0.2 to 1.2 % of a 9 mm case.
  - Meplat: it lies above the mouth, so it changes the capacity by 0 %.
  - Bullet materials: the capacity uses the outline, not mass and density. A jacket share of 0.15 to 0.35 of the bullet mass moves the density of the bullet mix by ±2.6 % (unverified); no published jacket share was found.
  - Firings: 49.14 gr of water after one firing and 49.05 gr after four (n = 50), 0.18 % less capacity and 0.34 % more pressure (forum figures, unverified).
  - Plating: +0.33 % pressure at 5 µm (unverified). Case mass: a standard deviation of 0.41 gr (unverified) is 0.0031 cm³ of brass at 8.5 g/cm³, about 0.10 % of the 3.19 cm³ that 49.14 gr of water fill.
  - Case material: the only capacity claim found is a maker's statement, relayed by [Merrill 2017](../bibliography.md#merrill-2017), that a nickel-alloy 9 mm case with an aluminium head holds about 2 % more than brass (unverified). The `material` values of a case record have no nickel alloy.

## Sources

- [Tanaka 2001](../bibliography.md#tanaka-2001): density of water at 20 °C, table, pp. 301 to 309 (the table value is unverified, not re-read from the paper).
- [C.I.P. TDCC](../bibliography.md#cip-tdcc): cartridge length $L_3$ and the chamber values $L_3$, $s$, $G$, $G_1$, $F$ and $i$, per cartridge sheet.
- Research log: [placing a maximum pressure against the tolerance range](../research/interior-ceiling-classification.md).
