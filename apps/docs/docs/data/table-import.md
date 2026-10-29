---
title: Table import
description: How the web app reads a table of bullets, powders or cartridges into user records, with the fields, header aliases, units and kind tiers.
---

# Table import

The web app imports a table of bullets, powders or cartridges (CSV, text, workbook or a JSON list of objects) into the user records of the browser. File menu, Import: the file is read in the browser and never uploaded. Each file gets a card with the kind it is read as, the column mapping and a row report. The rows are written with the source typed under the cards, kept on each record as `imported { source, file, day }`. You are responsible for holding the rights to the data you import. Code: `packages/importers/src/record-fields.ts` (fields, aliases, units), `packages/importers/src/records.ts` (kind score, mapping, records), `apps/web/src/components/import-entry.tsx` (the dialog).

Each file is told by its bytes, its extension is not read. An OpenReloading data file goes to the data import and its report, as before. On the cards a file is tried in this order: larger than 40 MB (refused), a load file of a known format ("Load file, read by <format>", with its record count and what it did not read), a workbook by its signature, then the text as a JSON list or a delimited table. Code: `apps/web/src/lib/load-file-formats.ts` (the load-file formats, one entry each).

## Limits

A file over a limit is not imported. The card or the status line says which limit it met.

- 40 MB per file (`maxFileBytes` in `apps/web/src/lib/user-data.ts`): a larger file is refused before it is read, with "The file is larger than 40 MB."
- 256 columns (`maxColumn` in `packages/importers/src/limits.ts`): a wider table is refused, with "The table has more than 256 columns." Remove the extra columns or choose another file.
- 1,000,000 cells, columns times rows (`maxCells` in `packages/importers/src/limits.ts`): a larger table is refused, with "The table has more than 1000000 cells." Split it into smaller files.
- 32 MiB for a chronograph file in the workbench's Measurements tab (`maxFileBytes` in `apps/web/src/lib/chrono.ts`): a larger file is refused before it is read, with "The file is larger than 32 MiB."

## Kind

Each kind gets a score from 0 to 1: every column is matched to at most one field, and each field adds its weight times how well the column fits. A column fits by its header words (the whole header is an alias, one of its words is, or it contains an alias of four letters or more) and by its values (numbers in the usual range, a listed choice, text for a text field). The core fields of a kind, Name among them, add up to 1 or a little more, the others (such as Maker) are a bonus on top; the score is capped at 1.

| Tier | Score | Card |
|---|---|---|
| high | 0.80 and above | folded: the verdict and the counts, the mapping behind Kind and columns |
| medium | 0.60 to below 0.80 | open with the mapping |
| low | 0.40 to below 0.60 | open with the mapping |
| none | below 0.40 | no kind suggested: the card names the scores and the floor, the kind is picked by hand |

## Fields

A header is matched in lower case, without accents, with ß as ss and ä, ö and ü as their base letter followed by e, and without the text in brackets. The first unit of a field is the stored one. A value outside the usual range is a warning on its row; a required field that is empty rejects the row.

### Bullets

| Field | Header aliases | Units | Usual range (stored unit) |
|---|---|---|---|
| Name (required) | name, bullet, powder, cartridge, description, product, item, bezeichnung | | |
| Maker | maker, manufacturer, brand, make, hersteller | | |
| Caliber | caliber, calibre, cal, kaliber | | |
| Diameter (required) | diameter, dia, durchmesser | mm, in, cm | 3 to 25 |
| Mass (required) | mass, weight, wt, grains, gr, gewicht, masse | g, gr | 0.5 to 60 |
| Length | length, len, oal, laenge | mm, in, cm | 5 to 80 |
| BC G1 | g1, bcg1, bc1 | lb/in2, kg/m2 | 0.05 to 1.5 |
| BC G7 | g7, bcg7, bc7 | lb/in2, kg/m2 | 0.05 to 1.5 |

### Powders

| Field | Header aliases | Units or values | Usual range (stored unit) |
|---|---|---|---|
| Name (required) | name, bullet, powder, cartridge, description, product, item, bezeichnung | | |
| Maker | maker, manufacturer, brand, make, hersteller | | |
| Grain form | grainform, form, shape, grain, kornform | ball (also spherical), extruded (stick, tubular), flake (flattened), other | |
| Propellant base | base, propellantbase, basis | single (single-base), double (double-base), triple (triple-base) | |
| Bulk density | bulkdensity, density, bulk, schuettdichte | g/cm3 | 0.3 to 1.3 |

A grain form or base not in the list is a warning: the value is left out and the row kept.

### Cartridges

| Field | Header aliases | Units | Usual range (stored unit) |
|---|---|---|---|
| Name (required) | name, bullet, powder, cartridge, description, product, item, bezeichnung | | |
| Case length | caselength, l3, case, huelsenlaenge | mm, in, cm | 10 to 120 |
| Overall length | overalllength, coal, oal, l6, cartridgelength | mm, in, cm | 15 to 150 |
| Bullet diameter | bulletdiameter, g1, diameter, dia | mm, in, cm | 3 to 25 |
| Max pressure | maxpressure, pmax, pressure, maxpress | bar, psi, MPa, kpsi | 300 to 6500 |

## Units and decimal mark

Each number column has its own unit and decimal mark, both changeable on the card.

- Unit: named in the header, in brackets or after a slash, underscore or space (`Weight (gr)`, `Diameter_in`, `Weight grains`; inch and grains are read as in and gr). A unit in brackets or after a slash or underscore that the field does not take rejects the rows of the column until a unit is chosen on the card. A last word after a space that is no unit of the field counts as part of the name. Without a unit in the header, the unit whose conversion puts the most values in the usual range is taken, and the card says the unit was guessed from the values. MPa and kpsi are never guessed: their values fall in the bar range too. Without a fit, the stored unit.
- Decimal mark: point or comma, whichever more cells use. A column of cells such as `1,500` that could also be grouped integers is marked as a guess.
- A value in another unit than the stored one keeps its text as written next to the converted value.

## Duplicates

A row's id is made from its kind, name and maker and, for a bullet, its diameter and mass (in the stored unit, six significant digits), with case, accents and extra spaces ignored. The same row imported again gets the same id. The report counts each accepted row as new, already here (same content), changed (other content under the same id) or repeated in the file. A changed row replaces the stored record only when Replace is ticked. Each maker name becomes one manufacturer record that the rows refer to.

## Saved mappings

Save mapping keeps the kind and the column map under a name, in this browser only (its local storage, not in the user data file). A later file whose header has the same cells in the same order is read with the last mapping saved for it, and the card names the mapping.

## Example files

Invented values, no maker's catalogue. Each is read as its kind at the high tier.

Bullets:

```csv
Name,Maker,Diameter (mm),Weight (gr),BC G1
Alpha 150,Invented Arms,7.82,150,0.40
Alpha 168,Invented Arms,7.82,168,0.45
Beta 55,Other Works,5.70,55,0.25
```

Powders:

```csv
Name,Maker,Grain form,Base,Bulk density (g/cm3)
Gamma 120,Invented Powders,extruded,single,0.89
Gamma 140,Invented Powders,ball,double,0.98
Delta 30,Other Mills,flake,double,0.62
```

Cartridges:

```csv
Name,Case length (mm),COAL (mm),Bullet diameter (mm),Pmax (bar)
Invented 7x50,50.0,72.0,7.21,4000
Invented 6x40,40.0,58.5,6.20,3800
Invented 9x20,20.0,29.0,9.02,2400
```
