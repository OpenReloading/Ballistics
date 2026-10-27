---
title: Cases
description: The case records that name a cartridge, a manufacturer and the stated water capacity of a case product.
---

# Cases

A case record describes one cartridge case product as its manufacturer sells it, for one cartridge. A load names it with `case.record`. The stated water capacity of a case record is the default capacity of a load that names it; a capacity the user measured stays the user's value and takes precedence (`apps/docs/docs/models/case-capacity.md`). Schema: `packages/schema/src/case.ts`. Records: `packages/data/records/cases/`.

## Record

`records/cases/<id>.json`, schema `catalogueCase`.

| Field | Meaning |
|---|---|
| `id`, `origin`, `name`, `productNumber` | Record id (the file name), `catalogue`, the product name and number as the manufacturer prints them |
| `manufacturer`, `cartridge` | References, `catalogue:<id>`, to the manufacturer and the cartridge record |
| `headstamp` | Marking on the case head as the source states it |
| `material` | `brass`, `nickel-plated-brass`, `lacquered-steel`, `polymer-coated-steel` or `aluminium` |
| `primerPocket` | `type` `boxer` or `berdan`, and `size` as the source states it |
| `flashHole` | Diameter of the flash hole, mm |
| `mass` | Mass of the empty case, g |
| `waterCapacity` | Water to the case mouth as the manufacturer states it, g |
| `annealed` | Whether the case is delivered annealed |
| `provenance` | Sources, each listing the fields it supports |

Every data field needs a source that lists it in `fields`. A value a source does not state is left out, never estimated.

## Your cases

The same `Case` shape is the user record of kind `case`, a group of cases the user keeps in the browser (page `/my-cases`, the My cases tab of My gear, `apps/web/src/components/case-library.tsx`): `origin` `user`, a free `name` (for example headstamp and batch), the `cartridge`, the `material` and, as the user measured them, `numberOfFirings`, `trimLength` and `neckWall` (mm), `casesMeasured` and `spread` (g, the standard deviation of the capacity over the cases measured). `basedOn` names the catalogue product the group started from. `manufacturer`, `headstamp`, `mass` and `note` are optional.

The measured water capacity is not a field of the group: `capacity` names the user `caseCapacity` record that holds it, so a capacity is stored once and a load names the same record. The workbench lists the groups of its cartridge next to the catalogue products; a chosen group's capacity fills the measured capacity field and is shown as measured ([Case capacity and seating](../models/case-capacity.md)). Export all and Import of the user data file carry the groups and their capacity records.

## API

Served under `/v1` (`packages/api/src/routes/components.ts`): `GET /cases` filters by `cartridge=<id>` and `manufacturer=<id>`, orders by manufacturer name and name, and its `q` matches the manufacturer name with the product name or the product number. Each item carries the cartridge and manufacturer ids, the material, and the stated water capacity and empty mass where the record has them. `GET /cases/:id` answers the record with its `origin` and `revision`.

## Validation

`npm run data:validate` reports a case whose `cartridge` or `manufacturer` names no record, a flash hole or mass outside the ranges of `checkCase` (`packages/data/src/plausibility.ts`), a stated water capacity above the water the case's enclosing cylinder holds, and two cases of one manufacturer and cartridge with the same name.
