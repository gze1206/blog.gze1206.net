import type { Bullet } from './syntax.js';
import { parseBulletLine } from './parse.js';
import { serializeBullet } from './serialize.js';
import { assertBulletId } from './syntax.js';
import { assertCalendarDate } from './date.js';

export interface MigrationInput {
  readonly source: string;
  readonly target: string;
  readonly sourceId: string;
  readonly targetDate: string;
  readonly migratedAt: string;
  readonly mode: 'quick' | 'intentional';
  readonly confirmation?: string;
  readonly createId: () => string;
}

export interface MigrationResult {
  readonly source: string;
  readonly target: string;
  readonly bullet: Bullet;
}

export function migrateBullet(_input: MigrationInput): MigrationResult {
  const input = _input;
  if (input.mode === 'intentional' && !input.confirmation?.trim()) {
    throw new Error('confirmation is required for intentional migration');
  }
  assertCalendarDate(input.targetDate);
  assertCalendarDate(input.migratedAt);
  assertBulletId(input.sourceId);

  const lines = input.source.split(/\r?\n/u);
  const sourceIndex = lines.findIndex((line) =>
    new RegExp(`<!--\\s*wb:id=${input.sourceId}\\s*-->`, 'u').test(line),
  );
  if (sourceIndex < 0) throw new Error('source bullet not found');
  const sourceBullet = parseBulletLine(lines[sourceIndex] ?? '');
  if (sourceBullet.migratedTo) throw new Error('source bullet was already migrated');

  const newId = input.createId();
  assertBulletId(newId);
  const migrated: Bullet = {
    id: newId,
    type: sourceBullet.type,
    status: sourceBullet.status,
    text: sourceBullet.text,
    migratedFrom: sourceBullet.id,
  };
  const sourceWithHistory: Bullet = {
    ...sourceBullet,
    migratedTo: { id: newId, at: input.migratedAt },
  };
  lines[sourceIndex] = serializeBullet(sourceWithHistory);

  const targetPrefix =
    input.target.length === 0 || input.target.endsWith('\n') ? input.target : `${input.target}\n`;
  return {
    source: `${lines.join('\n')}${input.source.endsWith('\n') ? '\n' : ''}`,
    target: `${targetPrefix}${serializeBullet(migrated)}\n`,
    bullet: migrated,
  };
}
