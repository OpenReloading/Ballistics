---
title: Measuring case capacity with water
description: How to weigh the water capacity of your own cases, which cases and conditions to use, how to report mean and spread, and how to enter the value as a brass group for the workbench.
---

# Measuring case capacity with water

The case capacity is the mass of water that fills a case to the mouth. The workbench turns it into the case volume, takes off the part of the bullet seated below the mouth and runs the interior model in the volume that is left ([Case capacity and seating](../models/case-capacity.md)). A capacity measured on your own cases replaces the stated capacity of a brass record. All results are simulations, not load data.

## What it improves

The case capacity sets the chamber volume of the simulation. The [peak-pressure range](../models/interior-pressure-range.md#default-tolerances) moves the chamber volume by 1 % either side by default, next to 0.5 % for the charge and 3 % for the burn coefficient. A stated capacity of a brass record describes another lot or the maker's figure, and can differ from your cases by more than that. A measured mean with a small spread brings the input within the tolerance the range assumes.

## What you need

- A scale that reads 0.1 grain (about 0.006 g) or finer. At 0.1 grain the reading of a case of 50 grains of water is within 0.2 %, a fifth of the 1 % tolerance above.
- Water at room temperature, a dropper or syringe, and a towel.
- 5 to 10 cases of one lot, prepared as you load them.

## Steps

1. **Choose the cases.** Use the cases you load, in the state you load them. Fired cases hold more water than new ones, and sizing takes some of that back: measure fired and sized cases for a load that you size, fired cases for a load fired in the same chamber without sizing. Keep the spent primer in place, or seat a fired primer, so that no water leaks through the flash hole.
2. **Weigh each case dry.** Zero the scale, weigh one case and note it. Weigh every case on its own: case masses differ within a lot.
3. **Fill to the mouth.** Fill the case with the dropper until the water stands level with the mouth, with no bubble inside and no drop on the outside. A curved surface above the mouth adds water that a seated bullet does not leave room for.
4. **Weigh it full.** The difference between the full and the dry mass is the water capacity of that case. Empty and dry the case before it is loaded.
5. **Repeat** for every case. Refill one case two or three times to see how well you repeat a fill; if that scatter is as large as the scatter between cases, the spread you report is mostly your filling.

## Water temperature

The app turns the water mass into a volume with the density of water at 20 °C, 0.9982 g/cm³, whatever water you used ([Case volume](../models/case-capacity.md#case-volume)). Between 15 °C and 25 °C the density of water changes by about 0.2 % (from the table of [Tanaka 2001](../bibliography.md#tanaka-2001), values unverified, not re-read from the paper). Water near room temperature therefore keeps the volume within a fifth of the 1 % tolerance. The app does not correct a capacity measured at another temperature: write the temperature in the group's Notes.

## Mean and spread

Report the mean of the case capacities and the sample standard deviation over the cases, in grains or grams of water, and the number of cases. The mean is the input the simulation runs; the spread and the count tell you and others how far one case is from it. Compare the spread with the 1 % chamber-volume tolerance of the pressure range: a spread near or above 1 % of the mean means that single cases differ from the mean by about as much as the range moves the input.

## Entering it

1. Open the Brass tab of the Database and choose New brass group.
2. Give it a Name (for example headstamp and batch) and choose its Cartridge. Start from a case product if you know the catalogue product of your cases.
3. Enter the mean as Water capacity to the mouth, the number of cases as Cases measured and the standard deviation as Capacity spread. Times fired and the other measured values are optional.
4. In Notes, write how the cases were measured: fired or sized, primer in place, water temperature.
5. Save. In the workbench, choose the group as the Brass record of a load of that cartridge (it is listed as your brass): its capacity fills Case capacity (H₂O) and is shown as measured.

To try a value without a group, type it straight into Case capacity (H₂O) in the workbench. It replaces the record's capacity for this load only.

## What the value is not

The water capacity to the mouth is the volume of the empty case. The volume the powder burns in is smaller by the part of the bullet below the mouth, which the app computes from the bullet's outline and the seating. A capacity measured with a bullet seated, or with water above the mouth, is not this value.
