import { describe, expect, it } from 'vitest';

const doc = (body: string) =>
  `---\ntitle: 글\nkind: private-post\ncreatedAt: 2026-11-15\nupdatedAt: 2026-11-15\n---\n${body}`;

describe('renderPreview', () => {
  it('NOR-206 AC-1: frontmatter 를 빼고 본문을 렌더하며 원시 HTML·위험한 주소를 막는다', async () => {
    const mod = await import('./render.js');
    expect(mod).toHaveProperty('renderPreview');
    const { html } = mod.renderPreview(
      doc(
        '# 제목\n\n본문 **굵게**\n\n<script>alert(1)</script>\n\n[위험](javascript:alert(1)) [안전](https://example.com)\n',
      ),
    );
    expect(html).toContain('<h1');
    expect(html).toContain('<strong>굵게</strong>');
    expect(html).not.toContain('title: 글');
    expect(html).not.toContain('<script>');
    // 글자로는 남을 수 있지만 링크가 되면 안 된다.
    expect(html).not.toMatch(/href="\s*javascript:/iu);
    expect(html).toContain('href="https://example.com"');
  });

  it('NOR-206 AC-2: bookquote 를 책 문서의 구절과 출처로 펼치고, 못 펼치면 경고한다', async () => {
    const mod = await import('./render.js');
    expect(mod).toHaveProperty('renderPreview');
    const book = {
      kind: 'book',
      title: '니체의 초월자',
      authors: ['프리드리히 니체'],
      translators: ['김철'],
      excerpts: [
        { id: '01J00000000000000000000001', text: '너 자신이 되어라.', page: 42, public: true },
      ],
    };
    const ok = mod.renderPreview(
      doc('{% bookquote book="니체의-초월자" excerpt="01J00000000000000000000001" /%}\n'),
      { lookupBook: (id: string) => (id === '니체의-초월자' ? (book as never) : undefined) },
    );
    expect(ok.html).toContain('class="bookquote"');
    expect(ok.html).toContain('너 자신이 되어라.');
    expect(ok.html).toContain('『니체의 초월자』');
    expect(ok.warnings).toEqual([]);
    const missing = mod.renderPreview(
      doc('{% bookquote book="없는-책" excerpt="01J00000000000000000000001" /%}\n'),
    );
    expect(missing.warnings.length).toBeGreaterThan(0);
  });

  it('NOR-206 AC-3: 블로그 태그를 오류 없이 그린다', async () => {
    const mod = await import('./render.js');
    expect(mod).toHaveProperty('renderPreview');
    const { html, warnings } = mod.renderPreview(
      doc(
        [
          '{% callout type="note" title="참고" %}\n안내\n{% /callout %}',
          '{% bookmark url="https://example.com" /%}',
          '{% github repo="gze1206/blog.gze1206.net" /%}',
          '{% math formula="a^2" /%}',
          '{% mathblock formula="E=mc^2" /%}',
          '{% youtube id="abc" /%}',
        ].join('\n\n'),
      ),
    );
    expect(warnings).toEqual([]);
    expect(html).toContain('참고');
    expect(html).toContain('https://example.com');
    expect(html).toContain('gze1206/blog.gze1206.net');
  });
});
