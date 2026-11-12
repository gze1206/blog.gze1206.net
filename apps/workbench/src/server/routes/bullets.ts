import { Hono } from 'hono';
import { z } from 'zod';

import { migrateBullet } from '../../core/bullets/migrate.js';
import { isCalendarDate } from '../../core/bullets/date.js';
import { parseBulletLine, parseBullets } from '../../core/bullets/parse.js';
import { serializeBullet } from '../../core/bullets/serialize.js';
import {
  assertBulletId,
  assertBulletText,
  cycleBulletType,
  transitionBullet,
  type Bullet,
} from '../../core/bullets/syntax.js';
import { parseDocument, serializeDocument } from '../../core/document/document.js';
import type { JournalStore } from '../adapters/journalStore.js';

const date = z.string().refine(isCalendarDate, 'date must use a real Gregorian YYYY-MM-DD date');
const captureSchema = z.object({
  type: z.enum(['memo', 'note', 'event', 'task']),
  text: z
    .string()
    .trim()
    .min(1)
    .max(10_000)
    .superRefine((value, context) => {
      try {
        assertBulletText(value);
      } catch (error) {
        context.addIssue({
          code: 'custom',
          message: error instanceof Error ? error.message : 'invalid bullet text',
        });
      }
    }),
});
const migrationSchema = z.object({
  sourceDate: date,
  targetDate: date,
  mode: z.enum(['quick', 'intentional']),
  confirmation: z.string().max(500).optional(),
});
const actionSchema = z.object({
  action: z.enum(['complete', 'cancel', 'reopen', 'cycle-type']),
});

export interface BulletRouteOptions {
  readonly clock: () => Date;
  readonly createId: () => string;
}

export function createBulletRoutes(store: JournalStore, options: BulletRouteOptions): Hono {
  const routes = new Hono();

  routes.get('/api/days/:date', async (context) => {
    const day = date.parse(context.req.param('date'));
    const source = await store.read(day);
    return context.json({
      date: day,
      bullets: source ? parseBullets(parseDocument(source).content) : [],
    });
  });

  routes.post('/api/days/:date/bullets', async (context) => {
    const day = date.parse(context.req.param('date'));
    const input = captureSchema.parse(await readJson(context.req.raw));
    const id = options.createId();
    assertBulletId(id);
    const bullet: Bullet = { id, type: input.type, status: 'open', text: input.text };
    await store.runExclusive(async (transaction) => {
      const existing = await transaction.read(day);
      const nextSource = appendBullet(existing ?? newJournal(day), bullet, day);
      await transaction.write(day, nextSource);
    });
    return context.json(bullet, 201);
  });

  routes.get('/api/bullets/review', async (context) => {
    const before = date.parse(context.req.query('before'));
    const journals = await store.listBefore(before);
    const bullets = journals.flatMap((journal) =>
      parseBullets(parseDocument(journal.source).content)
        .filter(
          (bullet) => bullet.type === 'task' && bullet.status === 'open' && !bullet.migratedTo,
        )
        .map((bullet) => ({ ...bullet, date: journal.date })),
    );
    return context.json({ bullets });
  });

  routes.patch('/api/days/:date/bullets/:id', async (context) => {
    const day = date.parse(context.req.param('date'));
    const id = context.req.param('id');
    assertBulletId(id);
    const input = actionSchema.parse(await readJson(context.req.raw));
    let changed: Bullet | undefined;
    await store.runExclusive(async (transaction) => {
      const source = await transaction.read(day);
      if (source === null) throw Object.assign(new Error('journal not found'), { code: 'ENOENT' });
      const document = parseDocument(source);
      const lines = document.content.split(/\r?\n/u).map((line) => {
        if (!line.includes(`wb:id=${id}`)) return line;
        const bullet = parseBulletLine(line);
        changed =
          input.action === 'cycle-type'
            ? cycleBulletType(bullet)
            : transitionBullet(bullet, input.action);
        return serializeBullet(changed);
      });
      if (!changed) throw Object.assign(new Error('bullet not found'), { code: 'ENOENT' });
      await transaction.write(
        day,
        serializeDocument({
          ...document,
          updatedAt: isoDate(options.clock()),
          content: lines.join('\n'),
        }),
      );
    });
    return context.json(changed);
  });

  routes.post('/api/bullets/:id/migrate', async (context) => {
    const sourceId = context.req.param('id');
    assertBulletId(sourceId);
    const input = migrationSchema.parse(await readJson(context.req.raw));
    if (input.sourceDate >= input.targetDate)
      throw new Error('target date must follow source date');
    const migrated = await store.runExclusive(async (transaction) => {
      const source = await transaction.read(input.sourceDate);
      if (source === null)
        throw Object.assign(new Error('source journal not found'), { code: 'ENOENT' });
      const target = (await transaction.read(input.targetDate)) ?? newJournal(input.targetDate);
      const sourceDocument = parseDocument(source);
      const targetDocument = parseDocument(target);
      const decision = migrateBullet({
        source: sourceDocument.content,
        target: targetDocument.content,
        sourceId,
        targetDate: input.targetDate,
        migratedAt: isoDate(options.clock()),
        mode: input.mode,
        ...(input.confirmation === undefined ? {} : { confirmation: input.confirmation }),
        createId: options.createId,
      });
      const sourceResult = serializeDocument({
        ...sourceDocument,
        updatedAt: isoDate(options.clock()),
        content: decision.source,
      });
      const targetResult = serializeDocument({
        ...targetDocument,
        updatedAt: isoDate(options.clock()),
        content: decision.target,
      });
      await transaction.writeMigration(
        input.sourceDate,
        sourceResult,
        input.targetDate,
        targetResult,
      );
      return decision;
    });
    return context.json(migrated.bullet, 201);
  });

  return routes;
}

function newJournal(day: string): string {
  return `---\ntitle: ${day}\nkind: journal\ncreatedAt: ${day}\nupdatedAt: ${day}\ndate: ${day}\n---\n# ${day}\n`;
}

function appendBullet(source: string, bullet: Bullet, updatedAt: string): string {
  const document = parseDocument(source);
  const prefix = document.content.endsWith('\n') ? document.content : `${document.content}\n`;
  return serializeDocument({
    ...document,
    updatedAt,
    content: `${prefix}${serializeBullet(bullet)}\n`,
  });
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
