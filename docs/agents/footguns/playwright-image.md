# The pinned Playwright image

Read before changing the e2e job of `.github/workflows/ci.yml`, `apps/e2e/scripts/baseline.sh` or the `@playwright/test` version.

- CI runs the e2e tests and the drawing baseline in `PLAYWRIGHT_IMAGE` (`ci.yml` env), the official image pinned by digest. It holds the browsers and the fonts they render with; the runner installs no browser.
- A `@playwright/test` update (catalog in `pnpm-workspace.yaml`) changes in the same pull request:
  - `PLAYWRIGHT_IMAGE` in `ci.yml`, tag and digest. The digest of a tag: `curl -sSI -H 'Accept: application/vnd.oci.image.index.v1+json' https://mcr.microsoft.com/v2/playwright/manifests/v<version>-noble | grep -i docker-content-digest`.
  - The version in `.devcontainer/Dockerfile` (the headless shell of the dev container).
- Dependabot does not read the workflow image. The e2e job's pull step fails when the image's tag, or the Playwright version the pulled image records, is not the locked one.
- Snapshots of the drawing baseline are rendered with the image's fonts: update them only in the image, `sh apps/e2e/scripts/baseline.sh --update-snapshots` (Docker or Podman, against the served export), never with a browser of the host.
