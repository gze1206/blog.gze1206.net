import { assertBulletId, assertBulletText, type Bullet, type BulletType } from './syntax.js';

const glyphs: Record<string, { readonly type: BulletType; readonly status: Bullet['status'] }> = {
  '•': { type: 'memo', status: 'open' },
  '–': { type: 'note', status: 'open' },
  '○': { type: 'event', status: 'open' },
  '□': { type: 'task', status: 'open' },
  '▣': { type: 'task', status: 'completed' },
  '⨯': { type: 'task', status: 'cancelled' },
};

export function parseBulletLine(line: string, createId?: () => string): Bullet {
  const item = /^\s*-\s*(?:(?<glyph>[•–○□▣⨯])\s*)?(?<rest>.*?)\s*$/u.exec(line);
  if (!item?.groups) throw new Error('invalid bullet line');
  const parsedId = /<!--\s*wb:id=(?<id>[0-7][0-9A-HJKMNP-TV-Z]{25})\s*-->/u.exec(line)?.groups?.id;
  const id = parsedId ?? createId?.();
  if (!id) throw new Error('bullet id is required');
  assertBulletId(id);
  const migratedFrom = /<!--\s*wb:migrated-from=(?<id>[0-7][0-9A-HJKMNP-TV-Z]{25})\s*-->/u.exec(
    line,
  )?.groups?.id;
  const migratedTo =
    /<!--\s*wb:migrated-to=(?<id>[0-7][0-9A-HJKMNP-TV-Z]{25})\s+at=(?<at>\d{4}-\d{2}-\d{2})\s*-->/u.exec(
      line,
    )?.groups;
  const text = (item.groups.rest ?? '').replace(/\s*<!--\s*wb:[^>]+-->\s*/gu, ' ').trim();
  assertBulletText(text);
  const syntax = glyphs[item.groups.glyph ?? '•'] ?? glyphs['•'];
  if (!syntax) throw new Error('unsupported bullet glyph');
  return {
    id,
    type: syntax.type,
    status: syntax.status,
    text,
    ...(migratedFrom ? { migratedFrom } : {}),
    ...(migratedTo?.id && migratedTo.at
      ? { migratedTo: { id: migratedTo.id, at: migratedTo.at } }
      : {}),
  };
}

export function parseBullets(source: string, createId?: () => string): Bullet[] {
  return source
    .split(/\r?\n/u)
    .filter((line) => /^\s*-\s+/u.test(line))
    .map((line) => parseBulletLine(line, createId));
}
