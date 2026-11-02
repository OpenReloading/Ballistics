---
title: Manufacturers
description: The manufacturer records that powder, bullet, case capacity and load table records name by id.
---

# Manufacturers

Who names a manufacturer, and how:

- by the id of a manufacturer record: a powder, primer or bullet (`manufacturer`), a case capacity record (`caseManufacturer`) and a load table (`manufacturer`);
- by a `catalogue:<id>` reference: a chronograph session (`device.manufacturer`), and a load for a described bullet, powder or case (`manufacturer`);
- by a `catalogue:<id>` or `user:<id>` reference: a user bullet and a firearm.

A name a user types that no manufacturer has becomes a user manufacturer, a record kept in the browser with the name as its `name`. The same name typed again finds it; a name or alias of a catalogue manufacturer finds the catalogue record first. While the catalogue cannot be read, a name that matches none of the user's own manufacturers gets no reference and no record (the field keeps the text and says so), so a user manufacturer never duplicates a catalogue one; leaving the field asks the catalogue again. The file and copied JSON of a bullet or firearm, and the share link of a bullet, carry the user manufacturer record it names; opening them keeps that record in the browser (an existing record of that id stays). Settings, Manufacturers lists the user manufacturers of the browser and deletes one that no record names.

Schema: `packages/schema/src/manufacturer.ts`. Records: `packages/data/records/manufacturers/`.

## Record

`records/manufacturers/<id>.json`, schema `manufacturer`.

| Field | Meaning |
|---|---|
| `id` | Record id, the file name |
| `name` | Name as the manufacturer prints it on its products |
| `website` | URL of the manufacturer's website |
| `aliases` | Former names and other names the products are sold under |
| `provenance` | Sources of the name and the aliases |

## Id

The id is the slug of the name without the legal form: "Demo Powder Co." becomes `demo-powder`. An id never changes. When a manufacturer changes its name, `name` takes the new one and the old one goes to `aliases`, so records and saved files that name the id keep working. Examples in tests and docs use invented names; the catalogue records name the real makers, each citing the maker's own publication; only the records with the `demo-` prefix are invented.

## Validation

`npm run data:validate` (`packages/data/src/references.ts`, `checkManufacturerReferences`) reports a powder, primer or bullet `manufacturer`, a case capacity `caseManufacturer`, a load table `manufacturer`, a chronograph session's `device.manufacturer` or a load's `bullet.manufacturer`, `powder.manufacturer` or `case.manufacturer` that names no manufacturer record. Names and aliases of manufacturers are unique. Powder, primer and bullet names are unique per manufacturer.

## API

Served under `/v1` (`packages/api/src/routes/components.ts`):

- `GET /manufacturers`: `{ total, items: [{ id, name, aliases?, website? }] }`, ordered by name; `GET /manufacturers/:id`: the record.
- `GET /powders` and `GET /bullets` filter by `manufacturer=<id>` and order by manufacturer name, product name and id; `q` matches the manufacturer name or one of its aliases followed by the product name.

The web app reads the names once per page and shows a powder or bullet as its manufacturer name followed by its product name.
