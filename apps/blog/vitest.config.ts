import { defineConfig } from 'vitest/config';

// 지금까지 블로그 테스트는 설정 파일 없이 기본값으로 돌았다. 그 동작은 그대로 두고 커버리지만 더한다.
export default defineConfig({
  test: { coverage: { provider: 'v8', reporter: ['text-summary', 'html'] } },
});
