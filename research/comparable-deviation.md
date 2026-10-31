# When a simulation can be compared with a published load row

Research note for wayfinder ticket #823, read on 2026-10-31. Evidence tags: `[read]` the text or file was read for the point, `[summary]` only a fetch tool's summary of the page was available, `[rows]` counted in the collected maker load tables (68,502 rows of 10 makers, collected 2026-10-12 and 2026-10-13), `[records]` counted in `packages/data/records`, `[run]` computed for this note with the sources of `packages/core` on a synthetic load or on the collected rows, `[fit]` taken from the latest published run of the powder fit on the collected rows (validation split only unless stated). Nothing here is a recommendation of a load.

## Result

- A row is compared at the maker's own conditions. The comparison run takes the row's charge, bullet mass, COAL and test barrel, never the user's barrel. The measure per row is the signed velocity error (simulated minus printed, in m/s and in percent of the printed value) and, where the row has a comparable pressure, the pressure error in percent of the printed value. A row that cannot be compared says why and shows no number.
- Velocity distance: only 3 of 10 makers label a distance (RWS `v3`, Reload Swiss and Lovex `V5`), 4,171 of 68,502 rows with a velocity, and none of the three defines the label in the table. The other seven print "velocity" without a distance. A speed read 3 to 5 m downrange is 0.2 to 0.5 percent below the muzzle value for a rifle bullet and 0.4 to 1.3 percent for a handgun bullet, with tails to 2 percent `[run]`. The sign is always the same, so it is a bias and not noise. Recommendation: correct the labelled rows to the muzzle with one function, and use the same function in the powder fit and in the deviation view in one model version. Until then the powder fit absorbs the bias into each powder's parameters, and the view must not correct on its own.
- Pressure: three bases occur (case-contact transducer, C.I.P. method, copper crusher) plus one unstated. A crusher row has no bar value and is velocity only (10,823 rows, 9,990 with cartridge and powder ids). Case-contact (Hodgdon, Western, ADI by its unit), C.I.P. (Lovex) and unstated (Reload Swiss) rows are compared one by one and aggregated only within their own basis, never converted. No powder in the collected rows has bar pressures on more than one basis (150 powders, 0 mixed), so the refusal of #344 does not bite for the maker tables. It bites when a user's own pressures meet maker rows.
- Test barrel: velocity moves by about 2 percent per 10 percent of barrel length, peak pressure by about 0 `[run]`. The 6,480 rows without a printed barrel (Norma, Alliant, Vectan, and 98 rows of three other makers) keep their pressure comparison and get a velocity term of at most about 2 percent from the spread of the cartridge's printed barrels `[rows]`. Twist is stored and not matched (below 0.1 percent velocity, below 0.5 percent pressure for 1:7 to 1:15 inch).
- Bullet length and seating decide the pressure number. No row has a bullet length. A 10.5 percent error of the default bullet length (the rms of the existing regression) moves the seated volume by about 3.5 percent on a rifle case and about 16 percent on a 9 x 19 mm case, which moves the simulated peak pressure by about 7 to 8 percent and 17 to 30 percent, and the velocity by about 1.6 and 3 to 4 percent `[run]`. Show the default as an input with its interval and prefer a bullet record with a length when the row's bullet matches one.
- Interval: use the empirical band of the validation errors, not the parameter band of `predictPowder`. Velocity: 9.21 percent half width over all validation rows, 7.24 rifle and 12.53 handgun (P90 of the absolute error) `[fit]`. Pressure: P90 of 34.6 to 43.7 percent by basis `[fit]`, so a pressure deviation inside about 35 percent says nothing and must not be drawn as a pass.

## 1. Velocity: where it was measured

What each maker says, from its own table or text. "Not stated" means the table, its legend and the pages read hold no distance.

| Maker (rows) | Label in the table | Distance | Source |
|---|---|---|---|
| RWS (451 with velocity, max load only) | `v3` | not defined on the page; 3 m is the usual reading of the label, unverified | `https://rws-ammunition.com/de/infotainment/wiederladen` `[read]` |
| Reload Swiss (2,190) | `V5` | not defined; the submit page for customer loads asks for a reading "only few metres away from the muzzle" `[summary]` | `https://www.reload-swiss.com/en/loading-data/rs-loading-data` `[read]` |
| Lovex (1,530) | `Velocity V5` | not defined | Lovex Reloading Guide EN 37 (Explosia), `#page=6` `[read]` |
| Hodgdon (19,453) | "velocity" | not stated for the tables; the manual's own article tests name 12 and 15 feet for those tests only | Annual Manual 2025, `https://hodgdonpowderco.com/wp-content/uploads/2026/04/AM25.pdf#page=36` `[read]` |
| Western (12,251) | "start velocity", "max velocity", "measured by our ballistics lab" | not stated | Handloading Guide 8.0, `https://hodgdonpowderco.com/wp-content/uploads/2023/04/WesternPowdersHandloadingGuide8.0_WEB-1.pdf#page=24` `[read]` |
| ADI (12,322) | "Velocity (fps)" | not stated | `https://www.adiworldclass.com.au/data-rifle/` `[read]` |
| Vihtavuori (13,472) | `StartloadMs`, `MaxloadMs` | not in the data file for rifle or handgun cartridges. The shotshell page states 2.5 m, which must not be carried over to metallic rows | `https://www.vihtavuori.com/reloading-data/` `[summary]`, data file fields `[read]` |
| Alliant (2,056) | "velocity" | not stated | Reloader's Guide 2023, `https://www.alliantpowder.com/resources/catalog/AP399_2023AlliantPowderReloadersGuide_SinglePgsNoCrops.pdf#page=7` `[read]` |
| Norma (2,394) | "Velocity m/s" | not stated | `https://www.norma-ammunition.com/reloading` `[read]` |
| Vectan (1,932) | "Vitesse/Velocity" | not stated | catalogue 2023-12, `https://www.vectan.fr/images/files/NS-23-12-CATALOGUE-PP-WEB.pdf#page=6` `[read]` |

Search summaries describe SAAMI's instrumental velocity as a reading at a predetermined distance from the muzzle `[summary]`, and Vihtavuori states 2.5 m for shotshell under the C.I.P. method (the page above). I did not find the distance for metallic cartridges in a primary text of either (the SAAMI standard Z299.4 was not readable here, the C.I.P. sheets returned HTTP 403). Confidence that the seven unlabelled makers read at a distance of several metres and not at the muzzle: medium; the distance itself: unknown.

How big the omitted loss is. The speed lost over a distance s follows the point-mass drag equation of the exterior model (`apps/docs/docs/models/exterior-drag.md`), with the G1 table of `packages/core/src/drag-tables.ts`, sea-level standard air, the bullet mass from the row, and the diameter from the cartridge record (G1 of the cartridge side, else Z, else F). The bullets have no drag data, so a form factor over G1 is assumed: 0.5, 0.6, 0.7 for rifle (barrel at least 400 mm), 0.9, 1.2, 1.5 for handgun. The muzzle speed is found by fixed point so that the printed value is the speed at s `[run]`.

| Maker, class (rows) | Distance | Median correction, % | P90, % | Largest, % | Median, m/s |
|---|---:|---:|---:|---:|---:|
| RWS rifle (448) | 3 m | 0.22 to 0.30 | 0.29 to 0.41 | 0.41 to 0.57 | 1.8 to 2.5 |
| Reload Swiss rifle (1,772) | 5 m | 0.38 to 0.53 | 0.53 to 0.74 | 0.98 to 1.37 | 3.0 to 4.2 |
| Lovex rifle (1,082) | 5 m | 0.37 to 0.51 | 0.55 to 0.77 | 0.82 to 1.15 | 2.8 to 3.9 |
| Reload Swiss handgun (416) | 5 m | 0.76 to 1.27 | 1.22 to 2.06 | 1.97 to 3.32 | 2.4 to 4.0 |
| Lovex handgun (448) | 5 m | 0.80 to 1.35 | 1.34 to 2.26 | 1.80 to 3.05 | 2.6 to 4.3 |

The range in each cell is the spread over the three assumed form factors. RWS has only 3 handgun rows (0.43 to 0.72 percent). The rifle values at 5 m agree with the analytic entry of the research log (0.31 to 0.72 percent at 5 m, `apps/docs/docs/research/muzzle-velocity-correction.md`).

How this compares with the model error: the median absolute velocity error of the powder fit is 3.33 percent on the validation rows (rifle 2.83, handgun 5.59) `[fit]`. A rifle correction of 0.4 percent is about one seventh of that, a handgun correction of 1 percent about one fifth. It is small against the scatter and invisible in a single row, but every labelled row is printed below its muzzle value by the loss. The fit takes such rows as muzzle velocities (`[fit]`, assumptions), so a powder fitted on them alone predicts muzzle velocities lower than the true ones by about the correction. That shows in a mean error, not in a row.

Two ways to handle it, and the one recommended.

- Compare at the printed distance: run the model's muzzle velocity through the exterior trajectory to the distance and compare the speed there. `trajectory` returns the speed per range (`packages/core/src/exterior/trajectory.ts`, `TrajectoryPoint.velocity`), so no new function is needed on `main`. It needs a drag input, which the maker rows lack.
- Correct the printed value to the muzzle: needs the inversion `muzzleVelocityFromDownrange`, which exists only on the branch `research/muzzle-velocity-correction` at commit `fbb0e3dc`, not on `main`. It also needs a drag input.
- Recommended: the inversion with a default form factor per class (rifle 0.6 over G1, handgun 1.2), the spread over the three form factors above as a one-sided term on the row, and the same correction in the refit of #828 and in the view of #827. Applying it in the view alone makes a refitted powder show a bias of the size above. Rows of makers with no label are not corrected; their bias is in the mean error and is not known.

Confidence: the sign and size of the loss for a labelled row, high given the form factor; that `v3` is 3 m and `V5` is 5 m, medium; the form factors, low (assumed, no measurement). Open for the owner: ask RWS, Reload Swiss and Lovex in writing what `v3` and `V5` mean and where the screen stood.

## 2. Pressure: bases that can and cannot be compared

What each maker says about the method:

- Hodgdon: pressure in psi from a transducer that rests against the case, or in CUP from a copper crusher; the two systems do not give the same maximum number `[read]`, `https://hodgdonpowderco.com/wp-content/uploads/2026/04/AM25.pdf#page=58`. 14,593 rows psi, 4,854 CUP `[rows]`.
- Western: piezoelectric transducers in contact with the cartridge body, through a modified barrel; pressure printed for the maximum load only, in psi `[read]`, `https://hodgdonpowderco.com/wp-content/uploads/2023/04/WesternPowdersHandloadingGuide8.0_WEB-1.pdf#page=15`. 6,090 rows psi, 27 CUP.
- ADI: the unit only (psi or cup), no method text. 5,510 rows psi, 5,942 CUP `[rows]`. A psi value could be a conversion of a crusher value; the page does not say. Confidence that psi means a transducer: medium-low.
- Lovex: pressure of the maximum load in bar next to the C.I.P. maximum pressure of the cartridge; the method is not described `[read]`, Lovex guide `#page=6`. 765 rows.
- Reload Swiss: pressure in bar for start and maximum load; no method on the page `[read]`. 2,190 rows. Customer submissions are on a different page and not in the collected rows (see the note on #820).
- RWS: no pressure; the page says that the old book's values were crusher values and that the proof law moved to piezoelectric transducers `[read]`.
- Vectan, Norma, Alliant, Vihtavuori: no pressure. Vectan prints the C.I.P. maximum per cartridge, a limit and not a measurement.

Rows with a bar value and cartridge and powder ids: case-contact 25,154, C.I.P. 765, unstated 2,188 `[rows]`.

The record vocabulary is not enough. The cartridge records carry `pressureMethod` for the C.I.P. sheet: 536 `transducer`, 12 `crusher`, none `piezo` or `energy` `[records]`, `packages/schema/src/standards.ts:5`. The docs say only that the fit's basis is "the `pressureMethod` vocabulary of the cartridge records" (`packages/core/src/interior/fit.ts:26`) and do not say what `transducer` and `piezo` mean. The sheets give the measuring position `M` in mm from the breech face (556 records, 358 at 25 mm, the rest 6.5 to 82.25 mm) `[records]`; that the C.I.P. method drills the case so the transducer sees the gas is stated by a secondary source only (`https://en.wikipedia.org/wiki/Small_arms_ammunition_pressure_testing`, `[summary]`). If the case-contact rows were mapped onto `transducer`, they would share a basis with the C.I.P. sheets and the refusal of #344 would stop separating two methods that the makers themselves say differ.

Recommendation for the row schema (#826, owner decision, question 3 below): add a value for the case-contact transducer, keep `transducer` for the C.I.P. method, document both in the data docs, and map Hodgdon and Western rows to case-contact, ADI psi to case-contact with a note "assumed from the unit", Lovex to C.I.P. with a note "method not described", Reload Swiss to no basis ("not stated"), CUP to `crusher`.

Which pairs are compared:

| Printed basis | Pressure error shown | Aggregate | Why |
|---|---|---|---|
| case-contact (Hodgdon, Western, ADI) | yes, one row at a time | within the basis | one transducer against one simulated number |
| C.I.P. (Lovex) | yes | within the basis, 765 rows | same |
| not stated (Reload Swiss) | yes, marked "method not stated" | own bin | cannot be placed on either basis |
| crusher (CUP) | no, the printed value is shown as a conventional value | none | no conversion exists (`apps/docs/docs/research/interior-crusher-conventional-pressure.md`) |
| any basis, user's own pressure against a maker row | refused | none | as `MixedPressureBasisError`, `packages/core/src/interior/fit.ts:304` |

Whether the bases show up in the errors: validation split, simulated against printed, C.I.P. 186 rows median absolute 19.00 percent mean minus 17.27, case-contact 4,938 rows 14.89 and minus 6.73, not stated 677 rows 15.16 and minus 2.79 `[fit]`. The C.I.P. rows are 186 rows of a few cartridges and powders, so the difference of the means is confounded with the cartridge mix and is not evidence of a basis offset.

Gauge position. The model's `peakBreechPressure` is the pressure a chamber transducer measures (`apps/docs/docs/models/interior-m3.md`, results section), and the gauge position is not modelled (`apps/docs/docs/models/interior-powder-fit.md`, assumptions). On the synthetic rifle load of the fit tests the peak base pressure is 0.872 and the peak mean pressure 0.957 of the peak breech pressure `[run]`. With the model's own uniform-density gradient, a gauge half way along the gas column reads about 4 percent below the breech value, and the base value (13 percent below) is the bound. This is model-based and small against the 35 to 44 percent P90 of the pressure error, so the position is shown as text and not corrected.

## 3. Test barrel

- Length: printed per table by Hodgdon, Western, ADI, Vihtavuori, Lovex, RWS, Reload Swiss. Missing for Norma 2,394, Alliant 2,056, Vectan 1,932, Reload Swiss 72, Western 20, RWS 6 rows `[rows]`. Alliant says its loads were tested in SAAMI approved, un-vented test barrels and that such barrels often give higher velocities than sporting arms (`#page=7` of the guide above) `[read]`; Vectan says its tables were made in the maker's laboratory according to C.I.P. rules, fired in proof barrels (`#page=6`) `[read]`. Neither gives a length.
- Twist: printed by Hodgdon, Vihtavuori, Reload Swiss and Western in the barrel text, not by the others `[rows]`.
- Effect `[run]`, synthetic rifle-like load (the test load of `packages/core/test/interior-fit.test.ts`, 0.6 m barrel, 6.9 mm bore, 868 m/s, 3399 bar): barrel length minus 20, minus 10, minus 5, plus 5, plus 10, plus 20 percent changes the velocity by minus 4.62, minus 2.13, minus 1.03, plus 0.96, plus 1.85, plus 3.48 percent and the peak pressure by under 0.01 percent. Twist 7 to 15 inch (0.178 to 0.381 m) changes velocity by minus 0.07 to plus 0.04 percent and pressure by plus 0.41 to minus 0.22 percent. A handgun-like load was not run (a synthetic 9 mm load was calibrated only for the volume test below).
- Default for a missing length, as the fit does it: the median of the cartridge's printed barrels, else 610 mm (case above 33 mm) or 120 mm. 6,214 of the 6,402 rows without a barrel and with a cartridge id have a cartridge with a printed barrel from another maker `[rows]`. Across all printed rows the barrel deviates from its cartridge's median by 0 percent at the median and 8.3 percent at P90 `[rows]`, so the default adds about 1.7 percent to the velocity at P90 and nothing to the pressure. Across the 232 cartridges with a printed barrel, 125 have more than one length, and the longest over the shortest minus one is 1.6 percent at the median cartridge and 60 percent at P90, so for those cartridges (revolver and pistol cartridges) the median is a weak default `[rows]`.
- Recommendation: the comparison run takes the row's barrel. Without one it takes the default and the row shows "barrel not printed, 612 mm assumed" with the velocity term above. A user's rifle with another barrel is not a deviation: the view says the published row is the maker's test barrel.

## 4. Bullet length and seating

COAL is printed on nearly every row (Vectan prints none, Norma 2,226 of 2,394 rows `[rows]`). The bullet length is printed by none. The seated volume is `case capacity minus the bullet's part inside the case`, and the part inside the case is the bullet length minus (COAL minus case length). So a wrong bullet length is a wrong chamber volume behind the bullet.

Default: the model's regression of ln length on ln mass and ln diameter over the 457 existing bullet records that have a length, rms of ln L 0.105 `[fit]`. The seating depth comes from the printed COAL, else the C.I.P. maximum.

What 10.5 percent of length costs `[run]`, on the synthetic rifle load (bore area 37.5 mm2, chamber volume 3.4 cm3: a 3.2 mm error on a 30 mm bullet is 0.12 cm3, 3.5 percent) and on a synthetic 9 x 19 mm-like load (bore 9.0 mm, 8.04 g bullet, 0.32 g charge, 0.62 cm3, 100 mm barrel, calibrated to 357 m/s and 2176 bar; a 1.6 mm error on a 15 mm bullet is 0.10 cm3, 16 percent; these dimensions are assumed, not taken from a record). The volume is moved by one and two times that change:

| Load | Volume change | Velocity change, % | Peak pressure change, % |
|---|---:|---:|---:|
| rifle | minus 7.0 % | plus 3.58 | plus 18.7 |
| rifle | minus 3.5 % | plus 1.71 | plus 8.4 |
| rifle | plus 3.5 % | minus 1.58 | minus 7.1 |
| rifle | plus 7.0 % | minus 3.06 | minus 13.1 |
| 9 mm | minus 16.4 % | plus 4.17 | plus 30.3 |
| 9 mm | minus 8.2 % | plus 1.94 | plus 12.8 |
| 9 mm | plus 8.2 % | minus 1.72 | minus 9.7 |
| 9 mm | plus 16.4 % | minus 3.25 | minus 17.3 |

The fit run's own sensitivity agrees on the velocity: with the powder parameters held, a 10 percent shorter bullet length moves the mean velocity error by minus 1.82 percentage points and 10 percent longer by plus 1.75, a 5 percent chamber volume by plus 1.75 and minus 1.78 `[fit]`. The case capacity adds the same kind of term: capacity records where present, else the C.I.P. outline times a fill factor of 0.718 with leave-one-out rms 5.9 percent `[fit]`, which is a further 5.9 percent of volume, about 11 percent of pressure on the rifle load (interpolated from the table).

So the dominant input uncertainty of a pressure deviation is the volume behind the bullet, from two sources (case capacity, bullet length), not the barrel, the twist or the gauge. Recommendation: the row shows the default length as an assumption with its interval. When the row's bullet matches a bullet record with a length (maker, type and mass), the record's length replaces the default and the interval shrinks to the printed COAL tolerance. Matching rows to bullet records is a naming problem tracked by the open point on aliases in the map #817. The default does not need an extra term on top of the empirical band, because every row of the fit run used it.

## 5. The measure shown per row, and its interval

- Velocity error: simulated minus printed, in m/s, and divided by the printed value, in percent, signed. Printed value and distance as printed beside it, the maker named, the edition and page as the link.
- Pressure error: simulated minus printed divided by printed, in percent, only for bar rows of a comparable basis; the basis as a label.
- Interval: the empirical band of the validation errors, shown as a bar around zero, with the share of rows inside it stated on the sheet. Velocity bands: 9.21 percent for all rows; per class 7.24 percent for rifle and 12.53 percent for handgun `[fit]`. The all-rows band covered 90.7 percent of the held-out test rows (`[fit]`, 85 to 95 percent accepted); the class bands were not checked on the test split and need their own check in the next fit version. Pressure band: P90 of the absolute validation error, 37.90 percent case-contact, 43.74 percent C.I.P., 34.64 percent not stated `[fit]`. At that width the pressure marker is a position on a scale, not a pass or a fail.
- Not the parameter band of `predictPowder`: it holds the fitted parameters' covariance only (`packages/core/src/interior/fit.ts`, "no model error") and in a synthetic check (#339) its stated 90 percent covered 79 percent inside the ladder when the fixed inputs differed by their stated uncertainties, and fell to 43 to 49 percent at 3 to 5 percent of charge outside the ladder. The pressure range of `powderPressureRange` adds the fixed inputs and is the right interval for a user's own load, not for a comparison with a table.
- Rows that are compared and flagged: compressed charges (5,680), a row also in a newer edition (4,155, use one copy), same values under two powder names (the pairs of Hodgdon names). Rows without a velocity (RWS minimum charge, 451), without a cartridge or powder id, with a powder that has no fitted parameters, and rows whose run is invalid at the start values are listed as "not compared" with the reason.
- Wording: the published row is the maker's value and is cited; the simulation is a simulation. No row, deviation or band is a statement about a safe load.

## Open points

- RWS, Reload Swiss and Lovex: what `v3` and `V5` mean, and the screen position. Medium confidence on 3 m and 5 m until answered.
- C.I.P. and SAAMI primary text for the velocity distance and the transducer position of metallic cartridges: the C.I.P. sheets returned HTTP 403 and the SAAMI standard was not readable here.
- Form factors for the correction are assumed. A handful of rows with a published ballistic coefficient would test them.
- The pressure effect of the volume was run on two synthetic loads, not on records; the 9 mm dimensions are assumed.

## Questions only the owner can decide

1. Hold-out: a view that shows test-split rows next to a simulation lets anyone tuning the model read the test split repeatedly, against "read once per frozen model version". Hide test-split rows in the view, mark them, or show them with the line that the view never feeds a model choice?
2. Rows the powder was fitted on show an in-sample deviation. Mark them as "fitted on this row" or leave them unmarked?
3. Add a basis value for the case-contact transducer (a schema change, no migration before 1.0), or reuse `piezo` for it and document `transducer` as the C.I.P. method?
4. Apply the distance correction to the labelled rows in the next fit version, or keep "printed velocity is the muzzle velocity" and show the one-sided term only?
