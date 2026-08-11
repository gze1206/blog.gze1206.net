import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { verifyHomeContentIntegration } from './verify-home-content-integration.mjs';

it('visible experience loader가 없는 홈을 거부한다', () => {
  const source = `
    getProfile
    profile.data.name
    profile.data.headline
    profile.data.introduction
    experiences.length > 0
  `;

  expect(verifyHomeContentIntegration(source)).toEqual([
    'home must load visible experiences through getVisibleExperiences',
    'home must render profile skills',
  ]);
});

it('홈은 프로필과 공개 경력을 콘텐츠 경계로 연결한다', async () => {
  const source = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

  expect(verifyHomeContentIntegration(source)).toEqual([]);
});

it('홈이 experience 컬렉션을 직접 읽으면 거부한다', () => {
  const source = `
    getProfile
    getVisibleExperiences
    profile.data.name
    profile.data.headline
    profile.data.introduction
    profile.data.skills.map
    experiences.length > 0
    getCollection('experience')
  `;

  expect(verifyHomeContentIntegration(source)).toEqual([
    'home must not read experience collections directly',
  ]);
});
