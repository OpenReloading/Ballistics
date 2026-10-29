---
title: Research log
description: What was tried on each model question, how, with what numbers, and whether it improved the model, so a finished test is not repeated.
---

# Research log

One entry per model question that was investigated, including the ones that changed nothing or were not adopted. An entry is a page in this folder with the sections below, written when the work ends. A change that repeats a question starts from its entry.

## Template

Copy this into `apps/docs/docs/research/<slug>.md`, add the front matter (`title`, `description` with one line of what the page covers) and fill every section. A section may be short. The check (`npm test -w @open-reloading/docs`, `scripts/research-log.mts`) fails on a missing or empty section, on a `Result`, `Data basis` or `Confidence` that does not start with one of its answers, and on a path under `Where in the app` that is not an existing file.

```md
## Question

One sentence, with the model area.

## Method

What was compared with what, on which data, with which metric and which accept rule, decided in advance.

## Formulas

The equations used, in the symbols of the docs, each in your own words with a citation.

## Numbers

Baseline, result and the size of the change, with units.

## Result

Starts with one of: improved, no change, worse. Then what was done: adopted, adopted in a reduced form, not adopted, documented as a limit.

## Data basis

Starts with one of: public, analytic, measured. A closed form or a synthetic case is analytic. Measured data that is not in the repository: only what the owner allows to be stated.

## Where in the app

Files in backticks (`packages/...`) and the links to the model pages the decision touches. Each file must exist, a directory does not count. A root-level file without extension is written with its `./` (`./LICENSE`), else it is not looked up.

## Confidence

Starts with one of: high, medium, low. Then the reason in one line.
```

## Sources

Equations are described in your own words with a citation. A book, paper, standard or public report is cited by title, author and DOI or URL, in the [bibliography](../bibliography.md). A figure without an open source is marked "unverified" with a confidence level. No text, figure or table of a source is copied.

## Literature notes

What published work says on a model question is a [literature note](./literature/index.md), with its own front matter and sections. The questions still waiting for a search are on [Open literature questions](./literature/open-questions.md).

## Entries

The entries are listed in the sidebar.
