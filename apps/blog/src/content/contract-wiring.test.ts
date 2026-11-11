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
