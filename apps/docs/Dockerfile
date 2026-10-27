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
RUN npm ci --ignore-scripts -w @open-reloading/schema -w @open-reloading/core -w @open-reloading/drawing -w @open-reloading/importers -w @open-reloading/data -w @open-reloading/api -w @open-reloading/docs && node patches/apply.mjs
COPY packages packages
RUN npm run build -w @open-reloading/schema -w @open-reloading/core -w @open-reloading/drawing -w @open-reloading/importers -w @open-reloading/data -w @open-reloading/api
COPY apps/docs apps/docs
# the API the REST page links to, no link when unset
ARG API_URL
RUN npm run site:build -w @open-reloading/docs

# unprivileged variant: listens on 8080, runs as `nginx`
FROM docker.io/nginxinc/nginx-unprivileged:1.29-alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6
COPY apps/docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/docs/build /usr/share/nginx/html
COPY LICENSE NOTICE /usr/share/nginx/html/
USER nginx
EXPOSE 8080
