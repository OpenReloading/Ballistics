---
title: Thermochemistry partial heats
description: Whether the mass-weighted sum of conventional ingredient partial heats matches the heat of explosion computed from a frozen equilibrium for recorded powder compositions.
---

# Thermochemistry partial heats

Every number on this page is a simulation from stated compositions, not load data.

## Question

Propellant thermochemistry: is the heat of explosion of a powder (liquid water) the mass-weighted sum of the ingredient partial heats within 2 %, so that the sum could stand in for the computed heat?

## Method

Partial heats (kJ/kg, liquid water): nitrocellulose 3358 at 11.5 % N, 3944 at 12.5 %, 4409 at 13.3 % (linear between, extended past 13.3 %), nitroglycerine 7474, dinitrotoluene -620, dibutyl phthalate -8671, diphenylamine -11238, ethyl centralite -9969.

Compositions: the powder records with a published composition range (not in the repository), mean of the range vertices, nitrogen 13.0 %, records with the same composition counted once. Selection: those whose ingredients without a listed partial heat sum to at most 5 % at their upper bounds; those ingredients are removed and the rest renormalised for both sides. A first pass with a 2.5 % cut and without removing repeated compositions gave ten records but only three distinct compositions, so the cut was widened to 5 % after that pass had shown its gaps. Seven distinct compositions qualify (ten were asked for).

Computed heat: a local calculation (the equilibrium of [thermochemistry reference case](thermochemistry-reference-case.md)) at 100 kg/m3, composition frozen at 1500 K, products cooled to 298.15 K with water liquid (vaporisation 44.0 kJ/mol). Metric: sum over computed heat minus one. Rule: within 2 % passes; above 5 % the convention gap is documented.

## Formulas

Heat of explosion: the energy of the ingredients at 298.15 K minus the energy of the frozen products at 298.15 K, water condensed. Partial-heat estimate: the sum over ingredients of mass fraction times partial heat.

## Numbers

Gap per composition, percent: -3.34, -3.13, -2.71, -1.65, -1.00, -0.23, +0.10. Maximum 3.34 %, median 1.65 %. Removed share 0 to 2.5 %. Single-base compositions with stabiliser and plasticiser show the largest gaps; double-base ones are within 1 %.

Checks of the computed heat: nitroglycerine 6767 kJ/kg, nitrocellulose 4437 kJ/kg at 13.3 % N and 4006 kJ/kg at 12.5 % N.

## Result

no change; not adopted. The median is within 2 %, the maximum (3.3 %) is not, and no gap reaches 5 %, so no convention gap is documented beyond this entry. Partial heats as outputs are not built: no user has asked for them.

## Data basis

public: published composition ranges of powder families, not in the repository; only aggregates are stated.

## Where in the app

`packages/schema/src/powder.ts` (`powderThermochemistry`), [M3](../models/interior-m3.md).

## Confidence

medium: seven compositions, one nitrogen content, and a freezing temperature taken from the fume-volume convention.
