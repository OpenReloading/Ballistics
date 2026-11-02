---
title: Setting up a chronograph
description: Where to put the chronograph, what its distance from the muzzle means for the velocities the app reads, and how the readings enter the powder fit and truing.
---

# Setting up a chronograph

The app reads chronograph velocities for two fits: the [powder fit](../powder-tuning.md) on the Measurements tab, which matches the simulated muzzle velocity, and [truing](../models/exterior-truing.md), which matches the trajectory. All results are simulations, not load data.

## What it improves

- **Powder fit.** The fitted burn coefficient is whatever makes the simulated muzzle velocity meet your mean velocities, so an offset in the velocities becomes an offset in the burn coefficient. The [peak-pressure range](../models/interior-pressure-range.md#default-tolerances) moves the burn coefficient by 3 % either side by default.
- **Truing.** A chronograph reading fixes the muzzle velocity, and the drop then fixes the drag factor ([Range strings](../models/exterior-truing-strings.md)).

## Distance to the muzzle

The app does not correct velocities to the muzzle. The Measurements tab says so, and names the distance a chronograph file records. A velocity read a few metres in front of the muzzle is lower than the muzzle velocity by the drag over that distance, and the fits take it as the muzzle velocity.

- Put the chronograph as close to the muzzle as its maker allows. A radar or a muzzle-mounted device reads at or near the muzzle.
- Optical screens need distance from the muzzle blast. Keep the distance the same for every string you compare, and record it in the session's note.
- Truing models the chronograph at the muzzle: a reading taken downrange is fitted as if it were at the muzzle.

## Set-up

1. Mount the chronograph so that the bullet crosses it square and at the height its maker gives.
2. Fire one or two shots before the strings you record, so that the readings start from a fouled bore.
3. Record every shot of a string, including outliers. The powder fit pools the scatter of all strings ([Powder fit](../models/interior-powder-fit.md)); dropping shots narrows a string without making it more accurate.
4. Fire at least 5 shots per string. The standard deviation of fewer shots is very uncertain ([Velocity flat spots](../models/interior-velocity-ladder.md#limits)).
5. Note the powder temperature of each session ([Powder temperature](powder-temperature.md)).
