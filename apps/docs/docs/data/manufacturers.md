---
title: Manufacturers
description: The manufacturer records that powder, bullet, case capacity and load table records name by id.
---

# Manufacturers

A powder or bullet record names its manufacturer by the id of a manufacturer record (`manufacturer`). A case capacity record names the case manufacturer the same way (`caseManufacturer`), and so does a load table (`manufacturer`). A chronograph session names the maker of its device by a `catalogue:<id>` reference (`device.manufacturer`). A load names the maker of a described bullet or powder, its primer and its case by a reference (`manufacturer`). A user bullet and a firearm name their manufacturer by a reference, `catalogue:<id>` or `user:<id>`. A name a user types that no manufacturer has becomes a user manufacturer, a record kept in the browser with the name as its `name`; the same name typed again finds it, and a name or alias of a catalogue manufacturer finds the catalogue record first. While the catalogue cannot be read, a name that matches none of the user's own manufacturers gets no reference and no record (the field keeps the text and says so), so a user manufacturer never duplicates a catalogue one; leaving the field asks the catalogue again. The file and the copied JSON of a bullet or a firearm, and the share link of a bullet, carry the user manufacturer record it names, and opening them keeps that record in the browser (an existing record of that id stays), so the maker shows wherever the record is opened. Settings, Manufacturers lists the user manufacturers of the browser and deletes one that no record names. Schema: `packages/schema/src/manufacturer.ts`. Records: `packages/data/records/manufacturers/`.

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

The id is the slug of the name without the legal form: "Demo Powder Co." becomes `demo-powder`. An id never changes. When a manufacturer changes its name, `name` takes the new one and the old one goes to `aliases`, so records and saved files that name the id keep working. Examples in records, tests and docs use invented names only.

## Validation

`npm run data:validate` (`packages/data/src/references.ts`, `checkManufacturerReferences`) reports a powder or bullet `manufacturer`, a case capacity `caseManufacturer`, a load table `manufacturer` a chronograph session's `device.manufacturer` or a load's `bullet.manufacturer`, `powder.manufacturer`, `primer.manufacturer` or `case.manufacturer` that names no manufacturer record. Names and aliases of manufacturers are unique. Powder and bullet names are unique per manufacturer.

## API

Served under `/v1` (`packages/api/src/routes/components.ts`):

- `GET /manufacturers`: `{ total, items: [{ id, name, aliases?, website? }] }`, ordered by name; `GET /manufacturers/:id`: the record.
- `GET /powders` and `GET /bullets` filter by `manufacturer=<id>` and order by manufacturer name, product name and id; `q` matches the manufacturer name or one of its aliases followed by the product name.

The web app reads the names once per page and shows a powder or bullet as its manufacturer name followed by its product name.
