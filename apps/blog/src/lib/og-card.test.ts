import { describe, expect, it } from 'vitest';
import {
  buildOgCard,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_THEME,
  type OgCardInput,
  type OgChild,
  type OgNode,
} from './og-card';

const BRAND = 'gze1206.net';

function base(overrides: Partial<OgCardInput> = {}): OgCardInput {
  return { kind: 'post', title: '한글 제목', brand: BRAND, ...overrides };
}

/** 트리에서 텍스트 자식만 모은다(구조가 바뀌어도 "무엇이 보이는가"는 검사할 수 있게). */
function collectText(node: OgChild): string[] {
  if (typeof node === 'string') return [node];
  const children = node.props.children;
  if (children === undefined) return [];
  const list = Array.isArray(children) ? children : [children as OgChild];
  return list.flatMap((child) => collectText(child));
}

function findStyled(node: OgChild, key: string): Readonly<Record<string, string | number>>[] {
  if (typeof node === 'string') return [];
  const style = node.props.style;
  const self = style !== undefined && key in style ? [style] : [];
  const children = node.props.children;
  if (children === undefined) return self;
  const list = Array.isArray(children) ? children : [children as OgChild];
  return [...self, ...list.flatMap((child) => findStyled(child, key))];
}

describe('규격', () => {
  it('1200×630 이다 (og:image 표준)', () => {
    expect(OG_IMAGE_WIDTH).toBe(1200);
    expect(OG_IMAGE_HEIGHT).toBe(630);
  });
});

describe('buildOgCard', () => {
  it('글 카드는 제목·시리즈·브랜드를 담는다', () => {
    const texts = collectText(buildOgCard(base({ eyebrow: '시리즈 · Astro 가이드' })));
    expect(texts).toContain('한글 제목');
    expect(texts).toContain('시리즈 · Astro 가이드');
    expect(texts).toContain(BRAND);
  });

  it('시리즈가 없으면 라벨 줄 자체가 없다', () => {
    const texts = collectText(buildOgCard(base()));
    expect(texts).toEqual(['한글 제목', BRAND]);
  });

  it('글 카드는 설명을 넣지 않는다 (제목·시리즈·브랜드만)', () => {
    const texts = collectText(buildOgCard(base({ description: '이 설명은 카드에 안 나온다' })));
    expect(texts).not.toContain('이 설명은 카드에 안 나온다');
  });

  it('목록 카드는 라벨·제목·설명·브랜드를 담는다', () => {
    const texts = collectText(
      buildOgCard(
        base({ kind: 'list', eyebrow: '카테고리', title: '개발', description: '글 3개' }),
      ),
    );
    expect(texts).toEqual(['카테고리', '개발', '글 3개', BRAND]);
  });

  it('About 카드도 같은 골격으로 만들어진다 (NOR-21 이 붙일 자리)', () => {
    const texts = collectText(
      buildOgCard(
        base({ kind: 'about', eyebrow: '소개', title: 'gze1206', description: '개발자' }),
      ),
    );
    expect(texts).toEqual(['소개', 'gze1206', '개발자', BRAND]);
  });

  it('긴 제목은 글자 크기가 줄고 clamp 가 걸린다', () => {
    const short = buildOgCard(base({ title: '짧은 제목' }));
    const long = buildOgCard(
      base({ title: '아주 긴 한글 제목을 넣어서 글자 크기가 줄어드는지 본다 '.repeat(3) }),
    );
    const [shortStyle] = findStyled(short, 'lineClamp');
    const [longStyle] = findStyled(long, 'lineClamp');
    expect(shortStyle?.lineClamp).toBe(3);
    expect(Number(longStyle?.fontSize)).toBeLessThan(Number(shortStyle?.fontSize));
  });

  it('아주 긴 라벨·설명은 … 로 잘린다', () => {
    const texts = collectText(
      buildOgCard(
        base({
          kind: 'list',
          eyebrow: '라'.repeat(80),
          title: '제목',
          description: '설'.repeat(200),
        }),
      ),
    );
    expect(texts.some((text) => text.endsWith('…'))).toBe(true);
    for (const text of texts) expect([...text].length).toBeLessThanOrEqual(160);
  });

  it('여러 자식을 가진 요소는 display 가 지정돼 있다 (Satori 제약)', () => {
    const walk = (node: OgChild): void => {
      if (typeof node === 'string') return;
      const children = node.props.children;
      if (children === undefined) return;
      expect(node.props.style?.display).toBeDefined();
      const list = Array.isArray(children) ? children : [children as OgChild];
      list.forEach(walk);
    };
    walk(buildOgCard(base({ kind: 'list', eyebrow: '태그', description: '설명' })));
  });

  it('색은 테마 토큰에서만 온다 (NOR-24 에서 한 곳만 갈아끼우면 된다)', () => {
    const card: OgNode = buildOgCard(base({ eyebrow: '시리즈' }));
    const palette = new Set<unknown>(Object.values(OG_THEME));
    for (const style of findStyled(card, 'color')) expect(palette.has(style.color)).toBe(true);
    for (const style of findStyled(card, 'backgroundColor')) {
      expect(palette.has(style.backgroundColor)).toBe(true);
    }
  });
});
