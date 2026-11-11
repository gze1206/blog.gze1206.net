import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4321' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // 빌드 산출물을 그대로 띄운다. dev 서버는 draft 를 보여 주므로 프로덕션과 다르다.
  webServer: {
    command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4321',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
