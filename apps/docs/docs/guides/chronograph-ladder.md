---
title: Reading a chronograph ladder for the powder fit
description: How to plan and fire a charge ladder so that the powder fit can use it, and what the fit and the flat-spot analysis can and cannot tell from it.
---

# Reading a chronograph ladder for the powder fit

The [powder fit](../powder-tuning.md) fits the burn coefficient of the load's powder to the mean velocities, and the [flat-spot analysis](../models/interior-velocity-ladder.md) shows where the velocity rises least with the charge. All results are simulations, not load data.

## What it improves

The burn coefficient. The [peak-pressure range](../models/interior-pressure-range.md#default-tolerances) moves it by 3 % either side by default; a fitted value replaces the record's value with one that matches your rifle and powder lot, with its own uncertainty ([Powder fit](../models/interior-powder-fit.md)).

## Plan the ladder

- **Charges.** Three or more charges, at least 10 % apart from the lowest to the highest, let the fit try values beyond the burn coefficient. Fewer, or closer, fit the burn coefficient alone ([Notes and refusals](../powder-tuning.md#notes-and-refusals)).
- **Shots.** At least 5 per string. Short strings give wide bands, and a flat spot can then mean only that the strings were too short to tell.
- **The rest fixed.** One rifle, one lot of powder, primers, cases and bullets, one seating, and one powder temperature unless you fire a temperature series on purpose.

## Read it

1. Read the chronograph files on the Measurements tab and map each string to its ladder step.
2. Fit the powder ([Tuning a powder from chronograph strings](../powder-tuning.md)). Read the residual per charge: the fit matches the mean velocities, so a large residual at one charge is a string to look at again.
3. Read the flat spots as a statistical observation about the strings fired. They say nothing about pressure, accuracy or whether a charge may be loaded.

## What it cannot tell

A velocity-only ladder cannot separate the burn coefficient from the start pressure, and it absorbs the errors of every fixed input that moves the velocity: energy, chamber volume, heat loss and others. A measured peak pressure or strings from a second barrel length or temperature separate them ([Powder fit](../models/interior-powder-fit.md#several-barrel-lengths-and-temperatures)).
