import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: 0,
  reporter: 'list',
  projects: [
    {
      name: 'production',
      testIgnore: '**/smoke-render.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4321' },
    },
    {
      name: 'smoke',
      testMatch: '**/smoke-render.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4322' },
    },
  ],
  webServer: [
    {
      command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4321',
      url: 'http://127.0.0.1:4321',
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command:
        'BLOG_SMOKE=1 pnpm exec astro build --outDir .astro/dist-smoke && pnpm exec astro preview --outDir .astro/dist-smoke --host 127.0.0.1 --port 4322',
      url: 'http://127.0.0.1:4322',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
