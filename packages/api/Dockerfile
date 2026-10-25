# Build context: repository root (docker build -f packages/api/Dockerfile .)
FROM docker.io/library/node:26-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
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
RUN npm ci --ignore-scripts -w @openreloading/schema -w @openreloading/core -w @openreloading/data -w @openreloading/api
COPY packages/schema packages/schema
COPY packages/core packages/core
COPY packages/data packages/data
COPY packages/api packages/api
RUN npm run build -w @openreloading/schema -w @openreloading/core -w @openreloading/data -w @openreloading/api

FROM docker.io/library/node:26-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe
ENV NODE_ENV=production
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
RUN npm ci --omit=dev --ignore-scripts -w @openreloading/schema -w @openreloading/core -w @openreloading/data -w @openreloading/api
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
