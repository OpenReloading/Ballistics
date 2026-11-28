---

title: Where catalog records come from
description: Whose facts a catalog record holds, how each citation names its publisher and terms, which values the project works out itself, and how records are removed on request.
---

# Where catalog records come from

Every catalog record names the sources of its values in `provenance.sources` ([record model](record-model.md)), and its page lists them in the Sources panel. What a source stands for depends on who publishes it and on the kind of its values.

## Own records

Records whose sources are the project's own (the demo records, the [construction wording map](bullet-construction.md), the thermochemistry solver) fall under the catalog license, CC BY-SA 4.0 (`packages/catalog/LICENSE`). A source with an SPDX `license` keeps that license for the data taken from it.

## Maker and published records

A bullet or powder record from a maker or another publisher (a magazine, a measured density table, a shop's list) holds facts as the publisher prints them. Each citation names:

- the publisher;
- the URL, or for a document without one, its title and edition;
- the retrieval date, where known;
- the publisher's terms, as a link in `terms`.

When a source names a publisher and links its terms, under no SPDX `license` and with an `origin` other than `public` or `community`, the record page says the record holds facts as that publisher publishes them, that the publisher has not reviewed the record, and that its terms apply; the Terms column links them. Data from a source with `origin` `manufacturer` carries no project license: the manufacturer's terms apply. Data from any other source without a `license` is CC BY-SA 4.0, as the `LICENSE` of `@rangefoundry/catalog` states.

The catalog check (`makerRows` of `@rangefoundry/catalog`) refuses a maker source without a field list, and one without a terms link unless it is a community list of the bullet `length` only. A maker source may supply only the fields of `makerSourceFields` (`@rangefoundry/schema`); a fitted powder source whose field list names only `interior` or fields below it may supply those.

## Values the project works out

A citation's `kind`, or the record's provenance kind where the citation states none, says how its values came about: `published`, `measured`, `derived`, `computed` or `fitted`. Values of kind `derived`, `computed` or `fitted` are the project's own work from the cited source, not figures the publisher printed. The record page then shows a Kind column and says so above the sources.

- A `fitted` citation covers the whole interior model (`interior`), but only the values `interior.fitted` lists are fitted; the other interior values are fixed inputs.
- A fitted powder model is a simulation input, not load data.
- The citation of a fitted model names the table it was fitted to by title, edition and retrieval date. The table's rows, the notes behind a citation and the text of a source are not published with the record.

## Open-license publications

A record whose source is under CC BY 4.0 holds values extracted from the cited publication, not the publication itself. The citation names the publication, and this page is the notice of that change that [CC BY 4.0 section 3(a)(1)(B)](https://creativecommons.org/licenses/by/4.0/legalcode.en) asks for.

## Removal on request

A maker or publisher can ask for its records to be removed through the [repository's issues](https://github.com/OpenReloading/Ballistics/issues). The removal leaves the repository when its pull request merges, and the site, the API and the published packages at their next release.
