import { describe, expect, it } from 'vitest';
import { createHeadingIdFactory, FALLBACK_HEADING_ID, toHeadingId } from './heading-id';
import { toSlug } from './slug';

describe('toHeadingId', () => {
  it('한글 헤딩은 한글 id 로 보존한다', () => {
    expect(toHeadingId('설치하기')).toBe('설치하기');
    expect(toHeadingId('왜 컬렉션인가')).toBe('왜-컬렉션인가');
  });

  it('영문은 소문자 kebab-case 로 만든다', () => {
    expect(toHeadingId('Getting Started')).toBe('getting-started');
  });

  it('카테고리·태그 슬러그와 같은 규칙을 쓴다', () => {
    for (const text of ['C# 기초', '.NET CIL', '웹 성능', 'Astro & 성능']) {
      expect(toHeadingId(text)).toBe(toSlug(text));
    }
  });

  it('슬러그가 비는 헤딩은 예외 대신 대체 id 를 준다', () => {
    // toSlug 는 여기서 EmptySlugError 를 던진다. 헤딩 하나 때문에 빌드를 세우지 않는다.
    expect(toHeadingId('???')).toBe(FALLBACK_HEADING_ID);
    expect(toHeadingId('  ')).toBe(FALLBACK_HEADING_ID);
  });

  it('같은 입력은 항상 같은 출력이다 (영구 링크 안정성)', () => {
    expect(toHeadingId('스택 머신')).toBe(toHeadingId('스택 머신'));
  });
});

describe('createHeadingIdFactory', () => {
  it('처음 등장한 텍스트는 접미 번호 없이 준다', () => {
    const nextId = createHeadingIdFactory();
    expect(nextId('설치하기')).toBe('설치하기');
    expect(nextId('사용하기')).toBe('사용하기');
  });

  it('같은 텍스트가 반복되면 -2, -3 을 붙인다', () => {
    const nextId = createHeadingIdFactory();
    expect(nextId('예제')).toBe('예제');
    expect(nextId('예제')).toBe('예제-2');
    expect(nextId('예제')).toBe('예제-3');
  });

  it('생성된 id 와 겹치는 실제 헤딩이 있어도 충돌하지 않는다', () => {
    const nextId = createHeadingIdFactory();
    expect(nextId('예제')).toBe('예제');
    expect(nextId('예제 2')).toBe('예제-2');
    // '예제' 의 두 번째 후보 '예제-2' 는 이미 쓰였으므로 건너뛴다.
    expect(nextId('예제')).toBe('예제-3');
  });

  it('빈 슬러그 헤딩이 여러 개여도 유일하다', () => {
    const nextId = createHeadingIdFactory();
    expect(nextId('???')).toBe('section');
    expect(nextId('!!!')).toBe('section-2');
  });

  it('발급한 id 는 문서 안에서 전부 유일하다', () => {
    const nextId = createHeadingIdFactory();
    const texts = ['A', 'A', 'a', 'A 2', 'A', '???', '???', 'B'];
    const ids = texts.map(nextId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('문서마다 새 팩토리를 만들면 카운터가 새지 않는다', () => {
    expect(createHeadingIdFactory()('예제')).toBe('예제');
    expect(createHeadingIdFactory()('예제')).toBe('예제');
  });
});
