import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist/server',
  clean: false,
  // 워크스페이스 패키지는 TS 소스를 내보낸다. 런타임 Node 는 node_modules 안의 TS 를 읽지 않으므로
  // 서버 번들에 넣는다. 그래서 이미지에는 이 패키지가 필요 없다.
  noExternal: ['@gze1206/content-contract'],
  esbuildOptions(options) {
    options.minifyWhitespace = true;
  },
});
