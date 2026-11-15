import { describe, expect, it } from 'vitest';

describe('포트폴리오 대표 이미지', () => {
  it('NOR-222 AC-3: 썸네일이 있으면 파일에서 읽은 크기와 함께 대표 이미지로 쓴다', async () => {
    const mod = await import('./portfolio-cover');
    expect(mod).toHaveProperty('portfolioCover');
    const sizes: Record<string, { width: number; height: number }> = {
      '/img/portfolio/a.webp': { width: 1200, height: 675 },
    };
    const read = async (src: string) => sizes[src] ?? null;
    await expect(
      mod.portfolioCover({ title: 'Boss Toss', thumbnail: '/img/portfolio/a.webp' }, read),
    ).resolves.toEqual({
      src: '/img/portfolio/a.webp',
      alt: 'Boss Toss 대표 이미지',
      width: 1200,
      height: 675,
    });
    await expect(mod.portfolioCover({ title: 't' }, read)).resolves.toBeNull();
    await expect(
      mod.portfolioCover({ title: 't', thumbnail: '/img/portfolio/missing.webp' }, read),
    ).resolves.toBeNull();
  });
});
