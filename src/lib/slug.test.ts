import { describe, expect, it } from 'vitest';
import { EmptySlugError, toSlug } from './slug';

describe('toSlug', () => {
  it('영문은 소문자 kebab-case 로 만든다', () => {
    expect(toSlug('TypeScript')).toBe('typescript');
    expect(toSlug('Web Performance')).toBe('web-performance');
    expect(toSlug('  Hello   World  ')).toBe('hello-world');
  });

  it('한글은 보존하고 공백만 하이픈으로 바꾼다', () => {
    expect(toSlug('웹 성능')).toBe('웹-성능');
    expect(toSlug('회고')).toBe('회고');
    expect(toSlug('닷넷 CLR 내부')).toBe('닷넷-clr-내부');
  });

  it('# 와 + 는 음차해서 언어 이름 충돌을 막는다', () => {
    expect(toSlug('C#')).toBe('c-sharp');
    expect(toSlug('C++')).toBe('c-plus-plus');
    expect(toSlug('F#')).toBe('f-sharp');
    // 음차가 없으면 'C#' 과 'C' 가 같은 슬러그가 되어 조용히 병합된다.
    expect(toSlug('C#')).not.toBe(toSlug('C'));
  });

  it('구분자·기호를 정리한다', () => {
    expect(toSlug('.NET')).toBe('net');
    expect(toSlug('front_end/back_end')).toBe('front-end-back-end');
    expect(toSlug('a---b')).toBe('a-b');
    expect(toSlug('!!!hello!!!')).toBe('hello');
  });

  it('같은 입력은 항상 같은 출력이다 (결정적)', () => {
    const input = 'Astro & 웹 성능';
    expect(toSlug(input)).toBe(toSlug(input));
    expect(toSlug(input)).toBe('astro-웹-성능');
  });

  it('NFKC 정규화로 호환 문자를 통일한다', () => {
    // 전각 영문 → 반각
    expect(toSlug('ＴＳ')).toBe('ts');
    // 자모 분리(NFD) 로 들어온 한글도 완성형과 같은 슬러그가 된다.
    expect(toSlug('웹'.normalize('NFD'))).toBe(toSlug('웹'));
  });

  it('변환 결과가 비면 예외를 던진다', () => {
    expect(() => toSlug('!!!')).toThrow(EmptySlugError);
    expect(() => toSlug('   ')).toThrow(EmptySlugError);
    expect(() => toSlug('')).toThrow(EmptySlugError);
  });
});
