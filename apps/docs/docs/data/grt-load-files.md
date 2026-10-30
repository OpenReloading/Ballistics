---
title: Load file import
description: How the web app reads load files of other programs (GRT .grtload, ChamberSim Reloaded .csrload) into a load, the cartridge, bullet and powder it names and its measurement series, with the field mapping.
---

# Load file import

The web app reads a load file of another program into user records: the load, and the cartridge, bullet and powder it names. The file is read in the browser and never uploaded. Imported values are your inputs as the other program held them; results of this app stay simulations.

Code: `packages/importers/src/grtload.ts` (reader and mapping), `packages/importers/src/csrload.ts` (the ChamberSim Reloaded format and its measurements), `apps/web/src/lib/load-file-formats.ts` (the format entries), `apps/web/src/lib/grt-load-file.ts` (schema check).

## How to import

1. File menu, Import. Choose one file, several files or all files of a folder. A file is told by its content, so a file with another name is read too: pick it with the picker's all-files choice.
2. Each file gets a card: "Load file, read by GRT load file", what it holds (for example "1 load, 1 cartridge, 1 bullet, 1 powder"), the fields it did not read and the plan against the records of the browser (new, already here, changed). A file that cannot be read is refused on its card with the reason; the other files are not affected.
3. Import writes the new records of every card. Each record carries `imported { source, file, day }`: the source is the format name, the file name and the day of the import. Records with the same content as a browser record are not written again, so importing a file a second time adds nothing.

File menu, Open on the workbench opens the load of one file and keeps the cartridge, bullet, powder and bullet maker it names, and the sessions of the file whose strings name the load, in the browser, unless a record with their id is there already.

## GRT load files (`.grtload`)

An XML file whose root element is `GordonsReloadingTool`, after an optional XML declaration, comments and processing instructions. The load is in the element `InnerBallistikInput`: a title, the sections `caliber`, `gun`, `projectile` and `propellant` of `input` fields (each with a name, a value and a unit), and an appendix. Text values are percent-encoded.

Reading rules:

- A field is read from the unit it declares, converted to the stored unit. A unit not in the table below, a value that is no number, or one too large for a number in the stored unit gives a warning and the field is not read.
- A field with an empty value holds nothing and is skipped.
- Every other field with a value, every section not listed and every appendix part other than a note is listed on the card as not read.
- A text that is not valid percent encoding is read as written, with a warning.
- A file that marks a shotshell load gives a warning: the reader is not checked on shotshell files, so check every value.
- Ids are built from the content of each record. The same file read again gives the same records, and files that share a cartridge, bullet or powder give one record of it.

Units read: length mm, cm, m; area mm2, cm2; mass g, kg, mg; pressure bar, Pa, kPa, MPa; density kg/m3, g/cm3; temperature Cel; no unit for a ratio.

### Mapping

| Field of the file | Record and field | Conversion |
| --- | --- | --- |
| `title` | load name | percent escapes resolved |
| `caliber.CaliberName` | cartridge name | percent escapes resolved |
| `caliber.oal` | load `seating` by overall length | length to mm |
| `caliber.caselen` | cartridge value `L3`, cartridge side | length to mm |
| `caliber.Dz` | cartridge value `Z` (groove diameter), chamber side | length to mm |
| `caliber.Aeff` | cartridge value `Q` (bore area), chamber side | area to mm2 |
| `caliber.pMaxZul` | cartridge value `Pmax` | pressure to bar |
| `caliber.ps` | load `analysis.overrides.startPressure` | pressure to bar |
| `caliber.sebert` | load `analysis.overrides.sebert` | none |
| `caliber.shotshell` | a warning when `true` | |
| `gun.twistlen` | load `analysis.overrides.twist` | length to mm |
| `gun.mgun` | load `analysis.overrides.firearmMass` | mass to g |
| `projectile.ProjectileName` | bullet name | percent escapes resolved |
| `projectile.mname` | user manufacturer of the bullet | percent escapes resolved |
| `projectile.pname` | bullet `name` | percent escapes resolved |
| `projectile.Dbul` | bullet `diameter` | length to mm |
| `projectile.mp` | bullet `mass` | mass to g |
| `projectile.glen` | bullet `length` | length to mm |
| `projectile.g1bc`, `projectile.g7bc` | bullet `ballisticCoefficients` G1, G7 (0: none) | none |
| `propellant.mname`, `propellant.pname` | powder name, maker and product joined | percent escapes resolved |
| `propellant.lotid` | load `powderLot` | percent escapes resolved |
| `propellant.mc` | load `charge` | mass to g |
| `propellant.pcd` | powder `bulkDensity` | density to g/cm3 |
| `propellant.pc` | load `analysis.overrides.density` (solid density) | density to g/cm3 |
| `propellant.k` | load `analysis.overrides.gamma` | none |
| `propellant.pt` | load `analysis.overrides.propellantTemperature` | Cel to degC |
| appendix `note` | load `note` | percent escapes resolved |

Not read, listed on the card when they hold a value:

- The case volume, barrel length and bullet seating depth: the workbench takes the volume behind the seated bullet and the bullet travel, which would have to be derived from them, and import changes no value.
- The burn-law coefficients, the explosive heat and the covolume of the propellant: they belong to another program's model, and this app's powder parameters are fitted for its own model ([M3 interior model](../models/interior-m3.md)). The covolume is declared in different units by different program versions.
- Bullet lot, base shape, friction and start pressure of the projectile section, the ladder settings, the gun name, the embedded cartridge drawing (`caliberfile`), the program's view settings (`config`), and the appendix measurements and pictures.

Shotshell loads: no shotshell file was available when the reader was written. A shotshell file is read with the same mapping and a warning.

## ChamberSim Reloaded load files (`.csrload`)

An XML file whose root element is `ChamberSimReloaded`, with the attributes `format` and `version`. The reader is written for format `1`; a file of another format, or without one, is read with the same mapping and a warning to check every value. The load is in the element `load`, laid out as the load input of a GRT load file: the title, the sections `caliber`, `gun`, `projectile` and `propellant` and the appendix are read by the GRT rules and mapping above.

Read in addition: each measurement series (appendix `Measurement`) becomes a session record of the load.

| Part of the file | Record and field | Conversion |
| --- | --- | --- |
| `Measurement` | one session, named like the load, device kind other, provenance measured | |
| `charge` | one string of the session, naming the load | |
| `charge` `name` | string `label` | percent escapes resolved |
| `charge` `note` | string `note` | percent escapes resolved |
| `charge` `value` | string `variation` of kind charge | kg to g |
| `shot` `velocity` | a shot of the string | m/s, as written |

Rules of the measurements:

- The charge value and the shot velocities carry no unit attribute. The files read hold the charge in kg next to the load's charge in g, and velocities in m/s.
- A shot without a velocity above 0 is not read, with a warning. A charge without such a shot is not read, with a warning, and a series without a charge left gives no session.
- A charge without a mass above 0 gives a string without a variation, with a warning.
- A string keeps its first 5000 shots and a session its first 500 strings, the bounds of the session record. A warning names the shots or charges left out.
- A shot pressure of 0 means not measured. A pressure above 0 has no field in the session record and is listed as not read, as are a shot name, the source of a charge and the display settings of the series and its charges (`index`, `showinreport`, `title`, `expanded`, `expandedstats`, `menu`, `menuvalue`, `menuunit`).
- The session ids come from the content, like the other records, so importing the file again adds no session.

Not read, listed on the card when they hold a value, in addition to the GRT list: the primer and the additional start pressure of the `caliber` section, and the section `physical`, the values of the program's own powder model. They are not this app's powder parameters and are never converted.

Shotshell parts: no file with them was available when the reader was written; a section the reader does not know is listed as not read.
