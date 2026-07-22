import { describe, expect, it } from 'vitest';
import {
  charWidth,
  estimateTextWidth,
  fitTitle,
  normalizeText,
  truncateChars,
  wrapText,
} from './og-text';

describe('charWidth', () => {
  it('한글 음절·자모·한자는 1em 이다', () => {
    expect(charWidth('가')).toBe(1);
    expect(charWidth('ㄱ')).toBe(1);
    expect(charWidth('漢')).toBe(1);
  });

  it('라틴은 1em 보다 좁다', () => {
    expect(charWidth('a')).toBeLessThan(1);
    expect(charWidth('i')).toBeLessThan(charWidth('a'));
    expect(charWidth('W')).toBeGreaterThan(charWidth('a'));
    expect(charWidth(' ')).toBeLessThan(charWidth('i'));
  });

  it('빈 문자열은 0 이다', () => {
    expect(charWidth('')).toBe(0);
  });
});

describe('estimateTextWidth', () => {
  it('한글 n 글자는 n em 이다', () => {
    expect(estimateTextWidth('한글제목')).toBe(4);
  });

  it('같은 글자 수라도 한글이 라틴보다 넓다', () => {
    expect(estimateTextWidth('가나다라')).toBeGreaterThan(estimateTextWidth('abcd'));
  });
});

describe('normalizeText', () => {
  it('연속 공백·개행을 하나로 접고 양끝을 다듬는다', () => {
    expect(normalizeText('  한글\n  제목   테스트 ')).toBe('한글 제목 테스트');
  });
});

describe('wrapText', () => {
  it('한글은 글자 단위로 끊는다', () => {
    expect(wrapText('가나다라마바', 3)).toEqual(['가나다', '라마바']);
  });

  it('라틴은 단어 단위로 끊는다 (단어를 쪼개지 않는다)', () => {
    // 'hello'(약 2.4em) + ' ' + 'world' → 3em 상한이면 두 줄
    const lines = wrapText('hello world', 3);
    expect(lines).toEqual(['hello', 'world']);
  });

  it('한 단어가 줄보다 길면 그 안에서 강제로 끊는다', () => {
    const lines = wrapText('Internationalization', 2);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('Internationalization');
  });

  it('줄 끝 공백을 다음 줄로 흘리지 않는다', () => {
    for (const line of wrapText('가나 다라 마바 사아', 2)) {
      expect(line).toBe(line.trim());
    }
  });

  it('빈 문자열은 줄이 없다', () => {
    expect(wrapText('   ', 10)).toEqual([]);
  });

  it('상한이 0 이하여도 던지지 않는다', () => {
    expect(wrapText('가나다', 0)).toEqual(['가나다']);
  });
});

describe('truncateChars', () => {
  it('상한 이하면 그대로 둔다', () => {
    expect(truncateChars('한글 제목', 10)).toBe('한글 제목');
  });

  it('상한을 넘으면 … 를 붙여 자른다', () => {
    const result = truncateChars('가나다라마바사', 5);
    expect(result).toBe('가나다라…');
    expect([...result]).toHaveLength(5);
  });

  it('이모지를 쪼개지 않는다', () => {
    const result = truncateChars('🚀🚀🚀🚀', 3);
    expect(result).toBe('🚀🚀…');
  });
});

describe('fitTitle', () => {
  it('짧은 제목은 가장 큰 글자 크기를 쓴다', () => {
    const short = fitTitle('짧은 제목');
    const long = fitTitle(
      '한글이 두부로 나오지 않는지 확인하기 위한 정말로 길고 장황한 제목입니다 ' +
        '여기서 더 길어지면 글자 크기가 한 단계씩 줄어들어야 정상입니다',
    );
    expect(short.fontSize).toBeGreaterThan(long.fontSize);
    expect(short.estimatedLines).toBe(1);
  });

  it('허용 줄 수 안에 들어오는 가장 큰 크기를 고른다', () => {
    const fit = fitTitle('한글 제목이 두 줄 정도로 적당히 길어지는 경우를 확인한다');
    expect(fit.estimatedLines).toBeLessThanOrEqual(fit.maxLines);
  });

  it('어떤 크기로도 안 담기면 가장 작은 크기를 쓰고 던지지 않는다', () => {
    const fit = fitTitle('가'.repeat(500));
    expect(fit.fontSize).toBe(44);
    // 하드 상한까지 잘려 나온다.
    expect([...fit.text]).toHaveLength(160);
    expect(fit.text.endsWith('…')).toBe(true);
  });

  it('빈 제목도 던지지 않는다', () => {
    expect(fitTitle('').text).toBe('');
  });

  it('제목이 담기는 폭은 카드 폭에서 좌우 패딩을 뺀 값이다', () => {
    // 66px 로 1056px 안에 들어가는 한글은 15자 남짓 — 16자면 두 줄이 되어야 한다.
    expect(fitTitle('가'.repeat(15)).estimatedLines).toBe(1);
    expect(fitTitle('가'.repeat(40)).estimatedLines).toBeGreaterThan(1);
  });
});
