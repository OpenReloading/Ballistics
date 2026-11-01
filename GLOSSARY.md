# OpenReloading

The fields of the record files (`packages/data/records`), the user data files of the web app and the request and response bodies of the API (`/v1`), with the names they carry in files and on the wire.

Units: a record file stores each quantity in one unit (`packages/schema/src/units.ts`): length mm, area mm2, mass g, density g/cm3, pressure bar, energy J, velocity m/s, angle deg, temperature degC (flame and gas temperatures K), specific energy J/kg, molar mass kg/kmol, specific volume m3/kg, burn rate 1/s, mass fraction %, relative humidity %, ballistic coefficient lb/in2. A record quantity is an object `{ value, raw }` in that unit. User data files and API request bodies use SI (m, kg, s, rad, Pa, K) unless a term names another unit. Results are simulations, not load data.

## Language

### Shared shapes

**Quantity**:
A record field stored as `{ value, raw }` with `value` in the stored unit of its quantity kind. Every length, mass, pressure, velocity, angle and temperature of a record file is one.
_Avoid_: measurement

**Value**:
The number of a field object: `value` of a quantity, of a spec value, of a published ballistic coefficient (lb/in2), of a ring (its score), of an estimate, of a seating length (m), of a truing observation, a range string entry or a charge target (SI). Each term that uses it names the unit.

**Raw text**:
`raw`: the text as the source prints it, kept where it differs from the parsed value. On quantities, spec values, powder `composition` entries and bullet `construction`.

**Record id**:
`id`: lowercase kebab-case id of a record, equal to its file name without `.json`. The `{id}` of every `GET /v1/<kind>/{id}` route and the value of every record reference.

**Local id**:
`id` inside a user data file: up to 64 characters, unique within its list. Records, optics, configurations, shot groups, sheet notes and embedded `files` carry one.
_Avoid_: record id (for user data)

**Name**:
`name`: the name of a record or item as its source, rule book or user writes it. Cartridges, powders, bullets, manufacturers, federations, disciplines, target faces, face events, user records, optics, configurations, shot groups and range string candidates carry one.

**Note**:
`note`: free text on a record, a provenance block, a source, a published ballistic coefficient or a plausibility exception.

**Provenance**:
`provenance`: where the values of a record come from, a `kind` and at least one source in `sources`, with an optional `note`. Every record kind and every record the API returns carries it.

**Provenance kind**:
`kind` of a provenance block or a source: `published`, `measured`, `derived`, `fitted` or `computed`. A source's `kind` overrides the block's for that source's values.

**Source**:
One entry of `sources`: a cited publication, file or data set with `title`, `publisher`, `edition`, `page`, `url`, `retrieved`, `sha256`, `fields`, `kind`, `license`, `terms`, `origin`, `run` and `note`.

**Source record**:
A record of kind `sources`: a source several records cite (the C.I.P. TDCC, a rule book), stored once. A record cites it as `{ "source": "<id>" }` with its own `page`, `fields`, `kind`, `note` (before the source record's note) and the `url`, `sha256`, `retrieved` of a file of its own. Answers carry the source resolved.

**Edition**:
`edition`: edition, print or date of a source or rule book as the document states it.

**Source title**:
`title`: names the actual source, such as the site and the table or the report. Rule books (`ruleBooks`) carry a `title` too.

**Publisher**:
`publisher`: who issued the data of a source, free text: a manufacturer, a standards body or the authors.
_Avoid_: maker

**Page**:
`page`: page of a source, or of the rule book section that defines a discipline (printed page, PDF page).

**URL**:
`url`: where a source or a rule book is published.

**Retrieval date**:
`retrieved`: ISO date the source was read.

**SHA-256**:
`sha256`: 64 lowercase hex digits of the file of a source or a rule book.

**Supported fields**:
`fields`: dot paths of the record fields a source supports. Absent: the whole record.

**License**:
`license`: SPDX id of the license the data of a source is used under, or `LicenseRef-<name>` for the publisher's own terms or a written permission.

**Terms**:
`terms`: URL or note of the publisher's terms or permission where no SPDX license covers the use.

**Source origin**:
`origin`: who stands behind a source: `manufacturer`, `public` or `community`.

**Fit run**:
`run` of a `fitted` source: `version`, the 16 hex digit model version id the fit report names, and `report`, the report of its evaluation.

**Country**:
`country`: on a powder or bullet, the ISO 3166-1 alpha-2 code of the manufacturer as a cited source names it. On a federation, its alpha-2 code or `international`. On a cartridge record, the country of origin as printed on its sheet. Cartridge list items carry it too.

**Kind**:
`kind`: the variant of a shape where several share one field: user record kind, calibration reference, chronograph device, optic, ladder, drag, burn law, burn form, fit, observation, range string entry, charge target and truing subject. Each term names its values.

### Manufacturers

**Manufacturer**:
A company that makes powders or bullets, or whose products other records name (a chronograph), a record of kind `manufacturers` with `id`, `name`, `website`, `aliases` and `provenance`. Its id is the slug of its name without the legal form and never changes. Served by `GET /v1/manufacturers` and `GET /v1/manufacturers/{id}`.
_Avoid_: maker, brand

**Manufacturer reference**:
`manufacturer`: record id of a manufacturer on powder and bullet records, their list items, the `resolved` parts of compute answers and the list filter `?manufacturer=`. On a user bullet and a firearm it is a reference `catalogue:<id>` or `user:<id>`, on a chronograph `device` a `catalogue:` reference.
_Avoid_: maker

**User manufacturer**:
A user record of kind `manufacturer`: `origin` (`user`) in `data`, the name in the record's `name`. Typing a name no catalogue or user manufacturer has creates one; the same name typed again names it.
_Avoid_: custom manufacturer

**Case manufacturer**:
`caseManufacturer`: record id of the manufacturer of the case a case capacity was measured with, when the source names one.
_Avoid_: caseMaker

**Manufacturer name**:
`manufacturerName`: the manufacturer as the free text a chronograph file gives, on an imported session candidate's `device`. Every stored record (a bullet design, a firearm, a load's components, a session) holds a manufacturer reference instead.
_Avoid_: maker

**Website**:
`website`: URL of the manufacturer's own site.

**Aliases**:
`aliases`: other names of a record. A manufacturer's former names and brand names, a cartridge's names printed in a standard's title or header, a powder's other brand and name pairs. Searched and checked for duplicates.

### Cartridges and standards

**Cartridge**:
A record of kind `cartridges`, one per C.I.P. sheet: `id`, `name`, `aliases`, `table`, `country`, `published`, `revised`, `pressureMethod`, `verification`, `values`, `exceptions`, `provenance` (the C.I.P. TDCC with the sheet's URL, SHA-256 and retrieval date). Served by `GET /v1/cartridges` and `GET /v1/cartridges/{id}`.

**Cartridge reference**:
`cartridge`: record id of a cartridge on case capacities, loads and firing series, a reference (`catalogue:<id>` or `user:<UUID>`) on a firearm, a reference on loads, and in interior bodies (the cartridge whose pressure limits the answer compares). Also the bullet list filter `?cartridge=`.

**Sheet id**:
`sheetId`: `cip-<id>-<revised or published>`, the id of a cartridge's sheet revision. Figure ids and drawing baselines are named after it.

**Organization**:
`organization`: on a target face list item, the abbreviation of the federation the face's `federation` names, derived. The records hold `federation`, a federation id.
_Avoid_: maker (as an organization value)

**Publication date**:
`published`: ISO date a cartridge's C.I.P. sheet was first published.

**Revision date**:
`revised`: ISO date of the revision of a cartridge's C.I.P. sheet.

**Standard table**:
`table`: table of the C.I.P. TDCC a cartridge or cartridge design sits in, `I` (rimless) to `VII` (shotshell). Also on a cartridge list item, and the list filter `?table=`.

**Pressure method**:
`pressureMethod` (cartridge) and `pressure.method` (firing series): the method that measured the chamber pressure: `transducer` (the C.I.P. method), `piezo`, `case-contact` (a transducer against the outside of the case), `crusher` or `energy`. A pressure is compared only with one of its own method.
_Avoid_: measuringMethod

**Verification**:
`verification`: `verified` when every value of a cartridge record was checked by hand against its sheet, else `unverified`.

**Spec value**:
One entry of `values`: a dimension, pressure, energy or measuring position as the standard prints it, with `side`, `symbol`, `quantity`, `value`, `raw`, `limit`, `tolerance`, `variant`, `basic`, `footnotes`. A cartridge design holds the spec values the drawing reads.

**Sheet column**:
`side`: `cartridge` or `chamber`, the column of the standard a spec value is printed in. Absent for pressures, energies and measuring positions.

**Standard symbol**:
`symbol`: the standard's own symbol of a spec value (`L3`, `P1`, `Pmax`), Greek letters spelled out.

**Quantity kind**:
`quantity`: the kind of a spec value, a key of `units` (`length`, `pressure`), which sets its stored unit.

**Limit**:
`limit`: `max` or `min` where the standard qualifies a spec value itself. Otherwise cartridge values are maxima and chamber values minima. `limit` is also the page size query of a list.

**Tolerance**:
`tolerance`: signed deviations of a spec value as printed, `lower` (at most 0) and `upper` (at least 0), in the unit of the value.

**Variant**:
`variant`: a sub-case the standard distinguishes, such as a chamber length marking (`12/70`).

**Basic dimension**:
`basic`: the spec value is printed as a basic dimension.

**Footnotes**:
`footnotes`: footnote numbers printed next to the symbol of a spec value.

**Plausibility exception**:
`exceptions`: plausibility findings of a cartridge record that were reviewed and kept, each with the `finding` code and the `note` with the reason.

**Pmax**:
`pmax`: the CIP maximum pressure of a cartridge on its list item, bar. Simulated pressures are called peak pressure.

**Case type**:
`caseType`: rim and head style of a cartridge, `rimless`, `semi-rimmed`, `rimmed`, `rebated` or `belted`, derived from the CIP values R1, P1 and R3. On cartridge list items and records.
_Avoid_: rimType

**Maximum bullet diameter**:
`maxBulletDiameter`: the smallest cartridge-side G1 of the C.I.P. sheet of a cartridge, mm, on its list item.
_Avoid_: g1

**Bore diameter**:
`boreDiameter`: diameter across the lands. Cartridge list item (mm, chamber-side CIP F), firearm (mm, measured), M3 `chamber.boreDiameter` (m).
_Avoid_: land

**Groove diameter**:
`grooveDiameter`: diameter across the grooves. Cartridge list item (mm, chamber-side CIP Z), firearm (mm, measured).
_Avoid_: groove

**Case length**:
`caseLength`: length of the case. Cartridge list item (mm, cartridge-side CIP L3).
_Avoid_: l3

**Cartridge length**:
`cartridgeLength`: cartridge-side L6 of the C.I.P. sheet (the smallest where several), mm, on a cartridge list item.
_Avoid_: l6

**Case capacity**:
One entity for every `origin`: the catalogue record (`records/capacities`) and the user record of kind `caseCapacity`, a capacity the user measured. One water capacity of a case of one cartridge from one source, with `origin`, `cartridge` and `caseManufacturer` (references), `waterCapacity` (g), `caseCondition`, `convention`, `note`. A catalogue capacity also has `id` and `provenance`. The cartridge record answer lists the catalogue ones in `capacities`.

**Water capacity**:
`waterCapacity`: mass of water filling a case to the mouth, g, on a case capacity.
_Avoid_: capacity

**Measured water capacity**:
`measuredWaterCapacity`: the case capacity (water to the mouth) the user measured, m3, as a workbench link carries it. A load keeps it as a reference `capacity` to a user capacity record (g).
_Avoid_: ownCapacity

**Case condition**:
`caseCondition`: state of the case when its capacity was measured: `new`, `fired` or `sized`.

**Capacity convention**:
`convention`: how the water was filled for a case capacity (fill level, water temperature, primer state), free text as the source states it. Absent: the default convention of the case capacity model page. It does not enter the derived volume.

**Caliber class**:
A record of kind `caliber-classes`: a class of bullet diameter with `name`, `diameter` and the member `cartridges`. `caliberClasses`: on a discipline an object with the ids of the class records it allows and its `basis` (`stated` by the rule book or `derived` from a stated range). On a target face list item the ids of the classes of its events.
_Avoid_: calibers, classes

### Powders

**Powder**:
A record of kind `powders`: a propellant as its manufacturer sells it, with `manufacturer`, `name`, `aliases`, `country`, `grainForm`, `propellantBase`, `bulkDensity`, `composition`, `thermochemistry`, `interior`. Served by `GET /v1/powders` and `GET /v1/powders/{id}`, and named by `powder` in charge-target bodies and workbench states.

**Grain form**:
`grainForm`: `ball` (spherical and flattened spherical grains), `extruded` (tubes, cylinders, sticks), `flake` or `other`.
_Avoid_: `form` (on a powder)

**Propellant base**:
`propellantBase`: `single`, `double` or `triple`, the number of energetic bases.
_Avoid_: `base` (on a powder)

**Bulk density**:
`bulkDensity`: mass per volume of uncompressed powder, voids between grains included, g/cm3 on the powder record. In charge-target bodies `propellant.bulkDensity`, kg/m3.

**Composition**:
`composition`: ingredients as the safety data sheet prints them, each with `name`, `cas` (CAS registry number), `min` and `max` (mass %) and `raw`.

**Min and max**:
`min` and `max`: the extremes of a range: of an ingredient's mass fraction (%), or of a computed thermochemistry value over the composition ranges.

**Thermochemistry**:
`thermochemistry`: constant-volume burning at `loadingDensity` (g/cm3) computed from the composition: `flameTemperature` (K), `impetus` (J/kg), `gamma`, `molarMass` (kg/kmol) and `covolume` (m3/kg), each a value with `min` and `max`.

**Interior parameters**:
`interior`: the M3 parameters of a powder fitted to load tables, with the fixed inputs of the fit: `model` (`m3`), `fitted`, `vivacity`, `energy`, `gamma`, `covolume`, `density`, `pressureExponent`, `referencePressure`, `ignitionPressure`, `startPressure`, `propellantTemperature`, `burnForm`, `resistance`, `trainingRows`, `trainingCartridges`. Effective values of the model version. Powder list items carry `vivacity`, `pressureExponent`, `referencePressure` and `burnForm`.

**Fitted parameters**:
`fitted`: the interior parameters the fit moved (`vivacity`, `energy`, `form.a`). The others are fixed inputs.

**Estimate**:
A fitted value with its `standardUncertainty`, both in the unit of the quantity: `interior.vivacity`, `interior.energy` and `burnForm.a`.

**Standard uncertainty**:
`standardUncertainty`: standard deviation of an estimate or of a truing observation, in the unit of its value.
_Avoid_: sigma, standard error

**Vivacity**:
`vivacity`: rate constant of the vivacity burn law, 1/s, in the powder record's `interior` and in a `vivacity` burn of an M3 body.

**Specific energy**:
Energy per unit propellant mass at constant volume, J/kg: `interior.energy` on the powder record, `propellant.specificEnergy` in interior bodies. The force constant is (gamma - 1) times it.
_Avoid_: impetus (a computed thermochemistry value)

**Gamma**:
`gamma`: ratio of specific heats of the propellant gas. In `thermochemistry` the frozen ratio at the flame temperature, in `interior` and interior bodies the value the model uses.

**Covolume**:
`covolume`: covolume of the propellant gas, m3/kg, in `thermochemistry`, `interior` and the M3 `propellant`.

**Solid density**:
`density`: density of the propellant grains, g/cm3 in the powder record's `interior`, kg/m3 in the `propellant` of interior bodies.

**Pressure exponent**:
Exponent of pressure in a burn law: `interior.pressureExponent` on the powder record, `burn.exponent` in M3 bodies (vivacity and geometric laws).
_Avoid_: `exponent` (on a powder record)

**Reference pressure**:
`referencePressure`: pressure the vivacity burn law refers to, bar in the powder record, Pa in M3 bodies.

**Ignition pressure**:
`ignitionPressure`: pressure of the gas present when the integration starts, bar in the powder record, Pa in M3 bodies.

**Start pressure**:
`startPressure`: mean pressure at which the bullet may start to move, bar in the powder record (absent: the core default), Pa in M3 bodies. `startPressureFraction` of `tolerances` varies it.

**Propellant temperature**:
`propellantTemperature`: temperature of the powder: of a powder fit and a chronograph shot string (degC), of an M3 body (K).
_Avoid_: `temperature` (of a propellant)

**Burn form**:
The form function of the vivacity burn law: `burnForm` on the powder record (`kind` `twoStage`), `burn.form` in M3 bodies (`kind` `constant`, `twoStage` or `threeStage`). Parameters `a`, `m`, `q` and `z1`, with `z2` and `r` for `threeStage`, are dimensionless.
_Avoid_: `form` (on a powder record)

**Bore resistance**:
`resistance`: the bore resistance the fit or the run applies. On the powder record the constants of the fit: `stress` (friction stress on the bullet side area, bar), `oversize` (coefficient per percent of bullet oversize) and `engraving` (fraction of the start pressure). In M3 bodies `friction` (constant pressure, Pa) and `engraving` (pressure over travel, a table of `travel` m and `pressure` Pa).

**Bore friction**:
`friction`: constant friction pressure on the bore area, Pa: M3 `resistance.friction`.

**Training set**:
`trainingRows` and `trainingCartridges`: rows and cartridges of the load data the interior parameters were fitted to, absent without a load-table fit.
_Avoid_: `rows`, `cartridges` (of a powder fit)

### Bullets

**Bullet**:
A record of kind `bullets`: a projectile as its manufacturer sells it, with `manufacturer`, `productNumber`, `name`, `country`, `productLine`, `caliber`, `diameter`, `mass`, `length`, `base`, `ogive`, `tip`, `meplatDiameter`, `noseLength`, `baseToOgive`, `bearingLength`, `construction`, `ballisticCoefficients`, `recommendedTwist`, `slowestTwist`. Served by `GET /v1/bullets` and `GET /v1/bullets/{id}`, and named by `bullet` in exterior bodies, the stability query and workbench states.

**Product number**:
`productNumber`: the manufacturer's product number of a bullet.
_Avoid_: `model` (on a bullet record)

**Product line**:
`productLine`: the manufacturer's product line a bullet belongs to.
_Avoid_: line

**Product model**:
`model`: product name or number of a load's `bullet`, of a chronograph `device` and of a firearm of the user data.

**Caliber**:
`caliber`: caliber as the manufacturer writes it, for example `.308`.

**Bullet diameter**:
`diameter` of a bullet record (mm) and its list item (mm), of an exterior `projectile` and the stability query (m). `bulletDiameter`: the diameter a range firings record's drag coefficients refer to, and the truing nominal (mm).
_Avoid_: `diameter` (on range firings)

**Bullet mass**:
`mass` of a bullet record and its list item (g), of an exterior `projectile`, an interior `bullet` and the stability query (kg). `bulletMass`: on a load's `bullet`, a firing series, a range firings record and the truing nominal (g).
_Avoid_: `mass` (on range firings and load bullets)

**Bullet length**:
`length`: overall length of a bullet record and its list item (mm), of an exterior `projectile` and the stability query (m).

**Bullet base**:
`base`: `type` (`flat`, `boat-tail`, `rebated-boat-tail`), `length` (mm), and for a boat tail `diameter` of the base face (mm) and `angle`, the half-angle of the conical tail (deg). The bullet list item carries `baseType`.

**Ogive**:
`ogive`: `form` (`tangent`, `secant`, `hybrid`), `radius` of the nose arc (mm) and `radiusRatio`, the head-shape parameter Rt/R (0 for a cone, 1 for a tangent ogive), at least one of them.

**Tip**:
`tip`: `type` (`hollow-point`, `polymer-tip`, `soft-point`, `full-metal-jacket`, `open-meplat`), the polymer tip `length` forward of the jacket opening (mm) and the hollow-point `mouthDiameter` (mm). The bullet list item carries `tipType`.
_Avoid_: `tip` (on a bullet list item)

**Meplat diameter**:
`meplatDiameter`: diameter of the flat at the nose, mm, 0 for a sharp point.

**Nose length**:
`noseLength`: length of the bullet nose, mm.

**Base to ogive**:
`baseToOgive`: on a bullet, base to the start of the ogive (mm). On a load, cartridge base to the bullet ogive of the loaded round (mm), and a `seating.by` value of a load.
_Avoid_: cbto

**Bearing length**:
`bearingLength`: length of the full-diameter part of a bullet, mm.

**Construction**:
`construction`: how a bullet is built, read from the manufacturer's wording in `raw`: `structure`, `core.material` and `core.hardness` (Brinell, lead cores), `jacket.material` and `jacket.thickness` (a present `jacket` means jacketed), `surface` (coatings), `gasCheck` (cast bullets), `drivingBands` (monolithic bullets), and `unmapped` when no structured field could be derived. Lead-free is not stored: `leadFree` derives it from core and surface (`apps/docs/docs/data/bullet-construction.md`). A bullet list item carries the structure or `<material>-core`, and `leadFree` where it is derived.

**Ballistic coefficient**:
`ballisticCoefficients`: the coefficients a manufacturer publishes for a bullet, each with `dragModel`, `value` (lb/in2), `minVelocity` and `note`. In exterior bodies a `bc` drag has `bands` of `ballisticCoefficient` (kg/m2) and `minVelocity`. Bullet list items carry the first G1 and G7 values as `ballisticCoefficientG1` and `ballisticCoefficientG7` (lb/in2). The UI label is BC.
_Avoid_: bc (as a field name), g1, g7

**Band start velocity**:
`minVelocity`: lower bound of the velocity band a ballistic coefficient applies to, m/s. Absent on a record and 0 in a band: from 0.
_Avoid_: velocityMin, minSpeed

**Drag model**:
`dragModel`: the reference drag function of a ballistic coefficient, `G1` or `G7` on a bullet record and a bullet reference in exterior bodies. The `model` of a `bc` drag in exterior bodies names any drag function of core.

**Recommended twist**:
`recommendedTwist`: twist the manufacturer recommends, length per turn, mm.

**Slowest twist**:
`slowestTwist`: slowest twist the manufacturer allows, length per turn, mm.
_Avoid_: minimumTwist

**Twist**:
`twist`: length of barrel per turn of the rifling. On a firearm (mm), interior `barrel`, exterior `firearm` and the stability query (m). 0 in an interior body: no rifling.
_Avoid_: twistLength

**Twist hand**:
`twistHand`: `right` or `left`, the direction of the rifling.

### Loads

**Primer**:
A record of kind `primers`: a primer product as its manufacturer sells it, with `manufacturer`, `name`, `productNumber`, `size` (`small-rifle`, `large-rifle`, `small-pistol`, `large-pistol` or `shotshell`), `magnum`, `cup`, `compound` (`lead-styphnate` or `lead-free`), `intendedUse` and `performance`. Served by `GET /v1/primers` and `GET /v1/primers/{id}`, named by a load's `primer.record`. No value of it enters a calculation.

**Load**:
One cartridge recipe fired from one firearm, one shape for the catalogue (a record of kind `loads`), the user record of kind `load` and the load file, in stored units: `origin`, `cartridge`, `firearm`, `bullet` and `powder` (references, a measured catalogue load may describe the bullet and powder instead), `charge` (g), `capacity` (a reference to a case capacity, catalogue or the user's measured one), `primer` (`record`, a `catalogue:` primer reference, and `lot`), `case` (`firingCount`), `seating`, `note`, `analysis` (`overrides`, the solver values the user typed, and `ladder`) and `sessions` (references to the chronograph sessions of the Measurements tab). A catalogue load also has `id`, `name` and `provenance`; a user load is named by its record. Its components hold a `manufacturer` reference and `lot`, the bullet `model` and `bulletMass`, and the powder `name`.

**Lot**:
`lot`: lot number of a load component as printed on the package.

**Charge**:
`charge`: propellant mass of one round. Load (g), the `charge` variation of a shot string (g), interior and charge-target bodies (kg), and the `charge` of each interior answer and ladder step (kg).

**Case firings**:
`firingCount`: times the case of a load was fired before this load.
_Avoid_: firings

**Overall length**:
`overallLength`: cartridge overall length of the loaded round, mm on a load, and a `seating.by` value of a load.
_Avoid_: coal

**Barrel length**:
`barrelLength`: barrel length of a firearm and a firing series (mm). Interior bodies take `barrel.length` (m): the bullet travel from the seated position to the muzzle.
_Avoid_: `travel` (of an M3 barrel)

**Bullet travel**:
`travel`: seated bullet base to the muzzle, m, a workbench field and key of a load's `analysis.overrides` (mm), sent as the M3 `barrel.length`.
_Avoid_: `barrelLength` (of the workbench field)

**Bullet seating**:
`seating`: the length a bullet is seated by in a load, `by` (`overallLength` or `baseToOgive`) and its `value` (mm). The other length is derived.

### Chronograph sessions

**Chronograph session**:
One shape for the catalogue (a record of kind `chrono`), the user record of kind `session` and what an import gives: one device, one place, one day, with `origin`, `date`, `device`, `muzzleDistance`, `conditions`, `strings` and `note`. A catalogue session also needs its `id`, the date, the device's maker and model, the air temperature and the load of every string; a user session is named by its record (the file name) and keeps what the file gave. Its provenance kind is `measured`.

**Device**:
`device`: the chronograph of a session, `kind` (`doppler-radar`, `optical`, `magnetic`, `other`), `manufacturer` (a reference, `catalogue:` in a catalogue session), `model` and `firmware`.

**Muzzle distance**:
`muzzleDistance`: muzzle to the measuring point of a chronograph, mm.

**Conditions**:
`conditions`: `airTemperature` (degC), `stationPressure` (absolute air pressure at the site, bar) and `relativeHumidity` (%) of a session. The truing nominal holds the same three.

**Shot string**:
One entry of a session's `strings`: the shots of one load, with `load`, `label`, `variation`, `propellantTemperature`, `conditions`, `note` and `shots`.

**String variation**:
`variation`: what a shot string varies against its load: `kind` `charge` (the charge, g) or `seating` (the length the load seats the bullet by, mm) and its `value`. Absent: the string is not mapped on the Measurements tab. A temperature ladder is the string's `propellantTemperature`.

**Load reference**:
`load`: on a shot string a reference to the load it was fired with, absent while a session is not attached to a load (a file just read). On a target sheet the local id of the saved load its groups belong to.
_Avoid_: loadId

**Chronograph shot**:
One entry of `shots` of a shot string: `velocity` (m/s), `coldBore` (first shot from a cold or clean barrel) and `excluded`, the reason it is left out of statistics.
_Avoid_: `shot` (for a chronograph reading)

**Excluded**:
`excluded`: left out of the statistics. A text with the reason on a chronograph shot, a boolean on a group shot, and an overlay switch of a target sheet.

### Published measurements

**Firing series**:
A record of kind `firings`: rounds of one ammunition fired from one barrel, measured and published by others, with `cartridge`, `ammunition`, `bulletMass`, `firearm` (text), `barrelLength`, `roundCount`, `velocity` and `pressure`.

**Ammunition**:
`ammunition`: the ammunition as the publication describes it.

**Firearm description**:
`firearm` of a firing series: the firearm or test barrel as the publication describes it, text.

**Round count**:
`roundCount`: number of rounds fired: in a firing series, and through the barrel of a firearm of the user data.
_Avoid_: `rounds` (as a count)

**Published velocity**:
`velocity` of a firing series: `point` (where it applies, as printed), `instrument`, `mean` (m/s) and the single-shot velocities `shots` (m/s). A `velocity` key of the stability query is not used (it takes `muzzleVelocity`).

**Published pressure**:
`pressure` of a firing series: `method`, `instrument`, gauge `position` as printed and `meanPeak`, the mean of the peak pressure of each round (bar).

**Instrument**:
`instrument`: the instrument that measured a published velocity or pressure, as printed.

**Mean**:
`mean`: mean velocity, m/s: published in a firing series, measured in a range string `chronograph`.

**Range firings**:
A record of kind `range`: spark-range firings of one projectile from one report, with `projectile` (as the report names it), `bulletDiameter`, `bulletMass` and `rounds`, each round with `label` (as printed), `mach`, `totalYaw` (total angle of attack, deg) and `dragCoefficient` at that yaw.

**Label**:
`label`: a name as printed or typed: the round number of range firings, a shot string of a session.
_Avoid_: `round` (in range firings)

**Mach number**:
`mach`: Mach number of a range firings round, dimensionless.

**Drag coefficient**:
`dragCoefficient`: drag coefficient of a range firings round at its total yaw, not the zero-yaw drag.
_Avoid_: cd

### Target faces and federations

**Target face**:
A record of kind `target-faces`: a printed face as a rule book defines it, with `name`, `federation`, `rings`, `innerTen`, `blackDiameter`, `blackHeight`, `decimal`, `events`, `paper`, `bulls`, `numerals`. Its list item carries `caliberClasses` and `categories`.

**Ring**:
One entry of `rings`, outer to inner: `value` (the score, one above the ring outside it), `diameter` (width to the outside edge of the ring line, mm), `height` of an oval ring (mm), `fill` (colour of the zone the ring line bounds outside) and `line` (colour of the ring line). `rings` is also an overlay switch.

**Inner ten**:
`innerTen`: the inner ten of a face, `diameter`, `height` (oval faces) and `rule`: `touch` counts a hole that touches its circle, `cover` only a hole that covers it.

**Black diameter**:
`blackDiameter`: width of the black aiming area, the outside of the outermost black zone, mm. `blackHeight`: its height on an oval face.
_Avoid_: black

**Decimal scoring**:
`decimal`: the rule book allows tenth-ring values on the face.

**Face event**:
One entry of `events` of a face: `id`, `name`, `distance`, `gauge`, `scoring`, `federation`, `section` and `category`. `event` on a target mapping or a shot group's `face` holds its `id`.

**Gauge**:
`gauge`: diameter of the hole as scored, mm: a face event's gauge, or the one a target mapping fixes for a discipline. A target mapping list item carries `gaugeMm`.

**Centre scoring**:
`scoring`: `centre` when a ring counts only if the centre of the hole lies on or inside its line, whatever the hole size.

**Discipline category**:
`category`: kind of firearm a discipline or face event is shot with, for example `rifle` or `service-pistol`. `categories` on a target face list item.

**Paper**:
`paper`: sheet a face is printed on, `format` (`A2` to `A6`, `other`), `width` and `height` as the sheet lies upright (mm).
_Avoid_: sheet, sheetFormat

**Bull**:
One entry of `bulls`: a scoring centre of a face with several, `x` and `y` from the sheet centre (x right, y up, mm) and the `zone` label of a card with two scoring zones.

**Printed numerals**:
`numerals`: the ring values are printed on the face.

**Federation**:
A record of kind `federations`: a shooting sport federation with `name`, `abbreviation` (shown as the organization of faces and events), `country`, `internationalFederation` and `ruleBooks`.

**International federation**:
`internationalFederation`: record id of the international federation a federation is a member of.
_Avoid_: international

**Rule book**:
One entry of `ruleBooks`: `title`, `edition` (as the document states it), `url` and `sha256`.
_Avoid_: documents

**Discipline**:
A record of kind `disciplines`: a match or course of fire of one `federation`, with `name`, `number` (as printed), `section` and `page` of the rule book, `distance`, `category`, `caliberClasses` and `internationalDiscipline`. The list filters `?federation=`. Its list item carries `distanceMm`.

**International discipline**:
`internationalDiscipline`: record id of the discipline of the international federation the rule book names as equivalent.
_Avoid_: international

**Distance**:
`distance`: muzzle to target. On a discipline and a face event (mm), on a discipline list item `distanceMm` (mm), on a shot group (m).

**Rule book section**:
`section`: section of the rule book that defines a discipline or lists a face event.

**Target mapping**:
A record of kind `target-mappings`: one discipline shot on one face event, with `discipline`, `face`, `event`, `stage` (the part shot on this face, absent: the whole discipline), `gauge` and `shotCount`. The list filters `?discipline=` and `?face=`.

**Face reference**:
`face`: record id of a target face on a target mapping. On a shot group, the ring-scoring settings: `id` of the face, `event` and `marks`.

**Discipline reference**:
`discipline`: record id of a discipline on a target mapping.

**Federation reference**:
`federation`: record id of the federation whose rule book defines a discipline.

**Shot count**:
`shotCount`: a number of shots: those that count on a face in a discipline (target mapping), and those behind a range string entry or chronograph reading.
_Avoid_: `shots` (as a count), n

### User data files

**User data file**:
A JSON file of the web app with `format` (`openreloading-user-data`), `version` (a file of another version is refused), `records` and the photos of its target sheets in `files`.

**User record**:
One entry of `records`: `kind` (`bullet`, `cartridge`, `load`, `firearm`, `targetSheet`, `targetFaceDesign`, `powder`), `id`, `name`, `saved` (ISO date and time of the save) and the `data` of that kind.
_Avoid_: workbenchLoad

**Embedded file**:
One entry of `files`: a photo with `id`, media `type` and base64 `data`.

**Bullet design**:
A user record of kind `bullet`: `origin` (`user`), the `manufacturer` reference, the `basedOn` catalogue reference and the `overrides` of the bullet fields, in stored units.

**Cartridge design**:
A user record of kind `cartridge`: `origin` (`user`), the `basedOn` catalogue reference and `overrides` of the `table` and the spec `values`.

**Target face design**:
A user record of kind `targetFaceDesign`: the `rings`, `innerTen`, `blackDiameter`, `blackHeight`, `decimal` and `events` of a face in mm, each optional while the draft is unfinished. The shot group and hit probability tools offer a design that builds a valid `TargetFace` as `User design <name>` (face id `user-<record id>`).

**Powder design**:
A user record of kind `powder`: `origin` (`user`), the `provenanceKind` and the `draft`, the powder's grain form, bulk density, composition, thermochemistry and burn law in stored units, each optional while the draft is unfinished. The workbench and the charge target tool offer a design that builds a valid `Powder` as `<name> (your design)`, a saved load names it as `user:<id>`, and every result from it says the powder values are from a user design.

**Base record**:
`basedOn`: the catalogue record a design is a variant of, as `catalogue:<id>`. The resolved record is the base with the `overrides` applied (`applyOverrides`).

**Overrides**:
`overrides`: the fields of a design that differ from its base record. An object merges by key, an array replaces, a cartridge value merges by side, symbol and variant, `null` removes.

**SI values**:
`siValues`: SI value per field key of a designer or the workbench, as the share link carries them.
_Avoid_: si

**Notes**:
`notes`: free text of a firearm; a load's is `note`. On a target sheet the list of sheet notes.

**Ladder**:
`ladder`: a series of runs around or beyond a base value. On a load, `analysis.ladder`: `kind` (`charge`, `seating` or `temperature`), `stepCount` (2 to 21), `step` (g for a charge ladder, mm for seating, K for temperature) and `direction` (`up`, `down`, `around`). In interior bodies a charge ladder from `load.charge` with `chargeStep` (kg), `stepCount` and `direction`, one interior run each.
_Avoid_: `step`, `steps` (of a ladder)

**Sessions of a load**:
`sessions`: the references (`user:<UUID>` or `catalogue:<id>`) of the chronograph sessions the Measurements tab shows for a load, in the order shown. The sessions are records of their own.

**Firearm**:
A firearm, one shape for every origin, in stored units (mm, g, degrees; the zero air in degC, bar and %). The user record of kind `firearm` holds `origin`, `name`, `manufacturer` (a reference), `model`, `cartridge` (a reference), `barrelLength`, `twist`, `twistHand`, `grooveDiameter`, `boreDiameter`, `freebore`, `baseToOgiveAtLands`, `firearmMass`, `roundCount`, `roundCountDate` (the day the count was last set), `countedSessions` (the rounds added to the count per session, so a session is counted once), `notes`, `optics`, `configurations`, `active` (the configuration on the firearm now). A workbench state names one by its local id in `firearm`, a load by a reference. The `firearm` of exterior bodies is the sight and rifling of one shot.
_Avoid_: rifle, gun

**Freebore**:
`freebore`: unrifled length of the throat from the case mouth to the start of the rifling, mm, on a firearm.

**Base to ogive at the lands**:
`baseToOgiveAtLands`: cartridge base to ogive with the bullet touching the lands, measured, m.
_Avoid_: lands

**Firearm mass**:
`firearmMass`: mass of a firearm, g. A load's `analysis.overrides` entry of that name is g too.
_Avoid_: `mass` (of a firearm), gunMass

**Optic**:
One entry of `optics`: `id`, `kind` (`scope`, `redDot`, `ironSights`, `other`), `name`, `clickUnit` (how the turrets are marked, `MOA` or `mrad`), `clickValue`, `travel` (total adjustment range, degrees), `reticle`, `minMagnification` and `maxMagnification`.
_Avoid_: magnificationMin, magnificationMax

**Click value**:
`clickValue`: angular size of one sight click: degrees on an optic, rad in range string bodies (nominal) and as a prior.
_Avoid_: click

**Optic configuration**:
One entry of `configurations`: the optics mounted on a firearm between `mounted` and `removed` (ISO dates), with `id`, `name` and 1 to 4 `mounts`.

**Optic mount**:
One entry of `mounts`: `optic` (local id), `sightHeight` (mm), `lateralOffset` (optic centre right of the bore, mm), `cant` (clockwise as seen from behind, degrees), `zeroRange` (mm), `zeroNotes`, the optional air of the zero (`zeroTemperature` degC, `zeroPressure` bar, `zeroHumidity` %) and an optional `dragFactor` with its `dragFactorSource`.
_Avoid_: `offset` (of a mount)

**Sight height**:
`sightHeight`: line of sight above the bore axis at the muzzle: mm on an optic mount, m on the `firearm` of exterior bodies. The truing nominal holds it in mm.

**Zero range**:
`zeroRange`: range at which an optic mount is zeroed, m. The truing nominal holds it in mm.

### Target sheets

**Target sheet**:
A user record of kind `targetSheet`: a `photo` (local id of an embedded file) or a drawn target, its `references`, `targetRotation`, `targetOrigin`, `photoRotation`, `groups`, `load`, `markerDiameter`, `notes` and `overlays`. Positions on the target are in m, x right, y up.

**Calibration reference**:
One entry of `references`: a scale or perspective reference on the photo, by `kind`: `line` (points `a` and `b` a known `length` apart), `ringCentre` (`centre` and a point on the `edge` of a ring of known `diameter`), `ringEdge` (three `points` on such a ring), `rectangle` (`corners` of a known `width` and `height`). Points in photo px, lengths in m.

**Position**:
`x` and `y`: a point. On the target in m, x right, y up (group shots, point of aim, notes, ring marks). On the photo in px, x right, y down. On a face's `bulls` in mm from the sheet centre.

**Target rotation**:
`targetRotation`: angle of the target's x axis on the photo, counter-clockwise, rad.
_Avoid_: rotation

**Target origin**:
`targetOrigin`: photo point of target (0, 0).
_Avoid_: `origin` (of a sheet)

**Photo rotation**:
`photoRotation`: turn of the photo on screen about its middle, counter-clockwise, rad.

**Marker diameter**:
`markerDiameter`: diameter of the shot marks, m. Absent: a fixed size on screen.
_Avoid_: marker

**Sheet note**:
One entry of `notes` of a target sheet: `id`, `x`, `y`, `text` with `{key.unit}` placeholders, and `group`, the local id of the group whose values they show.

**Overlay switches**:
`overlays`: which overlays the editor showed: `spread`, `box`, `aim`, `ellipses`, `dispersion`, `axis`, `excluded`, `numbers`, `stats`, `rings`.

**Shot group**:
One entry of `groups`: the shots at one distance, with `id`, `name`, `colour` (`#rrggbb`), `distance` (m), `aim` (point of aim), `ladderStep` (index of the ladder step of the sheet's load, 0 for the first charge), `shots`, `detection` and `face`.

**Group shot**:
One entry of a group's `shots`: `x`, `y`, `excluded`, `placement` (`detected` or `placed`), `holeDiameter` (measured, m) and `chrono`, the chronograph shot of the round as `session` (a reference), `string` (index) and `shot` (index).
_Avoid_: `origin` (of a shot), hole

**Hole detection**:
`detection`: the choices of hole detection kept for the next run: `region` (photo polygon searched), `expectedHoleDiameter` (m), `backing` (colour seen through a hole), `minContrast` (least contrast as a fraction of the local paper white) and `polarity` (`dark` or `light`).
_Avoid_: holeSize

**Ring marks**:
`marks` of a shot group's `face`: points marked on the face's rings in target m, each with the `ring` value, `x` and `y`.

### Truing results

**Truing result**:
`RangeStringFit`, the result of a fit from range strings (`packages/core/src/exterior/range-strings.ts`): `parameters`, `held`, `correlation`, `confounded`, `conditionNumber`, `residuals` and the residual check.
_Avoid_: `target` (of a truing result)

**Fitted parameter**:
One entry of `parameters`: `name` (`muzzleVelocity`, `dragFactor`, `clickValue`), `status` (`identified`, `weak`, `unresolved`), `reasons`, `nominal`, `value`, `standardUncertainty`, `relativeStandardUncertainty` (of its logarithm), `varianceInflation`, `interval`, `intervalsTrusted` and `conditionalOn`.

**Variance inflation**:
`varianceInflation`: variance inflation factor of a fitted parameter against knowing the others. `maxInflation` is the threshold above which a parameter is weak.
_Avoid_: inflation, vif

**Relative standard uncertainty**:
`relativeStandardUncertainty`: standard uncertainty of the logarithm of a fitted parameter. `maxRelativeStandardUncertainty` is the threshold above which a parameter is weak.
_Avoid_: relativeSigma, maxRelativeSigma

**Confidence interval**:
`interval`: `lower` and `upper` bound of a fitted parameter at its `confidenceLevel`.
_Avoid_: low, high, level

**Residual check**:
`residuals`: `chiSquare`, `degreesOfFreedom`, `pValue`, `consistent`, `intervalsTrusted` and `conditionNumber` of a fit.
_Avoid_: dof, df

**Condition number**:
`conditionNumber`: condition number of the column-scaled information of a fit, also on a 422 truing answer. `maxCondition` is the largest the fit accepts.
_Avoid_: condition

### API lists and errors

**List page**:
The answer of a list route: `total` and the `items` of the page. Query `q` (search, 1 to 100 characters), `limit` (page size 1 to 200) and `offset` (items skipped).
_Avoid_: search

**Cartridge record answer**:
`GET /v1/cartridges/{id}`: the cartridge record with `caseType` and `capacities` (case capacity records).

**Error body**:
The body of every error answer: `statusCode`, `error`, `message`, and where they apply `code` (Fastify), `issues` (schema errors, each `path` and `message`), `reason` (compute failures), `notice` and `requestId` (the server log id of a 500).

### API exterior bodies

**Shot**:
`shot`: the muzzle state of one trajectory in exterior bodies: `projectile`, `muzzleVelocity`, `firearm`, `air`, `lookAngle`, `wind`, `site` and `zero`. Not a chronograph or group shot.

**Projectile**:
`projectile`: `mass`, `diameter`, `length`, `drag` and `aerodynamics`, or a bullet reference (`bullet`, `dragModel`, `length`, `aerodynamics`). On range firings, the projectile as the report names it.

**Drag**:
`drag`: `kind` `bc` with `model`, `bands`, `reference` (`icao` or `metro`, the atmosphere the manufacturer states, stored only) and `interpolation`, or `kind` `curve` with a `curve` table of Mach number and drag coefficient and `interpolation` (`linear`, `monotone-cubic`).

**Aerodynamics**:
`aerodynamics`: coefficients of the modified point mass, each a number or a table over Mach: `liftSlope`, `momentSlope`, `magnusForceSlope`, `spinDamping`, with `axialInertia` and `transverseInertia` (kg m2).
_Avoid_: magnusForce

**Muzzle velocity**:
`muzzleVelocity`: velocity at the muzzle, m/s, in exterior bodies, the stability query and interior answers. A prior and a fitted parameter of range strings carry the name too. `fitMuzzleVelocity` fits it next to the drag in a truing body.
_Avoid_: `velocity` (in the stability query)

**Exterior firearm**:
`firearm` of a shot: `sightHeight`, `sightOffset` (sight to the right of the bore, m), `twist` and `twistHand`.
_Avoid_: rifle

**Air**:
`air`: `altitude` (m), `pressure` (station pressure, Pa), `temperature` (K) and `humidity` (relative, fraction 0 to 1), for the shot and optionally the zero.

**Look angle**:
`lookAngle`: angle of the line of sight above the horizontal, rad.

**Wind segment**:
One entry of `wind`: `speed` (m/s), `fromDirection` (rad clockwise from the line of fire, 0 headwind), `vertical` (m/s, up) up to `endDistance` (horizontal, m).
_Avoid_: until, from

**Site**:
`site`: `latitude` (rad, positive north) and `azimuth` of fire (rad clockwise from true north), for the Coriolis acceleration.

**Zero**:
`zero`: either the zero `range` (m) with its own `lookAngle`, `air` and `wind`, or the angles `elevationAngle` and `windageAngle` (rad).

**Range**:
`range`: slant range of a truing observation or range string entry, or the zero range, m. `ranges`: the distances a trajectory answer reports, m.

**Exterior options**:
`options` of exterior bodies: `relativeTolerance`, `absoluteTolerance`, `maxTime` (s), `gravity` (m/s2), the switches `coriolis`, `spinDrift` and `jump` (aerodynamic jump), `zeroTolerance` (largest miss of the zero search, m), `model` (`point-mass` or `modified-point-mass`), `maxYaw` (rad) and `maxSteps`. Range string bodies hold them in `trajectoryOptions`.
_Avoid_: config, rtol, atol

**Integrator tolerances**:
`relativeTolerance` and `absoluteTolerance` of the integrator in exterior and interior options. `relativeTolerance` of a charge-target answer is the relative miss the solver accepts.
_Avoid_: rtol, atol

**Step cap**:
`maxSteps`: integrator steps before a run stops, `maxIterations`: fit iterations, `maxTime`: run time (s).

**Truing observation**:
One entry of `observations` of a truing body: `kind` (`height`, `elevationHold`, `velocity`), `range`, `value` and `standardUncertainty`.

**Truing fit**:
`fit` of a truing body: `kind` `muzzleVelocity`, or `drag` with `knots` (Mach numbers of a drag factor that varies with Mach) and `fitMuzzleVelocity`.

**Range string**:
Measurements at known distances: `entries` (`kind` `impact` or `dial`, `range`, `shotCount`, `standardDeviation`, `rounding`, `group`, and the measured `value` in a fit) plus a `chronograph` reading. A plan body lists `candidates` (`name`, `entries`, `chronograph`) and the nominal `clickValue` and `dispersion`.

**Standard deviation**:
`standardDeviation`: standard deviation of one shot, in the unit of the value of a range string entry or chronograph reading. The UI label is SD.
_Avoid_: sd, `spread` (of a range string)

**Rounding**:
`rounding`: step to which a reading was rounded, in the unit of its value.

**Range string group**:
`group`: label of the group of shots behind a range string entry. On a sheet note, the local id of a shot group.

**Chronograph reading**:
`chronograph`: muzzle velocity readings of a range string, `instrumentDistance` (muzzle to the instrument, m), `mean`, `shotCount`, `standardDeviation`, `rounding`.
_Avoid_: `range` (of a chronograph)

**Dispersion**:
`dispersion`: standard deviation of one shot's vertical angle, rad, in a range strings plan body. Also an overlay switch.

**Range string options**:
`options` of range string bodies: `trajectoryOptions`, `fitZeroOffset`, `priors`, `maxIterations`, `maxCondition`, `confidenceLevel`, `maxInflation`, `maxRelativeStandardUncertainty`, `maxZeroSigma` (standard uncertainty of the zero offset above which it is weak, rad), `residualConfidenceLevel` (level of the chi-square test) and `scaleByResidual`.
_Avoid_: level, residualLevel, solver

**Prior**:
`priors`: Gaussian priors on the fitted parameters: `muzzleVelocity`, `dragFactor` and `clickValue` as the standard deviation of their logarithm, `zeroOffset` in rad (needs `fitZeroOffset`).

**Drag factor**:
`dragFactor`: constant multiplier on the drag curve fitted by truing. An optic mount can store one (1 is the drag of the bullet as given), shown as a percentage.

**Zero offset**:
`zeroOffset`: angle by which the impacts at the zero setting lie above the nominal zero, rad. `fitZeroOffset` fits it.

**Stability query**:
Query of `GET /v1/exterior/stability`: `bullet` or `mass`, `diameter` and `length`, with `twist`, `muzzleVelocity`, `temperature` (K) and `pressure` (Pa).

### API interior bodies

**Interior model**:
`model`: `m3`, the model of a `POST /v1/interior` body and of a powder's interior parameters.

**Chamber**:
`chamber` of an M3 body: `volume` behind the seated bullet base (m3), `boreArea` (m2) and `boreDiameter` (m).

**Bore area**:
`boreArea`: area of the bore, m2, in the M3 `chamber`.

**Barrel**:
`barrel` of interior bodies: `length` and `twist`.

**Interior bullet**:
`bullet` of interior bodies: `mass`, with `gyrationRadius` (axial radius of gyration, m). In exterior bodies and the stability query `bullet` is a bullet record id; on a load it is a bullet reference.

**Propellant**:
`propellant` of interior bodies: `specificEnergy`, `gamma`, `density`, `covolume`, `burn` and `temperatureSensitivity`.

**Burn law**:
`burn` of an M3 propellant: `kind` `geometric` (`coefficient` in m/s per Pa to the `exponent`, and the `grain`) or `vivacity` (`vivacity`, `exponent`, `referencePressure`, `form`).

**Grain**:
`grain` of a geometric burn: `shape` (`sphere`, `cylinder`, `tube`, `sevenPerf`), `diameter`, `length` and `perforationDiameter` (one perforation), m.
_Avoid_: perforation

**Temperature sensitivity**:
`temperatureSensitivity`: burn-rate change per K below (`cold`) and above (`hot`) the `reference` temperature (K) in an M3 body.

**Pressure gradient**:
`gradient`: coefficients of the gas kinetic energy (`energy`) and the breech pressure (`breech`), default the Lagrange gradient.

**Heat loss**:
`heat`: `model` `none` or `convective` with `flameTemperature` and `wallTemperature` (K), `viscosity` (Pa s), `prandtl` (Prandtl number) and `factor` on the heat flux.

**Leakage**:
`leakage`: gas leakage past the bullet, `area` over travel (table of `travel` m and `area` m2), `backPressure` (Pa) and the `discharge` coefficient.

**Interior options**:
`options` of an M3 body: `relativeTolerance`, `absoluteTolerance`, `outputStep` (spacing of curve points, s), `maxSteps` and `maxTime` (s).
_Avoid_: config

**Pressure tolerances**:
`tolerances`: the input variations of the pressure range, `chargeFraction`, `volumeFraction`, `massFraction` (default 0), `burnRateFraction`, `temperatureKelvin` (K) and `startPressureFraction`. Absent keys take the core defaults.

`sampling`: the request field of a single interior run that asks for the sampled band (`samples`, `seed`, `budgetMs`). The answer's `sampled` holds the 5th, 50th and 95th percentile of the peak pressure and the muzzle velocity, or the status `overBudget` or `invalid`.

**Charge target**:
`target` of `POST /v1/interior/charge-target`: `kind` (`peakPressure` Pa, `muzzleVelocity` m/s, `loadRatio`, `barrelTime` s, `bulletLeadTime` s), `value` and `unit` (`percentOfLimit` for a percentage of the first compared limit).

**Load file**:
The body of `POST /v1/interior/load-file`: a user data file with exactly one record of kind `load`. Query `curves` (`true` adds the curve `points`).

### API compute answers

The OpenAPI document describes these compute response fields using the route response schemas.

**Result**:
`result`: the computed value of a compute answer: trajectory, truing, range string plan or fit, stability, or one interior run.
_Avoid_: trajectory, truing, plans, fit, stability (as answer keys)

**Units**:
`units`: the unit of each field of a compute answer.

**Resolved record**:
`resolved`: the records a request named by id (`bullet`, `powder`, `cartridge`), each echoed with `id`, `manufacturer`, `name`, `provenance` and `suppliedFields`.
_Avoid_: echo

**Supplied fields**:
`suppliedFields`: names of the request values a resolved record supplied because the request left them out.
_Avoid_: `fields` (of a resolved record)

**Notice**:
`notice`: the fixed text "simulation, not load data" on every interior answer.

**Pressure range**:
`pressureRange`: the nominal, low and high peak pressure over the tolerance cases.

**Pressure limit**:
One entry of `limits`: one CIP Pmax of the cartridge's sheet (`cartridge`, `revised`) and its comparison with the pressure range. Crusher values are listed, not compared.

**Warnings**:
`warnings`: coded messages of an interior answer, such as a load ratio above the model's range.

**Ladder steps**:
`ladderSteps`: one entry per ladder charge, each with its `charge` and run. `shown`: index of the step whose summary and curves a load-file answer shows.
_Avoid_: steps

**Load name**:
`loadName`: name of the load record of a load file.
_Avoid_: `name` (of a load-file answer)

**Summary**:
`summary` of a load-file answer: `peakPressure` (Pa), `muzzleVelocity`, `muzzleEnergy` (J), `barrelTime` (s), `loadRatio` and `muzzleBurntFraction`.

**Peak pressure**:
`peakPressure`: the highest simulated pressure of a run, Pa, and a charge target kind. `pmax` is the CIP limit.
_Avoid_: maxPressure (for a simulated value)

**Load ratio**:
`loadRatio`: charge divided by the product of bulk density and chamber volume, dimensionless.

**Muzzle burnt fraction**:
`muzzleBurntFraction`: fraction of the charge burnt when the bullet leaves the muzzle.
_Avoid_: burntFraction

**Curve points**:
`points`: the pressure curve of a run, one entry per output step.
_Avoid_: curves (as a response key)

**Charge solution**:
The answer of `POST /v1/interior/charge-target`: the solved `charge`, the `achievedValue` of the target, the `relativeTolerance`, the `evaluationCount` of interior runs, the `reachable` range, the run `result`, `pressureRange` and `limits`.
_Avoid_: `value` (of a charge solution), evaluations

**Reachable range**:
`reachable`: lowest (`minValue`) and highest (`maxValue`) target value over the scanned charges, each with its charge.
_Avoid_: valueLow, valueHigh

**Truing failure**:
The 422 answer of a failed truing fit: `reason`, `conditionNumber`, `unresolved` (indices of parameters the observations do not resolve), `direction` (the parameter combination with the smallest eigenvalue) and `estimate`.
