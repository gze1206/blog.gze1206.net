import { checkDomains, readLegacyPaths } from '../domains/check.ts';

// 네트워크를 쓰므로 verify·CI 에 넣지 않는다. 런칭 직후와 도메인 설정을 바꾼 뒤에 돌린다.
const failures = await checkDomains(fetch, {
  canonical: 'https://gze1206.net',
  aliases: ['www.gze1206.net', 'blog.gze1206.net'],
  probe: '/blog/new-things-on-this-blog/?ref=check-domains',
  legacyPaths: await readLegacyPaths(),
});
for (const failure of failures) console.error(failure);
console.log(`check:domains: ${failures.length} failures`);
if (failures.length) process.exitCode = 1;
