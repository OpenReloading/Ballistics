<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="apps/web/src/assets/ballistics-dark.svg"><img src="apps/web/src/assets/ballistics-light.svg" width="360" alt="OpenReloading Ballistics"></picture></p>

# OpenReloading

[![CI](https://github.com/OpenReloading/Ballistics/actions/workflows/ci.yml/badge.svg)](https://github.com/OpenReloading/Ballistics/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/KkYJ5fdukR)

Simulate a handload before you take it to the range: muzzle velocity, peak pressure against the C.I.P. limit, and the bullet's trajectory, from cartridge, bullet, powder and firearm records that each name their source. The same app summarizes a chronograph session and measures group size from a target photo.

It is for handloaders who want to see what a load does on paper, and for developers who want the same models as TypeScript packages or a REST API.

**Alpha version:** breaking changes are to be expected in pages, features, data and file formats.

## Try it

Open the [live demo](https://openreloading.github.io/Ballistics/), a static site: the calculations, your firearms and your photos stay in your browser. The [documentation](https://openreloading.github.io/Ballistics/docs/) covers each model, the data formats, the packages and the REST API.

To run it yourself, with Node (version in `.nvmrc`):

```sh
npm ci
npm run build
npm start -w @open-reloading/api              # API on port 3000
npm start -w @open-reloading/web -- -p 3001   # web app on port 3001, in a second terminal
```

`docker compose up` (or `podman compose up`) starts the API, the web app on port 3001 and the documentation on port 3002. The libraries `schema`, `core`, `drawing`, `importers` and `data` are in `packages/` and tagged in [GitHub releases](https://github.com/OpenReloading/Ballistics/releases). Other commands and the dev container: [AGENTS.md](AGENTS.md).

## Data

The records in `packages/data/records/` are one cartridge record per C.I.P. sheet, target faces, shooting federations and their disciplines. The powder, bullet, case and manufacturer records are invented demo records for the example load, not real products.

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

Developed with the assistance of generative AI.
