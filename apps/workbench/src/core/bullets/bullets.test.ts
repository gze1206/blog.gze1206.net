import { describe, expect, it } from 'vitest';

import { migrateBullet } from './migrate.js';
import { parseBulletLine, parseBullets } from './parse.js';
import { serializeBullet } from './serialize.js';
import { assertBulletId, cycleBulletType, transitionBullet } from './syntax.js';

const taskId = '01J5AR7W6M3Q9N8K2T4V1X0ZBC';
const noteId = '01J5AR7W6M3Q9N8K2T4V1X0ZBD';
const migratedId = '01J5AR7W6M3Q9N8K2T4V1X0ZBE';

describe('bullet syntax', () => {
  it('normalizes flexible whitespace and a glyphless Markdown item without changing stable ids', () => {
    const task = parseBulletLine(` -   □   공개 글 초안 정리   <!-- wb:id=${taskId} -->`);
    const glyphless = parseBulletLine(`- 손으로 쓴 메모 <!-- wb:id=${noteId} -->`);

    expect(task).toMatchObject({
      id: taskId,
      type: 'task',
      status: 'open',
      text: '공개 글 초안 정리',
    });
    expect(serializeBullet(task)).toBe(`- □ 공개 글 초안 정리 <!-- wb:id=${taskId} -->`);
    expect(glyphless).toMatchObject({ id: noteId, type: 'memo', status: 'open' });
    expect(serializeBullet(glyphless)).toBe(`- • 손으로 쓴 메모 <!-- wb:id=${noteId} -->`);
  });

  it('rejects an id-less line unless an importer explicitly supplies a stable id', () => {
    expect(() => parseBulletLine('- • 앵커 없는 메모')).toThrow('bullet id is required');
    expect(parseBulletLine('- • 가져온 메모', () => noteId)).toMatchObject({ id: noteId });
  });

  it('rejects Crockford values outside the ULID 128-bit range', () => {
    expect(() => assertBulletId('7ZZZZZZZZZZZZZZZZZZZZZZZZZ')).not.toThrow();
    expect(() => assertBulletId('80000000000000000000000000')).toThrow('invalid bullet ULID');
    expect(() => assertBulletId('Z0000000000000000000000000')).toThrow('invalid bullet ULID');
  });

  it('never serializes multiline or workbench metadata as bullet text', () => {
    for (const text of ['두 줄\n- □ 주입', '메타 <!-- wb:id=00000000000000000000000000 -->']) {
      expect(() => serializeBullet({ id: noteId, type: 'memo', status: 'open', text })).toThrow(
        'bullet text must be one line',
      );
    }
  });

  it('changes task state and type only through explicit transitions', () => {
    const parsed = parseBulletLine(`- □ 배포 확인 <!-- wb:id=${taskId} -->`);

    expect(parsed.status).toBe('open');
    expect(transitionBullet(parsed, 'complete').status).toBe('completed');
    expect(transitionBullet(parsed, 'cancel').status).toBe('cancelled');
    expect(cycleBulletType(parsed).type).toBe('memo');
    expect(parsed).toMatchObject({ type: 'task', status: 'open' });
  });

  it('does not infer or copy bullets merely because a later date is requested', () => {
    const yesterday = `# 2026-08-11\n\n- □ 남은 일 <!-- wb:id=${taskId} -->\n`;
    const today = '# 2026-08-12\n';

    expect(parseBullets(today)).toEqual([]);
    expect(today).not.toContain('migrated-from');
    expect(parseBullets(yesterday)).toHaveLength(1);
  });
});

describe('migrateBullet', () => {
  it('quick migration preserves source text and writes immutable bidirectional history comments', () => {
    const source = `# 2026-08-11\n\n- □ 남은 일 <!-- wb:id=${taskId} -->\n`;
    const target = '# 2026-08-12\n';

    const result = migrateBullet({
      source,
      target,
      sourceId: taskId,
      targetDate: '2026-08-12',
      migratedAt: '2026-08-12',
      mode: 'quick',
      createId: () => migratedId,
    });

    expect(result.source).toContain(
      `- □ 남은 일 <!-- wb:id=${taskId} --> <!-- wb:migrated-to=${migratedId} at=2026-08-12 -->`,
    );
    expect(result.target).toContain(
      `- □ 남은 일 <!-- wb:id=${migratedId} --> <!-- wb:migrated-from=${taskId} -->`,
    );
    expect(result.bullet).toMatchObject({ id: migratedId, migratedFrom: taskId });
  });

  it('intentional migration rejects a missing confirmation before changing either document', () => {
    const source = `- □ 남은 일 <!-- wb:id=${taskId} -->\n`;
    const target = '';

    expect(() =>
      migrateBullet({
        source,
        target,
        sourceId: taskId,
        targetDate: '2026-08-12',
        migratedAt: '2026-08-12',
        mode: 'intentional',
        confirmation: '   ',
        createId: () => migratedId,
      }),
    ).toThrow('confirmation is required');
    expect(source).not.toContain('migrated-to');
    expect(target).not.toContain('migrated-from');
  });
});
