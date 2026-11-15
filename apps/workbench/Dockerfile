# 저장소 루트를 빌드 컨텍스트로 쓴다:
#   docker buildx build --platform linux/arm64 -f apps/workbench/Dockerfile .
ARG NODE_VERSION=26

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /repo
# Node 25 부터 corepack 이 빠졌다. packageManager 필드의 pnpm 을 그대로 설치한다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN npm install --global "$(node -p "require('./package.json').packageManager")"
COPY apps/blog/package.json apps/blog/
COPY apps/workbench/package.json apps/workbench/
COPY packages/config/package.json packages/config/
COPY packages/content-contract/package.json packages/content-contract/
COPY packages/repo-tools/package.json packages/repo-tools/
RUN pnpm install --frozen-lockfile --filter "@gze1206/workbench..."
COPY packages/config packages/config
COPY packages/content-contract packages/content-contract
COPY apps/workbench apps/workbench
RUN pnpm --filter @gze1206/workbench build \
  && pnpm --filter @gze1206/workbench --prod deploy --legacy /out

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 10001 workbench \
  && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin workbench
ENV HOME=/home/workbench
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=build --chown=10001:10001 /out ./
USER 10001:10001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(async response => { if (!response.ok || (await response.json()).status !== 'ready') process.exit(1) }).catch(() => process.exit(1))"]
CMD ["node", "dist/server/index.js"]
