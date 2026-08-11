import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const required = ['index.html', 'blog/index.html', 'rss.xml', 'sitemap-index.xml', 'robots.txt'];
const forbidden = ['keystatic', 'api/keystatic'];
for (const path of required)
  if (!existsSync(resolve('dist', path))) throw new Error(`missing ${path}`);
for (const path of forbidden)
  if (existsSync(resolve('dist', path))) throw new Error(`unexpected dynamic output: ${path}`);
