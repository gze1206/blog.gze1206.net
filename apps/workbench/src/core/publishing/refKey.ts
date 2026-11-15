/**
 * 발행 산출물·브랜치 이름에 쓸 ASCII 키 (NOR-214). 릴레이는 영문·숫자 이름만 받는다(ledger·브랜치 안전).
 * 이미 ASCII 인 id 는 그대로 두고, 아닌 id 는 남는 ASCII 조각에 id 해시 10자를 붙여 겹치지 않게 한다.
 */
export function publishRefKey(id: string): string {
  const normalized = id.normalize('NFC');
  if (/^[a-z0-9][a-z0-9-]*$/u.test(normalized)) return normalized.slice(0, 64);
  const ascii = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 40);
  const hash =
    fnv1a(normalized, 0x811c9dc5).slice(0, 5) + fnv1a(normalized, 0x01000193).slice(0, 5);
  return ascii === '' ? `b-${hash}` : `${ascii}-${hash}`;
}

/**
 * FNV-1a 32비트를 16진수 8자로. core 는 브라우저에서도 쓰이므로 node:crypto 를 쓰지 않는다.
 * 이름이 겹치지 않게 구분하는 용도라 암호학적 해시일 필요는 없다.
 */
function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
