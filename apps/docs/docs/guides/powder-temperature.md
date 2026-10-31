---
title: Measuring powder temperature
description: Why the temperature of the powder, not of the air, is the input, how to measure it at the range, and how to enter it for the workbench and the powder fit.
---

# Measuring powder temperature

The burn rate of the interior model changes with the temperature of the propellant, for a powder whose record has a temperature sensitivity ([Temperature of the propellant](../models/interior-m3.md#temperature-of-the-propellant)). A powder without one burns the same at any temperature in the simulation. All results are simulations, not load data.

## What it improves

- **The run.** Powder temperature is an input of every simulation of the load. The [peak-pressure range](../models/interior-pressure-range.md#default-tolerances) moves it by 5 K either side by default.
- **The powder fit.** Strings at two or more powder temperatures let the fit scale the temperature sensitivity; strings at one temperature fit the burn coefficient alone ([Several barrel lengths and temperatures](../models/interior-powder-fit.md#several-barrel-lengths-and-temperatures)). A wrong temperature on a string moves the fitted burn coefficient.

## Steps

1. **Measure the cartridges, not the air.** Cartridges in the sun, in a cold car or in a warm chamber are not at air temperature. Keep a few rounds in the same box as the ones you fire, and read a thermometer probe placed among them.
2. **Time it.** A round left in a hot chamber warms up. Read the temperature of the box just before a string and fire without long pauses in the chamber.
3. **One temperature per string.** Note the temperature with each string or session.

## Entering it

- **Workbench.** Type it as Powder temperature of the load.
- **Measurements and tuning.** A chronograph session records its own temperature where the file has one; else the string takes the load's Powder temperature. On the tuning screen, type a string's Powder temperature where it differs from the load's ([Tuning a powder](../powder-tuning.md)).
