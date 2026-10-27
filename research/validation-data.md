# Open measured velocity and pressure data for model validation

Question: which published measurements of muzzle velocity and chamber pressure of handloaded or factory ammunition can the project use to validate the powder fit, the pressure range and the interior model, under a licence that allows it? Ticket: OpenReloading/Ballistics#277.

## Summary

Almost nothing usable exists. The search found no data set with a DOI and a CC BY 4.0 licence that holds measured charge, velocity and pressure of small-arms ammunition.

- One report of US Government authors fits the powder fit in part: a 1972 Naval Postgraduate School thesis with per-shot velocities and quartz-transducer pressure traces for 7.62 mm NATO match loads. About two or three of its loads are conventional (no forward priming) and usable, so it validates a plausibility check, not a ladder fit.
- One US Government report holds a measured pressure and velocity curve of a single 105 mm howitzer firing (BRL Report 1183, 1962), usable only as a figure to digitise, for `interior` and `fitPressureCurve` on a large-bore gun.
- One CC BY 4.0 Zenodo archive redistributes about 25,800 rows of load data of two propellant makers. The rows are ranges, not shots, and the rights of the makers are unclear. It is not safe to import.
- Everything else found (journal papers, ARL reports, standards bodies) either shows measurements only in figures, has no stated reuse terms, or holds no measurements.

Method: DataCite, Zenodo, figshare and Dryad API searches (quoted phrases: interior ballistics, internal ballistics, muzzle velocity, chamber pressure, handloading, pressure-time, piezoelectric), web searches for DTIC and university theses, then the primary record or the report text of every hit. DTIC itself refused automated access, so the DTIC reports were read from the Internet Archive copies of the DTIC scans (identifier `DTIC_<AD number>`), which hold the text of the scan.

## Inputs the fits need

From `apps/docs/docs/models/interior-powder-fit.md` and `interior-curve-fit.md`:

- `fitPowder`: a ladder of charges with mean muzzle velocities and, optionally, peak pressures with stated uncertainties (pressures need velocity uncertainties too); per point optional barrel length and propellant temperature. The load carries bullet mass, bore, chamber volume (a measured case capacity is better than a nominal one), seating depth and the powder. A second barrel length or temperature is what resolves the energy and the temperature factor.
- `fitPressureCurve`: one pressure-time trace (time, pressure, sensor position, sigma) of one M3 load, including the load above. It fits the form and the exponent.
- Validation needs the same load description next to the measurement. Data without case capacity or seating depth can only be checked with the volume factor fitted, which then absorbs the gap.

## Data sets

### A. Culver and Burns 1972, Naval Postgraduate School thesis (public domain in the US, a US Navy thesis)

- Title: Velocity and Pressure Effects on Projectiles Due to Variation of Ignition Parameters. Authors: R. O. Culver Jr. (Major, USMC) and R. M. Burns (Captain, USMC), Master of Science in Physics, December 1972, 68 pages.
- Locator: DTIC AD0757278 (NTIS copy), https://archive.org/details/DTIC_AD0757278 . No DOI found (Crossref has none for this number).
- Licence as the record states it: "Approved for public release; distribution unlimited" (document control page and title page of the scan). No copyright notice. Public domain under 17 U.S.C. 105 applies to works of US Government employees in their official duties. The authors were serving officers at a Navy school. That this makes the thesis a work of Government employees is my reading and not stated in the report (unverified). Outside the US unverified, as `AGENTS.md` says.
- Measured: velocity of 7.62 mm NATO match cartridges (Lake City, 173 grain boat-tail match bullet, large rifle primer, the match charge weighed 41.5 grains and was found to resemble a stick powder of the thesis's own list) and handloaded .30-06 cases; velocity by two screens five feet apart and a digital chronograph; chamber pressure by a Kistler 607A quartz transducer with a Kistler 504 charge amplifier read from oscilloscope photographs (10,000 psi per cm vertical, 0.1 ms per cm), at least five traces per load.
- Size: ten loads of ten rounds each with per-shot velocity in tables (Tables IV to VI, time between screens and velocity); pressure as an average peak per load in the text (Figures 12 to 25 are the traces, as photographs). Conventional loads in the 7.62 mm series: 41.5 grains (average peak about 40,000 psi), 42.5 grains (about 41,000 psi), 44.5 grains (peak off scale above 50,000 psi, so only a lower bound), and one 1968 match lot of unknown ball powder (about 39,500 psi). The other loads are forward primed (primer tube), duplex or triplex.
- Format: scanned PDF only. Values must be transcribed from tables and read from images.
- Fit to the inputs: partial. Bullet mass, powder (approximate), charge, per-shot velocity and peak pressure are present. Barrel length of the 7.62 mm test barrel, case capacity, seating depth, powder temperature and powder lot data are not given in the text I read (not found, unverified). The forward-primed and layered loads change ignition and charge layout, which the M3 model does not represent, so they are out of scope. That leaves two or three charges of one powder: enough for a plausibility check of `interior` against one peak pressure and one velocity, too few for `fitPowder` beyond the burn coefficient. The traces could feed `fitPressureCurve` after digitising, with the sensor at the chamber wall (Kistler mounted in the chamber).
- Open points: which velocity column belongs to which load in the OCR of Tables IV to VI (check on the page image before use); the barrel in which the velocities were taken is the transducer barrel by the thesis text ("same barrels and loads were used in both cases"), length not stated.

### B. Baer and Frankle 1962, BRL Report 1183 (US Army BRL, public release)

- Title: The Simulation of Interior Ballistic Performance of Guns by Digital Computer Program. Authors: Paul G. Baer, Jerome M. Frankle, Interior Ballistics Laboratory, Ballistic Research Laboratories, Aberdeen Proving Ground, December 1962.
- Locator: DTIC AD0299980, DOI 10.21236/AD0299980 (the DOI is cited by the Zenodo package below; DTIC itself was not reachable).
- Licence as the record states it: the cover carries the stamp "Approved for public release - Distribution is Unlimited" over an older partly covered distribution notice (page image of the cover in Zenodo record 10.5281/zenodo.23504395, `sources/page_images/BRL-1183/cover-01.png`). Authors at a Government laboratory, so public domain in the US by 17 U.S.C. 105 (my inference from the affiliation, unverified). Outside the US unverified.
- Measured: "typical 105 mm howitzer firing", breech pressure (kpsi) and projectile velocity (ft/s) against travel, one shot, Appendix D figure (printed page 67), with the program's prediction beside it; peak about 34 kpsi, muzzle velocity about 1500 ft/s. The input card (page 48) lists chamber 153 in^3, bore area 13.77 in^2, travel 81 in, projectile 33 lb, and two granulations of one propellant (charge 0.6325 lb 1PF and 2.1356 lb 7PF).
- Size: one firing. Format: printed figure only, scanned. Digitising is required (a 2026 Zenodo package holds two independent digitisations, MIT licensed for the authors' part, but they should be redone from the report rather than taken, to keep the chain clean).
- Fit to the inputs: `interior` and `fitPressureCurve` (a trace against travel, not time, so it needs the model's travel-time map) on a large-bore gun with a perforated multi-grain propellant. Not `fitPowder` (one charge). Useful as a gun-scale check of the model, not of small-arms handloads.

### C. Zenodo 10.5281/zenodo.22103926 and 10.5281/zenodo.21534697 (Klapp Fritz, Valin Rivera, Galleguillos Ketterer, 2026): not usable as it stands

- Titles: "Reproduction archive for: When a validation corpus cannot decide: design effect, calibration invariance and anchor leakage in defense simulation model comparison" (record 22103926, 26 Aug 2026) and "Reproduction archive for: When the calibration treatment changes the estimand" (record 21534697, 22 Jul 2026, superseded).
- Licence as the record states it: Creative Commons Attribution 4.0 (record field `cc-by-4.0`; the archive LICENSE.txt says code and derived data are CC BY 4.0).
- Content: `data/corpus_balistico_unificado.csv` has 25,826 rows (374 cartridges), taken from two propellant makers' published load tables: 24,708 rows of one maker and 1,118 of the other. Per row: cartridge, bullet, bullet weight, powder, minimum and maximum charge, minimum and maximum velocity, minimum and maximum pressure (23,903 rows have pressure, all from the first maker), barrel length. `data/exp3_filas_evaluadas.csv` has 336 rows with a measured muzzle velocity and the archive's predictions.
- Why not usable: the rows are the makers' published load ranges (start and maximum load), not measured shots, with no pressure method, no case capacity and no temperature. The same LICENSE.txt says the makers' data are "NOT covered by this licence, and NOT redistributed here", yet the CSV holds them. The CC BY 4.0 label cannot grant rights the depositors do not hold, so the project cannot treat these rows as CC BY data. `AGENTS.md` allows CC BY 4.0 measurement data a publication releases; this is a compilation of third-party tables. Do not import. If the project wants load-table values, the route is permission from the maker or local, git-ignored use.
- Related records by the same authors: 10.5281/zenodo.20752053 (`geometry_real_v2.csv`, 163 cartridges with overflow case capacity in grains of water and groove diameter, source column "published_standard" with the note "standard published reloading values", record metadata MIT, description text says CC BY 4.0: the licence is inconsistent, and the source of the values is not a primary record, so unverified and not importable); 10.5281/zenodo.20724633, 10.5281/zenodo.22144925 and 10.5281/zenodo.21461804 (code only, the load tables are stated as licensed and not included; the last holds 24 gun specification cases transcribed from data sheets).

### D. Zenodo 10.5281/zenodo.23504395 (Klapp Fritz et al., 2026-10-20): benchmark transcription

- Title: Verification package: a lumped-parameter interior-ballistics model checked against the printed IBHVG2 benchmark (BRL-TR-2829) and the BRL-1183 105 mm firing. Licence field: MIT for the authors' material; the page images of the two reports are "not relicensed".
- Content: transcribed inputs and printed outputs of the IBHVG2 user's guide benchmark (Anderson and Fickie 1987, DTIC ADB117104, distribution changed to public release by memo of 26 Jul 1993 per the DTIC metadata the package extracted) and of BRL-1183 (data set B).
- Use: the IBHVG2 benchmark is a code-to-code reference (printed results of a program, not measurements). It is a check for a solver's own equations, fitted to large-bore guns. Not measured data. The authors' own file is a transcription by AI assistance with a stated two-pass reading; any values the project uses must be read again from the report.

## Papers with measured pressure, not usable as data

- Felix, Medeiros, Barbosa 2023, Sensors 23(19), 8081, DOI 10.3390/s23198081, CC BY 4.0 (verified on the PMC page). 7.62 x 51 mm NATO ball in an EPVAT barrel, piezoelectric chain model. Pressure-time curves only as figures, one case curve, shot count not stated, no velocities. The data availability statement says the data are available on request and not public. Unusable.
- Felix, Medeiros, Barbosa 2025, Acta IMEKO 14(3), DOI 10.21014/actaimeko.v14i3.1990, CC BY 4.0 (Crossref licence field). Calibration methods of transducers. Content not opened (unverified); a metrology paper, not a load data set.
- Elkarous et al. 2026, International Journal of Metrology and Quality Engineering, DOI 10.1051/ijmqe/2026005, CC BY 4.0 (Crossref licence field): uncertainty of pressure and velocity measurements with piezoelectric transducers and light screens, EPVAT case-mouth and port transducers, 2 MHz sampling (from the search summary only). The publisher page refused automated access, so tables and data statement are unverified. Worth a manual check.
- Elkarous et al. 2016 (DOI 10.1051/ijmqe/2016004) and 2013 (J. Phys. Conf. Ser. 459, 012048, CC BY 3.0 per Crossref): calibration and technique papers with example curves for 7.62 x 51 mm and 12.7 x 99 mm, not data sets. CC BY 3.0 and unlicensed records do not meet the project's CC BY 4.0 rule.
- Eastern-European Journal of Enterprise Technologies papers (for example DOI 10.15587/1729-4061.2021.239150, CC BY 4.0 per Crossref): model papers on gun interior ballistics; no measurement tables were found in the metadata (contents not opened, unverified).
- Dryad 10.5061/dryad.bg79cnpr8 (McTee, Hampton, Ramsey 2026, CC0): group sizes of 37 lead-free rifle loads on paper; the README lists impact coordinates, cartridge, bullet and rifle data. No velocity, pressure, charge or powder. Not relevant.

## US Government reports checked and set aside

- ARL-TR-7479 (Ritter, Beyer, Sep 2015, DOI 10.21236/ADA622138, approved for public release): 5.56 and 7.62 mm primer output and early bullet motion with a Kistler 6215 mid-case gauge, averages of 5 shots, in figures; first milliseconds only, no peak pressure or muzzle velocity table. Not usable for the fits.
- ARL-TR-4903 (Schmidt, Nusca, Aug 2009, approved for public release): 5.56 mm primer model with a CFD code; simulation results; no measurement table found.
- BRL-TR-3383 (Robbins, Colburn, Zoltani 1992, approved for public release): combustible cartridge cases, large-bore, not small-arms loads (only the title and distribution statement were read).
- ARFSD-TR-93039 (155 mm liquid propellant gun, distribution changed to public release by the AMSTA notice of 6 Apr 98): not relevant to powder fits.
- AD0492046 (older proof-test summary of a .30 caliber ball round, seen only in a search summary) and an ARDEC presentation on propellant position (ndia.dtic.mil, Lusto19293.pdf, EPVAT data of 5.56, 7.62 and .50 cal, slides): not opened, unverified.

## Standards bodies

- C.I.P. (cip-bobp.org, TDCC datasheets): the page states "(c) C.I.P. - All rights reserved" and no reuse licence. The bibliography already treats the sheet dimensions as facts. No measured shot data were found there. The Downloads site was not reachable (unverified what the sheets contain beyond dimensions).
- SAAMI: publishes maximum average pressure specifications, not measured series (not re-checked on the primary page, unverified).

## Other hits to ignore

Zenodo records by "Lee Francis" (titles "Guns", "mnemorphics", "Mind City", licence cc-by-2.5) match the phrase "muzzle velocity" and "chamber pressure" in search but are not measurements (not opened beyond metadata).

## Recommendation

1. Treat the 1972 thesis (A) as the only usable small-arms measurement under a public-release statement: transcribe the per-shot velocities and average peak pressures of the conventional loads after checking the page images, and digitise the traces of those loads if `fitPressureCurve` should be exercised. Record authors, report number and the distribution statement as the source, and the US-only status of the public-domain claim.
2. Use BRL-1183 (B) only as a gun-scale curve check, digitised from the report, with the same source record.
3. Do not import the Zenodo corpus (C).
4. For a real validation set the project needs its own measurements, or measurements from a contributor who releases them under CC BY 4.0 with a DOI. Such a set needs the fields listed under "Inputs the fits need" plus the pressure sensor type, per-shot velocity and ideally the trace.

## Unverified

- DTIC pages: the DTIC site refused automated access. The reports were read from Internet Archive copies of the scans (text and cover images), and the distribution statements are those of the scans, not of the live DTIC records.
- That the thesis and BRL authors count as US Government employees for 17 U.S.C. 105 (inferred from affiliation), and the status outside the US.
- Barrel length, case capacity, temperature of the thesis loads; column mapping of its velocity tables (OCR).
- The content of the 2026 IJMQE paper, the 2025 Acta IMEKO paper, AD0492046 and the ARDEC slides.
- Whether the propellant makers allow redistribution of their load tables (not asked).
- A search of every repository (Mendeley Data, OSF, Harvard Dataverse, university repositories not indexed by DataCite) was not exhaustive: DataCite, Zenodo, figshare and Dryad were queried; a data set with unusual keywords can exist.
