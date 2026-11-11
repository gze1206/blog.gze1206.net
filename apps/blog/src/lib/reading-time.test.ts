import { describe, expect, it } from 'vitest';
import { estimateReadingTime } from './reading-time';

/** 분당 500자 기준이므로 500자면 1분, 1500자면 3분. */
function korean(chars: number): string {
  return '가'.repeat(chars);
}

/** 분당 200단어 기준. */
function english(words: number): string {
  return Array.from({ length: words }, (_, i) => `word${i}`).join(' ');
}

describe('estimateReadingTime', () => {
  it('빈 본문도 0분이 되지 않는다', () => {
    for (const empty of ['', '   \n\n', undefined]) {
      const result = estimateReadingTime(empty);
      expect(result.minutes).toBe(1);
      expect(result.label).toBe('1분 미만');
      expect(result.iso).toBe('PT1M');
    }
  });

  it('한 문장짜리 글은 "1분 미만" 으로 표기한다', () => {
    const result = estimateReadingTime('블로그를 새로 만들었습니다.');
    expect(result.seconds).toBeLessThan(60);
    expect(result.label).toBe('1분 미만');
    expect(result.minutes).toBe(1);
  });

  it('한글은 분당 500자로 센다', () => {
    expect(estimateReadingTime(korean(500)).minutes).toBe(1);
    expect(estimateReadingTime(korean(1500)).minutes).toBe(3);
    expect(estimateReadingTime(korean(1500)).label).toBe('약 3분');
  });

  it('영문은 분당 200단어로 센다', () => {
    expect(estimateReadingTime(english(200)).minutes).toBe(1);
    expect(estimateReadingTime(english(600)).minutes).toBe(3);
  });

  it('한글을 영어 단어처럼 세지 않는다', () => {
    // 같은 "글자 수"라도 한글 500자와 영문 500단어는 읽기 시간이 다르다.
    const koreanOnly = estimateReadingTime(korean(1000));
    const englishOnly = estimateReadingTime(english(1000));
    expect(koreanOnly.minutes).toBe(2);
    expect(englishOnly.minutes).toBe(5);
  });

  it('한글·영문 혼합은 각각의 속도로 더한다', () => {
    // 한글 500자(1분) + 영문 200단어(1분) = 2분
    const mixed = estimateReadingTime(`${korean(500)}\n\n${english(200)}`);
    expect(mixed.minutes).toBe(2);
  });

  it('코드블럭은 산문 글자 수에 섞지 않고 줄 수로 가산한다', () => {
    const code = [
      '```ts',
      ...Array.from({ length: 20 }, (_, i) => `const v${i} = ${i};`),
      '```',
    ].join('\n');
    // 20줄 ÷ 40줄/분 = 0.5분. 산문으로 셌다면 훨씬 크게 나온다.
    const result = estimateReadingTime(code);
    expect(result.seconds).toBeCloseTo(30, 0);
  });

  it('아주 긴 코드블럭 하나가 추정치를 무한정 밀어 올리지 않는다', () => {
    const long = ['```ts', ...Array.from({ length: 400 }, (_, i) => `line ${i}`), '```'].join('\n');
    // 블럭당 30줄 상한 → 45초.
    expect(estimateReadingTime(long).seconds).toBeCloseTo(45, 0);
  });

  it('닫히지 않은 코드블럭도 코드로 센다', () => {
    const unterminated = ['```ts', 'const a = 1;', 'const b = 2;'].join('\n');
    expect(estimateReadingTime(unterminated).seconds).toBeCloseTo(3, 0);
  });

  it('코드블럭 안의 다른 펜스 문자는 코드의 일부다', () => {
    const nested = ['````md', '```ts', 'const a = 1;', '```', '````'].join('\n');
    // 3줄 × 1.5초 = 4.5초. 안쪽 ``` 에서 블럭이 끝났다면 뒤 줄이 산문으로 새어 나온다.
    expect(estimateReadingTime(nested).seconds).toBeCloseTo(4.5, 1);
  });

  it('프론트매터는 본문 분량이 아니다', () => {
    const withFrontmatter = `---\ntitle: '${korean(200)}'\ndraft: false\n---\n\n${korean(500)}`;
    expect(estimateReadingTime(withFrontmatter).minutes).toBe(1);
  });

  it('수식·이미지 캡션·인라인 코드는 산문에서 뺀다', () => {
    const noisy = [
      korean(500),
      '$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$',
      '![아주 긴 이미지 대체 텍스트가 여기에 들어간다](/images/foo.png)',
      '`const someVeryLongIdentifier = 1;`',
      '인라인 수식 $E = mc^2$ 도 마찬가지다.',
    ].join('\n\n');
    // 한글 500자 + "인라인 수식 도 마찬가지다." 정도만 남는다 → 1분.
    expect(estimateReadingTime(noisy).minutes).toBe(1);
  });

  it('Markdoc 태그는 마커만 걷어내고 안의 산문은 센다', () => {
    const markdoc = `{% callout type="warning" title="${korean(300)}" %}\n${korean(1000)}\n{% /callout %}`;
    // 속성값 300자는 세지 않고 본문 1000자만 센다 → 2분.
    expect(estimateReadingTime(markdoc).minutes).toBe(2);
  });

  it('링크는 표시 텍스트만 세고 URL 은 버린다', () => {
    const withLink = `[${korean(500)}](https://example.com/a/very/long/path/that/should/not/count)`;
    expect(estimateReadingTime(withLink).minutes).toBe(1);
  });

  it('ISO 8601 duration 을 함께 돌려준다 (JSON-LD timeRequired 대비)', () => {
    expect(estimateReadingTime(korean(1500)).iso).toBe('PT3M');
    expect(estimateReadingTime('짧다').iso).toBe('PT1M');
  });

  it('같은 본문은 항상 같은 결과다 (결정적)', () => {
    const body = `## 제목\n\n${korean(700)}\n\n\`\`\`ts\nconst a = 1;\n\`\`\`\n`;
    expect(estimateReadingTime(body)).toEqual(estimateReadingTime(body));
  });
});
