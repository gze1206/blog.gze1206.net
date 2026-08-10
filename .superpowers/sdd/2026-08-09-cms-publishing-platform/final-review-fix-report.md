# NOR-20 final review fix report

## Finding

- P1: `src/pages/api/keystatic/[...params].ts` creates the generic Keystatic handler and dereferences Cloudflare `env` at module initialization. Cloudflare's importable environment is request-context scoped, so the Worker can fail or lack configuration before an API request is handled.

## Required outcome

- Construct the Keystatic handler only inside the API route request path, using the request-context environment.
- Preserve the current route contract and avoid embedding credentials in source or output.
- Add a focused regression test that fails against the eager module-level construction and passes only after request-scoped initialization.

## Status

Completed locally. The final branch review P1 is fixed; no external deployment/authentication was authorized or attempted.

## RED

- Added `src/lib/keystatic-api-route.test.ts`, which imports the real Astro API route with controlled Worker and Keystatic runtime boundaries.
- Before the implementation change, `pnpm test -- src/lib/keystatic-api-route.test.ts` failed because route import read `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, and `KEYSTATIC_SECRET` before any request.

## GREEN

- Moved `makeGenericAPIRouteHandler()` construction and all `env.KEYSTATIC_*` reads into `ALL`.
- The focused regression test now verifies that import reads no Worker secret values, while an API request preserves the handler's status, headers, and body response contract and reads the three values at request time.

## Changes

- `src/pages/api/keystatic/[...params].ts`: retain `prerender = false` and the existing route response bridge; make the Keystatic handler request scoped.
- `src/lib/keystatic-api-route.test.ts`: add the focused request-context regression test outside `src/pages` so Astro does not treat it as a route.
- No secret values were added to tracked source or output.

## Validation

- `pnpm test -- src/lib/keystatic-api-route.test.ts` — passed (31 files, 309 tests).
- `git diff --check`, `pnpm format:check`, `pnpm lint`, `pnpm test`, `pnpm build` — passed.
- Build retained pre-existing non-failing warnings: Vite chunk-size guidance and deliberately invalid smoke-content fallback warnings.

## Commit

- `🐛 fix(cms): Worker 환경값을 요청 시점에 읽음 (NOR-20)`.

## Remaining external verification risks

- Cloudflare Worker deployment with real request-context bindings, GitHub App authentication, Cloudflare Access, and preview/live CMS flows remain intentionally unperformed.
- Device authentication, custom-block/upload preview rendering, draft exclusion, and public RSS/sitemap/search evidence remain externally pending.
