---
title: Thermochemistry ingredient heats
description: Four ingredient heats of formation that differ between two tables, a third open value for each where one exists, and the change in flame temperature over the recorded powder compositions.
---

# Thermochemistry ingredient heats

Every number on this page is a simulation from stated compositions, not load data.

## Question

Propellant thermochemistry: do four conflicting ingredient heats of formation matter for the flame temperature of the recorded powders (target below 0.3 %), and which value does a third open source support?

## Method

Values in use against an independent table (kJ/mol, condensed): ethyl centralite -121 against -105, methyl centralite -73.1 against -61, 2,4-dinitrotoluene -66.4 against -68.2, dibutyl phthalate (liquid) -778 against -843. Third values from combustion enthalpies of other authors in the [NIST WebBook](../bibliography.md#nist-webbook) (converted with CO2 -393.51 and liquid water -285.83 kJ/mol) and from [Maksimuk 2004](../bibliography.md#maksimuk-2004).

Rerun: a local calculation (the equilibrium of [thermochemistry reference case](thermochemistry-reference-case.md)) of every powder record with a published composition range (not in the repository) at 100 kg/m3, value at the mean composition and min and max over the range vertices and the nitrogen bounds. Variant A: all four from the independent table. Variant B: the values a third source supports, the others unchanged. Metric: largest relative change of the flame temperature (value, min or max).

## Formulas

Heat of formation from a combustion enthalpy: the formation heats of the combustion products (CO2, liquid water, N2) minus the combustion enthalpy.

## Numbers

| ingredient | in use | independent table | third value | third source |
| --- | --- | --- | --- | --- |
| ethyl centralite | -121 | -105 | -105.9, or -42 and -33 | combustion, Burlot 1939 and Ball 1931, via NIST WebBook (the -121 in use is Taylor 1947) |
| methyl centralite | -73.1 | -61 | -51.8 or -114 | combustion, Handrick 1956 and Taylor 1947, via NIST WebBook |
| 2,4-dinitrotoluene | -66.4 ± 3.0 | -68.2 | none within the spread | NIST WebBook lists -40 and -29 (older) |
| dibutyl phthalate, liquid | -778 | -843 | -864.7 ± 4.8 | Maksimuk 2004 |

Records: 43 with a composition, 31 solved (the rest refuse for a missing ingredient or condensed products). Variant A changes 26 records, largest change 0.052 % on the value and 0.107 % on min or max. Variant B (ethyl centralite -105.9 from the nearest outside value, dibutyl phthalate -864.7) changes 13 records, largest 0.038 % and 0.077 %.

## Result

no change; documented as a limit. Every change is below 0.3 % in flame temperature. Ethyl centralite: the outside values spread from -106 to -33; one lies near -105, the two oldest far from both, so no value decides. Dibutyl phthalate: a modern value (-864.7) supports the more negative side and rules out -778 (an old value without corrections). Ethyl centralite, methyl centralite and 2,4-dinitrotoluene: no third value decides, both values are kept on record with an effect below 0.11 %.

## Data basis

public: published heats of formation and composition ranges; the compositions are not in the repository and only aggregates are stated.

## Where in the app

`packages/schema/src/powder.ts` (`powderThermochemistry`), [M3](../models/interior-m3.md).

## Confidence

high for the effect (a factor of three below the target in the worst variant); low for which centralite and dinitrotoluene values are right.
