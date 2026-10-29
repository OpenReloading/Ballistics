---
title: Thermochemistry reference case
description: A double-base composition at 210 kg/m3 solved by constant-volume equilibrium and compared with an independent hand-checked calculation, with the energy scale, a real-gas energy correction and the covolume species set as candidate causes.
---

# Thermochemistry reference case

Every number on this page is a simulation from a stated composition, not load data.

## Question

Propellant thermochemistry (the values of `thermochemistry` in a powder record, the inputs `energy`, `gamma` and `covolume` of [M3](../models/interior-m3.md)): does a constant-volume equilibrium reproduce an independent hand-checked calculation of one double-base composition, and what explains the gaps?

## Method

Composition in mass percent: nitrocellulose 57.23 (13.25 % N), nitroglycerine 40.04, potassium nitrate 1.49, ethyl centralite 0.74, ethanol 0.50; loading density 210 kg/m3; heat of formation about -2150 kJ/kg (this run: -2148.0 kJ/kg, ethanol -277 kJ/mol, liquid, [NIST WebBook](../bibliography.md#nist-webbook)). Reference values: 3841 K, force 1170 kJ/kg, 27.28 g/mol, 36.66 mol/kg, covolume 0.937 cm3/g, 305.9 MPa.

The computed values come from a local calculation that is not in the repository: free-energy minimisation at fixed temperature and volume ([RP-1311](../bibliography.md#rp-1311)) over C, H, N, O and K gas species with the NASA Glenn coefficients ([TP-2002-211556](../bibliography.md#tp-2002-211556)), the temperature found from the energy balance, and the covolume as the sum over the five main products of amount times the Lennard-Jones second virial coefficient at the flame temperature ([Svehla 1962](../bibliography.md#svehla-1962)).

Runs: (1) base, heats of formation on the enthalpy scale; (2) the energy-of-formation scale, the input raised by the gaseous elements times R times 298.15 K; (3) a real-gas internal-energy correction of the Noble-Abel gas with a temperature-dependent covolume; (4) both. A fifth variant counts the minor species OH, H, O, O2 and NO in the covolume with their Table I force constants.

Rule, set in advance: pass when every gap is below 0.3 %, else a 1.5 % tolerance with a stated cause.

The energy-scale shift and the Noble-Abel pressure of the reference are reproduced by `node spikes/372/thermochemistry.mts` at commit `4f0382ff8860ef75b5d61219ef33f978ff284222` on the branch `spike/372-thermochemistry`.

## Formulas

Energy of formation of a condensed ingredient: the enthalpy of formation plus the amount of gaseous elements (H2, N2, O2) it is formed from, times R T at 298.15 K. For 1 kg of the composition that amount is half the sum of the H, N and O atoms in mol.

Noble-Abel pressure: force times loading density divided by one minus covolume times loading density.

Real-gas energy of a Noble-Abel gas whose covolume b depends on temperature: the residual energy is minus n R T squared times n db/dT over the volume, divided by one minus the covolume fraction n b / V; it follows from the residual Helmholtz energy, minus n R T times the logarithm of one minus n b / V ([Corner 1950](../bibliography.md#corner-1950) for the equation of state).

## Numbers

Computed against the reference, relative gap in percent:

| run | T (K) | force (kJ/kg) | M (g/mol) | gas (mol/kg) | covolume (cm3/g) | pressure (MPa) |
| --- | --- | --- | --- | --- | --- | --- |
| reference | 3841 | 1170 | 27.28 | 36.66 | 0.937 | 305.9 |
| base | 3799.2 (-1.09) | 1159.9 (-0.86) | 27.233 (-0.17) | 36.72 (+0.16) | 0.915 (-2.38) | 301.5 (-1.44) |
| energy scale | 3838.1 (-0.08) | 1173.7 (+0.32) | 27.189 (-0.33) | 36.78 (+0.33) | 0.915 (-2.37) | 305.1 (-0.26) |
| real-gas energy | 3811.9 (-0.76) | 1164.4 (-0.48) | 27.219 (-0.22) | 36.74 (+0.22) | 0.915 (-2.38) | 302.7 (-1.06) |
| both | 3850.1 (+0.24) | 1178.0 (+0.69) | 27.174 (-0.39) | 36.80 (+0.38) | 0.915 (-2.37) | 306.2 (+0.10) |
| base, minor species in covolume | 3799.2 (-1.09) | 1159.9 (-0.86) | 27.233 (-0.17) | 36.72 (+0.16) | 0.9374 (+0.04) | 303.3 (-0.85) |
| energy scale, minor species in covolume | 3838.1 (-0.08) | 1173.7 (+0.32) | 27.189 (-0.33) | 36.78 (+0.33) | 0.9396 (+0.28) | 307.1 (+0.38) |

The energy-scale shift is 90.7 kJ/kg (36.60 mol/kg of gaseous elements) and moves the flame temperature by 38.9 K. The real-gas energy is -29.3 kJ/kg and moves it by 12.7 K. Product mole percent of the base run: H2O 28.2, CO 28.3, CO2 21.1, N2 14.6, H2 4.4, OH 1.7, H, NO and KOH about 0.4 each; the minor species are 3.3 % of the moles.

## Result

no change; documented as a limit. Two causes explain the gaps:

- Temperature and force: the 39 K gap is the size of the shift between the enthalpy and the energy scale of the input. The base run is the consistent one (condensed reactants at their enthalpy of formation, gas products at enthalpy minus R T); the reference matches the energy-scale run within 0.1 %, so it most likely takes -2150 kJ/kg as an energy of formation.
- Covolume: the 2.4 % gap is the five-species sum. With OH, H, O, O2 and NO counted the covolume agrees within 0.04 % (base) and 0.3 % (energy scale).

The real-gas energy correction is 0.3 % in temperature and does not explain a gap. With the energy scale and the minor species every quantity is within 0.4 %, slightly above the 0.3 % target in force, molar mass, gas amount and pressure (species set and data, not resolved). The base run fails a 1.5 % tolerance on the covolume only. A regression test at 1.5 % on temperature, force and covolume would need the minor species in the covolume; that is a separate change.

## Data basis

public: published composition, NASA species data and force constants. The reference shares heats of formation with the computation, so the case tests the method, not the data.

## Where in the app

`packages/schema/src/powder.ts` (`powderThermochemistry`), [M3](../models/interior-m3.md).

## Confidence

medium: both causes reproduce the gaps to 0.3 % or better, but the reference's own convention is inferred, not stated.
