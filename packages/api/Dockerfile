# Build context: repository root (docker build -f packages/api/Dockerfile .)
FROM docker.io/library/node:26-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9 AS build
# pnpm as .github/pnpm/package-lock.json pins it; its native binary comes as an optional dependency, so no install script runs
COPY .github/pnpm /opt/pnpm
RUN cd /opt/pnpm && npm ci --ignore-scripts --no-audit --no-fund && ln -s /opt/pnpm/node_modules/.bin/pnpm /usr/local/bin/pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/units/package.json packages/units/
COPY packages/schema/package.json packages/schema/
COPY packages/importers/package.json packages/importers/
COPY packages/core/package.json packages/core/
COPY packages/data/package.json packages/data/
COPY packages/api/package.json packages/api/
COPY packages/drawing/package.json packages/drawing/
COPY packages/cli/package.json packages/cli/
COPY apps/web/package.json apps/web/
COPY tools/package.json tools/
COPY apps/e2e/package.json apps/e2e/
COPY apps/docs/package.json apps/docs/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@open-reloading/api..."
COPY packages/units packages/units
COPY packages/schema packages/schema
COPY packages/core packages/core
COPY packages/data packages/data
COPY packages/api packages/api
RUN pnpm --filter "@open-reloading/api..." run build

FROM docker.io/library/node:26-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9
ENV NODE_ENV=production
# pnpm as .github/pnpm/package-lock.json pins it; its native binary comes as an optional dependency, so no install script runs
COPY .github/pnpm /opt/pnpm
RUN cd /opt/pnpm && npm ci --ignore-scripts --no-audit --no-fund && ln -s /opt/pnpm/node_modules/.bin/pnpm /usr/local/bin/pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/units/package.json packages/units/
COPY packages/schema/package.json packages/schema/
COPY packages/importers/package.json packages/importers/
COPY packages/core/package.json packages/core/
COPY packages/data/package.json packages/data/
COPY packages/api/package.json packages/api/
COPY packages/drawing/package.json packages/drawing/
COPY packages/cli/package.json packages/cli/
COPY apps/web/package.json apps/web/
COPY tools/package.json tools/
COPY apps/e2e/package.json apps/e2e/
COPY apps/docs/package.json apps/docs/
# The image runs node only: pnpm and npm are removed after the install.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter "@open-reloading/api..." \
  && rm -rf /opt/pnpm /usr/local/bin/pnpm /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/packages/units/dist packages/units/dist
COPY --from=build /app/packages/schema/dist packages/schema/dist
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/data/dist packages/data/dist
COPY --from=build /app/packages/api/dist packages/api/dist
COPY LICENSE NOTICE ./
COPY packages/data/LICENSE packages/data/
WORKDIR /app/packages/api
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
