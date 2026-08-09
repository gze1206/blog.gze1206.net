# NOR-138 final review fix report

## Findings

- P1: CMS authoring and release documents place the GitHub App callback beneath `/keystatic/api`, while the real Astro route and Keystatic redirect URI use `/api/keystatic/github/oauth/callback`.
- P1: The release checklist invokes the root `wrangler.jsonc`, which intentionally has no Worker `main`/`assets`; deployment must use Astro's generated `dist/server/wrangler.json`.

## Required outcome

- Use exactly `/api/keystatic/github/oauth/callback` in every owner-facing CMS setup document and the CMS publishing plan.
- Use `pnpm exec wrangler deploy --config dist/server/wrangler.json` in the Worker deployment checklist, retaining the instruction to build before deployment.
- Do not execute deployment/authentication or introduce credentials; validate documentation references against the route and generated configuration.

## Changes

- `docs/operations/cms-authoring.md`, `docs/release-readiness.md`, and the CMS publishing plan now use the
  actual catch-all API route callback: `/api/keystatic/github/oauth/callback`.
- The release checklist now requires `pnpm build` followed by
  `pnpm exec wrangler deploy --config dist/server/wrangler.json`. The root `wrangler.jsonc` name and
  compatibility flags remain unchanged.

## Verification

- Compared the callback documentation with `src/pages/api/keystatic/[...params].ts`, whose filesystem route
  resolves to `/api/keystatic/[...params]` and therefore serves the callback path.
- Confirmed `dist/server/wrangler.json` is the generated deploy configuration: it defines `main: "entry.mjs"`
  and the `../client` Assets directory, while root `wrangler.jsonc` retains only project-level name and
  compatibility settings.
- Ran `pnpm format`, `pnpm lint`, and `pnpm build` after the documentation correction.

## Commit

- `🐛 fix(docs): CMS 콜백과 Worker 배포 경로 보완 (NOR-138)`

## External residual risks

- No Cloudflare deployment, authentication, secret registration, or credentials handling was performed.
- GitHub App callback registration, Cloudflare Access, Worker secret registration, and real-device/production
  validation remain owner-operated external approval steps.
