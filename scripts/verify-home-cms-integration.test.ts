import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { verifyHomeCmsIntegration } from './verify-home-cms-integration.mjs';

it('visible experience loader가 없는 홈을 거부한다', () => {
  const source = `
    getProfile
    profile.data.name
    profile.data.headline
    profile.data.introduction
    profile.data.skills.map
    experiences.length > 0
  `;

  expect(verifyHomeCmsIntegration(source)).toEqual([
    'home must load visible experiences through getVisibleExperiences',
  ]);
});

it('홈은 프로필과 공개 경력을 CMS 경계로 연결한다', async () => {
  const source = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

  expect(verifyHomeCmsIntegration(source)).toEqual([]);
});
