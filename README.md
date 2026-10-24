<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="apps/web/src/assets/ballistics-dark.svg"><img src="apps/web/src/assets/ballistics-light.svg" width="360" alt="OpenReloading Ballistics"></picture></p>

# OpenReloading

[![CI](https://github.com/OpenReloading/Ballistics/actions/workflows/ci.yml/badge.svg)](https://github.com/OpenReloading/Ballistics/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D26-339933?logo=nodedotjs&logoColor=white)](.nvmrc)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/OpenReloading/Ballistics/badge)](https://scorecard.dev/viewer/?uri=github.com/OpenReloading/Ballistics)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-fe5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org/en/v1.0.0/)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/KkYJ5fdukR)

[![web](https://img.shields.io/github/v/release/OpenReloading/Ballistics?filter=web-v*&include_prereleases&label=web)](https://github.com/OpenReloading/Ballistics/releases?q=web-v&expanded=true)
[![api](https://img.shields.io/github/v/release/OpenReloading/Ballistics?filter=api-v*&include_prereleases&label=api)](https://github.com/OpenReloading/Ballistics/releases?q=api-v&expanded=true)
[![core](https://img.shields.io/github/v/release/OpenReloading/Ballistics?filter=core-v*&include_prereleases&label=core)](https://github.com/OpenReloading/Ballistics/releases?q=core-v&expanded=true)
[![schema](https://img.shields.io/github/v/release/OpenReloading/Ballistics?filter=schema-v*&include_prereleases&label=schema)](https://github.com/OpenReloading/Ballistics/releases?q=schema-v&expanded=true)
[![data](https://img.shields.io/github/v/release/OpenReloading/Ballistics?filter=data-v*&include_prereleases&label=data)](https://github.com/OpenReloading/Ballistics/releases?q=data-v&expanded=true)
[![drawing](https://img.shields.io/github/v/release/OpenReloading/Ballistics?filter=drawing-v*&include_prereleases&label=drawing)](https://github.com/OpenReloading/Ballistics/releases?q=drawing-v&expanded=true)
[![importers](https://img.shields.io/github/v/release/OpenReloading/Ballistics?filter=importers-v*&include_prereleases&label=importers)](https://github.com/OpenReloading/Ballistics/releases?q=importers-v&expanded=true)
[![docs](https://img.shields.io/github/v/release/OpenReloading/Ballistics?filter=docs-v*&include_prereleases&label=docs)](https://github.com/OpenReloading/Ballistics/releases?q=docs-v&expanded=true)

**Alpha version:** breaking changes are to be expected in pages, features, data and file formats. The version is 0.0.1 until the first public release.

A ballistics database with interior and exterior ballistics simulations.

## What it does

- **Load workbench:** pressure and muzzle velocity of a load, and the bullet's trajectory.
- **Cartridges:** CIP dimensions and maximum pressures.
- **Session summary and shot groups:** chronograph statistics and group size from a target photo.

Every record names its sources.

Records in `packages/data/records/`: one cartridge record per C.I.P. sheet, target faces, shooting federations and their disciplines. The powder, bullet and manufacturer records are invented demo records (1 powder, 2 bullets, 2 manufacturers) for the example load, not real products.

## Run

Requires Node (version in `.nvmrc`), or a container engine.

```sh
npm ci
npm run build
npm start -w @openreloading/api                   # API on port 3000 (PORT), from the catalogue files of the build
npm start -w @openreloading/web -- -p 3001        # web app on port 3001, API at API_URL (default http://localhost:3000)
```

- Containers: `docker compose up` (or `podman compose up`) starts the database, the API, the web app and the documentation site.
- Documentation site: `npm run site:build -w @openreloading/docs` builds the model pages, the library and the REST reference.
- Pages edition (a static site without a server), after `npm run build` ([apps/web/AGENTS.md](apps/web/AGENTS.md#pages-edition)):
  - `PAGES_BASE_PATH=<path> npm run pages:build` writes `pages/`. `PAGES_BASE_PATH=<path> npm run pages:serve` serves it on port 3003 (`PORT`).
  - `PAGES_BASE_PATH`: the base path of the site, `''` or a path such as `/Ballistics`.
  - `PAGES_URL`: the site's origin.
- Checks: [CONTRIBUTING.md](CONTRIBUTING.md#before-a-pull-request). Commands, configuration and the dev container: [AGENTS.md](AGENTS.md).

Developed with the assistance of generative AI.

## Safety

Reloading ammunition is dangerous. This software helps you plan, simulate and document. It does not replace published load data, the instructions of your component and equipment makers, or safe practice.

- Results are simulations, not load data. Never use a result as a charge weight or as proof that a load is safe. Start from load data published by the powder or bullet maker for your exact components.
- Simulated pressures carry model and input uncertainty. The shown ranges do not include model error. The absence of a warning does not mean a load is safe.
- Component lots, cases, chambers and barrels differ. Measured pressure and velocity can differ from any simulation.
- Measurements, statistics, group sizes, scores and records shown here can contain errors from the models, the data or your inputs.

Reloading and shooting are done at your own risk. This software comes without warranty of any kind, and its authors are not liable for any damage or injury arising from its use.

## Community and contributing

- Questions and ideas: [GitHub Discussions](https://github.com/OpenReloading/Ballistics/discussions) and [Discord](https://discord.gg/KkYJ5fdukR).
- Bugs, features and record requests: [issues](https://github.com/OpenReloading/Ballistics/issues/new/choose).
- How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md).
- Security reports: [security policy](https://github.com/OpenReloading/.github/blob/main/SECURITY.md).
- Releases and versions: [release.md](apps/docs/docs/release.md).

## License

- Code: MIT, see [LICENSE](LICENSE).
- Data records (`packages/data/records/`): CC BY 4.0, see [packages/data/LICENSE](packages/data/LICENSE). Sources with their own terms name them in `license`.
- The Ballistics logo: [OpenReloading/Artwork](https://github.com/OpenReloading/Artwork) (MIT), see [NOTICE](NOTICE).
