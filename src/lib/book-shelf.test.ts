import { describe, expect, it } from 'vitest';
import { SPINE_TONE_COUNT, spineTitle, spineTone } from './book-shelf';

describe('spineTone', () => {
  it('같은 제목은 언제나 같은 색이다', () => {
    expect(spineTone('사피엔스')).toBe(spineTone('사피엔스'));
  });

  it('정해 둔 색 범위를 벗어나지 않는다', () => {
    const titles = ['사피엔스', '니체의 초월자', 'Crime and Punishment', '', '연금술사', '1984'];
    for (const title of titles) {
      const tone = spineTone(title);
      expect(tone).toBeGreaterThanOrEqual(1);
      expect(tone).toBeLessThanOrEqual(SPINE_TONE_COUNT);
    }
  });

  it('색이 한 쪽으로 쏠리지 않는다', () => {
    const tones = new Set(
      ['사피엔스', '니체의 초월자', '연금술사', '데미안', '토지', '1984', '멋진 신세계'].map(
        spineTone,
      ),
    );
    expect(tones.size).toBeGreaterThan(1);
  });
});

describe('spineTitle', () => {
  it('부제는 떼고 본 제목만 세운다', () => {
    expect(spineTitle('사피엔스: 유인원에서 사이보그까지')).toBe('사피엔스');
    expect(spineTitle('클린 코드 — 애자일 소프트웨어 장인 정신')).toBe('클린 코드');
  });

  it('부제 없이도 긴 제목은 줄인다', () => {
    expect(spineTitle('가'.repeat(40))).toBe(`${'가'.repeat(23)}…`);
  });

  it('짧은 제목은 그대로 둔다', () => {
    expect(spineTitle('토지')).toBe('토지');
  });
});
