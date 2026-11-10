# Domain Docs

Single context: one glossary for the whole monorepo. Skills that explore the codebase read, when present:

- `GLOSSARY.md` at the repository root.
- `docs/adr/`: ADRs that touch the area being changed.

A missing file is not an error. `mattpocock-skills:domain-modeling` creates them when terms or decisions get resolved.

## Rules

- Output that names a domain concept (issue title, refactor proposal, test name) uses the term as `GLOSSARY.md` defines it.
- Output that contradicts an existing ADR names the ADR and says why it is being reopened.
