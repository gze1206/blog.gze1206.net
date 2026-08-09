import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const workerEntrypoint = 'dist/server/entry.mjs';
const prerenderedHome = 'dist/client/index.html';

if (!existsSync(resolve(workerEntrypoint))) {
  throw new Error('Cloudflare Worker entrypoint was not generated');
}

if (!existsSync(resolve(prerenderedHome))) {
  throw new Error('Prerendered public home page was not generated');
}
