---
title: Literature notes
description: How the result of a literature search becomes a literature note, its front matter and sections, and the machine-readable index of all research pages.
---

# Literature notes

A literature note records what published work says on one question of a model, including a search that found nothing or a result that changes nothing. The questions still waiting for a search are on [Open literature questions](./open-questions.md).

Before you change a model, read the entries of its model page in the research index (`research-index.json` or `llms.txt` at the docs root, both written by `npm run site:research -w @open-reloading/docs`).

## How a result enters

1. Resolve each DOI at `https://doi.org/<doi>` and check that title, authors and year match. A source that cannot be verified this way stays out of the findings; it may be listed with `verified: false`.
2. Write one claim per source, in your own words. No text, figure or table of a source is copied.
3. Add each cited source to the [bibliography](../../bibliography.md), one line, with its DOI link.
4. Set `status`: `verified` when every source is verified, `partly_verified` when some are, `unverified` when none is.
5. Name the file `<id>.md` in this folder (`A1.md`), so the page and its id share one link, and remove the question from the open questions page.

The check (`npm test -w @open-reloading/docs`, `scripts/research-index.mts`) fails on a missing field, an answer not in its list, a model page that does not exist and a source marked verified without a DOI.

## Template

```md
---
title: Short title
description: One line of what the note covers.
id: A1
question: The question, one sentence.
model_pages: [interior-powder-fit]
status: verified # verified, partly_verified, unverified
evidence: review # review, experiment, simulation, opinion
retrieved: 2026-01-31
result: no_change # adopt, reject, open, no_change
sources:
  - doi: 10.xxxx/xxxx
    year: 2001
    claim: What the source shows, in our words.
    verified: true
---

# Short title

## Question

The question and the model area.

## Findings

One claim per source, in your own words, with its bibliography link. No copied text, no figures.

## What it changes

The model page or stored shape the finding touches, or nothing.

## What is missing

What the sources do not answer.
```
