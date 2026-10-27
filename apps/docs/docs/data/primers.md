---
title: Primers
description: The primer records that describe a primer product by size, cup, priming compound and published figures, and that a load names.
---

# Primers

A primer record describes one primer product as its manufacturer sells it. A load names it with `primer.record`, next to the lot of the primer. A primer takes no part in a calculation: no value of the record enters a solver. Schema: `packages/schema/src/primer.ts`. Records: `packages/data/records/primers/`.

## Record

`records/primers/<id>.json`, schema `primer`.

| Field | Meaning |
|---|---|
| `id`, `name`, `productNumber` | Record id (the file name), the product name and number as the manufacturer prints them |
| `manufacturer` | Id of the manufacturer record |
| `size` | `small-rifle`, `large-rifle`, `small-pistol`, `large-pistol` or `shotshell` |
| `magnum` | Whether the manufacturer sells the primer as a magnum primer |
| `cup` | `material` (`brass`, `nickel-plated-brass`, `copper` or `steel`) and wall `thickness` (mm), where the source gives them |
| `compound` | `lead-styphnate` or `lead-free` |
| `intendedUse` | What the manufacturer sells the primer for, in the words of the record |
| `performance` | Output or sensitivity figures a source publishes, each a `property` and a `value` as the source prints it, with its unit |
| `provenance` | Sources, each listing the fields it supports |

Every data field needs a source that lists it in `fields`. A value a source does not state is left out, never estimated. A source other than a fact source (a standard, an official specification) needs a `license`, or the manufacturer's written permission, in its record (`packages/data/AGENTS.md`, Provenance).

`packages/data/records/primers/` holds the synthetic demo records (CC0-1.0), invented for tests and the example. No record of a real product is in the catalogue yet: no primer source whose terms allow publishing the values has been found.

## In a load

`Load.primer` is `{ lot?, record? }`. `record` is a `catalogue:<id>` reference: there is no user primer record, so a `user:` reference is refused. The earlier fields `manufacturer` and `model` are gone, and a load file that has them is refused (no migrations before 1.0).

## API

Served under `/v1` (`packages/api/src/routes/components.ts`): `GET /primers` filters by `manufacturer=<id>`, `size=<size>`, `compound=<compound>` and `magnum`, orders by manufacturer name and name, and its `q` matches the manufacturer name with the product name or the product number. `GET /primers/:id` answers the record with its `revision`.

## Validation

`npm run data:validate` reports a primer whose `manufacturer` names no record, a field without a source, a load whose `primer.record` names no primer, and two primers of one manufacturer with the same name.
