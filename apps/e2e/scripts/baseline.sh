#!/bin/sh
# Runs tests/web/drawing-baseline*.spec.ts in the Playwright image of the installed
# @playwright/test version, as CI does, so the image's fonts render the snapshots.
# DRAWING_BASELINE=full for the full set (drawing-baseline.spec.ts). WEB_URL as for the e2e tests (the exported site, `npm run pages:serve`, port 3003; Docker Desktop without host networking:
# http://host.docker.internal:3003); arguments go to `playwright test` (such as --update-snapshots).
set -eu
cd "$(dirname "$0")/../../.."
version=$(node -p "require('@playwright/test/package.json').version")
engine=$(command -v docker || command -v podman) || { echo 'baseline.sh: needs docker or podman' >&2; exit 1; }
# Docker runs the image as root, so the results and snapshots it writes would belong to root: run
# as the caller. Podman (also behind a docker command) and rootless Docker map root to the caller.
user="--user=$(id -u):$(id -g) --env=HOME=/tmp"
if "$engine" --version | grep -q podman ||
  "$engine" info --format '{{.SecurityOptions}}' | grep -q rootless; then user=; fi
# amd64 as on the CI runner, also on an arm64 host; :z relabels the checkout for SELinux hosts
exec "$engine" run --rm --platform=linux/amd64 --network=host --ipc=host $user \
  -v "$PWD:/work:z" -w /work/apps/e2e -e DRAWING_BASELINE="${DRAWING_BASELINE:-1}" -e WEB_URL="${WEB_URL:-http://localhost:3003}" \
  "mcr.microsoft.com/playwright:v$version-noble" \
  npx playwright test --project=full tests/web/drawing-baseline "$@"
