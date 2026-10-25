# Build context: repository root (docker build -f apps/web/Dockerfile .)
FROM docker.io/library/node:26-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY patches patches
COPY packages/schema/package.json packages/schema/
COPY packages/importers/package.json packages/importers/
COPY packages/core/package.json packages/core/
COPY packages/data/package.json packages/data/
COPY packages/api/package.json packages/api/
COPY packages/drawing/package.json packages/drawing/
COPY apps/web/package.json apps/web/
COPY tools/package.json tools/
COPY apps/e2e/package.json apps/e2e/
COPY apps/docs/package.json apps/docs/
RUN npm ci --ignore-scripts -w @open-reloading/web -w @open-reloading/core -w @open-reloading/drawing -w @open-reloading/importers -w @open-reloading/schema -w @open-reloading/data -w @open-reloading/api && node patches/apply.mjs
COPY tsconfig.base.json ./
COPY packages/schema packages/schema
COPY packages/importers packages/importers
COPY packages/core packages/core
COPY packages/drawing packages/drawing
# the web app imports @open-reloading/data/plausibility only: no records, no bundle
COPY packages/data/tsconfig.json packages/data/tsconfig.build.json packages/data/tsconfig.plausibility.json packages/data/
COPY packages/data/src/plausibility.ts packages/data/src/
# and @open-reloading/api/compute and /catalogue only (the Pages edition's compute and catalogue in the browser)
COPY packages/api/tsconfig.json packages/api/tsconfig.build.json packages/api/tsconfig.browser.json packages/api/
COPY packages/api/src/compute packages/api/src/compute
COPY packages/api/src/catalogue packages/api/src/catalogue
RUN npm run build -w @open-reloading/schema && npm run build -w @open-reloading/importers && npm run build -w @open-reloading/core && npm run build -w @open-reloading/drawing && node_modules/.bin/tsc -p packages/data/tsconfig.plausibility.json && node_modules/.bin/tsc -p packages/api/tsconfig.browser.json
COPY apps/web apps/web
RUN npm run build -w @open-reloading/web && rm -rf apps/web/.next/standalone/node_modules/sharp apps/web/.next/standalone/node_modules/@img

FROM docker.io/library/node:26-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static apps/web/.next/static
# the service worker (written by the build) and the 192 px icon
COPY --from=build --chown=node:node /app/apps/web/public apps/web/public
COPY LICENSE NOTICE ./
COPY packages/data/LICENSE packages/data/
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
