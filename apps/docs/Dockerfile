# Build context: repository root (docker build -f apps/docs/Dockerfile .)
FROM docker.io/library/node:26-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
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
RUN npm ci --ignore-scripts -w @open-reloading/schema -w @open-reloading/core -w @open-reloading/drawing -w @open-reloading/importers -w @open-reloading/data -w @open-reloading/api -w @open-reloading/docs
COPY packages packages
RUN npm run build -w @open-reloading/schema -w @open-reloading/core -w @open-reloading/drawing -w @open-reloading/importers -w @open-reloading/data -w @open-reloading/api
COPY apps/docs apps/docs
# the API the REST page links to, no link when unset
ARG API_URL
RUN npm run site:build -w @open-reloading/docs

# unprivileged variant: listens on 8080, runs as `nginx`
FROM docker.io/nginxinc/nginx-unprivileged:1.31-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e
COPY apps/docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/docs/build /usr/share/nginx/html
COPY LICENSE NOTICE /usr/share/nginx/html/
USER nginx
EXPOSE 8080
