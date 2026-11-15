import { readFile } from 'node:fs/promises';
import { checkDomains, readLegacyPaths } from '../domains/check.ts';

// 블로그가 고정한 댓글 스크립트 해시. packages 는 apps 를 import 하지 않으므로 소스를 글자로 읽는다.
const commentsSource = await readFile(
  new URL('../../../../apps/blog/src/lib/comments.ts', import.meta.url),
  'utf8',
);
const integrity = /COMMENTS_SCRIPT_INTEGRITY =\s*'(sha384-[^']+)'/u.exec(commentsSource)?.[1];
if (integrity === undefined)
  throw new Error('apps/blog/src/lib/comments.ts 에서 SRI 해시를 찾지 못했다');

// 네트워크를 쓰므로 verify·CI 에 넣지 않는다. 런칭 직후와 도메인 설정을 바꾼 뒤에 돌린다.
const failures = await checkDomains(fetch, {
  canonical: 'https://gze1206.net',
  aliases: ['www.gze1206.net', 'blog.gze1206.net'],
  probes: ['/', '/blog/new-things-on-this-blog/?ref=check-domains'],
  hostileProbes: ['//evil.example/x?next=https://evil.example'],
  legacyPaths: await readLegacyPaths(),
  services: [{ url: 'https://comments.gze1206.net/comentario.js', integrity }],
});
for (const failure of failures) console.error(failure);
console.log(`check:domains: ${failures.length} failures`);
if (failures.length) process.exitCode = 1;
