# Domain Docs

Single-context repository: one glossary for the whole monorepo, since the packages and apps share one domain. Skills that explore the codebase read these files when they exist:

- `GLOSSARY.md` at the repository root.
- `docs/adr/`: ADRs that touch the area being changed.

A missing file is not an error: proceed without it. `mattpocock-skills:domain-modeling` creates them when terms or decisions get resolved.

## Rules

- Output that names a domain concept (issue title, refactor proposal, test name) uses the term as `GLOSSARY.md` defines it.
- Output that contradicts an existing ADR names the ADR and says why it is being reopened.
