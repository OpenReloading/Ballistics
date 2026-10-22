FROM mcr.microsoft.com/devcontainers/typescript-node:26-bookworm@sha256:cdd6d07f8eee8726c7726fad160ba3006f4e6cfb89ff69ed2dc98ea26aac2530

# agent-side tools that run in the container: MCP servers for Mantine docs and Playwright
# the e2e headless shell too: keep 1.63.0 equal to @playwright/test in package-lock.json (postCreateCommand installs it on a mismatch)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npm i -g --prefix /usr/local @mantine/mcp-server@9.7.3 @playwright/mcp@0.0.83 \
  && cd /usr/local/lib/node_modules/@playwright/mcp && npx playwright install --with-deps chromium \
  && npx -y playwright@1.63.0 install --only-shell chromium \
  && chown -R node:node /ms-playwright \
  && npm cache clean --force && rm -rf /root/.npm/_npx

# API contract tools of `npm run api:check` and `npm run api:conformance`; keep the versions equal to the images in ci.yml
RUN arch=$(dpkg --print-architecture) \
  && case $arch in \
    amd64) sum=43a4e328e2d13ba1552d760aa68d2485c75c5621f309f6ff64ae895188345247 ;; \
    arm64) sum=4ae3c362d6074d919aada2dea82d0ee84366591600384455d0bdc658ddf8f7ae ;; \
  esac \
  && curl -fsSL -o /tmp/oasdiff.tar.gz https://github.com/oasdiff/oasdiff/releases/download/v1.33.0/oasdiff_1.33.0_linux_$arch.tar.gz \
  && echo "$sum  /tmp/oasdiff.tar.gz" | sha256sum -c - \
  && tar -xzf /tmp/oasdiff.tar.gz -C /usr/local/bin oasdiff \
  && rm /tmp/oasdiff.tar.gz
COPY --from=ghcr.io/astral-sh/uv:0.12.23@sha256:61d393e44e249f2e4b526b6c7ddcecce245946826e608e11c93ad4f5bba55b21 /uv /uvx /usr/local/bin/
RUN UV_TOOL_BIN_DIR=/usr/local/bin UV_TOOL_DIR=/opt/uv-tools UV_PYTHON_DOWNLOADS=never UV_NO_CACHE=1 \
  uv tool install schemathesis==4.29.4
