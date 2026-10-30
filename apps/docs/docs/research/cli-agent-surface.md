---
title: Command line for people, scripts and agents
description: Whether the command line is a full-featured load simulator that a person, a script and a language-model agent can use without the web app, measured against command line and tool-protocol guidance, and the sliced plan.
---

# Command line for people, scripts and agents

## Question

Command line (`packages/cli`): is it a full-featured load simulator that a person, a script and an AI agent can use without the web app, and if not, what is the smallest command surface and output contract that makes it one, reusing instead of rebuilding?

## Method

Decided before measuring:

- Measurement: the pre-release integration branch at commit `e568b86f`, `npm ci` and `npm run build` on the host (Node 26.11.1). The CLI was run from `node packages/cli/dist/bin.js` with no arguments, `--help`, `--version`, unknown commands and options, the sealed split, a missing and a `-` rows path, and `verify` and `compare` on the synthetic rows of `packages/cli/test/data.ts` (25 rows) with the records of the data package and of `packages/cli/test/fixtures/records`. Exit code, bytes on stdout, the first line on stderr, byte equality of two runs, and wall time (median of 5 runs) were recorded.
- What the web app computes: the compute routes of the API (`packages/api/src/routes/compute.ts`), the browser compute entry (`packages/api/src/compute/browser.ts`) and the core functions the web app imports.
- Simplicity test: a script of about ten lines over the existing packages that runs one load offline. If it works, a command earns its place only through the contract (help, schema listing, notice, exit codes, stdin), and each proposed command is checked on who runs it and what it replaces.
- Checklist: the six items of the issue, each graded met, partly met or missing with the command and its output.
- Sources: primary only, read on 2026-10-30: the Command Line Interface Guidelines ([clig.dev](https://clig.dev/)), POSIX Utility Syntax Guidelines ([IEEE Std 1003.1-2024, chapter 12](https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap12.html)), GNU coding standards ([`--help`](https://www.gnu.org/prep/standards/html_node/_002d_002dhelp.html), [`--version`](https://www.gnu.org/prep/standards/html_node/_002d_002dversion.html)), the tool-protocol specification ([MCP 2025-11-25, Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)), [JSON Schema 2020-12 core](https://json-schema.org/draft/2020-12/json-schema-core), [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html), [sysexits(3)](https://man.freebsd.org/cgi/man.cgi?query=sysexits&sektion=3) and the [llms.txt proposal](https://llmstxt.org/).
- Accept rule for a build issue ("Worth building?"): it closes a checklist gap for scripts or agents, reuses the schemas and runners the API already has instead of copying them, needs no network and no workflow or repository setting change, and is a small or medium change with tests. A command that a short script or a file search already does is a negative result.

## Formulas

- Start time: $t = \mathrm{median}(t_1, \dots, t_5)$, the wall time of 5 runs of the same command on an idle host; the overhead of the CLI is $t_\text{cmd} - t_\text{node}$ with $t_\text{node}$ the time of `node -e 0`.
- Coverage of the web app's computations: the share of compute operations of the API that a command runs, $c = n_\text{cli} / n_\text{api}$.
- Determinism: two runs with the same inputs give byte-identical stdout.

## Numbers

What exists (integration head):

- Two commands, `verify` and `compare`, 1396 lines in `packages/cli/src`, 84 tests in 11 test files, coverage floors 97 % statements, 94 % branches, 98 % functions, 97 % lines.
- Start time: `node -e 0` 0.017 s, `--help` 0.107 s, `verify` on 25 rows 0.297 s. `main.ts` imports core, data and drawing before it reads the arguments, so `--help` pays for the libraries (inferred from the imports, not profiled).
- `verify` writes 3680 B of JSON, `compare` 8833 B; two `verify` runs are byte-identical. The table mode prints 11 lines on a terminal or with `--table`.
- The API has 8 compute operations (interior, interior charge target, interior load file, exterior trajectory, truing, range strings plan and fit, stability). The CLI runs none of them: $c = 0/8$. The web app further computes group and velocity statistics, hit probability, moving target lead, recoil and powder fit from chronograph strings by calling core directly; none of these is an API route either.
- Simplicity test: a 9-line Node script that imports `interiorBody`, `runInterior` and `runTask` from `@open-reloading/api/compute`, reads the interior example body on stdin and prints the answer, ran offline in 0.212 s, exit 0, with `notice` "simulation, not load data", `units` (SI) and `result` with peak pressure, muzzle velocity and energy (217153 B, the full time curves). The interior computation for a script is therefore already available; what is missing is the contract around it.

Checklist:

| Item | Grade | Evidence |
| --- | --- | --- |
| 1. Inputs | missing for a single load; partly met for rows | Only a rows CSV (unit-suffixed columns `charge_g`, `velocity_ms`, ...) with record ids, resolved against `--records`. No load, firearm, bullet, powder or conditions file or flags; no catalogue lookup or search command; no user records. |
| 2. Computations | partly met | `verify` and `compare` met. Interior, exterior (trajectory, drop, wind, zero), group and score statistics and powder fit: no command (`ballistics simulate`, `list`, `schema` all exit 2 with the usage). |
| 3. Outputs | partly met | JSON on stdout when piped, `schemaVersion` 1, schema file `packages/cli/schema/result.schema.json` kept current by a test, table mode: met. Simulation label: 0 occurrences of "simulation" in the `verify` JSON, while the API answers carry `notice`. Field names are stable through the schema test; units are in the docs, not in the result. |
| 4. Script and agent ergonomics | partly met | No prompts: met. Exit codes 0, 1 (refused), 2 (bad input) documented; an unexpected error also exits 2 (the last catch of `main.ts`). Errors: one plain text line on stderr, not JSON. Deterministic: met. Stdin: `--rows -` is refused ("does not exist"), `--rows /dev/stdin` works. Batch: a rows file is a batch: met. `--help`: complete for both commands, exits 0 on stdout: met. `--version`: exit 2, unknown option. Command and schema listing as JSON: missing. Network: no `fetch` or `http` in `packages/cli/src`: met. |
| 5. Discoverability for AI | partly met | `packages/cli/AGENTS.md` with an agent loop: met. The docs `llms.txt` lists only the research pages (`apps/docs/scripts/research-index.mts`). The examples of `apps/docs/docs/cli.md` need rows the repository does not hold, so none runs as written. The schema has no `$id` and is not served at a URL. No tool-server wrapper. What it will not do: the docs page says results are simulations and that a fit from rows is not part of this version; nothing says no network and no prompts. |
| 6. Packaging and size | partly met | Private package, run as `node packages/cli/dist/bin.js` from a built checkout (no `ballistics` on the path). Start time above. Maintenance: 1396 lines beside the API; any new compute command that does not reuse the API's schemas doubles the contract the OpenAPI baseline guards. |

Against the sources:

- clig.dev: humans first with the terminal as the signal, `--json` for machines, output on stdout and messages on stderr, zero exit on success and non-zero codes mapped to the main failure modes, prompts only on a terminal and never required, full help on `-h` and `--help` leading with examples, responsive within about 100 ms, additive changes and `--json` as the stable interface. The CLI meets the stream split, the terminal default, the prompts rule and additive JSON; it misses examples that run, the 100 ms target for `--help`, and structured errors (clig.dev asks for errors rewritten for humans; structured errors for agents are this entry's reading of the tool protocol below, not a clig.dev rule).
- POSIX guideline 13: an operand `-` means standard input. Not met for `--rows`. Guideline 10 (`--` ends options) is met by `parseArgs`.
- GNU: `--help` on stdout and exit 0 (met), `--version` on stdout and exit 0 (missing).
- Tool protocol: a tool is a name, a description, an input JSON Schema and an optional output schema (2020-12 by default); a failure of the tool itself is a result with `isError` and an actionable message so the model can correct the call. A command listing operations with their input and output schemas, and errors as objects, map one to one onto that, so a later tool-server wrapper is a thin layer and not a second contract.
- JSON Schema 2020-12, section 8.2.1.1: a root schema should have an absolute `$id`, which need not be downloadable. OpenAPI 3.1 Schema Objects are a superset of 2020-12, so the API's zod schemas can serve both the OpenAPI document and a CLI listing.
- sysexits(3): the codes 64 to 78 exist but the interface is marked deprecated and its use discouraged, so the plan keeps small documented codes (0, 1, 2, and 3 for an internal error) instead.
- llms.txt: an informal proposal, a Markdown file at a site root or subpath with an H1, a summary and link lists. The docs already write one; a line for the command line page is enough.

Reuse decision:

- Thin client over the REST API: fails item 4 (no network access needed) and needs a running server. Rejected.
- Command line over core directly: would copy the request schemas, record resolution, limits and answer shapes of the compute routes, the contract the OpenAPI baseline guards. Rejected.
- Command line over the API's browser entries (`@open-reloading/api/compute`, `@open-reloading/api/catalogue`): no Fastify and no I/O of their own, already imported by the web app, and the simplicity test shows they run a load offline. Recommended. It is blocked by the import rule `cli-imports-core-data-drawing-schema-only` of `.dependency-cruiser.cjs` and the package rule in `AGENTS.md` (the CLI never depends on the API): changing them is an owner decision.
- Must not be duplicated: the zod request and answer schemas, record resolution, the limit checks and warnings, the notice string, and the units of the answers.

Simplicity gate per command:

- Error contract, `--version`, `-`, notice, `$id`, fast `--help`: who runs it is every script and agent that calls `verify` or `compare`; it replaces guessing from stderr text. Passes.
- `run <operation>` and `operations`: replaces starting the API server, or each user writing the 9-line script plus record resolution and error handling; the listing is what an agent reads first. How often it would run is unverified (no user report asks for it). Passes on the reuse condition only.
- Catalogue lookup and search command: the records are JSON files in git and the API has list routes; `grep` or `jq` over `packages/data/records` (1484 files) does it. Negative result, not proposed.
- Group statistics and powder fit commands: no API operation exists, so a command would be the first and only contract for them. Not proposed; the API route comes first.
- Tool-server wrapper: with `operations` and `run` it is a thin mapping; no agent client asks for it today. Deferred, outside the pre-release scope.

## Result

no change. Not adopted in code; recommendation (medium confidence): the CLI is not a full-featured simulator today (0 of 8 compute operations, items 1 and 2 largely missing); make it one by running the API's own compute entry offline behind a small contract, after the owner allows that import, rather than a REST client or a copy over core.

Plan, in order:

1. Issue #653 (small, no dependency): error objects on stderr with `--json`, exit code 3 for an internal error, `--version`, `--rows -`, `notice` in the result, `$id` in the schema, `--help` before the libraries load.
2. Owner decision: allow `packages/cli` to import `@open-reloading/api/compute` and `@open-reloading/api/catalogue` (the rule and `AGENTS.md`).
3. Issue #654 (medium, useful alone): move the exterior handlers and the load file computation into run functions exported from the compute entry, OpenAPI unchanged.
4. Issue #655 (medium, after 2; exterior and load file operations after 3): `ballistics run <operation> [--input <file>|-]` and `ballistics operations` with input and output schemas from the same zod definitions, docs page, package `AGENTS.md`, an example that runs, a line in `llms.txt`.

Deferred, outside the pre-release scope: tool-server wrapper, group statistics and powder fit (API first), a table for `run`, publishing the package (an owner decision on releases).

## Data basis

measured: runs of the built CLI and of a 9-line script over the API compute entry at `e568b86f` on one host, the synthetic rows of the CLI tests; sources as listed under Method.

## Where in the app

- `packages/cli/src/main.ts`: commands, options, exit codes, the error catch.
- `packages/cli/schema/result.schema.json`: the result schema.
- `apps/docs/docs/cli.md`, `packages/cli/AGENTS.md`: the docs and the agent loop.
- `packages/api/src/compute/browser.ts`: the compute entry the web app runs.
- `packages/api/src/routes/compute.ts`: the compute routes, exterior handlers inline.
- `packages/api/src/compute/answer.ts`: the notice.
- `.dependency-cruiser.cjs`: the rule `cli-imports-core-data-drawing-schema-only`.
- `apps/docs/scripts/research-index.mts`: the docs `llms.txt`.

## Confidence

medium: the gaps and times are measured on one host and the reuse path is shown by a working script, but how often people, scripts or agents would run the new commands is unverified.
