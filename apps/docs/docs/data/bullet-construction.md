---
title: Bullet construction
description: The structured construction fields of a bullet record, the rules between them and the derived lead-free flag.
---

# Bullet construction

`construction` of a bullet record keeps the manufacturer's wording in `raw` and, where the wording states it, structured fields next to it. Schema: `constructionFields` in `packages/schema/src/bullet.ts`. Nose shape is not part of it: it is `tip.type`.

## Fields

| Field | Values | Rule |
|---|---|---|
| `structure` | `cup-and-core`, `bonded`, `partitioned`, `monolithic`, `cast`, `swaged`, `plated`, `frangible` | |
| `core.material` | `lead`, `lead-alloy`, `copper`, `copper-alloy`, `tin`, `tungsten`, `steel`, `compressed-powder` | `compressed-powder` is a consolidated metal powder whose metals the wording does not state |
| `core.hardness` | Brinell hardness number (HBW), a positive number without unit | only with a `lead` or `lead-alloy` core |
| `jacket` | present when the bullet has a jacket, absent when it has none | |
| `jacket.material` | `copper`, `gilding-metal`, `copper-clad-steel`, `copper-plated-steel`, `steel` | optional |
| `jacket.thickness` | wall thickness, mm | optional, below the radius of the bullet |
| `surface` | `moly`, `black-oxide`, `powder-coat`, `polymer-coat`, `paint`, `wax-lube`, `boron-nitride`, `tungsten-disulfide`, `copper-wash`, `lead-wash` | a non-empty list |
| `gasCheck` | `true`, or `false` for a plain base the wording states | only with structure `cast` |
| `drivingBands` | count of driving bands, an integer of 1 or more | only with structure `monolithic` |
| `unmapped` | `true` | the wording could not be mapped: it excludes every structured field above |

A field is absent where the wording does not state it. Wording that maps unambiguously is mapped; anything else stays in `raw` with `unmapped`.

## Lead-free

`leadFree(construction)` in `@open-reloading/schema` is derived, never stored:

| Result | When |
|---|---|
| `false` | the core is `lead` or `lead-alloy`, or the surface holds `lead-wash`, whatever else is stated |
| `true` | the core is a named material other than lead and `compressed-powder`, and the surface has no lead |
| `undefined` | no construction, `unmapped` wording, no core material, or a `compressed-powder` core |

A jacket does not enter: the jackets of the schema hold no lead. The flag describes the wording of the record, not an analysis of the bullet.

## Provenance

The record's `provenance` covers the construction as a whole (`fields: ["construction"]`) or by dot path (`construction.core.hardness`, `construction.gasCheck`). `npm run data:validate` fails a construction field no source covers (`checkCoverage`, `packages/data/src/coverage.ts`).

## Maker wording

Records whose maker states the construction for a whole line or for the whole range, mapped once per maker. The record names the source of each structured field in its provenance.

| Maker | Wording | Fields | Source |
|---|---|---|---|
| Sierra | Bullet Material "Jacketed Lead" (product page) | `core.material` `lead`, `jacket` present | the product page of each record, for example [20 cal 32 gr TVK](https://sierrabullets.com/20-cal-32-gr-tipped-varmintking-tvk/) |
| Lehigh Defense | material attribute "Copper", the only material named | `structure` `monolithic`, no core | the store's product attributes of each record, for example [.224 62 gr Maximum Expansion](https://lehighdefense.com/224-diameter-62-grain-maximum-expansion-bullets-50-count.html) (now redirects to [wilsoncombat.com](https://wilsoncombat.com/lehigh-defense/), whose product titles end in "Copper") |
| Hammer Bullets | "using only the highest-quality solid copper", "pure copper", "100% Lead Free" | `structure` `monolithic`, no core | [hammerbullets.com](https://hammerbullets.com/), home page, retrieved 2026-11-01 |
| Cutting Edge Bullets | "World-class solid copper bullets" | `structure` `monolithic`, no core | [cuttingedgebullets.com](https://cuttingedgebullets.com/), home page, retrieved 2026-11-01 |
| Missouri Bullet | "We make cast lead bullets", alloys of tin, antimony and lead, "We don't do gas-checked bullets" | `structure` `cast`, `core.material` `lead-alloy`, `gasCheck` `false` | [missouribullet.com](https://missouribullet.com/), home page, retrieved 2026-11-01 |
| Missouri Bullet | "Brinell N" of each product | `core.hardness` N | the [pricing page](https://missouribullet.com/pricing.php) row of each record |
| Sako | Bullet Type "Full metal jacket" | `jacket` present | the reloading data row of each record |

For the monolithic rows above the maker names the material of the whole bullet, so these records have no `core` and their derived `leadFree` is undefined. That is a choice of these mappings, not a rule of the schema, where `structure` and `core` are independent; Hammer's "100% Lead Free" is the maker's statement and is not that value. Of the Hornady records, one keeps its construction wording in `construction.raw` (with fields mapped from it); the other Sako records keep their source wording in `construction.raw` with `unmapped: true`; Sellier & Bellot records state no construction.

## Values and their sources

Each value is read from a manufacturer's wording. The public sources found for the terms:

| Terms | Source |
|---|---|
| `frangible`, `compressed-powder`, `tin` | A frangible projectile breaks up on a hard surface; copper and copper-tin powders are pressed and sintered or compacted: [US 10,309,756 B2](https://patents.google.com/patent/US10309756). No standard defining frangible was found. |
| `moly`, `tungsten-disulfide`, `boron-nitride` | Dry lubricant coatings of bullets: [Guide to Bullet Coating](https://www.accurateshooter.com/?p=2477); friction test of coated bullets: [DTIC ADA568594](https://apps.dtic.mil/sti/pdfs/ADA568594.pdf). |
| `core.hardness` | Brinell hardness (HBW) is defined by ISO 6506-1 (not read for this page). |

Unverified (no source found that names them as bullet terms): `powder-coat`, `polymer-coat`, `paint`, `wax-lube`, `copper-wash`, `black-oxide`, core materials `steel` and `tungsten`, jacket material `steel`, the use of `gasCheck` and `drivingBands` as written here, and `lead-wash`. `lead-wash` is the one surface that holds lead: it exists so the derived flag can state a lead-bearing coating, and is to be dropped if no record uses it.
