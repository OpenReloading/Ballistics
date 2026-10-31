---
title: Measuring bullet length, base to ogive and bearing length
description: How to measure the bullet dimensions the seating and the stability estimate use, which simulation input each one moves, and where to enter them.
---

# Measuring bullet length, base to ogive and bearing length

A bullet record carries the maker's dimensions where they are known, and the app fills missing ones from stated proportions ([Bullet volume below the mouth](../models/case-capacity.md#bullet-volume-below-the-mouth)). Your own bullets of one lot can differ from both. All results are simulations, not load data.

## What each value improves

| Value | Input it moves | How |
| --- | --- | --- |
| Length | Chamber volume and bullet travel, when the load is seated by COAL; the gyroscopic stability factor | The base sits at COAL minus the length ([Seated bullet](../models/case-capacity.md#seated-bullet)). Miller's rule uses the length ([Stability](../models/exterior-stability.md)). |
| Base to ogive | Chamber volume and bullet travel, when the load is seated by CBTO; the jump to the lands | The base sits at CBTO minus the base to ogive length. |
| Bearing length | The outline below the mouth | It shapes the bullet volume that comes off the case volume. It is not an input of the interior model. |

The base position moves the chamber volume, which the [peak-pressure range](../models/interior-pressure-range.md#default-tolerances) moves by 1 % either side. On a case of about 3.2 cm³ (50 grains of water) and a bore of 7.8 mm, 0.5 mm of base position is 0.024 cm³, under 1 % of the case volume. Bullet mass is not moved by the range unless a tolerance is set.

## What you need

- A caliper that reads 0.01 mm or 0.001 in.
- A bullet comparator insert of the bore diameter for base to ogive: the ogive has no edge, so it is measured where the nose reaches the insert's diameter.
- 5 to 10 bullets of one lot.

## Steps

1. **Length.** Measure base to tip on each bullet. Polymer tips and hollow points vary most at the tip: note the mean and the range.
2. **Base to ogive.** Clip the comparator insert on one jaw and measure from the base to the insert. Use the same insert for the bullet, for the cartridge (CBTO) and for Base to ogive at the lands of your firearm, so that the three agree.
3. **Bearing length.** Measure the cylindrical part of the shank, from where the boat tail or base ends to where the ogive starts. Marking the shank with a felt pen and turning it in a sized case neck shows its ends.
4. Take the mean of each value over the bullets.

## Entering them

In the bullet designer, start from the catalogue bullet or a new design and enter Length under Mass, diameter and length, and Bearing length and Base to ogive under Shank. Save the design and choose it in the workbench. The seating figure then draws the bullet from your values, and COAL or CBTO places it.

The lands values belong to the firearm: enter Base to ogive at the lands, measured, with the bullet you measured it with, and the workbench gives the jump for that bullet ([Firearm records](../data/firearm-records.md)).
