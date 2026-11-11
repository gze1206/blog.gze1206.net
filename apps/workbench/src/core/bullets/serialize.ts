import { assertBulletText, type Bullet } from './syntax.js';

const typeGlyph = { memo: '•', note: '–', event: '○', task: '□' } as const;

export function serializeBullet(bullet: Bullet): string {
  assertBulletText(bullet.text);
  const glyph =
    bullet.status === 'completed'
      ? '▣'
      : bullet.status === 'cancelled'
        ? '⨯'
        : typeGlyph[bullet.type];
  const history = [
    bullet.migratedFrom ? `<!-- wb:migrated-from=${bullet.migratedFrom} -->` : '',
    bullet.migratedTo
      ? `<!-- wb:migrated-to=${bullet.migratedTo.id} at=${bullet.migratedTo.at} -->`
      : '',
  ].filter(Boolean);
  return `- ${glyph} ${bullet.text} <!-- wb:id=${bullet.id} -->${history.length ? ` ${history.join(' ')}` : ''}`;
}
