---
title: How close a result is
description: The known sources of variation of a load, each with its size and source, and the held-out error of the interior model against printed load data, split by rifle and handgun.
---

# How close a result is

A result is a simulation, not load data, and nothing on this page is a statement about a particular load. Two things lie between a result and what a firearm does with a load: the variation of the real load, and the error of the model. Neither is in the [peak-pressure range](models/interior-pressure-range.md) or the [sampled band](models/interior-sampled-band.md) of a result. They move six inputs within [default tolerances](models/interior-pressure-range.md#default-tolerances) that are assumptions without a source, and they leave the model error out.

## Error of the model on held-out data

The model was compared with printed load rows of cartridges it was not fitted to, by the protocol of [Model validation](models/validation.md). The error of a row is the absolute relative difference between the model and the printed value.

### All used rows

From the [results](models/validation.md#results) of `verify --json` on the validation split (rows not in the repository), model version `67d67adf…`, powder parameters of the records:

| Quantity | Rows | Median error | P90 error | Interval coverage |
| --- | --- | --- | --- | --- |
| Muzzle velocity | 10,497 | 3.32 % | 8.87 % | 89.6 % |
| Peak pressure (rows that print one in bar) | 4,060 | 15.0 % | 38.1 % | not measured |

The errors are over the 10,497 of 16,871 rows in the split that the model ran. The [results](models/validation.md#results) give the reasons for the rest, the family lines and the [pooled powder fit](models/validation.md#pooled-powder-fit) (median 2.85 %, P90 7.84 % on 633 held-out rows). Not measured: the sealed test split, and a powder that is not in the fitted set.

### Rifle and handgun

`verify --group-by` has no firearm class, so the split comes from the research entry [Shot-start pressure by bullet construction and firearm class](research/interior-start-pressure-rules.md). It scores the load-table fit with every powder refitted on the training split, on 14,238 validation rows, a different set-up from the table above:

| Start pressure rule | Rifle median | Rifle P90 | Handgun median | Handgun P90 |
| --- | --- | --- | --- | --- |
| Fixed 30 MPa | 2.76 % | 7.22 % | 6.16 % | 13.58 % |
| One value per construction and class | 2.75 % | 7.18 % | 5.70 % | 12.99 % |
| As the model runs: fixed for rifles, per construction for handguns | 2.76 % | 7.22 % | 5.70 % | 12.99 % |

Muzzle velocity only; a barrel of 300 mm or longer counts as a rifle. The research entry names no model version, and its powder parameters are refitted, not the records' values of the table above. No command in the repository reproduces this split.

## Sources of variation of a load

Each line gives a size from one source, with the conditions it was measured under. Sizes are for the named cartridge and load and do not carry over to another. Shot counts are small in several sources.

| Source of variation | Size | Conditions | Source |
| --- | --- | --- | --- |
| Shot to shot, one load | standard deviation 7 to 14 ft/s (means 2740 to 2771 ft/s), depending on the case make | .223 Rem, 77 gr bullet, 20 in barrel, 20 shots per case make | [Castleman 2023](bibliography.md#castleman-2023) |
| Shot to shot, handgun | no measured source found | | |
| Powder temperature | over 0 to 125 °F, a velocity spread of 67 to 127 ft/s for IMR 4350, Reloder 19, Win 748 and IMR 4831, and of 4 to 10 ft/s for H4350, Varget and H4831SC | maker's test, .30-06, .308 and .300 Win Mag; shots per point not stated | [Hodgdon 2012](bibliography.md#hodgdon-2012) |
| Powder lot | lots of one powder 7.9 to 15.3 ft/s (53 gr bullet) and 23.4 to 45.6 ft/s (69 gr) faster than the slowest lot | Varget in .223, 10 shots per lot | [Courtney 2015](bibliography.md#courtney-2015) |
| Case capacity, within a lot | standard deviation 0.07 to 0.21 gr of water | .223 Rem cases of several makes, 20 per make | [Castleman 2023](bibliography.md#castleman-2023) |
| Case capacity, between makes and lots | 0.96 gr of water between the makes with the largest and the smallest mean capacity; 1.06 % between two lots of one make | .223 Rem | [Castleman 2023](bibliography.md#castleman-2023) |
| Case capacity, between makes | 56.8 (R-P) against 56.2 gr of water (Lapua) | .308 Win, once-fired cases | [Courtney 2015](bibliography.md#courtney-2015) |
| Barrel, same length | 1125 to 1181 ft/s from three 5 in barrels | 9 mm Luger, one 115 gr factory load, 3 shots per barrel, measured 15 ft from the muzzle | [BBTI 9 mm](bibliography.md#bbti-9mm) |
| Factory ammunition, velocity tolerance | within ±90 ft/s of the tabulated values | factory ammunition in SAAMI test barrels | [SAAMI Z299.4-2025](bibliography.md#saami-z299-4-2025) |
| Barrel length | 24.6 ft/s per inch (147 gr FMJ) and 20.9 ft/s per inch (168 gr match), 22.7 on average over four factory loads | .308 Win, one barrel cut from 28 to 16.5 in, 5 shots per length | [Rifleshooter 2014](bibliography.md#rifleshooter-2014) |
| Barrel length, handgun | 948 ft/s from a 2 in and 1166 ft/s from a 5 in barrel | 9 mm Luger, one 115 gr factory load, 3 shots per barrel, measured 15 ft from the muzzle | [BBTI 9 mm](bibliography.md#bbti-9mm) |
| Pressure measurement method, limits | maximum average pressure 52,000 CUP against 55,000 psi (.223 Rem), 50,000 against 60,000 (.30-06), 52,000 against 62,000 (.308 Win) | the standard's limits for copper crusher and piezo transducer, same cartridge; not paired measurements of one load | [SAAMI Z299.4-2025](bibliography.md#saami-z299-4-2025) |
| Seating depth | no primary sized source found | | |

Some lines are inputs of the model: the barrel length, the case capacity (as the chamber volume), the powder temperature, and the powder lot through the burn coefficient (the [lot rows](models/interior-pressure-range.md#powder-lot-rows) move it by 3 %). Their effect is part of a result when the value is entered. Shot-to-shot spread, barrel-to-barrel differences and the pressure method are not inputs. The pressure method sets which printed pressures a result can be compared with. The standard sets the crusher and piezo limits of a cartridge apart by a ratio that changes from cartridge to cartridge, so its limits give no single factor between the methods; no paired measurement of one load by both methods is cited here.

Primer make, moisture, ageing, suppressors, polygonal rifling, bullet coatings and jackets, and the small effects on the case capacity are listed with their sources in the Limits of the [M3 model](models/interior-m3.md#limits), [burn forms](models/interior-burn-forms.md#limits), [leakage and heat loss](models/interior-leakage-heat.md#limits) and [case capacity](models/case-capacity.md#limits) pages.

## Limits

- The variation sizes come from single tests of named loads, mostly with few shots, except the two lines from the SAAMI standard, which are its tolerance and limits; they show an order of size, not a tolerance for another load.
- The held-out error is against printed values and their conventions. Held-out cartridges stand for cartridges the fit has not seen, not for every firearm, lot or temperature ([Model validation, Limits](models/validation.md#limits)).
- No rating or band of another program is used here, and no line on this page says that a load or a result is fit for use.
