FROM node:22-bookworm-slim AS dependencies

RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src
RUN pnpm build

FROM dependencies AS production-dependencies

RUN pnpm prune --prod

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 10001 workbench \
  && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin workbench

ENV HOME=/home/workbench
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app
COPY --from=production-dependencies --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /app/dist ./dist
# 빈 작업 공간에 처음 부팅할 때 깔아 줄 기본 템플릿 (NOR-191).
COPY --chown=10001:10001 workspace-seed ./workspace-seed

USER 10001:10001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(async response => { if (!response.ok || (await response.json()).status !== 'ready') process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node", "dist/server/index.js"]
