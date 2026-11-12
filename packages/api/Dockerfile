# Build context: repository root (docker build -f packages/api/Dockerfile .)
FROM docker.io/library/node:26-trixie-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072 AS build
# pnpm as .github/pnpm/package-lock.json pins it; its native binary comes as an optional dependency, so no install script runs
COPY .github/pnpm /opt/pnpm
RUN cd /opt/pnpm && npm ci --ignore-scripts --no-audit --no-fund && ln -s /opt/pnpm/node_modules/.bin/pnpm /usr/local/bin/pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/units/package.json packages/units/
COPY packages/locale-format/package.json packages/locale-format/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/ui/package.json packages/ui/
COPY packages/statistics/package.json packages/statistics/
COPY packages/ballistics/package.json packages/ballistics/
COPY packages/shot-groups/package.json packages/shot-groups/
COPY packages/schema/package.json packages/schema/
COPY packages/importers/package.json packages/importers/
COPY packages/catalog/package.json packages/catalog/
COPY packages/use-cases/package.json packages/use-cases/
COPY packages/target-recognition/package.json packages/target-recognition/
COPY packages/api/package.json packages/api/
COPY packages/drawing/package.json packages/drawing/
COPY packages/cli/package.json packages/cli/
COPY apps/web/package.json apps/web/
COPY tools/package.json tools/
COPY apps/e2e/package.json apps/e2e/
COPY apps/docs/package.json apps/docs/
COPY tooling/test-kit/package.json tooling/test-kit/
# tools: the catalog build writes its bundle with the catalog reader of tools/src/catalog
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@open-reloading/api..." --filter @open-reloading/tools
# the API Extractor configuration that the builds of the packages extend
COPY packages/api-extractor.base.json packages/
COPY packages/units packages/units
COPY packages/statistics packages/statistics
COPY packages/ballistics packages/ballistics
COPY packages/schema packages/schema
COPY packages/catalog packages/catalog
COPY packages/use-cases packages/use-cases
COPY packages/api packages/api
COPY tools/src/catalog tools/src/catalog
# statistics' tests draw on the test kit, a dev dependency the filter builds too
COPY tooling/test-kit tooling/test-kit
RUN pnpm --filter "@open-reloading/api..." run build

FROM docker.io/library/node:26-trixie-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072
ENV NODE_ENV=production
# pnpm as .github/pnpm/package-lock.json pins it; its native binary comes as an optional dependency, so no install script runs
COPY .github/pnpm /opt/pnpm
RUN cd /opt/pnpm && npm ci --ignore-scripts --no-audit --no-fund && ln -s /opt/pnpm/node_modules/.bin/pnpm /usr/local/bin/pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/units/package.json packages/units/
COPY packages/locale-format/package.json packages/locale-format/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/ui/package.json packages/ui/
COPY packages/statistics/package.json packages/statistics/
COPY packages/ballistics/package.json packages/ballistics/
COPY packages/shot-groups/package.json packages/shot-groups/
COPY packages/schema/package.json packages/schema/
COPY packages/importers/package.json packages/importers/
COPY packages/catalog/package.json packages/catalog/
COPY packages/use-cases/package.json packages/use-cases/
COPY packages/target-recognition/package.json packages/target-recognition/
COPY packages/api/package.json packages/api/
COPY packages/drawing/package.json packages/drawing/
COPY packages/cli/package.json packages/cli/
COPY apps/web/package.json apps/web/
COPY tools/package.json tools/
COPY apps/e2e/package.json apps/e2e/
COPY apps/docs/package.json apps/docs/
COPY tooling/test-kit/package.json tooling/test-kit/
# The image runs node only: pnpm and npm are removed after the install.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter "@open-reloading/api..." \
  && rm -rf /opt/pnpm /usr/local/bin/pnpm /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/packages/units/dist packages/units/dist
COPY --from=build /app/packages/statistics/dist packages/statistics/dist
COPY --from=build /app/packages/ballistics/dist packages/ballistics/dist
COPY --from=build /app/packages/schema/dist packages/schema/dist
COPY --from=build /app/packages/catalog/dist packages/catalog/dist
COPY --from=build /app/packages/use-cases/dist packages/use-cases/dist
COPY --from=build /app/packages/api/dist packages/api/dist
COPY LICENSE NOTICE ./
COPY packages/catalog/LICENSE packages/catalog/
WORKDIR /app/packages/api
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
