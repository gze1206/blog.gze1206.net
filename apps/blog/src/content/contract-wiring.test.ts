import {
  postSchema as contractPost,
  seriesSchema as contractSeries,
} from '@gze1206/content-contract';
import { describe, expect, it } from 'vitest';
import { postSchema, seriesSchema } from './schemas';

describe('계약 연결', () => {
  it('NOR-195 AC-5: 블로그의 글·시리즈 스키마는 계약 패키지의 것과 같은 객체다', () => {
    expect(postSchema).toBe(contractPost);
    expect(seriesSchema).toBe(contractSeries);
  });
});

it('NOR-196 AC-1: 블로그 bookSchema 는 계약의 것과 같은 객체다', async () => {
  const contract = await import('@gze1206/content-contract');
  const blog = await import('./schemas');
  expect(blog.bookSchema).toBe(contract.bookSchema);
});

it('NOR-208 AC-1: 블로그의 프로필·경력·포트폴리오 스키마는 계약의 것과 같은 객체다', async () => {
  const contract = (await import('@gze1206/content-contract')) as unknown as Record<
    string,
    unknown
  >;
  const blog = await import('./schemas');
  expect(contract['profileSchema']).toBeDefined();
  expect(blog.profileSchema).toBe(contract['profileSchema']);
  expect(blog.experienceSchema).toBe(contract['experienceSchema']);
  expect(blog.portfolioSchema).toBe(contract['portfolioSchema']);
});
