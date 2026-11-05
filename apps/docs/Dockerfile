# Build context: repository root (docker build -f apps/docs/Dockerfile .)
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
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@open-reloading/docs..."
COPY packages packages
# the libraries the docs document and the API its REST page describes: every workspace the docs depend on
RUN pnpm --filter "@open-reloading/docs^..." run build
COPY apps/docs apps/docs
# the API the REST page links to, no link when unset
ARG API_URL
RUN pnpm --filter @open-reloading/docs run site:build

# unprivileged variant: listens on 8080, runs as `nginx`
FROM docker.io/nginxinc/nginx-unprivileged:1.31-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e
COPY apps/docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/docs/build /usr/share/nginx/html
COPY LICENSE NOTICE /usr/share/nginx/html/
USER nginx
EXPOSE 8080
