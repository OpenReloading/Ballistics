<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="apps/web/src/assets/ballistics-dark.svg"><img src="apps/web/src/assets/ballistics-light.svg" width="360" alt="RangeFoundry Workbench"></picture></p>

# RangeFoundry Workbench

[![Sponsor](https://img.shields.io/badge/Sponsor-eikelandin-db61a2?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/eikelandin)
[![CI](https://github.com/OpenReloading/Ballistics/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/OpenReloading/Ballistics/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/OpenReloading/Ballistics/badge)](https://scorecard.dev/viewer/?uri=github.com/OpenReloading/Ballistics)
[![License: AGPL-3.0-only, CC-BY-SA-4.0 data, MIT docs](https://img.shields.io/badge/license-AGPL--3.0--only%20%2B%20CC--BY--SA--4.0%20data-blue)](REUSE.toml)
[![Release](https://img.shields.io/github/v/release/OpenReloading/Ballistics?filter=web-v*)](https://github.com/OpenReloading/Ballistics/releases)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/hUCSjDYNaa)

Simulate a handload before you take it to the range: muzzle velocity, peak pressure against the C.I.P. limit, and the bullet's trajectory, from cartridge, bullet, powder and firearm records that each name their source. The same app summarizes a chronograph session and measures group size from a target photo.

It is for handloaders who want to see what a load does on paper, and for developers who want the same models as TypeScript packages or a REST API.

**Alpha version:** breaking changes are to be expected in pages, features, data and file formats.

## Try it

Open the [live demo](https://openreloading.github.io/Ballistics/), a static site: the calculations, your firearms and your photos stay in your browser. The [documentation](https://openreloading.github.io/Ballistics/docs/) covers each model, the data formats, the packages and the REST API.

To run it yourself, with Node (version in `.nvmrc`):

```sh
pnpm install
pnpm run build
pnpm run dev:static                        # web app on port 3000, reading data files, no API needed
PORT=3010 pnpm --filter @rangefoundry/api start  # REST API on port 3010
```

To host the web app, run `pnpm run pages:build` (set `PAGES_BASE_PATH` to the path it is served under, empty for a site root) and copy `pages/` to any static host. The REST API is the container image `ghcr.io/openreloading/ballistics-api`, published with each API release (`docker run -p 3000:3000 ghcr.io/openreloading/ballistics-api:<version>`). `docker compose up` (or `podman compose up`) builds and starts the API on port 3000 and the documentation on port 3002. The libraries `schema`, `svg-drawings`, `importers` and `data` are in `packages/` and tagged in [GitHub releases](https://github.com/OpenReloading/Ballistics/releases). Setup and the dev container: [CONTRIBUTING.md](CONTRIBUTING.md).

## Data

The records in `packages/catalog/records/` hold one cartridge record per C.I.P. sheet, target faces, shooting federations and their disciplines, bullets, powders, case capacities and manufacturers. Bullet, powder and manufacturer records cite the maker's own publication, case capacity records cite Wikipedia (CC BY-SA 4.0); powders carry model parameters fitted to the makers' load tables. Data a maker published carries no project license, the fitted parameters are under the data license (`packages/catalog/LICENSE`). The demo bullet, powder, case, primer and manufacturer records are invented, for the tests.

## Safety

Reloading ammunition is dangerous: excess pressure can destroy a firearm and injure or kill. This software helps you plan, simulate and document. It does not replace published load data, the instructions of your component and equipment makers, or safe practice.

- Results are simulations, not load data. Never use a result as a charge weight or as proof that a load is safe.
- Measured pressure and velocity can differ greatly from any simulation. The shown ranges do not include model error. The absence of a warning does not mean a load is safe.
- Small input errors can change the predicted pressure a lot, and stored values may not match your components. Measure what you can: case capacity, bullet dimensions, seating depth, bullet jump, barrel and chamber dimensions, temperature.
- Work up in small steps from the start charge published by the powder or bullet maker for your exact components, and check every step yourself. Never exceed the published maximum.
- Measurements, statistics, group sizes, scores and records shown here can contain errors.

Reloading and shooting are at your own risk: you are responsible for your inputs, loads and safety checks.

## Community and contributing

- Questions and ideas: [GitHub Discussions](https://github.com/OpenReloading/Ballistics/discussions) and [Discord](https://discord.gg/hUCSjDYNaa).
- Bugs, features and record requests: [issues](https://github.com/OpenReloading/Ballistics/issues/new/choose).
- How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md).
- Security reports: [security policy](https://github.com/OpenReloading/.github/blob/main/SECURITY.md).
- Releases and versions: [release.md](apps/docs/docs/release.md).

## License

- Code (apps, packages, tools, tests, scripts and the training code): AGPL-3.0-only, see [LICENSE](LICENSE). The design tokens (`packages/design-tokens/`), which other projects use, are MIT.
- Documentation (`apps/docs/docs/` and the Markdown files, except the `*.api.md` API reports generated from the code): MIT, see [LICENSES/MIT.txt](LICENSES/MIT.txt).
- Data records (`packages/catalog/records/`): each source states its license in its `license` field, data from a source without one is CC BY-SA 4.0, except data a maker published (a source with `origin` `manufacturer`), which carries no project license (see [packages/catalog/LICENSE](packages/catalog/LICENSE)).
- The Ballistics name and logo: no open license, see [LICENSES/LicenseRef-Brand.txt](LICENSES/LicenseRef-Brand.txt) and [NOTICE](NOTICE).
- The hole-detection model weights and the synthetic training photos: CC-BY-SA-4.0, see [LICENSES/CC-BY-SA-4.0.txt](LICENSES/CC-BY-SA-4.0.txt).
