import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP = fileURLToPath(new URL('../../', import.meta.url));
const PUBLIC = `${APP}public/`;

interface ManifestIcon {
  readonly src: string;
  readonly sizes: string;
  readonly type: string;
  readonly purpose?: string;
}

function readManifest(): Record<string, unknown> | null {
  const path = `${PUBLIC}manifest.webmanifest`;
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>)
    : null;
}

/** PNG 머리(IHDR)에서 너비·높이를 읽는다. */
function pngSize(path: string): [number, number] {
  const bytes = readFileSync(path);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe('워크벤치 설치 (NOR-232)', () => {
  it('NOR-232 AC-1: manifest 가 설치에 필요한 값과 아이콘을 갖는다', () => {
    const manifest = readManifest();
    expect(manifest).not.toBeNull();
    expect(manifest).toMatchObject({
      name: expect.any(String),
      short_name: expect.any(String),
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: expect.stringMatching(/^#[0-9a-f]{6}$/iu),
      background_color: expect.stringMatching(/^#[0-9a-f]{6}$/iu),
    });
    const icons = (manifest?.['icons'] ?? []) as ManifestIcon[];
    const any = icons.filter((icon) => (icon.purpose ?? 'any') === 'any').map((icon) => icon.sizes);
    expect(any).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(icons.some((icon) => icon.purpose === 'maskable' && icon.sizes === '512x512')).toBe(
      true,
    );
    for (const icon of icons) {
      const path = `${PUBLIC}${icon.src.replace(/^\//u, '')}`;
      expect(existsSync(path), icon.src).toBe(true);
      expect(pngSize(path).join('x')).toBe(icon.sizes);
    }
  });

  it('NOR-232 AC-2: index.html 이 manifest 와 아이콘, 테마 색을 연결한다', () => {
    const html = readFileSync(`${APP}index.html`, 'utf8');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"');
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/icon\.svg"/u);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/u);
    expect(html).toMatch(/<meta name="theme-color" media="\(prefers-color-scheme: light\)"/u);
    expect(html).toMatch(/<meta name="theme-color" media="\(prefers-color-scheme: dark\)"/u);
    for (const file of ['icon.svg', 'apple-touch-icon.png'])
      expect(existsSync(`${PUBLIC}${file}`), file).toBe(true);
    expect(pngSize(`${PUBLIC}apple-touch-icon.png`)).toEqual([180, 180]);
  });

  it('NOR-232 AC-3: service worker 를 등록하지 않는다', () => {
    const html = readFileSync(`${APP}index.html`, 'utf8');
    const main = readFileSync(`${APP}src/web/main.tsx`, 'utf8');
    expect(`${html}\n${main}`).not.toMatch(/serviceWorker/u);
    expect(existsSync(`${PUBLIC}sw.js`)).toBe(false);
  });

  it('NOR-232 AC-4: 운영 문서에 Tailscale Services 로 옮기고 되돌리는 절차가 있다', () => {
    const doc = readFileSync(`${APP}../../docs/operations/workbench/oci.md`, 'utf8');
    expect(doc).toContain(
      'tailscale serve --service=svc:workbench --https=443 http://127.0.0.1:3000',
    );
    expect(doc).toContain('tailscale serve --service=svc:workbench --https=443 off');
    expect(doc).toContain('tailscale serve --https=8443 off');
  });
});
