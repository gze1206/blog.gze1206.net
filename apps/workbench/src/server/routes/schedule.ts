/** 일정 API(NOR-242). */
import { Hono, type Context } from 'hono';
import { z } from 'zod';

import { isCalendarDate } from '../../core/bullets/date.js';
import { parseBulletLine } from '../../core/bullets/parse.js';
import { assertBulletId } from '../../core/bullets/syntax.js';
import { parseDocument, serializeDocument } from '../../core/document/document.js';
import {
  SCHEDULE_ID_PATTERN,
  ScheduleValidationError,
  dayNumber,
  expandSchedule,
  planDelete,
  planEdit,
  setCompleted,
  validateEventInput,
  type ScheduleEvent,
} from '../../core/schedule/index.js';
import type { JournalStore } from '../adapters/journalStore.js';
import type { ScheduleStore } from '../adapters/scheduleStore.js';

const MAX_RANGE_DAYS = 400;
const date = z.string().refine(isCalendarDate, 'date must be YYYY-MM-DD');
const scope = z.enum(['this', 'following', 'all']);
const editSchema = z.object({ scope, occurrenceDate: date, event: z.unknown() }).strict();
const completionSchema = z.object({ date, completed: z.boolean() }).strict();

export interface ScheduleRouteOptions {
  readonly createId: () => string;
  /** 일지의 ○ 불렛을 일정으로 옮길 때 쓴다(NOR-248). 없으면 그 경로를 열지 않는다. */
  readonly journal?: JournalStore;
  readonly clock?: () => Date;
}

class NotFound extends Error {}

function invalid(context: Context, message: string) {
  return context.json({ error: { code: 'invalid_request', message } }, 400);
}

export function createScheduleRoutes(store: ScheduleStore, options: ScheduleRouteOptions): Hono {
  const routes = new Hono();

  routes.onError((error, context) => {
    if (error instanceof ScheduleValidationError || error instanceof z.ZodError)
      return invalid(context, error.message);
    if (error instanceof NotFound)
      return context.json({ error: { code: 'not_found', message: 'Event not found' } }, 404);
    throw error;
  });

  routes.get('/api/schedule', async (context) => {
    const from = date.safeParse(context.req.query('from'));
    const to = date.safeParse(context.req.query('to'));
    if (!from.success || !to.success) return invalid(context, 'from and to must be dates');
    const span = dayNumber(to.data) - dayNumber(from.data);
    if (span < 0 || span > MAX_RANGE_DAYS)
      return invalid(context, `range must be 0 to ${MAX_RANGE_DAYS} days`);
    const { events, problems } = await store.list();
    return context.json({ occurrences: expandSchedule(events, from.data, to.data), problems });
  });

  routes.get('/api/schedule/events/:id', async (context) => {
    const event = await store.read(eventId(context.req.param('id')));
    if (event === null) throw new NotFound();
    return context.json(event);
  });

  routes.post('/api/schedule/events', async (context) => {
    const input = validateEventInput(await readJson(context.req.raw));
    const event: ScheduleEvent = { id: options.createId(), ...input };
    await store.runExclusive(async (transaction) => {
      if ((await transaction.read(event.id)) !== null) throw new Error('schedule id collision');
      await transaction.write(event);
    });
    return context.json(event, 201);
  });

  routes.put('/api/schedule/events/:id', async (context) => {
    const id = eventId(context.req.param('id'));
    const body = editSchema.parse(await readJson(context.req.raw));
    const next = validateEventInput(body.event);
    const plan = await store.runExclusive(async (transaction) => {
      const current = await transaction.read(id);
      if (current === null) throw new NotFound();
      const result = planEdit(current, body.scope, body.occurrenceDate, next, options.createId());
      if (result.update) await transaction.write(result.update);
      if (result.create) await transaction.write(result.create);
      return result;
    });
    return context.json(plan);
  });

  routes.post('/api/schedule/events/:id/completion', async (context) => {
    const id = eventId(context.req.param('id'));
    const body = completionSchema.parse(await readJson(context.req.raw));
    const updated = await store.runExclusive(async (transaction) => {
      const current = await transaction.read(id);
      if (current === null) throw new NotFound();
      const next = setCompleted(current, body.date, body.completed);
      await transaction.write(next);
      return next;
    });
    return context.json(updated);
  });

  const journal = options.journal;
  if (journal) {
    // 일지의 ○ 불렛을 같은 날짜의 종일 일정으로 옮긴다(NOR-248).
    // 두 저장소가 같은 작업 공간 잠금을 쓰므로 겹쳐 잡지 않는다: 일정을 먼저 만들고 불렛을 지운다.
    routes.post('/api/days/:date/bullets/:bulletId/schedule', async (context) => {
      const day = date.parse(context.req.param('date'));
      const bulletId = context.req.param('bulletId');
      try {
        assertBulletId(bulletId);
      } catch {
        throw new ScheduleValidationError('invalid bullet id');
      }
      const source = await journal.read(day);
      const line = source
        ?.split(/\r?\n/u)
        .find((candidate) => candidate.includes(`wb:id=${bulletId}`));
      if (source === null || line === undefined) throw new NotFound();
      const bullet = parseBulletLine(line);
      if (bullet.type !== 'event')
        throw new ScheduleValidationError('only event bullets can be scheduled');
      const event: ScheduleEvent = {
        id: options.createId(),
        ...validateEventInput({ title: bullet.text, date: day }),
      };
      await store.runExclusive((transaction) => transaction.write(event));
      await journal.runExclusive(async (transaction) => {
        const current = await transaction.read(day);
        if (current === null) return;
        const document = parseDocument(current);
        const content = document.content
          .split(/\r?\n/u)
          .filter((candidate) => !candidate.includes(`wb:id=${bulletId}`))
          .join('\n');
        if (content === document.content) return;
        const now = (options.clock ?? (() => new Date()))().toISOString().slice(0, 10);
        await transaction.write(day, serializeDocument({ ...document, updatedAt: now, content }));
      });
      return context.json(event, 201);
    });
  }

  routes.delete('/api/schedule/events/:id', async (context) => {
    const id = eventId(context.req.param('id'));
    const chosen = scope.parse(context.req.query('scope'));
    const occurrenceDate = date.parse(context.req.query('date'));
    await store.runExclusive(async (transaction) => {
      const current = await transaction.read(id);
      if (current === null) throw new NotFound();
      const result = planDelete(current, chosen, occurrenceDate);
      if (result.remove) await transaction.remove(id);
      else if (result.update) await transaction.write(result.update);
    });
    return context.body(null, 204);
  });

  return routes;
}

function eventId(value: string): string {
  if (!SCHEDULE_ID_PATTERN.test(value)) throw new ScheduleValidationError('invalid schedule id');
  return value;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ScheduleValidationError('request body must be JSON');
  }
}
