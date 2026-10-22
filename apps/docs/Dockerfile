# Build context: repository root (docker build -f apps/docs/Dockerfile .)
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
RUN npm ci -w @openreloading/schema -w @openreloading/core -w @openreloading/drawing -w @openreloading/importers -w @openreloading/data -w @openreloading/api -w @openreloading/docs
COPY packages packages
RUN npm run build -w @openreloading/schema -w @openreloading/core -w @openreloading/drawing -w @openreloading/importers -w @openreloading/data -w @openreloading/api
COPY apps/docs apps/docs
# the API the REST page links to, no link when unset
ARG API_URL
# the web app the navbar links to, no link when unset
ARG APP_URL
RUN npm run site:build -w @openreloading/docs

FROM docker.io/library/nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de
COPY apps/docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/docs/build /usr/share/nginx/html
COPY LICENSE NOTICE /usr/share/nginx/html/
