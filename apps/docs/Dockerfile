# Build context: repository root (docker build -f apps/docs/Dockerfile .)
FROM docker.io/library/node:26-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe AS build
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
COPY packages/api/package.json packages/api/
COPY packages/drawing/package.json packages/drawing/
COPY packages/cli/package.json packages/cli/
COPY apps/web/package.json apps/web/
COPY tools/package.json tools/
COPY apps/e2e/package.json apps/e2e/
COPY apps/docs/package.json apps/docs/
COPY tooling/test-kit/package.json tooling/test-kit/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@open-reloading/docs..."
COPY packages packages
COPY tooling tooling
# the catalog reader that the catalog build writes its bundle with
COPY tools/src/catalog tools/src/catalog
# the libraries the docs document and the API its REST page describes (the docs also depend on web, cli and tools,
# whose files their tests read; the site needs no build of them)
RUN pnpm --filter "@open-reloading/api..." --filter "@open-reloading/drawing..." --filter "@open-reloading/importers..." run build
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
